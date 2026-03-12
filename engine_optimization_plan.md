# AIRealCheck – Engine-Optimierungsplan (Lokal, kein Paid API)

> Erstellt: 2026-03-12 | Basis: engine_analysis.md + vollständige Code-Inspektion
> Reihenfolge: Audio → Image → Video → Benchmarking

---

## Voraussetzungen & Wichtige Befunde

Vor Beginn – kritische Erkenntnisse aus der Code-Analyse:

| Befund | Auswirkung |
|--------|-----------|
| `audio_prosody` gibt immer `ai_likelihood=None` zurück | Engine hat de-facto **Gewicht 0** – fließt nie in Score ein |
| `clip_detector` braucht `data/clip_real_embeddings.npz` | Ohne diese Datei funktioniert clip_detector nicht, egal ob aktiviert |
| `xception_engine` gibt Score in 0-100 zurück (nicht 0-1) | Normalisierung in `ensemble.py` via `_normalize_ai01()` bereits korrekt |
| `audio_forensics` baseline startet bei 0.50 | Score ist per Design minimal differenzierend |
| `video_forensics` nutzt bereits ELA + pHash aus `image_forensics.py` | Solide Basis – besser als `video_temporal` |
| `librosa` wird in keiner Engine importiert | Dependency nicht garantiert vorhanden – nur numpy/scipy nutzen |

---

## AUDIO-Optimierung (Schritt 1–3)

---

### Schritt A1 – audio_forensics: MFCC-basierte Analyse ersetzen die Heuristik

**Beschreibung:**
Die Funktion `_score_audio()` in `Backend/engines/audio_forensics_engine.py` basiert auf Clipping, ZCR und Silence – das sind Aufnahmequalitätssignale, keine KI-Indikatoren. Diese werden durch MFCC-Features ersetzt, die robuste Unterschiede zwischen menschlicher Sprache und TTS-Systemen messen.

**Direkt ausführbarer Prompt:**
```
Ändere die Datei Backend/engines/audio_forensics_engine.py.

Ersetze die Funktion _score_audio(metrics) durch eine neue Funktion _score_audio_mfcc(samples, sample_rate).

WICHTIG: Das Return-Format von run_audio_forensics() darf sich NICHT ändern.
Die Funktion muss weiterhin zurückgeben:
{
    "engine": "audio_forensics",
    "status": "ok",
    "ai_likelihood": <float 0-1>,
    "confidence": <float 0-1>,
    "signals": [<bis zu 6 strings>],
    "notes": <string>,
    "timing_ms": <int>,
    "available": True
}

Die neue Scoring-Logik:

1. Berechne 13 MFCC-Koeffizienten via numpy (manuelle DCT auf Mel-Filterbank):
   - Frame-Size: 512 Samples bei 16kHz (32ms)
   - Hop: 256 Samples (50% Overlap)
   - Mel-Filter: 26 Filter, 0-8000 Hz
   - Nimm scipy.fft.dct oder numpy implementiere es direkt

2. Berechne folgende Features aus den MFCCs:
   - mfcc_std_mean: Mittelwert der Standardabweichungen über alle 13 Koeffizienten (hoher Wert = natürlich)
   - mfcc_delta_energy: Energie der Delta-MFCCs (Δ zwischen aufeinanderfolgenden Frames)
   - spectral_rolloff_85: Frequenz unter der 85% der Spektralenergie liegen
   - hnr_approx: Harmonics-to-Noise-Ratio Approximation via ACF (autokorrelation)
     - voiced_peak / (total_energy - voiced_peak)
     - Wertebereich: 0.0 (rauschen) bis 1.0 (rein harmonisch)
     - TTS hat typisch HNR > 0.7, echte Sprache 0.3-0.6

3. Score-Formel (alles 0-1 skaliert):
   stability_score = 1.0 - clamp01(mfcc_std_mean / 2.0)   # niedrige Varianz = TTS-typisch
   delta_score = 1.0 - clamp01(mfcc_delta_energy * 5.0)    # wenig Delta = TTS-typisch
   hnr_score = clamp01((hnr_approx - 0.5) * 2.0)           # hoher HNR = TTS-typisch
   rolloff_score = clamp01((spectral_rolloff_85 - 3000) / 5000.0)  # zu glatt = KI-typisch

   ai_likelihood = clamp01(
       0.25 * stability_score +
       0.25 * delta_score +
       0.30 * hnr_score +
       0.20 * rolloff_score
   )

4. Confidence:
   - Basis: 0.55
   - duration < 2.0s: min(confidence, 0.35)
   - Wenn weniger als 10 Frames analysiert: min(confidence, 0.40)

5. Signals (als Strings):
   ["mfcc_std_mean:{wert:.4f}", "mfcc_delta:{wert:.4f}", "hnr_approx:{wert:.4f}",
    "spectral_rolloff:{wert:.1f}", "frames_analyzed:{n}", "duration_s:{s:.2f}"]

6. Keine neuen Imports außer was schon vorhanden ist (os, numpy, scipy.fft wenn vorhanden, wave, subprocess).
   Falls scipy nicht importierbar: DCT selbst implementieren via numpy cos-transform.
```

