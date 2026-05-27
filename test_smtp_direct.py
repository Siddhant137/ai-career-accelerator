
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import get_settings

def test_smtp():
    settings = get_settings()
    
    print(f"Testing SMTP with Host: {settings.smtp_host}, Port: {settings.smtp_port}, User: {settings.smtp_user}")
    
    to = settings.smtp_user # Send to self
    subject = "CareerAI SMTP Test"
    from_addr = settings.email_from or settings.smtp_user
    html = "<h1>SMTP Test</h1><p>This is a test email from CareerAI.</p>"
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))
    
    try:
        print("Connecting to server...")
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
        print("Starting TLS...")
        if settings.smtp_use_tls:
            server.starttls()
        print("Logging in...")
        server.login(settings.smtp_user, settings.smtp_password)
        print("Sending mail...")
        server.sendmail(from_addr, [to], msg.as_string())
        server.quit()
        print("SUCCESS: SMTP test email sent!")
    except Exception as exc:
        print(f"FAILED: SMTP test failed: {exc}")

if __name__ == "__main__":
    test_smtp()
