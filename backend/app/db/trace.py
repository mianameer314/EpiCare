"""
Trace propagation helpers — embed the request trace_id into SQL.

SQLAlchemy renders Select.comment() as a leading SQL comment, so
pg_stat_activity / slow-query logs show which trace produced each query.
"""
from sqlalchemy import Select

from app.middleware.request_context import request_id_var


def trace_comment(statement: Select) -> Select:
    """Attach the current trace_id as a SQL comment on a select statement."""
    trace_id = request_id_var.get()
    if trace_id == "-":
        return statement
    return statement.comment(f"trace:{trace_id}")


async def set_session_trace_id(executor) -> None:
    """Set app.trace_id as a session-level GUC for the current request.

    Visible via pg_stat_activity.query and usable in pg_stat_statements.
    Best-effort: failures never break the request.
    """
    trace_id = request_id_var.get()
    if trace_id == "-":
        return
    try:
        from sqlalchemy import text

        await executor.execute(
            text("SELECT set_config('app.trace_id', :trace_id, true)"),
            {"trace_id": trace_id},
        )
    except Exception:
        pass