**Betroffene Dateien:**
- `Backend/engines/audio_forensics_engine.py`
  - Funktion `_compute_metrics()` → ersetzen durch `_compute_mfcc_features(samples, sample_rate)`
  - Funktion `_score_audio()` → ersetzen durch `_score_audio_mfcc(features)`
  - Funktion `_build_signals()` → anpassen an neue Feature-Names
  - `run_audio_forensics()` → nur interne Calls ändern, Interface bleibt identisch

**Erwartetes Ergebnis:**
- TTS-Audio (VALL-E, Bark, Elevenlabs) → `ai_likelihood` > 0.60
- Echte menschliche Sprache (rauschartig, natürliche Jitter) → `ai_likelihood` < 0.40
- Confidence steigt von ~0.55 auf bis zu 0.70 bei klaren Fällen

**Zeitschätzung:** 2-3h

---

### Schritt A2 – audio_prosody: Aus Signal-Only-Engine einen echten Scorer machen

**Beschreibung:**
`run_audio_prosody()` gibt seit Anbeginn `ai_likelihood=None` zurück – die Engine liefert ausschließlich Prosody-Signale und trägt **nie** zum Score bei, obwohl sie Gewicht 0.05 hat. Die vorhandenen Features (F0 CV, Jitter, RMS CV) sind klinisch validiert als TTS-Indikatoren und müssen in einen Score umgewandelt werden.

**Direkt ausführbarer Prompt:**
```
Ändere die Datei Backend/engines/audio_prosody_engine.py.

In der Funktion run_audio_prosody(), nach dem Aufruf von _compute_prosody():

1. Extrahiere aus den signals folgende Werte (via Name-Lookup):
   f0_cv    = signal["value"] where signal["name"] == "f0_cv"      (default: None)
   jitter_cv = signal["value"] where signal["name"] == "jitter_cv"  (default: None)
   rms_cv   = signal["value"] where signal["name"] == "rms_cv"     (default: None)
   voiced_ratio = signal["value"] where signal["name"] == "voiced_ratio" (default: None)

2. Score-Formel:
   # TTS hat unnatürlich stabile F0 (niedriger f0_cv), niedrigen Jitter, gleichmäßige Energie
   f0_stability_score = 0.0
   if f0_cv is not None:
       # TTS: f0_cv typisch < 0.05; Mensch: f0_cv typisch 0.10-0.30
       f0_stability_score = clamp01(1.0 - f0_cv / 0.15)

   jitter_stability_score = 0.0
   if jitter_cv is not None:
       # TTS: jitter_cv < 0.03; Mensch: jitter_cv 0.05-0.15
       jitter_stability_score = clamp01(1.0 - jitter_cv / 0.10)

   energy_flatness_score = 0.0
   if rms_cv is not None:
       # TTS: rms_cv typisch < 0.30; Mensch: rms_cv 0.40-0.80
       energy_flatness_score = clamp01(1.0 - rms_cv / 0.50)

   voiced_bonus = 0.0
   if voiced_ratio is not None and voiced_ratio > 0.90:
       # TTS spricht sehr gleichmäßig – hoher voiced_ratio ist verdächtig
       voiced_bonus = clamp01((voiced_ratio - 0.90) * 3.0) * 0.15

   if warning is not None:  # "low_voiced_or_pitch"
       ai_likelihood = None
       confidence = 0.0
   elif f0_cv is None and jitter_cv is None:
       ai_likelihood = None
       confidence = 0.0
   else:
       available_scores = [s for s in [f0_stability_score, jitter_stability_score, energy_flatness_score] if s > 0.0]
       if available_scores:
           base_score = sum(available_scores) / len(available_scores) + voiced_bonus
           ai_likelihood = clamp01(base_score)
       else:
           ai_likelihood = None
       confidence = 0.50 if ai_likelihood is not None else 0.0

3. Ändere den Return-Call:
   return _result(
       status="ok" if ai_likelihood is not None else "not_available",
       available=ai_likelihood is not None,
       ai_likelihood=ai_likelihood,
       confidence=confidence,
       signals=signals,
       notes="prosody_scored" if ai_likelihood is not None else "prosody_signals_only",
       start_time=start,
       warning=warning,
   )

WICHTIG: Das Return-Format ändert sich nicht strukturell.
Nur ai_likelihood und confidence werden jetzt befüllt wenn Daten vorhanden.
```

