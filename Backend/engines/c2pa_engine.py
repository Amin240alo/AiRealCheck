def _truthy_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    if isinstance(value, str):
        return value.strip().lower() in {"true", "valid", "verified", "success", "passed", "ok"}
    return False


def _manifest_present(manifest):
    if manifest is None:
        return False
    if isinstance(manifest, (dict, list, tuple, str, bytes)):
        return len(manifest) > 0
    return True


def _extract_manifest(reader):
    for attr in ("manifest", "manifest_store", "get_manifest", "read"):
        if hasattr(reader, attr):
            try:
                value = getattr(reader, attr)
                return value() if callable(value) else value
            except Exception:
                continue
    return None


def _read_manifest(c2pa_module, asset_path):
    if hasattr(c2pa_module, "read"):
        try:
            return c2pa_module.read(asset_path), None
        except Exception:
            pass

    reader = None
    for cls_name in ("Reader", "C2pa", "C2PA", "C2paReader"):
        if hasattr(c2pa_module, cls_name):
            try:
                reader = getattr(c2pa_module, cls_name)(asset_path)
                break
            except Exception:
                continue

    if reader is None:
        return None, None
    return _extract_manifest(reader), reader


def _detect_verified(c2pa_module, asset_path, manifest, reader):
    for target in (reader, manifest):
        if target is None:
            continue
        if hasattr(target, "verify"):
            try:
                return bool(target.verify())
            except Exception:
                pass

    if hasattr(c2pa_module, "verify"):
        try:
            return bool(c2pa_module.verify(asset_path))
        except Exception:
            pass

    if isinstance(manifest, dict):
        for key in ("verified", "signature_verified", "is_verified", "valid", "is_valid"):
            if key in manifest and _truthy_value(manifest.get(key)):
                return True
        validation = manifest.get("validation") if isinstance(manifest.get("validation"), dict) else {}
        for key in ("verified", "is_verified", "is_valid", "valid", "success"):
            if _truthy_value(validation.get(key)):
                return True
        status = manifest.get("status")
        if _truthy_value(status):
            return True
        if isinstance(status, str) and status.strip().lower() in {"valid", "verified", "success", "passed"}:
            return True

    return False


def analyze_c2pa(asset_path: str) -> dict:
    try:
        import c2pa  # type: ignore
    except Exception:
        return {
            "engine": "c2pa",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [],
            "notes": "not_available",
            "available": False,
        }

    try:
        manifest, reader = _read_manifest(c2pa, asset_path)
        if not _manifest_present(manifest):
            return {
                "engine": "c2pa",
                "ai_likelihood": None,
                "confidence": 0.0,
                "signals": ["no_content_credentials"],
                "notes": "Keine Content Credentials (C2PA) gefunden",
                "available": True,
            }

        verified = _detect_verified(c2pa, asset_path, manifest, reader)
        if verified:
            signals = ["content_credentials_present", "signature_verified"]
            confidence = 1.0
            notes = "Content Credentials vorhanden (verifiziert)"
        else:
            signals = ["content_credentials_present", "signature_unverified"]
            confidence = 0.5
            notes = "Content Credentials vorhanden (nicht verifizierbar)"

        return {
            "engine": "c2pa",
            "ai_likelihood": None,
            "confidence": confidence,
            "signals": signals,
            "notes": notes,
            "available": True,
        }
    except Exception:
        return {
            "engine": "c2pa",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": ["c2pa_error"],
            "notes": "C2PA-Analyse fehlgeschlagen",
            "available": True,
        }
