"""
app/core/exceptions.py
───────────────────────
Domain-specific exception hierarchy.
"""


class CareerAcceleratorError(Exception):
    """Base exception for the platform."""

# ── PDF ────────────────────────────────────────────────────────────────────────
class PDFExtractionError(CareerAcceleratorError): pass
class PDFTooLargeError(CareerAcceleratorError): pass
class EmptyPDFError(CareerAcceleratorError): pass

# ── AI ─────────────────────────────────────────────────────────────────────────
class GeminiAPIError(CareerAcceleratorError): pass
class GeminiParseError(CareerAcceleratorError): pass

# ── Auth ───────────────────────────────────────────────────────────────────────
class AuthError(CareerAcceleratorError): pass
class InvalidCredentialsError(AuthError): pass
class UserAlreadyExistsError(AuthError): pass
class InvalidTokenError(AuthError): pass
class InsufficientPermissionsError(AuthError): pass

# ── Phase 3 ────────────────────────────────────────────────────────────────────
class EmailServiceError(CareerAcceleratorError): pass
class NotFoundError(CareerAcceleratorError): pass