**Betroffene Dateien:**
- `Backend/engines/audio_prosody_engine.py`
  - `run_audio_prosody()` → Score-Berechnung nach `_compute_prosody()` einfügen
  - Sonst nichts

**Erwartetes Ergebnis:**
- Engine produziert erstmals Scores und fließt in den gewichteten Durchschnitt ein
- TTS-Audio: ai_likelihood > 0.65 (sehr stabile F0, wenig Jitter)
- Echte Sprache: ai_likelihood 0.30-0.55

**Zeitschätzung:** 1h

---

### Schritt A3 – ensemble.py: Audio-Gewichte korrigieren

**Beschreibung:**
AASIST hat 70% Gewicht – ein Single-Point-of-Failure. Nach den Verbesserungen an audio_forensics und audio_prosody sollten die Gewichte neu verteilt werden. Gleichzeitig: `audio_prosody` hatte de facto 0% – nach Schritt A2 muss das Gewicht aktiviert werden.

**Direkt ausführbarer Prompt:**
```
Ändere die Datei Backend/ensemble.py.

Suche den Block ENGINE_WEIGHTS (ab Zeile ~57) und ändere den "audio"-Abschnitt:

ALT:
    "audio": {
        "audio_aasist": 0.70,
        "audio_forensics": 0.25,
        "audio_prosody": 0.05,
        "reality_defender_audio": 0.15,
    },

NEU:
    "audio": {
        "audio_aasist": 0.55,
        "audio_forensics": 0.25,
        "audio_prosody": 0.15,
        "reality_defender_audio": 0.15,
    },

Keine anderen Änderungen. Nur diese 3 Zeilen im audio-Dict.
```

**Betroffene Dateien:**
- `Backend/ensemble.py` – Zeile ~78 bis ~82 (ENGINE_WEIGHTS["audio"])

**Erwartetes Ergebnis:**
- AASIST-Ausfall reduziert den Gesamtausfall von 70% auf 55%
- audio_prosody trägt nach Schritt A2 erstmals 15% bei
- Gesamtgewicht ohne reality_defender_audio: 0.95 (normalisiert korrekt)

**Zeitschätzung:** 5 Minuten

---

## IMAGE-Optimierung (Schritt 4–6)

---

### Schritt B1 – Xception-Kalibrierung aktivieren (sofort, kein Code nötig)

**Beschreibung:**
Die Temperature-Scaling-Kalibrierung für xception und clip_detector ist vollständig implementiert in `ensemble.py` (`_apply_local_calibration()`, `_calibration_enabled()`, `_calibration_temperature()`). Sie ist nur über ENV deaktiviert. Aktivierung erfordert nur `.env`-Anpassung.

**Direkt ausführbarer Prompt:**
```
Füge in die Datei .env (Projektroot oder Backend/.env) folgende Zeilen ein,
falls sie nicht bereits vorhanden sind:

AIREALCHECK_IMAGE_CALIBRATION_ENABLE=true
AIREALCHECK_IMAGE_CALIBRATION_TEMPERATURE=1.5

BEGRÜNDUNG: Temperature 1.5 macht überconfidente Modelle (xception tendiert dazu,
extreme Werte nahe 0 oder 1 auszugeben) moderater. logit wird durch 1.5 geteilt
→ sigmoid(logit/1.5) zieht Extremwerte zur Mitte, Wert 0.9 wird zu ~0.80,
Wert 0.1 wird zu ~0.20. Das verbessert Kalibrierung ohne Erkennungsrate zu ändern.

Danach Backend-Server neu starten. Keine Codeänderung nötig.
Betroffene Engines: xception, clip_detector (via _CALIBRATION_ENGINES in ensemble.py Zeile ~333)
```

**Betroffene Dateien:**
- `.env` (nur ENV-Variable)

**Erwartetes Ergebnis:**
- Xception-Scores werden moderater → weniger extreme False Positives/Negatives
- Confidence-Werte realistischer

**Zeitschätzung:** 5 Minuten

---

### Schritt B2 – clip_detector vorbereiten und aktivieren

**Beschreibung:**
`clip_detector` ist via `AIREALCHECK_ENABLE_CLIP_DETECTOR=false` deaktiviert. Der Code ist vollständig implementiert. Das Problem: Die Engine benötigt `data/clip_real_embeddings.npz` – eine NPZ-Datei mit vorberechneten CLIP-Embeddings echter Bilder. Ohne diese Datei scheitert die Engine immer mit `embeddings_missing`.

