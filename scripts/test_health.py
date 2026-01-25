from Backend.server import app

with app.test_client() as c:
    r = c.get("/health")
    print("/health:", r.status_code, r.get_json())

