import os, io, sys
os.environ['AIREALCHECK_JWT_SECRET'] = 'smoketestsecret'
os.environ['AIREALCHECK_FREE_CREDITS'] = '5'
os.environ['AIREALCHECK_IMAGE_FALLBACK'] = 'true'
os.environ['AIREALCHECK_CACHE'] = 'false'

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
from Backend import server, middleware
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

print('--- Balance 1')
r = client.get('/credits/balance', headers=hdr)
print('status', r.status_code, 'body', r.json)

# Prepare an in-memory JPEG
img = Image.new('RGB', (64, 64), color=(120, 150, 200))
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)

print('--- Analyze 1')
r = client.post('/analyze', headers=hdr, data={'file': (buf, 't1.jpg')}, content_type='multipart/form-data')
print('status', r.status_code, 'ok', r.json and r.json.get('ok'), 'usage', r.json.get('usage') if r.is_json else None)

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
