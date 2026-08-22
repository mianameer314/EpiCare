"""
Central model registry — re-exports all models for easy imports and Alembic autogenerate.
"""
from app.models.enums import UserRole, ConnectionStatus
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.doctor_profile import DoctorProfile
from app.models.caretaker_profile import CaretakerProfile
from app.models.networks import PatientDoctorNetwork, PatientCaretakerNetwork
from app.models.eeg_session import EegSession
from app.models.prediction import Prediction
from app.models.ai_report import AiReport
from app.models.medication import Medication, MedicationSchedule, MedicationLog
from app.models.lifestyle import LifestyleLog, SleepLog, TriggerLog
from app.models.patient_feature_snapshot import PatientFeatureSnapshot
from app.models.recommendation import Recommendation
from app.models.recommendation_feedback import RecommendationFeedback
from app.models.emergency import EmergencyContact, SosEvent, SosDelivery
from app.models.chat import ChatSession, ChatMessage
from app.models.rag import RagDocument, RagChunk
from app.models.model_version import ModelVersion
from app.models.audit_log import AuditLog
from app.models.seizure import ManualSeizureLog
from app.models.pending_registration import PendingRegistration
from app.models.user_session import UserSession

__all__ = [
    "User",
    "PatientProfile",
    "DoctorProfile",
    "CaretakerProfile",
    "PatientDoctorNetwork",
    "PatientCaretakerNetwork",
    "EegSession",
    "Prediction",
    "AiReport",
    "Medication",
    "MedicationSchedule",
    "MedicationLog",
    "LifestyleLog",
    "SleepLog",
    "TriggerLog",
    "PatientFeatureSnapshot",
    "Recommendation",
    "RecommendationFeedback",
    "EmergencyContact",
    "SosEvent",
    "SosDelivery",
    "ChatSession",
    "ChatMessage",
    "RagDocument",
    "RagChunk",
    "ModelVersion",
    "AuditLog",
    "ManualSeizureLog",
    "PendingRegistration",
    "UserSession",
]
