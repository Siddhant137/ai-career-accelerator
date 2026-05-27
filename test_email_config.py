
from app.core.config import get_settings
from app.core.email_allowlist import get_email_allowlist, is_email_allowlisted
from app.services.email_service import _resolve_mode

settings = get_settings()
print(f"--- Settings Check ---")
print(f"EMAIL_MODE: {settings.email_mode}")
print(f"Resolved Mode: {_resolve_mode()}")
print(f"SMTP_HOST: {settings.smtp_host}")
print(f"SMTP_USER: {settings.smtp_user}")
print(f"EMAIL_ALLOWLIST: {settings.email_allowlist}")

allowlist = get_email_allowlist()
print(f"\n--- Allowlist Check ---")
print(f"Parsed Allowlist: {allowlist}")

test_email = "siddhant.23bce7137@vitapstudent.ac.in"
print(f"Is {test_email} allowlisted? {is_email_allowlisted(test_email)}")

test_email_2 = "random@gmail.com"
print(f"Is {test_email_2} allowlisted? {is_email_allowlisted(test_email_2)}")
