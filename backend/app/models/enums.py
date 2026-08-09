from enum import Enum

class UserRole(str, Enum):
    PATIENT = "PATIENT"
    DOCTOR = "DOCTOR"
    CARETAKER = "CARETAKER"
    ADMIN = "ADMIN"

class ConnectionStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
