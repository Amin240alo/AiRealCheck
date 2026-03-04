import datetime as dt
import importlib
import json


def _bootstrap_app(tmp_path, monkeypatch):
    monkeypatch.setenv("AIREALCHECK_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path/'history_smoke.db'}")

    import Backend.db as db
    import Backend.models as models
    import Backend.server as server

    importlib.reload(db)
    importlib.reload(models)
    importlib.reload(server)

    return server.app, db.get_session, models


def _create_user(session, models, email, verified=True):
    user = models.User(
        email=email,
        display_name="History Smoke",
        email_verified=verified,
        password_hash="test",
        role="user",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_history_endpoints_smoke(tmp_path, monkeypatch):
    app, get_session, models = _bootstrap_app(tmp_path, monkeypatch)

    from Backend.middleware import create_access_token

    db = get_session()
    try:
        user = _create_user(db, models, "history_user@example.com", verified=True)
        other = _create_user(db, models, "other_user@example.com", verified=True)

        history = models.AnalysisHistory(
            id="hist-1",
            user_id=user.id,
            media_type="image",
            title="sample.png",
            status="success",
            final_score=87.0,
            verdict_label="Wahrscheinlich KI",
            engine_breakdown=json.dumps({"engine_x": {"score": 87, "confidence": 72.5}}),
            result_payload=json.dumps({"reasons": ["Test"]}),
            credits_charged=10,
            created_at=dt.datetime.utcnow(),
        )
        db.add(history)
        db.commit()
    finally:
        db.close()

    token = create_access_token(user)
    other_token = create_access_token(other)

    with app.test_client() as client:
        res = client.get("/api/history", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        items = res.get_json()
        assert isinstance(items, list)
        assert any(item.get("id") == "hist-1" for item in items)

        detail = client.get("/api/history/hist-1", headers={"Authorization": f"Bearer {token}"})
        assert detail.status_code == 200
        payload = detail.get_json()
        assert isinstance(payload.get("engine_breakdown"), dict)

        forbidden = client.get("/api/history/hist-1", headers={"Authorization": f"Bearer {other_token}"})
        assert forbidden.status_code in (403, 404)
