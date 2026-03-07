import os
import io
import sys
import threading

os.environ["AIREALCHECK_JWT_SECRET"] = "smoketestsecret"
os.environ["AIREALCHECK_FREE_CREDITS"] = "50"
os.environ["AIREALCHECK_IMAGE_FALLBACK"] = "true"
os.environ["AIREALCHECK_CACHE"] = "false"
os.environ["AIREALCHECK_ALLOW_ADMIN"] = "true"
os.environ["AIREALCHECK_EMAIL_DEV_CONSOLE"] = "true"
if not (os.getenv("AIREALCHECK_EMAIL_DEV_CONSOLE") or "").strip().lower() in {"1", "true", "yes", "on"}:
    os.environ.setdefault("SMTP_HOST", "localhost")
    os.environ.setdefault("SMTP_PORT", "1025")
os.environ.setdefault("SMTP_USE_TLS", "false")

from . import server

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from Backend.db import get_session
from Backend.models import User
from Backend.credits import grant_credits, get_available, charge_credits_on_success, InsufficientCredits
from PIL import Image

app = server.app
client = app.test_client()

email = "test@demo.de"
password = "Pass1234"

print("--- Register")
r = client.post(
    "/auth/register",
    json={"email": email, "password": password, "display_name": "Test User", "consent_terms": True},
)
print("status", r.status_code, "body", r.json)
if not (r.is_json and r.json and r.json.get("ok")):
    if not (r.is_json and r.json and r.json.get("error") == "email_exists"):
        print("register failed; aborting")
        sys.exit(1)

print("--- Login")
r = client.post("/auth/login", json={"email": email, "password": password})
print("status", r.status_code, "ok", r.json and r.json.get("ok"))
token = r.json["token"] if r.is_json and r.json and r.json.get("ok") else None
print("token?", bool(token))
if not token:
    print("login failed; aborting")
    sys.exit(1)

hdr = {"Authorization": "Bearer " + token} if token else {}

session = get_session()
try:
    user = session.query(User).filter(User.email == email).first()
    if user:
        user.role = "user"
        user.is_banned = False
        session.add(user)
        session.commit()
finally:
    session.close()

print("--- Admin stats (non-admin)")
r = client.get("/admin/stats", headers=hdr)
print("status", r.status_code, "body", r.json)
if r.status_code != 403:
    print("expected 403 for non-admin; aborting")
    sys.exit(1)

# verify user + reset credits for deterministic test run
session = get_session()
user_id = None
try:
    user = session.query(User).filter(User.email == email).first()
    if user:
        user_id = user.id
        user.email_verified = True
        user.role = "admin"
        user.is_banned = False
        session.add(user)
        session.commit()
        target = int(os.getenv("AIREALCHECK_FREE_CREDITS", "50"))
        current = get_available(user)
        delta = target - current
        if delta != 0:
            grant_credits(session, user.id, delta, kind="admin_adjust", note="smoke_adjust")
finally:
    session.close()
if not user_id:
    print("user lookup failed; aborting")
    sys.exit(1)

# ensure credits_used > 0 for admin validation tests
session = get_session()
try:
    try:
        charge_credits_on_success(
            session,
            user_id,
            1,
            "image",
            "smoke-admin",
            "smoke-admin",
        )
    except InsufficientCredits:
        pass
finally:
    session.close()

print("--- Admin stats (admin)")
r = client.get("/admin/stats", headers=hdr)
print("status", r.status_code, "body", r.json)
if r.status_code != 200:
    print("admin stats failed; aborting")
    sys.exit(1)

print("--- Balance 1")
r = client.get("/api/credits", headers=hdr)
print("status", r.status_code, "body", r.json)

# reduce credits to trigger no_credits path faster
session = get_session()
try:
    user = session.query(User).filter(User.email == email).first()
    if user:
        target = 20
        current = get_available(user)
        delta = target - current
        if delta != 0:
            grant_credits(session, user.id, delta, kind="admin_adjust", note="smoke_reduce")
finally:
    session.close()

