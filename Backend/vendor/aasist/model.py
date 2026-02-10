import importlib
import importlib.util
import json
import os
import sys
from collections import OrderedDict

import numpy as np

try:
    import torch
except Exception:
    torch = None


_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_UPSTREAM_ROOT = os.path.abspath(os.path.join(_BASE_DIR, "..", "aasist_upstream"))
_UPSTREAM_MODEL_FILE = os.path.join(_UPSTREAM_ROOT, "models", "AASIST.py")
_UPSTREAM_CONFIG_FILE = os.path.join(_UPSTREAM_ROOT, "config", "AASIST.conf")

_FALLBACK_MODEL_CONFIG = {
    "architecture": "AASIST",
    "nb_samp": 64600,
    "first_conv": 128,
    "filts": [70, [1, 32], [32, 32], [32, 64], [64, 64]],
    "gat_dims": [64, 32],
    "pool_ratios": [0.5, 0.7, 0.5, 0.5],
    "temperatures": [2.0, 2.0, 100.0, 100.0],
}


def resolve_weights_path() -> str:
    return os.path.join(_BASE_DIR, "models", "weights", "AASIST.pth")


def _clamp01(value):
    try:
        v = float(value)
    except Exception:
        return 0.0
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _ensure_upstream_paths():
    for path in (_UPSTREAM_ROOT, os.path.join(_UPSTREAM_ROOT, "models")):
        if path not in sys.path:
            sys.path.insert(0, path)


def _import_upstream_model_module():
    errors = []
    _ensure_upstream_paths()

    try:
        module = importlib.import_module("Backend.vendor.aasist_upstream.models.AASIST")
        return module, {
            "module": "Backend.vendor.aasist_upstream.models.AASIST",
            "model_file": _UPSTREAM_MODEL_FILE,
        }
    except Exception as exc:
        errors.append(f"import_backend_path:{str(exc)[:180]}")

    try:
        module = importlib.import_module("models.AASIST")
        return module, {"module": "models.AASIST", "model_file": _UPSTREAM_MODEL_FILE}
    except Exception as exc:
        errors.append(f"import_models_path:{str(exc)[:180]}")

    if os.path.exists(_UPSTREAM_MODEL_FILE):
        try:
            spec = importlib.util.spec_from_file_location("_aasist_upstream_AASIST", _UPSTREAM_MODEL_FILE)
            if spec is None or spec.loader is None:
                raise RuntimeError("spec_loader_missing")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module, {"module": "_aasist_upstream_AASIST", "model_file": _UPSTREAM_MODEL_FILE}
        except Exception as exc:
            errors.append(f"import_spec:{str(exc)[:180]}")
    else:
        errors.append("model_file_missing")

    return None, {"reason": "upstream_import_failed", "errors": errors, "model_file": _UPSTREAM_MODEL_FILE}


