"""
APScheduler integration — AsyncIOScheduler backed by a persistent PostgreSQL
job store so scheduled jobs survive restarts and are shared across workers.

Jobs (FYP scope):
    - medication reminders (per schedule)
    - missed-medication detection (daily rollup)
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SchedulerState:
    """Live status snapshot for diagnostics."""

    running: bool = False
    job_count: int = 0
    jobs: list[dict[str, object]] = field(default_factory=list)
    jobstore: str = "default"
    last_error: str | None = None


class AppScheduler:
    """Wrapper around AsyncIOScheduler with a PostgreSQL job store."""

    def __init__(self) -> None:
        self.scheduler: AsyncIOScheduler | None = None
        self.jobstore_url: str = settings.SCHEDULER_JOBSTORE_URL or settings.DATABASE_URL
        if self.jobstore_url.startswith("postgresql+asyncpg://"):
            self.jobstore_url = self.jobstore_url.replace("+asyncpg", "")
        self.state = SchedulerState()

    def start(self) -> None:
        """Create the scheduler with a PostgreSQL job store and start it."""
        if not settings.SCHEDULER_ENABLED:
            logger.info("APScheduler disabled via SCHEDULER_ENABLED=false")
            self.state.running = False
            return

        from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

        jobstore = SQLAlchemyJobStore(
            url=self.jobstore_url,
            tablename="apscheduler_jobs",
        )
        # APScheduler 3.x does not auto-create its table; ensure it exists.
        # (no-op when the Alembic migration already created it)
        jobstore.jobs_t.create(bind=jobstore.engine, checkfirst=True)
        self.scheduler = AsyncIOScheduler(
            jobstores={"default": jobstore},
            timezone="UTC",
        )
        self._register_jobs()
        self.scheduler.start()
        self.state.running = True
        self.state.jobstore = self.jobstore_url.split("@")[-1]
        logger.info("APScheduler started", extra={"jobstore": self.jobstore_url})

    def _register_jobs(self) -> None:
        if self.scheduler is None:
            return
        self.scheduler.add_job(
            medication_reminder_job,
            CronTrigger(minute="*"),
            id="medication-reminders",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        self.scheduler.add_job(
            missed_med_detection_job,
            CronTrigger(hour=0, minute=5),
            id="missed-med-detection",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )

    async def refresh_state(self) -> SchedulerState:
        """Refresh the diagnostics snapshot from the live scheduler."""
        if self.scheduler is None or not self.scheduler.running:
            self.state = SchedulerState(running=False)
            return self.state

        jobs: list[dict[str, object]] = []
        for job in self.scheduler.get_jobs():
            jobs.append(
                {
                    "id": job.id,
                    "next_run_time": (
                        job.next_run_time.isoformat() if job.next_run_time else None
                    ),
                    "trigger": str(job.trigger),
                }
            )
        self.state = SchedulerState(
            running=True,
            job_count=len(jobs),
            jobs=jobs,
            jobstore=self.jobstore_url.split("@")[-1],
        )
        return self.state

    async def shutdown(self) -> None:
        """Gracefully stop the scheduler."""
        if self.scheduler is not None:
            self.scheduler.shutdown(wait=False)
            self.scheduler = None
            self.state.running = False
            logger.info("APScheduler stopped")


_scheduler: AppScheduler | None = None


def get_scheduler() -> AppScheduler:
    """Return the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AppScheduler()
    return _scheduler


# ------------------------------------------------------------------
# Job bodies (pure async, mock-friendly for tests)
# ------------------------------------------------------------------

async def medication_reminder_job() -> None:
    """Send pending medication reminders."""
    from app.db.session import SessionLocal
    from app.models.medication import MedicationSchedule, Medication
    from app.models.user import User
    from app.services.notification import dispatch_notification

    now = datetime.now(timezone.utc)
    current_time = now.time().replace(second=0, microsecond=0)
    current_day = now.strftime("%A").upper()

    async with SessionLocal() as db:
        # Find all active schedules due right now
        result = await db.execute(
            select(MedicationSchedule, Medication, User)
            .join(Medication, MedicationSchedule.medication_id == Medication.id)
            .join(User, Medication.user_id == User.id)
            .where(MedicationSchedule.reminder_enabled == True)
            .where(Medication.is_active == True)
        )
        rows = result.all()

        for schedule, med, user in rows:
            # Match time
            sched_time = schedule.scheduled_time.replace(second=0, microsecond=0)
            if sched_time != current_time:
                continue

            # Match day
            if schedule.days_of_week and current_day not in schedule.days_of_week:
                continue

            # Dispatch
            message = f"Reminder: It's time to take your medication '{med.name}' (Dose: {med.dosage})."
            await dispatch_notification(user, "Medication Reminder", message)

        logger.info("medication_reminder_job executed", extra={"at": now.isoformat()})


async def missed_med_detection_job() -> None:
    """Detect missed doses and log MISSED entries for adherence rollups."""
    from app.db.session import SessionLocal
    from app.models.medication import MedicationSchedule, MedicationLog, Medication
    from sqlalchemy import and_, exists, func, not_
    
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    yesterday_date = yesterday.date()
    yesterday_day = yesterday.strftime("%A").upper()

    async with SessionLocal() as db:
        # Find schedules active yesterday without a log
        result = await db.execute(
            select(MedicationSchedule)
            .join(Medication, MedicationSchedule.medication_id == Medication.id)
            .where(Medication.is_active == True)
            .where(
                not_(
                    exists().where(
                        and_(
                            MedicationLog.schedule_id == MedicationSchedule.id,
                            func.date(MedicationLog.taken_at) == yesterday_date
                        )
                    )
                )
            )
        )
        missing_schedules = result.scalars().all()
        
        missed_count = 0
        for schedule in missing_schedules:
            if schedule.days_of_week and yesterday_day not in schedule.days_of_week:
                continue
            
            missed_log = MedicationLog(
                schedule_id=schedule.id,
                medication_id=schedule.medication_id,
                user_id=schedule.medication.user_id,
                taken_at=datetime.combine(yesterday_date, schedule.scheduled_time).replace(tzinfo=timezone.utc),
                status="MISSED",
            )
            db.add(missed_log)
            missed_count += 1
            
        await db.commit()
        logger.info("missed_med_detection_job executed", extra={"missed_logs_inserted": missed_count})