# Prepare an in-memory JPEG
img = Image.new("RGB", (64, 64), color=(120, 150, 200))
buf = io.BytesIO()
img.save(buf, format="JPEG")
buf.seek(0)

idem_key = "smoke-idem-1"

print("--- Analyze 1")
r = client.post(
    "/analyze",
    headers={**hdr, "Idempotency-Key": idem_key},
    data={"file": (buf, "t1.jpg")},
    content_type="multipart/form-data",
)
print("status", r.status_code, "ok", r.json and r.json.get("ok"), "usage", r.json.get("usage") if r.is_json else None)

print("--- Analyze retry (same idempotency key)")
img_retry = Image.new("RGB", (64, 64), color=(121, 151, 201))
buf_retry = io.BytesIO()
img_retry.save(buf_retry, format="JPEG")
buf_retry.seek(0)
rr = client.post(
    "/analyze",
    headers={**hdr, "Idempotency-Key": idem_key},
    data={"file": (buf_retry, "t1_retry.jpg")},
    content_type="multipart/form-data",
)
print("status", rr.status_code, "ok", rr.json and rr.json.get("ok"), "usage", rr.json.get("usage") if rr.is_json else None)

print("--- Balance after retry")
r = client.get("/api/credits", headers=hdr)
print("status", r.status_code, "body", r.json)

print("--- Admin credits validation")
used = 0
if r.is_json and r.json:
    try:
        used = int(r.json.get("credits_used") or 0)
    except Exception:
        used = 0
target = max(0, used - 1)
resp = client.post(
    f"/admin/users/{user_id}/credits",
    json={"mode": "set_total", "amount": target, "reason": "smoke_validation"},
    headers=hdr,
)
print("status", resp.status_code, "body", resp.json if resp.is_json else None)
if used > 0 and resp.status_code != 400:
    print("expected 400 when setting credits below used; aborting")
    sys.exit(1)

print("--- Analyze failure (missing file)")
fail = client.post("/analyze", headers=hdr, data={}, content_type="multipart/form-data")
print("status", fail.status_code, "body", fail.json if fail.is_json else None)

print("--- Balance after failure")
r = client.get("/api/credits", headers=hdr)
print("status", r.status_code, "body", r.json)

print("--- Concurrent charge")
# set available credits to 10
session = get_session()
try:
    user = session.query(User).filter(User.email == email).first()
    if user:
        target = 10
        current = get_available(user)
        delta = target - current
        if delta != 0:
            grant_credits(session, user.id, delta, kind="admin_adjust", note="smoke_concurrency_reset")
finally:
    session.close()

results = []
barrier = threading.Barrier(2)

def worker(label):
    db = get_session()
    try:
        barrier.wait()
        charged, available = charge_credits_on_success(
            db,
            user_id,
            10,
            "image",
            f"concurrent-{label}",
            f"concurrent-{label}",
        )
        results.append((label, "charged" if charged else "skipped", available))
    except InsufficientCredits as exc:
        results.append((label, "insufficient", getattr(exc, "available", None)))
    finally:
        db.close()

threads = [threading.Thread(target=worker, args=("A",)), threading.Thread(target=worker, args=("B",))]
for t in threads:
    t.start()
for t in threads:
    t.join()

print("concurrent_results", results)

print("--- Balance final")
r = client.get("/api/credits", headers=hdr)
print("status", r.status_code, "body", r.json)

print("--- Ban user (block analyze)")
session = get_session()
try:
    user = session.query(User).filter(User.email == email).first()
    if user:
        user.is_banned = True
        session.add(user)
        session.commit()
finally:
    session.close()

img_block = Image.new("RGB", (32, 32), color=(80, 100, 120))
buf_block = io.BytesIO()
img_block.save(buf_block, format="JPEG")
buf_block.seek(0)
blocked = client.post(
    "/analyze",
    headers=hdr,
    data={"file": (buf_block, "blocked.jpg")},
    content_type="multipart/form-data",
)
print("status", blocked.status_code, "body", blocked.json if blocked.is_json else None)
if blocked.status_code != 403:
    print("expected 403 for banned user; aborting")
    sys.exit(1)