def _load_model_config():
    if os.path.exists(_UPSTREAM_CONFIG_FILE):
        try:
            with open(_UPSTREAM_CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
            model_config = config.get("model_config")
            if isinstance(model_config, dict):
                merged = dict(_FALLBACK_MODEL_CONFIG)
                merged.update(model_config)
                return merged, {"config_path": _UPSTREAM_CONFIG_FILE}
        except Exception as exc:
            return dict(_FALLBACK_MODEL_CONFIG), {
                "config_path": _UPSTREAM_CONFIG_FILE,
                "config_error": str(exc)[:180],
            }
    return dict(_FALLBACK_MODEL_CONFIG), {"config_path": "fallback"}


def _extract_state_dict(ckpt):
    if isinstance(ckpt, (dict, OrderedDict)):
        if isinstance(ckpt.get("state_dict"), dict):
            return ckpt.get("state_dict"), "state_dict"
        if isinstance(ckpt.get("model"), dict):
            return ckpt.get("model"), "model"
        if isinstance(ckpt.get("model_state_dict"), dict):
            return ckpt.get("model_state_dict"), "model_state_dict"
        if ckpt and all(torch.is_tensor(v) for v in ckpt.values()):
            return ckpt, "state_dict"
    return None, "unknown"


def _normalize_state_dict(state_dict):
    cleaned = {}
    for key, value in (state_dict or {}).items():
        new_key = str(key)
        for prefix in ("module.", "model."):
            if new_key.startswith(prefix):
                new_key = new_key[len(prefix) :]
        cleaned[new_key] = value
    return cleaned


def build_model(device="cpu"):
    if torch is None:
        raise RuntimeError("torch_missing")

    module, import_meta = _import_upstream_model_module()
    if module is None:
        raise RuntimeError(import_meta.get("reason", "upstream_import_failed"))

    model_class = getattr(module, "Model", None)
    if model_class is None:
        raise RuntimeError("model_constructor_missing")

    model_config, _ = _load_model_config()
    model = model_class(model_config).to(device)
    model.eval()
    return model


def load_aasist_model(device="cpu"):
    weights_path = resolve_weights_path()
    if torch is None:
        return None, {"reason": "torch_missing", "weights_path": weights_path}
    if not os.path.exists(weights_path):
        return None, {"reason": "weights_missing", "weights_path": weights_path}

    module, import_meta = _import_upstream_model_module()
    if module is None:
        return None, {"reason": "upstream_import_failed", "weights_path": weights_path, "details": import_meta}

    model_class = getattr(module, "Model", None)
    if model_class is None:
        return None, {
            "reason": "upstream_import_failed",
            "weights_path": weights_path,
            "details": {"reason": "model_constructor_missing", "module": import_meta.get("module")},
        }

    model_config, config_meta = _load_model_config()
    try:
        model = model_class(model_config).to(device)
    except Exception as exc:
        return None, {
            "reason": "upstream_import_failed",
            "weights_path": weights_path,
            "details": {"reason": "model_constructor_failed", "error": str(exc)[:240], **config_meta},
        }

    try:
        ckpt = torch.load(weights_path, map_location=device)
    except Exception as exc:
        return None, {"reason": "checkpoint_load_failed", "weights_path": weights_path, "error": str(exc)[:240]}

    state_dict, sd_origin = _extract_state_dict(ckpt)
    if state_dict is None:
        return None, {
            "reason": "checkpoint_load_failed",
            "weights_path": weights_path,
            "error": "state_dict_not_found",
            "checkpoint_type": type(ckpt).__name__,
        }

    state_dict = _normalize_state_dict(state_dict)

    try:
        model.load_state_dict(state_dict, strict=True)
        model.eval()
        return model, {
            "format": "state_dict",
            "strict": True,
            "state_dict_origin": sd_origin,
            "state_dict_keys": len(state_dict),
            "loaded_keys": len(state_dict),
            "missing_keys": [],
            "unexpected_keys": [],
            "weights_path": weights_path,
            **import_meta,
            **config_meta,
        }
    except Exception as strict_exc:
        strict_error = str(strict_exc)[:240]

    try:
        incompatible = model.load_state_dict(state_dict, strict=False)
    except Exception as loose_exc:
        return None, {
            "reason": "checkpoint_load_failed",
            "weights_path": weights_path,
            "error": str(loose_exc)[:240],
            "strict_error": strict_error,
            "state_dict_origin": sd_origin,
            **import_meta,
            **config_meta,
        }

    missing_keys = list(getattr(incompatible, "missing_keys", []) or [])
    unexpected_keys = list(getattr(incompatible, "unexpected_keys", []) or [])
    loaded_keys = max(0, len(state_dict) - len(unexpected_keys))
    if loaded_keys <= 0:
        return None, {
            "reason": "checkpoint_load_failed",
            "weights_path": weights_path,
            "error": "state_dict_mismatch_no_compatible_keys",
            "strict_error": strict_error,
            "state_dict_origin": sd_origin,
            "state_dict_keys": len(state_dict),
            "loaded_keys": loaded_keys,
            "missing_keys": missing_keys[:40],
            "unexpected_keys": unexpected_keys[:40],
            **import_meta,
            **config_meta,
        }

    model.eval()
    return model, {
        "format": "state_dict",
        "strict": False,
        "state_dict_origin": sd_origin,
        "state_dict_keys": len(state_dict),
        "loaded_keys": loaded_keys,
        "missing_keys": missing_keys[:40],
        "unexpected_keys": unexpected_keys[:40],
        "strict_error": strict_error,
        "weights_path": weights_path,
        **import_meta,
        **config_meta,
    }


def _extract_logits(output):
    if torch is not None and torch.is_tensor(output):
        return output

    if isinstance(output, (list, tuple)):
        tensor_items = [item for item in output if torch is not None and torch.is_tensor(item)]
        if not tensor_items:
            raise RuntimeError("output_without_tensor")
        for item in tensor_items:
            if item.dim() >= 1 and item.shape[-1] == 2:
                return item
        return tensor_items[-1]

    if isinstance(output, dict):
        for key in ("logits", "output", "out", "cls_output", "score"):
            value = output.get(key)
            if torch is not None and torch.is_tensor(value):
                return value
        for value in output.values():
            if torch is not None and torch.is_tensor(value):
                return value
        raise RuntimeError("dict_output_without_tensor")

    raise RuntimeError(f"unsupported_output_type:{type(output).__name__}")


def predict_spoof_prob(model, wav_16k_mono_np_float32) -> float:
    if torch is None:
        raise RuntimeError("torch_missing")
    if model is None:
        raise RuntimeError("model_missing")
    if wav_16k_mono_np_float32 is None:
        raise RuntimeError("audio_missing")

    audio = np.asarray(wav_16k_mono_np_float32, dtype=np.float32).reshape(-1)
    if audio.size == 0:
        raise RuntimeError("audio_empty")
    if audio.size < 400:
        audio = np.pad(audio, (0, 400 - audio.size))

    device = torch.device("cpu")
    if hasattr(model, "parameters"):
        try:
            first_param = next(model.parameters())
            device = first_param.device
        except Exception:
            device = torch.device("cpu")

    x_bt = torch.from_numpy(audio).unsqueeze(0).to(device)
    x_bct = torch.from_numpy(audio).unsqueeze(0).unsqueeze(0).to(device)

    attempts = [("shape_[1,T]", x_bt), ("shape_[1,1,T]", x_bct)]
    errors = []
    with torch.no_grad():
        for label, tensor in attempts:
            try:
                output = model(tensor)
                logits = _extract_logits(output).detach().float()
                if logits.numel() == 0:
                    raise RuntimeError("empty_model_output")
                if logits.numel() == 1:
                    return _clamp01(torch.sigmoid(logits.reshape(-1)[0]).item())

                spoof_index = 1
                try:
                    spoof_index = int(os.getenv("AIREALCHECK_AASIST_SPOOF_INDEX", "0"))
                except Exception:
                    spoof_index = 1
                if spoof_index < 0:
                    spoof_index = 0

                if logits.dim() == 1:
                    probs = torch.softmax(logits, dim=0)
                else:
                    probs = torch.softmax(logits.reshape(-1, logits.shape[-1])[0], dim=0)
                idx = min(spoof_index, probs.shape[0] - 1)
                return _clamp01(probs[idx].item())
            except Exception as exc:
                errors.append(f"{label}:{str(exc)[:160]}")

    raise RuntimeError("inference_shape_mismatch:" + " | ".join(errors))
