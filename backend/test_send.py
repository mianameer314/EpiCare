import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path("backend").resolve()))

async def test_email():
    from app.services.email import send_email, _use_gmail_api
    from app.core.config import settings
    
    print("Use Gmail API:", _use_gmail_api())
    print("MAIL_FROM:", settings.MAIL_FROM)
    print("MAIL_SERVER:", settings.MAIL_SERVER)
    print("MAIL_USERNAME:", settings.MAIL_USERNAME)
    
    recipient = "fa23-bai-021@cuiatk.edu.pk"
    print(f"Testing dispatch to: {recipient}")
    try:
        await send_email(
            to_email=recipient,
            subject="🚨 URGENT: Seizure Alert for AASHAN KHAN 🚨",
            html_content="<h1>Test SOS Alert</h1><p>This is a direct test email from EpiCare to verify inbox delivery for Caretaker.</p>"
        )
        print("SUCCESS: send_email executed without error!")
    except Exception as e:
        print(f"ERROR in send_email: {e}")

if __name__ == "__main__":
    asyncio.run(test_email())