**Direkt ausführbarer Prompt:**
```
Erstelle ein Python-Script Backend/scripts/create_clip_embeddings.py das:

1. Einen Ordner data/real_images/ liest (muss vorher manuell mit echten Bildern befüllt werden)
2. CLIP-Modell ViT-B-32 lädt (open_clip oder openai/clip)
3. Embeddings für alle Bilder berechnet
4. Das Ergebnis als data/clip_real_embeddings.npz speichert
   Format: np.savez("data/clip_real_embeddings.npz", embeddings=array)
   Array-Shape: (N, 512) als float32

Script-Aufruf: python -m Backend.scripts.create_clip_embeddings

Anforderungen:
- Mindestens 100 echte Bilder in data/real_images/ (JPG/PNG)
- torch + open_clip (oder clip) müssen installiert sein
- Script gibt Fortschritt aus: "Verarbeite Bild 1/100..."
- Falls ein Bild fehlschlägt: überspringen mit Warning, nicht abbrechen
- Am Ende: "Embeddings gespeichert: N Bilder → data/clip_real_embeddings.npz"

DANACH (separat): .env ergänzen mit:
AIREALCHECK_ENABLE_CLIP_DETECTOR=true
AIREALCHECK_CLIP_SIM_LOW=0.18
AIREALCHECK_CLIP_SIM_HIGH=0.32
AIREALCHECK_CLIP_TOPK=5

WICHTIG: clip_detector erst aktivieren NACHDEM clip_real_embeddings.npz existiert.
```

**Betroffene Dateien:**
- NEU: `Backend/scripts/create_clip_embeddings.py`
- `.env` (nach Erstellung der Embeddings)

**Erwartetes Ergebnis:**
- clip_detector liefert Scores (0-100) mit confidence 0.30-0.85
- Fließt mit Gewicht 0.12 in den Image-Score ein
- Mit 100 echten Referenzbildern: Grundlegende Differenzierung möglich

**Zeitschätzung:** 2h (Script 30min, Bilder sammeln 1-1.5h)

---

### Schritt B3 – Xception-Fallback verbessern: Frequency-Domain-Analyse ergänzen

**Beschreibung:**
Xception ist auf FaceForensics++ trainiert und erkennt Gesichts-Deepfakes gut, aber GAN- und Diffusions-Bilder (Stable Diffusion, Midjourney) schlecht. Eine einfache Frequency-Domain-Analyse (DCT-Spektrum, Azimuth-Power-Spektrum) kann KI-typische Gittermuster erkennen – besonders bei GAN-Outputs. Diese Analyse wird als neue Engine `freq_domain` in `engines/freq_domain_engine.py` implementiert.

**Direkt ausführbarer Prompt:**
```
Erstelle eine neue Datei Backend/engines/freq_domain_engine.py

Die Engine analysiert das Frequenzspektrum eines Bildes auf KI-typische Artefakte.
GAN-generierte Bilder zeigen charakteristische Gittermuster im DCT/FFT-Spektrum.

Implementiere run_freq_domain(file_path: str) → dict

Return-Format (identisch zu anderen Engines):
{
    "engine": "freq_domain",
    "status": "ok"|"error"|"not_available",
    "available": bool,
    "ai_likelihood": float (0-1) oder None,
    "confidence": float (0-1),
    "signals": [bis zu 6 strings],
    "notes": string,
    "timing_ms": int
}

Algorithmus:

1. Bild laden mit PIL (RGB → Graustufen)
   Resize auf 256x256 (Standard für FFT-Analyse)

2. FFT-Analyse:
   - numpy.fft.fft2 auf Graustufen-Array
   - numpy.fft.fftshift zum Zentrieren
   - magnitude_spectrum = 20 * log10(|FFT| + 1)

3. Azimuth-Power-Spektrum (radiale Durchschnittspower):
   - Teile das Spektrum in 36 Winkel-Bins à 10°
   - Berechne Durchschnitts-Magnitude pro Winkel-Bin
   - azimuth_std = Standardabweichung der 36 Bins
   - GAN-Bilder haben hohe azimuth_std (anisotropes Spektrum)
   - Echte Bilder: azimuth_std typisch < 3.0
   - GAN-Bilder: azimuth_std typisch > 5.0

4. High-Frequency-Ratio:
   - Verhältnis von Energie im äußeren 20% des Spektrums zur Gesamtenergie
   - GAN-Bilder: hf_ratio typisch > 0.40
   - Echte Bilder: hf_ratio typisch < 0.30
   - Diffusion-Modelle: hf_ratio zwischen 0.30-0.45

5. Peak-Detection:
   - Finde die Top-5 lokalen Maxima im Spektrum (außerhalb Zentrum-Kreis r>10px)
   - peak_regularity = Varianz der Abstände zwischen Peaks (niedrig = Gittermuster)
   - GAN: niedrige peak_regularity (regelmäßige Gitter-Peaks)

6. Score-Formel:
   azimuth_score = clamp01((azimuth_std - 3.0) / 4.0)       # > 3.0 = verdächtig
   hf_score = clamp01((hf_ratio - 0.28) / 0.20)             # > 0.28 = verdächtig
   peak_score = clamp01(1.0 - peak_regularity / 0.5)         # < 0.5 = regelmäßig = KI

   ai_likelihood = clamp01(0.40 * azimuth_score + 0.35 * hf_score + 0.25 * peak_score)

7. Confidence:
   - Basis: 0.50
   - Wenn ai_likelihood > 0.70 oder < 0.30: confidence = 0.65
   - Sonst: confidence = 0.45

8. Signals:
   ["azimuth_std:{v:.4f}", "hf_ratio:{v:.4f}", "peak_regularity:{v:.4f}",
    "resolution:256x256", "method:fft2_azimuth"]

Imports erlaubt: os, time, numpy, PIL.Image
Keine externen Dependencies.

DANACH: Registriere freq_domain in Backend/ensemble.py:
- Füge "freq_domain" zu IMAGE_ENGINES Liste hinzu
- Füge "freq_domain": 0.08 zu ENGINE_WEIGHTS["image"] hinzu
  (Gleichzeitig xception-Gewicht von 0.08 auf 0.06 reduzieren
   um Gesamtsumme stabil zu halten)
- Füge den Import hinzu: from Backend.engines.freq_domain_engine import run_freq_domain
- Füge "freq_domain" zu DETECTOR_ENGINES_IMAGE Set hinzu
- Im _run_image_engines() Handler: freq_domain analog zu forensics verdrahten
  (Wie der Handler auf freq_domain reagiert: identisch zu run_forensics Aufruf)
```

