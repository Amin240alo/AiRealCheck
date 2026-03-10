import importlib

from Backend.public_result import build_public_result_v1
import Backend.history as history


def test_public_result_transform_smoke():
    raw = {
        "analysis_id": "test-1",
        "media_type": "image",
        "final_ai": 0.73,
        "ai_likelihood": 73,
        "real_likelihood": 27,
        "verdict": "likely_ai",
        "traffic_light": "red",
        "label_de": "Ueberwiegend KI",
        "label_en": "Likely AI-generated",
        "confidence": 0.82,
        "confidence_label": "high",
        "conflict": False,
        "reasons_user": ["KI-Signale überwiegen"],
        "warnings_user": [],
        "decision_threshold": 0.5,
        "engine_results": [
            {
                "engine": "hive",
                "status": "ok",
                "available": True,
                "ai_likelihood": 95,
                "confidence": 0.9,
                "signals": ["raw_signal"],
                "timing_ms": 120,
            }
        ],
        "timestamps": {"created_at": "2020-01-01T00:00:00Z"},
    }
    public = build_public_result_v1(raw)
    assert public.get("meta", {}).get("schema_version") == "public_result_v1"
    assert isinstance(public.get("summary", {}).get("ai_percent"), int)
    engines = public.get("details", {}).get("engines") or []
    assert engines
    assert all("signals" not in entry for entry in engines)


def test_history_engine_breakdown_compact():
    public = {
        "meta": {"schema_version": "public_result_v1"},
        "summary": {"ai_percent": 88, "label_de": "Ueberwiegend KI"},
        "details": {
            "engines": [
                {"engine": "hive", "ai_percent": 88},
                {"engine": "xception", "ai01": 0.2},
            ]
        },
    }
    breakdown = history._extract_engine_breakdown(public)
    assert breakdown == {"hive": 88, "xception": 20}
    assert all(isinstance(value, (int, float)) for value in breakdown.values())


def _bootstrap_server(tmp_path, monkeypatch):
    monkeypatch.setenv("AIREALCHECK_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path/'backfill.db'}")

    import Backend.db as db
    import Backend.models as models
    import Backend.server as server

    importlib.reload(db)
    importlib.reload(models)
    importlib.reload(server)

    return server, db.get_session, models


def _create_user(session, models):
    user = models.User(
        email="backfill@example.com",
        display_name="Backfill",
        email_verified=True,
        password_hash="test",
        role="user",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_backfill_skips_public_result(tmp_path, monkeypatch):
    server, get_session, models = _bootstrap_server(tmp_path, monkeypatch)

    public_payload = {
        "meta": {"schema_version": "public_result_v1", "analysis_id": "analysis-1"},
        "summary": {"ai_percent": 42, "label_de": "Unsicher"},
        "details": {"engines": []},
    }

    db = get_session()
    try:
        user = _create_user(db, models)
        analysis = models.Analysis(
            id="analysis-1",
            user_id=user.id,
            status="done",
            media_type="image",
            result_json=public_payload,
            raw_result_json=None,
        )
        db.add(analysis)
        db.commit()
    finally:
        db.close()

    server._ensure_analysis_schema()

    db = get_session()
    try:
        row = db.query(models.Analysis).filter_by(id="analysis-1").one()
        assert row.result_json == public_payload
        assert row.raw_result_json is None
    finally:
        db.close()
