import os, io, sys, datetime

from . import server
os.environ['AIREALCHECK_JWT_SECRET'] = 'smoketestsecret'
os.environ['AIREALCHECK_FREE_CREDITS'] = '100'
os.environ['AIREALCHECK_IMAGE_FALLBACK'] = 'true'
os.environ['AIREALCHECK_CACHE'] = 'false'

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
from Backend import middleware
from Backend.db import get_session
from Backend.models import User
import jwt
from PIL import Image

app = server.app
client = app.test_client()

print('--- Register')
r = client.post('/auth/register', json={'email':'test@demo.de','password':'Pass1234'})
print('status', r.status_code, 'body', r.json)

print('--- Login')
r = client.post('/auth/login', json={'email':'test@demo.de','password':'Pass1234'})
print('status', r.status_code, 'ok', r.json and r.json.get('ok'))
token = r.json['token'] if r.is_json and r.json and r.json.get('ok') else None
print('token?', bool(token))

if token:
    print('jwt_secret', middleware.JWT_SECRET)
    try:
        dec = jwt.decode(token, middleware.JWT_SECRET, algorithms=['HS256'])
        print('token_decoded', dec)
    except Exception as e:
        print('token_decode_error', type(e).__name__, str(e))

hdr = {'Authorization': 'Bearer ' + token} if token else {}

# reset credits for deterministic test run
session = get_session()
try:
    user = session.query(User).filter(User.email == 'test@demo.de').first()
    if user:
        user.credits = int(os.getenv('AIREALCHECK_FREE_CREDITS', '100'))
        utc_now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        user.credits_reset_at = utc_now - datetime.timedelta(days=1)
        session.add(user)
        session.commit()
finally:
    session.close()

print('--- Login wrong password')
bad_login = client.post('/auth/login', json={'email':'test@demo.de','password':'WrongPass!1'})
print('status', bad_login.status_code, 'body', bad_login.json)

print('--- Register duplicate email')
dup = client.post('/auth/register', json={'email':'test@demo.de','password':'Pass1234'})
print('status', dup.status_code, 'body', dup.json)

print('--- Balance 1')
r = client.get('/credits/balance', headers=hdr)
print('status', r.status_code, 'body', r.json)

# reduce credits to trigger no_credits path faster
session = get_session()
try:
    user = session.query(User).filter(User.email == 'test@demo.de').first()
    if user:
        user.credits = 3
        session.add(user)
        session.commit()
finally:
    session.close()

# Prepare an in-memory JPEG
img = Image.new('RGB', (64, 64), color=(120, 150, 200))
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)

print('--- Analyze 1')
r = client.post('/analyze', headers=hdr, data={'file': (buf, 't1.jpg')}, content_type='multipart/form-data')
print('status', r.status_code, 'ok', r.json and r.json.get('ok'), 'usage', r.json.get('usage') if r.is_json else None)

print('--- Analyze without token (should fail)')
unauth_img = Image.new('RGB', (64, 64), color=(100, 120, 180))
unauth_buf = io.BytesIO()
unauth_img.save(unauth_buf, format='JPEG')
unauth_buf.seek(0)
unauth = client.post('/analyze', data={'file': (unauth_buf, 'raw.jpg')}, content_type='multipart/form-data')
print('status', unauth.status_code, 'body', unauth.json if unauth.is_json else None)

print('--- Analyze guest endpoint (no token)')
guest_img = Image.new('RGB', (64, 64), color=(90, 130, 210))
guest_buf = io.BytesIO(); guest_img.save(guest_buf, format='JPEG'); guest_buf.seek(0)
guest_call = client.post('/analyze', data={'file': (guest_buf, 'guest.jpg')}, content_type='multipart/form-data')
print('status', guest_call.status_code, 'body', guest_call.json if guest_call.is_json else None)

# Spend remaining credits
spent = 1 if (r.is_json and r.json.get('ok')) else 0
for i in range(2,7):
    img = Image.new('RGB', (64, 64), color=(120+i, 150, 200))
    buf = io.BytesIO(); img.save(buf, format='JPEG'); buf.seek(0)
    rr = client.post('/analyze', headers=hdr, data={'file': (buf, f't{i}.jpg')}, content_type='multipart/form-data')
    if rr.is_json:
        print(f'--- Analyze {i}:', rr.status_code, rr.json)
    else:
        print(f'--- Analyze {i}:', rr.status_code)
    if rr.is_json and rr.json.get('ok'):
        spent += 1

print('spent_ok_calls', spent)

print('--- Balance final')
r = client.get('/credits/balance', headers=hdr)
print('status', r.status_code, 'body', r.json)

print('--- Force daily reset via DB tweak')
session = get_session()
try:
    user = session.query(User).filter(User.email == 'test@demo.de').first()
    if user:
        user.credits = 0
        utc_now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        user.credits_reset_at = utc_now - datetime.timedelta(days=1)
        session.add(user)
        session.commit()
finally:
    session.close()

reset_call = client.get('/credits/balance', headers=hdr)
print('status', reset_call.status_code, 'body', reset_call.json)