**Betroffene Dateien:**
- NEU: `Backend/engines/freq_domain_engine.py`
- `Backend/ensemble.py` – IMAGE_ENGINES Liste, ENGINE_WEIGHTS, Imports, _run_image_engines()

**Erwartetes Ergebnis:**
- GAN-generierte Bilder (DALL-E 2 style, StyleGAN) werden besser erkannt
- Diffusion-Bilder: moderate Verbesserung
- Echte Fotos: niedrige false-positive Rate (Naturbilder haben stochastisches Spektrum)

**Zeitschätzung:** 3-4h (Code + Testen)

---

## VIDEO-Optimierung (Schritt 7–8)

---

### Schritt C1 – video_temporal: Optical-Flow-basierte Logik durch Frame-Inkonsistenz ersetzen

**Beschreibung:**
Die Funktion `run_video_temporal()` in `Backend/engines/video_temporal_engine.py` verwendet Optical Flow (Farneback) als primären AI-Indikator – das ist falsch. Optical Flow misst Bewegung, nicht KI-Artefakte. Die Engine wird so umgebaut, dass sie auf **Frame-zu-Frame-Inkonsistenz** und **Schärfe-Anomalien** fokussiert – Signale die bei KI-generierten Videos tatsächlich auffallen.

**Direkt ausführbarer Prompt:**
```
Ändere die Datei Backend/engines/video_temporal_engine.py.

Ersetze den gesamten Analyse-Block in run_video_temporal() ab der Zeile
"flow_mags = []" bis zum finalen make_engine_result()-Aufruf.

NEUE LOGIK (behalte Frame-Extraktion und alles davor bei):

Berechne folgende Metriken über alle Frame-Paare:

1. Sharpness-Konsistenz:
   sharpness_values = []
   for each frame:
       gray = cv2.cvtColor(frame, BGR2GRAY)
       lap = cv2.Laplacian(gray, CV_32F)
       sharpness_values.append(float(np.var(lap)))

   sharpness_cv = std(sharpness_values) / mean(sharpness_values)
   # KI-Videos: abrupte Schärfewechsel zwischen Frames (hoher CV)
   # Echte Videos: gleichmäßige Schärfe (niedriger CV)

2. Pixel-Differenz-Konsistenz:
   frame_diffs = []
   for consecutive frame pairs (prev, curr):
       diff = abs(curr_gray.float - prev_gray.float)
       frame_diffs.append(mean(diff))

   diff_cv = std(frame_diffs) / mean(frame_diffs) if mean > 0 else 0.0
   # KI-Videos: unnatürlich gleichmäßige Differenzen (niedriger diff_cv)
   # Echte Videos: variable Unterschiede durch Kamerabewegung (höherer diff_cv)

3. Blocking-Artefakt-Score (für komprimierte KI-Videos):
   block_scores = []
   for each frame:
       # 8x8 DCT-Block Varianz (H.264-typische Blockartefakte bei KI-Videos)
       h, w = gray.shape
       block_vars = []
       for y in range(0, h-8, 8):
           for x in range(0, w-8, 8):
               block = gray[y:y+8, x:x+8].astype(float)
               block_vars.append(np.var(block))
       if block_vars:
           block_scores.append(np.mean(block_vars))
   blocking_score = np.std(block_scores) / (np.mean(block_scores) + 1e-6) if block_scores else 0.0

4. Score-Formel:
   sharpness_ai_score = clamp01((sharpness_cv - 0.20) / 0.60)    # CV > 0.20 = verdächtig
   diff_ai_score = clamp01(1.0 - diff_cv / 0.50)                  # niedriger CV = verdächtig
   blocking_ai_score = clamp01(blocking_score / 2.0)

   ai_likelihood = clamp01(
       0.40 * sharpness_ai_score +
       0.35 * diff_ai_score +
       0.25 * blocking_ai_score
   )

   # Kein Clamp bei 0.85 mehr – max ist 1.0

5. Confidence:
   if frames_ok >= 8: confidence = 0.65   # war 0.50 → auf 0.65 angehoben
   elif frames_ok >= 5: confidence = 0.55  # war 0.40 → auf 0.55 angehoben
   else: confidence = 0.40

6. Signals:
   [f"frames_analyzed:{frames_ok}", f"sharpness_cv:{sharpness_cv:.4f}",
    f"diff_cv:{diff_cv:.4f}", f"blocking:{blocking_score:.4f}",
    f"sharpness_ai:{sharpness_ai_score:.4f}", f"diff_ai:{diff_ai_score:.4f}"]

Der Rest (make_engine_result-Aufruf) bleibt identisch.
```

