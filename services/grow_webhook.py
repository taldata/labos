"""Grow payment webhook: sends the buyer watch-link email and an internal sale
notification via Resend. Ported from mali-api (mali/mali-api), which ran on a
free Render plan that kept spinning down and missing webhook calls.
"""
import html
import logging
import os

import resend

logger = logging.getLogger(__name__)

WATCH_URL = "https://www.mali-barefoot.com/watch.html"

# In-memory dedup by Grow transactionCode. Resets on process restart/redeploy,
# same tradeoff the original mali-api implementation made.
_seen_transaction_codes = set()


def _domain_of(mail_from):
    at = mail_from.find("@")
    return mail_from if at == -1 else mail_from[at + 1:]


def _build_buyer_email(full_name, payer_email, mail_from):
    domain = _domain_of(mail_from)
    name = html.escape(full_name or "")
    body_html = f"""<div dir="rtl" style="background:#F5EDE0;padding:32px 16px;font-family:'Assistant',Arial,sans-serif;color:#2E241A;">
  <div style="max-width:520px;margin:0 auto;background:#FAF4E8;border-radius:8px;padding:32px;text-align:center;">
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 16px;color:#2E241A;">ברוכה הבאה לסדנה ♡</h1>
    <p style="font-size:17px;line-height:1.7;margin:0 0 12px;">{name}, איזה כיף שהלכת על זה!</p>
    <p style="font-size:17px;line-height:1.7;margin:0 0 28px;">כל סרטוני הסדנה מחכים לך כאן, לפי הסדר. אפשר לצפות בקצב שלך, בכל זמן — והגישה נשארת איתך לתמיד.</p>
    <a href="{WATCH_URL}" style="display:inline-block;background:#6B7A4B;color:#FDF9EE;text-decoration:none;font-size:18px;font-weight:600;padding:16px 40px;border-radius:3px;">לצפייה בסדנה</a>
    <p style="font-size:14px;line-height:1.7;margin:28px 0 0;color:rgba(46,36,26,0.6);">אם הכפתור לא עובד, הכתובת לצפייה היא:<br><a href="{WATCH_URL}" style="color:#6B7A4B;">{WATCH_URL}</a></p>
    <p style="font-size:15px;line-height:1.7;margin:24px 0 0;">נתקלת בשאלה או בקושי? אני כאן באהבה 🤍<br>מלי</p>
  </div>
</div>"""
    return {
        "from": f"noreply@{domain}",
        "to": payer_email,
        "subject": "הסדנה שלך מוכנה ♡ ללכת על זה",
        "html": body_html,
    }


def _build_sale_email(full_name, payment_sum, payer_email, payer_phone, transaction_code, payment_date, mail_from, notify_to):
    domain = _domain_of(mail_from)
    text = "\n".join([
        "מכירה חדשה 🎉",
        "",
        f"שם: {full_name or ''}",
        f"סכום: {payment_sum or ''}",
        f"אימייל: {payer_email or ''}",
        f"טלפון: {payer_phone or ''}",
        f"קוד עסקה: {transaction_code or ''}",
        f"תאריך: {payment_date or ''}",
    ])
    return {
        "from": f"mali@{domain}",
        "to": notify_to,
        "subject": f"{full_name or ''} {payment_sum or ''}",
        "text": text,
    }


def _send(payload, label, sent):
    try:
        resend.Emails.send(payload)
        sent.append(label)
    except Exception as err:
        logger.error("[grow-webhook] failed to send %s email: %s", label, err)


def handle_grow_webhook(body, webhook_key, mail_from, notify_to):
    """Returns (status_code, sent_labels)."""
    body = body or {}
    if not body.get("webhookKey") or body.get("webhookKey") != webhook_key:
        return 401, []

    code = body.get("transactionCode")
    if code and code in _seen_transaction_codes:
        return 200, []
    if code:
        _seen_transaction_codes.add(code)

    sent = []

    # Sale notification first - it is our backstop, always attempted.
    _send(
        _build_sale_email(
            full_name=body.get("fullName"),
            payment_sum=body.get("paymentSum"),
            payer_email=body.get("payerEmail"),
            payer_phone=body.get("payerPhone"),
            transaction_code=body.get("transactionCode"),
            payment_date=body.get("paymentDate"),
            mail_from=mail_from,
            notify_to=notify_to,
        ),
        "sale",
        sent,
    )

    payer_email = body.get("payerEmail")
    if payer_email:
        _send(
            _build_buyer_email(body.get("fullName"), payer_email, mail_from),
            "buyer",
            sent,
        )
    else:
        logger.error("[grow-webhook] payment %s had no payerEmail; skipped buyer email", code or "(no code)")

    return 200, sent