**Betroffene Dateien:**
- `Backend/engines/video_temporal_engine.py`
  - Analyse-Block ab `flow_mags = []` bis vor `return make_engine_result(...)` ersetzen
  - Import der `statistics`-Klasse am Anfang ggf. entfernen (nicht mehr nötig)

**Erwartetes Ergebnis:**
- Max confidence steigt von 0.50 auf 0.65
- Engine misst jetzt echte KI-Artefakte statt Bewegung
- Schnell generierte KI-Videos (gleichförmige Frames) werden besser erkannt

**Zeitschätzung:** 2h

---

### Schritt C2 – Video: Lokale Frame-basierte Xception-Analyse hinzufügen

**Beschreibung:**
Im Default-Betrieb ohne Paid APIs ist `video_frame_detectors` die höchstgewichtete Video-Engine (0.20), aber sie liefert **keine Sub-Engine-Ergebnisse** wenn alle APIs deaktiviert sind. Die Lösung: Eine neue Engine `video_xception_frames` extrahiert Video-Frames und analysiert jeden Frame lokal mit der bestehenden Xception-Engine.

**Direkt ausführbarer Prompt:**
```
Erstelle eine neue Datei Backend/engines/video_xception_frames_engine.py

Implementiere run_video_xception_frames(file_path: str) → dict

Diese Engine:
1. Prüft ob Xception verfügbar ist (torch + timm) – wenn nicht: status="not_available"
2. Prüft ob AIREALCHECK_USE_LOCAL_ML=true – wenn nicht: status="disabled"

3. Extrahiert 8 gleichmäßig verteilte Frames via cv2:
   cap = cv2.VideoCapture(file_path)
   total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
   indices = [int(i * total_frames / 8) for i in range(8)]
   # Frames als temporäre JPG-Dateien speichern in tempfile.mkdtemp()

4. Für jeden Frame: run_xception(frame_jpg_path) aufrufen
   (Import: from Backend.engines.xception_engine import run_xception)

5. Alle verfügbaren Frame-Scores aggregieren:
   available_scores = [r["ai_likelihood"] for r in frame_results
                       if r.get("available") and r.get("ai_likelihood") is not None]

   Wenn available_scores leer: status="not_available"

   Sonst:
   ai_mean = mean(available_scores) / 100.0   # xception gibt 0-100 zurück
   ai_max  = max(available_scores) / 100.0    # Worst-Frame-Score
   ai_likelihood = clamp01(0.60 * ai_mean + 0.40 * ai_max)
   # Kombination: Durchschnitt + "Worst-Case-Frame" erhöht Sensitivität

6. Confidence:
   n = len(available_scores)
   base_conf = 0.35 + (n / 8) * 0.25    # mehr Frames = höhere Konfidenz
   # Wenn alle Frames ähnlich (std < 10): confidence += 0.10
   if len(available_scores) >= 2:
       spread = max(available_scores) - min(available_scores)
       if spread < 10.0:
           base_conf = min(0.70, base_conf + 0.10)
   confidence = clamp01(base_conf)

7. Signals:
   [f"frames_analyzed:{n}", f"ai_mean:{ai_mean:.4f}", f"ai_max:{ai_max:.4f}",
    f"spread:{spread:.1f}", "method:xception_per_frame"]

8. Cleanup: Temporäre Frame-JPGs löschen (shutil.rmtree auf tmpdir)

Return-Format identisch zu anderen Engines.

DANACH: Registriere in Backend/ensemble.py:
- Füge "video_xception_frames" zu VIDEO_ENGINES Liste hinzu
- Füge "video_xception_frames": 0.14 zu ENGINE_WEIGHTS["video"] hinzu
  (Gleichzeitig video_temporal von 0.16 auf 0.14 reduzieren)
- Füge "video_xception_frames" zu VIDEO_ENGINE_GROUPS["local_models"] hinzu
- Füge Import hinzu: from Backend.engines.video_xception_frames_engine import run_video_xception_frames
- Füge "video_xception_frames" zu DETECTOR_ENGINES_VIDEO Set hinzu
- Im _run_video_engines() Handler: video_xception_frames verdrahten
```

**Betroffene Dateien:**
- NEU: `Backend/engines/video_xception_frames_engine.py`
- `Backend/ensemble.py` – VIDEO_ENGINES, ENGINE_WEIGHTS, DETECTOR_ENGINES_VIDEO, VIDEO_ENGINE_GROUPS, Imports, Handler

**Erwartetes Ergebnis:**
- Videos können jetzt lokal mit ML analysiert werden (Xception frame-by-frame)
- Deepfake-Videos mit synthetischen Gesichtern: bessere Erkennungsrate
- Gewichteter lokaler Video-Score steigt von 0.32 auf 0.46 des gesamten Pools

**Zeitschätzung:** 2-3h

---

## BENCHMARKING (Schritt 9–10)

---

### Schritt D1 – Test-Dataset-Struktur anlegen

**Beschreibung:**
Vor dem Aktivieren von Learned Weights muss ein Test-Dataset vorhanden sein. Hier wird die Ordnerstruktur und das Label-Format festgelegt.

**Direkt ausführbarer Prompt:**
```
Lege folgende Ordnerstruktur an (manuell oder via Script):

data/
├── test_dataset/
│   ├── image/
│   │   ├── real/        # Echte Fotos (min. 50 Stück, JPG/PNG)
│   │   └── ai/          # KI-generierte Bilder (min. 50 Stück)
│   ├── video/
│   │   ├── real/        # Echte Videos (min. 20 Stück, MP4)
│   │   └── ai/          # KI-generierte Videos (min. 20 Stück)
│   ├── audio/
│   │   ├── real/        # Echte Stimmen (min. 30 Stück, MP3/WAV)
│   │   └── ai/          # TTS-Audios (min. 30 Stück)
│   └── labels.json      # Auto-generiert durch Benchmarking-Script

labels.json Format:
{
  "version": "1.0",
  "entries": [
    {
      "id": "img_001",
      "file": "image/real/foto1.jpg",
      "label": 0,            // 0 = echt, 1 = KI
      "source": "eigene_kamera",
      "notes": ""
    }
  ]
}

Erstelle ein Script Backend/scripts/build_dataset_labels.py das:
- Alle Dateien in data/test_dataset/ scannt
- Automatisch label=0 für Dateien in /real/, label=1 für Dateien in /ai/ setzt
- labels.json schreibt
- Aufruf: python -m Backend.scripts.build_dataset_labels
```

**Betroffene Dateien:**
- NEU: `data/test_dataset/` (Ordnerstruktur)
- NEU: `Backend/scripts/build_dataset_labels.py`

**Erwartetes Ergebnis:**
- `data/test_dataset/labels.json` mit allen annotierten Samples
- Basis für Benchmarking-Script

**Zeitschätzung:** 30min Script + Zeit zum Sammeln der Testdaten

---

### Schritt D2 – Benchmarking-Script erstellen

**Beschreibung:**
Das Script führt alle Engines auf dem Test-Dataset aus, berechnet AUC-ROC, F1 und FPR pro Engine und Media-Typ, und schreibt das Ergebnis nach `data/benchmark_report.json` sowie `data/learned_weights.json`.

**Direkt ausführbarer Prompt:**
```
Erstelle Backend/scripts/run_benchmark.py

Das Script:

1. Lädt data/test_dataset/labels.json

2. Für jede Datei im Dataset:
   - Bestimmt media_type (image/video/audio) aus Ordnerpfad
   - Ruft das vollständige Ensemble auf: ensemble.run_ensemble(file_path, media_type)
   - Speichert: file, label, predicted_ai01, per_engine_results

3. Berechnet pro Engine (und pro media_type):
   - AUC-ROC (scipy.metrics oder manuelle Implementierung via Trapez)
   - F1-Score bei Threshold 0.50
   - False-Positive-Rate (FPR): Anteil echter Dateien die als KI erkannt werden
   - False-Negative-Rate (FNR): Anteil KI-Dateien die als echt erkannt werden
   - Mean-Score (avg ai_likelihood über alle Samples)

4. Schreibt data/benchmark_report.json:
   {
     "created_at": "<ISO8601>",
     "total_samples": { "image": N, "video": N, "audio": N },
     "per_engine": {
       "image": {
         "xception": { "auc": 0.82, "f1": 0.76, "fpr": 0.15, "fnr": 0.28, "n": 50 },
         "forensics": { "auc": 0.61, ... }
       },
       "video": { ... },
       "audio": { ... }
     },
     "ensemble": {
       "image": { "auc": 0.87, "f1": 0.83, "optimal_threshold": 0.48 },
       "video": { ... },
       "audio": { ... }
     },
     "decision_thresholds": {
       "image": 0.50,
       "video": 0.50,
       "audio": 0.50
     }
   }

5. Schreibt data/learned_weights.json basierend auf Engine-AUC:
   - Normalisiere AUC-Werte pro media_type auf Summe 1.0
   - Engines mit AUC < 0.55 erhalten Gewicht 0.0 (schlechter als Zufall)
   - Format: { "image": { "xception": 0.15, ... }, "video": { ... }, "audio": { ... } }

6. Output am Ende:
   "Benchmark fertig. Ergebnisse: data/benchmark_report.json"
   "Learned weights: data/learned_weights.json"
   "Top-Engine Image: <name> (AUC: <wert>)"
   "Top-Engine Audio: <name> (AUC: <wert>)"

Aufruf: python -m Backend.scripts.run_benchmark

Imports: os, json, time, numpy (für Trapez-AUC)
Kein sklearn erforderlich – AUC manuell berechnen.
```

**Betroffene Dateien:**
- NEU: `Backend/scripts/run_benchmark.py`
- OUTPUT: `data/benchmark_report.json`, `data/learned_weights.json`

**Nach Benchmarking:** `.env` ergänzen:
```
AIREALCHECK_ENABLE_LEARNED_WEIGHTS=true
AIREALCHECK_ENABLE_RUNTIME_THRESHOLDS=true
```

**Erwartetes Ergebnis:**
- Vollständige Übersicht über echte Engine-Performance
- Automatisch optimierte Gewichte basierend auf messbarer AUC
- Decision-Threshold pro Media-Type statt hardcoded 0.50

**Zeitschätzung:** 2-3h

---

## Zusammenfassung & Reihenfolge

| # | Schritt | Datei(en) | Aufwand | Impact |
|---|---------|-----------|---------|--------|
| A1 | audio_forensics MFCC | `audio_forensics_engine.py` | 2-3h | Hoch |
| A2 | audio_prosody Score-Fix | `audio_prosody_engine.py` | 1h | Mittel |
| A3 | Audio-Gewichte korrigieren | `ensemble.py` | 5min | Sofort |
| B1 | Xception-Kalibrierung | `.env` | 5min | Mittel |
| B2 | clip_detector + Embeddings | `create_clip_embeddings.py`, `.env` | 2h | Mittel |
| B3 | freq_domain Engine | `freq_domain_engine.py`, `ensemble.py` | 3-4h | Hoch |
| C1 | video_temporal Fix | `video_temporal_engine.py` | 2h | Hoch |
| C2 | video_xception_frames | `video_xception_frames_engine.py`, `ensemble.py` | 2-3h | Hoch |
| D1 | Test-Dataset-Struktur | `data/`, `build_dataset_labels.py` | 30min | Vorbereitung |
| D2 | Benchmarking-Script | `run_benchmark.py` | 2-3h | Langfristig hoch |

**Gesamtaufwand: ca. 15-20 Stunden**
**Empfohlene Reihenfolge:** A3 → B1 → A2 → A1 → C1 → B3 → C2 → B2 → D1 → D2

---

## Abhängigkeiten-Checklist

Vor Beginn prüfen (einmalig im Backend-Verzeichnis):

```python
# Prüfe ob verfügbar:
import numpy          # muss vorhanden sein
import cv2            # für Video-Engines
import scipy.fft      # für freq_domain (B3)
from PIL import Image  # für Bildanalyse
import torch          # für xception/clip
import timm           # für xception

# Audio:
# librosa NICHT voraussetzen – numpy-only implementieren
# ffmpeg: shutil.which("ffmpeg") muss Pfad zurückgeben
```

---

*Alle Schritte erfordern keinen Paid API-Zugang. Jeder Schritt kann unabhängig ausgeführt werden.*
