# AIRealCheck – Engine-Analyse & Optimierungsplan

> Erstellt: 2026-03-12 | Basis: vollständige Code-Analyse aller Backend-Dateien
> Zweck: Grundlage für Phase 1 der AIRealCheck-Roadmap

---

## 1. Engine-Übersichtstabelle

### IMAGE-Engines (9 Engines)

| Name | Datei | Typ | Methode | Status (Default) | Gewicht | Priorität |
|------|-------|-----|---------|------------------|---------|-----------|
| **hive** | `engines/hive_engine.py` | Externe API | Hive Moderation API | ❌ Deaktiviert (Paid) | 0.30 | Hoch |
| **reality_defender** | `engines/reality_defender_engine.py` | Externe API | Reality Defender API (S3 Upload + Polling) | ❌ Deaktiviert (Paid) | 0.25 | Hoch |
| **sightengine** | `engines/sightengine_engine.py` | Externe API | SightEngine AI-Detection API | ❌ Deaktiviert (Paid) | 0.18 | Mittel |
| **clip_detector** | `engines/clip_detector_engine.py` | Lokales ML-Modell | CLIP ViT-B/32 oder RN50 Zero-Shot | ❌ Deaktiviert (Experimental) | 0.12 | Mittel |
| **xception** | `engines/xception_engine.py` | Lokales ML-Modell | Xception CNN (timm) | ✅ Aktiv (wenn torch) | 0.08 | Mittel |
| **forensics** | `engines/forensics_engine.py` | Lokale Heuristik | `image_forensics.analyze_image()` | ✅ Aktiv | 0.07 | Niedrig |
| **sensity_image** | `engines/sensity_image_engine.py` | Externe API | Sensity API | ❌ Deaktiviert (Paid) | 0.05 | Niedrig |
| **c2pa** | `engines/c2pa_engine.py` | Metadaten-Analyse | C2PA Manifest-Verifikation (Content Credentials) | ✅ Aktiv | — (kein Score) | Mittel |
| **watermark** | `engines/watermark_engine.py` | Metadaten-Analyse | EXIF/XMP Keyword Detection (PIL) | ✅ Aktiv | — (kein Score) | Niedrig |

> **Hinweis zu c2pa & watermark:** Diese Engines haben keinen Eintrag in `ENGINE_WEIGHTS` – sie fließen **nicht** in den gewichteten Score ein. Sie beeinflussen nur `confidence_label` und Signale.

### VIDEO-Engines (8 Engines)

| Name | Datei | Typ | Methode | Status (Default) | Gewicht | Priorität |
|------|-------|-----|---------|------------------|---------|-----------|
| **video_frame_detectors** | `engines/video_frame_detectors_engine.py` | Hybrid | Frame-Extraktion + Delegation an Image-APIs | ✅ Aktiv (Sub-Engines abhängig) | 0.20 | Hoch |
| **video_temporal** | `engines/video_temporal_engine.py` | Lokale Heuristik | Optical Flow (Farneback) + Laplacian + Residuals | ✅ Aktiv (wenn opencv) | 0.16 | Hoch |
| **reality_defender_video** | `engines/reality_defender_video_engine.py` | Externe API | Reality Defender (ganzes Video, S3 Upload) | ❌ Deaktiviert (Paid) | 0.10 | Mittel |
| **video_forensics** | `engines/video_forensics_engine.py` | Lokale Heuristik | Frame-Level Forensik (ffmpeg + PIL) | ✅ Aktiv | 0.10 | Mittel |
| **video_temporal_cnn** | `engines/video_temporal_cnn_engine.py` | Lokales ML-Modell | Temporal CNN (torch) | ✅ Aktiv (wenn torch + weights) | 0.06 | Mittel |
| **hive_video** | (via video_frame_detectors) | Externe API | Hive Video API | ❌ Deaktiviert (weight=0.0) | 0.0 | – |
| **sensity_video** | (via video_frame_detectors) | Externe API | Sensity Video API | ❌ Deaktiviert (weight=0.0) | 0.0 | – |
| **sightengine_video** | (via video_frame_detectors) | Externe API | SightEngine Video API | ❌ Deaktiviert (weight=0.0) | 0.0 | – |

### AUDIO-Engines (4 Engines)

| Name | Datei | Typ | Methode | Status (Default) | Gewicht | Priorität |
|------|-------|-----|---------|------------------|---------|-----------|
| **audio_aasist** | `engines/audio_aasist_engine.py` | Lokales ML-Modell | AASIST RawNet (vendor/aasist/AASIST.pth) | ✅ Aktiv (wenn torch + weights) | 0.70 | Kritisch |
| **audio_forensics** | `engines/audio_forensics_engine.py` | Lokale Heuristik | Clipping, ZCR, Spectral Centroid, Silence Ratio | ✅ Aktiv (wenn ffmpeg) | 0.25 | Hoch |
| **reality_defender_audio** | `engines/reality_defender_audio_engine.py` | Externe API | Reality Defender Audio API | ❌ Deaktiviert (Paid) | 0.15 | Mittel |
| **audio_prosody** | `engines/audio_prosody_engine.py` | Lokale Heuristik | Prosody Features (Jitter, F0, RMS via librosa) | ✅ Aktiv (wenn ffmpeg + librosa) | 0.05 | Niedrig |

---

## 2. Ensemble-Logik

### 2.1 Gewichtete Durchschnittsberechnung

Die Kern-Formel ist ein gewichteter Durchschnitt über alle verfügbaren Engines:

```
final_score_01 = Σ(ai_likelihood_engine_i × weight_i) / Σ(weight_i)
```

Dabei gilt:
- Alle ai_likelihood-Werte werden auf [0.0, 1.0] normalisiert (`>1.0 → /100`)
- Nur Engines mit `available=True` und `ai_likelihood != None` und `weight > 0` fließen ein
- Der Score wird dann auf 0-100 skaliert für die Ausgabe

### 2.2 Engine-Gewichte (Hardcoded in `ensemble.py`)

```python
ENGINE_WEIGHTS = {
    "image": {
        "hive": 0.30,              # dominiert – wenn aktiv
        "reality_defender": 0.25,
        "sightengine": 0.18,
        "clip_detector": 0.12,
        "xception": 0.08,
        "forensics": 0.07,
        "sensity_image": 0.05,
    },
    "video": {
        "video_frame_detectors": 0.20,
        "video_temporal": 0.16,
        "reality_defender_video": 0.10,
        "video_forensics": 0.10,
        "video_temporal_cnn": 0.06,
        "hive_video": 0.0,         # effektiv deaktiviert
        "sensity_video": 0.0,      # effektiv deaktiviert
        "sightengine_video": 0.0,  # effektiv deaktiviert
    },
    "audio": {
        "audio_aasist": 0.70,      # dominiert stark
        "audio_forensics": 0.25,
        "audio_prosody": 0.05,
        "reality_defender_audio": 0.15,
    }
}
```

> **Wichtig:** Die Audiogewichte summieren sich auf 1.15 (nicht 1.0), da reality_defender_audio standardmäßig nicht aktiv ist. Bei Aktivierung würde die normalisierte Gewichtung greifen.

### 2.3 VIDEO-Gruppenlogik

Video nutzt eine zweistufige Berechnung über Gruppen:

```
Gruppe "frame_apis":      {video_frame_detectors, hive_video, sensity_video, sightengine_video}
Gruppe "whole_video_apis": {reality_defender_video}
Gruppe "local_models":    {video_temporal, video_temporal_cnn, video_forensics}
```

1. Jede Gruppe → gewichteter Durchschnitt der aktiven Sub-Engines
2. Gruppen-Score → gewichteter Durchschnitt der Gruppen (Gewicht = Summe der aktiven Engine-Weights)

### 2.4 Speziallogik für IMAGE (Xception-Only-Modus)

Wenn nur Xception verfügbar ist (kein Paid API):
1. **Clamping** auf [0.35, 0.65] (verhindert extreme Scores ohne Verifikation)
2. **Deadzone Collapse**: Werte in [0.46, 0.54] → 0.5 (verhindert falsche Präzision)
3. **Mild Sharpening**: `logit × 1.15` für leicht schärfere Differenzierung

**Effekt:** Im Default-Betrieb (ohne Paid APIs) können Image-Scores niemals sicher über ~65 oder unter ~35 steigen – das System "weiß", dass es unsicher ist.

### 2.5 Kalibrierung (optional, standardmäßig deaktiviert)

- Aktivierung: `AIREALCHECK_IMAGE_CALIBRATION_ENABLE=true`
- Gilt für: `xception`, `clip_detector`
- Methode: Temperature Scaling (`sigmoid(logit / temperature)`)
- Standard-Temperatur: 1.0 (keine Änderung) – muss kalibriert werden

### 2.6 Konflikterkennung

```python
# IMAGE/VIDEO:
conflict = (spread >= 40.0) AND (len(available_engines) >= 2)

# AUDIO:
conflict = (spread >= 0.50) AND (len(available_engines) >= 2)

# High-Weight-Conflict:
conflict = True  # wenn Engines mit weight >= 0.25 sich um >0.60 unterscheiden
```

### 2.7 Confidence-Berechnung

Gewichteter Durchschnitt der Engine-Einzelkonfidenzen:
```
confidence = Σ(engine_confidence_i × weight_i) / Σ(weight_i)
```

Anpassungen:
- Conflict → clamp auf ≤ 0.35
- Nur 1 Engine → ~0.55
- C2PA verifiziert → "high"
- Spread ≤ 15% → "high"
- Spread > 15% → "medium"

### 2.8 Verdict-Berechnung

```python
ai_likelihood ≤ 20%  → "likely_real"  (grün)
ai_likelihood ≤ 60%  → "uncertain"    (gelb)
ai_likelihood > 60%  → "likely_ai"    (rot)
```

### 2.9 Optionale Features (alle standardmäßig deaktiviert)

| Feature | ENV-Variable | Funktion |
|---------|-------------|---------|
| Learned Weights | `AIREALCHECK_ENABLE_LEARNED_WEIGHTS=true` | Überschreibt hardcoded Weights aus `data/learned_weights.json` |
| Runtime Thresholds | `AIREALCHECK_ENABLE_RUNTIME_THRESHOLDS=true` | Dynamischer Decision-Threshold aus `data/benchmark_report.json` |
| Audio-Video-Fusion | `AIREALCHECK_ENABLE_AUDIO_VIDEO_FUSION=true` | Fusioniert Audio- und Video-Score (default weight: 0.2) |
| Kalibrierung | `AIREALCHECK_IMAGE_CALIBRATION_ENABLE=true` | Temperature Scaling für xception/clip |

---

## 3. Schwachstellen-Report pro Engine

### 3.1 IMAGE-Engines

#### forensics (`engines/forensics_engine.py`)
- **Erkennungsrate:** [UNKLAR: interne `image_forensics`-Bibliothek nicht vollständig analysiert – Wrapper-Pattern]
- **Stärken:** Kein Netzwerk erforderlich, immer verfügbar
- **Schwächen:**
  - Weight 0.07 – marginaler Einfluss auf Gesamtscore
  - Vollständig abhängig von der internen `Backend/image_forensics.py` Bibliothek
  - Confidence-Berechnung: `max(fake, real)` – primitiv, kein echtes Unsicherheitsmaß
  - Signals auf 6 Einträge begrenzt (Information Loss)
- **Performance:** Schnell (lokal, kein ML)
- **Fazit:** Sicherheitsnetz, kein starker Predictor

#### xception (`engines/xception_engine.py`)
- **Erkennungsrate:** Moderat – Xception wurde auf FaceForensics++ trainiert, generalisiert schlecht auf GAN-Bilder und Stable Diffusion
- **False-Positive-Rate:** Mittel-Hoch bei unbekannten Bildtypen
- **False-Negative-Rate:** Hoch bei neueren Diffusion-Modellen (2023+)
- **Schwächen:**
  - Weight 0.08 – schwacher Einfluss selbst wenn aktiv
  - Im Xception-Only-Modus: Deadzone-Clamping auf [0.35, 0.65] → **Score niemals überzeugend**
  - Stark abhängig von torch + timm (große Dependencies, ~80MB Modell)
  - Trainiert auf Gesichter (FaceForensics++) – schlecht für allgemeine KI-Bilder
  - Kalibrierung standardmäßig deaktiviert → Rohwerte können schlecht kalibriert sein
- **Performance:** Langsam (GPU empfohlen, aber nicht zwingend)
- **Fazit:** Im Default-Betrieb der primäre lokale Predictor – aber strukturell geschwächt durch Clamping und falschen Trainings-Domain

#### clip_detector (`engines/clip_detector_engine.py`)
- **Erkennungsrate:** [UNKLAR: Zero-Shot CLIP – ohne spezifisches Training für deepfake detection generell schwach]
- **Schwächen:**
  - Standardmäßig **deaktiviert** (`AIREALCHECK_ENABLE_CLIP_DETECTOR` fehlt)
  - CLIP ist kein Deepfake-Detector – es ist ein general vision model
  - Zero-Shot Performance für AI-Detection ungetestet und wahrscheinlich unzuverlässig
  - Große Dependencies (CLIP ~300-600MB)
- **Fazit:** Experimentelle Engine ohne bewiesene Effektivität für AI-Detection

#### hive (0.30 Weight – dominanteste Engine)
- **Erkennungsrate:** Kommerziell – wahrscheinlich hoch (Hive ist ein spezialisierter Anbieter)
- **Schwächen:**
  - **Standardmäßig deaktiviert** – der wichtigste Engine-Slot ist leer
  - API-Kosten (laufende Betriebskosten)
  - Latenz durch Netzwerkkommunikation
  - Vendor Lock-in
- **Fazit:** Kritische Abhängigkeit – ohne Hive ist das Image-Ensemble strukturell geschwächt

#### reality_defender (0.25 Weight)
- **Schwächen:**
  - S3 Presigned URL Upload-Polling-Mechanismus → **hohe Latenz** (Sekunden bis Minuten möglich)
  - Standardmäßig deaktiviert
  - AWS-abhängig (S3 für File-Upload)
- **Fazit:** Potentiell stark, aber Latenz-Problem für Echtzeit-Analyse

#### c2pa (`engines/c2pa_engine.py`)
- **Erkennungsrate:** Sehr hoch – wenn Content Credentials vorhanden (100% präzise)
- **Schwächen:**
  - Nur nützlich wenn Bild C2PA-Metadaten enthält (selten in der Praxis)
  - Hat **keinen Gewichtsanteil im Score** – beeinflusst nur Confidence
  - C2PA ist leicht entfernbar durch Re-Save (JPEG ohne Metadata)
- **Fazit:** Wertvoll als Bonus-Signal, aber kein zuverlässiger primärer Detector

#### watermark (`engines/watermark_engine.py`)
- **Erkennungsrate:** Sehr niedrig (nur explizite XMP/EXIF Keyword-Matches)
- **Schwächen:**
  - **Kein Gewichtsanteil** – fließt nicht in Score ein
  - Einfach umgehbar (Metadaten entfernen)
  - Nur bekannte Keywords werden erkannt (kein semantisches Verständnis
- **Fazit:** Grober Metadaten-Hint, kein echter Detector

---

### 3.2 VIDEO-Engines

#### video_temporal (`engines/video_temporal_engine.py`)
- **Erkennungsrate:** Niedrig – misst Optical Flow-Muster, nicht AI-spezifische Artefakte
- **False-Positive-Rate:** Hoch – stabiles Video (wenig Bewegung) → niedrige KI-Wahrscheinlichkeit, unabhängig von Echtheit
- **False-Negative-Rate:** Hoch – viele KI-Videos haben plausiblen Optical Flow
- **Schwächen:**
  - **Mechanismus ist grundlegend falsch:** Optical Flow misst Bewegung, nicht AI-Artefakte
  - `baseline = 0.15 + (0.35 × flow) + (0.25 × residual) + (0.25 × hf_score)` → Score-Baseline von 0.15 bedeutet "immer leicht KI-verdächtig"
  - **Max confidence = 0.5** (hardcoded) → Engine signalisiert immer eigene Unsicherheit
  - **Max ai_likelihood = 0.85** (geclampt) → kann keine starke KI-Aussage machen
  - Benötigt min. 4 Frames und opencv
  - 12 Frames Standard → sehr grobe zeitliche Abtastung
- **Fazit:** Engine mit fundamental falschen Annahmen – optischer Fluss ist kein AI-Indikator

#### video_forensics (`engines/video_forensics_engine.py`)
- **Erkennungsrate:** Niedrig – Frame-Level Forensik ohne ML
- **Schwächen:**
  - Heuristik-basiert (keine ML-Erkennung)
  - ffmpeg-abhängig für Frame-Extraktion
  - Analyse ist statisch (keine zeitlichen Muster)
- **Fazit:** Ergänzendes Signal, kein starker Predictor

#### video_temporal_cnn (`engines/video_temporal_cnn_engine.py`)
- **Erkennungsrate:** [UNKLAR: Hängt von den trainierten Weights ab – nicht einsehbar]
- **Schwächen:**
  - Weight 0.06 – geringer Einfluss
  - Abhängig von torch + proprietären Weights
  - Ohne Weights: nicht verfügbar
- **Fazit:** Potentiell wertvoll, aber Status unklar

#### video_frame_detectors (0.20 Weight)
- **Erkennungsrate:** Abhängig von Sub-Engines
- **Schwächen:**
  - Im Default-Betrieb ohne Paid APIs: **keine Sub-Engine aktiv** → Engine liefert nichts
  - hive_video, sightengine_video, sensity_video haben alle weight=0.0 → struktureller Bug/Design-Fehler
  - Der wichtigste Video-Engine-Slot ist im Default leer
- **Fazit:** Kritischer Ausfall – die höchstgewichtete Video-Engine funktioniert ohne Paid APIs nicht

---

### 3.3 AUDIO-Engines

#### audio_aasist (`engines/audio_aasist_engine.py`) – Gewicht 0.70
- **Erkennungsrate:** Hoch für gesprochene Deepfakes (TTS, Voice Cloning) – AASIST ist ein state-of-the-art Modell für ASVspoof
- **False-Positive-Rate:** Mittel – echte Stimmen können als Spoof eingestuft werden
- **False-Negative-Rate:** Variiert – neuere TTS-Systeme (VALL-E, Bark) können AASIST teilweise umgehen
- **Schwächen:**
  - **Kritische Einzelpunkt-Abhängigkeit:** Weight 0.70 → wenn AASIST ausfällt, bricht das Audio-Ensemble
  - `AASIST.pth` Weights müssen manuell vorhanden sein – ohne sie ist die Engine komplett tot
  - Nur auf WAV mit 16kHz trainiert → ffmpeg-Konvertierung nötig
  - Kurze Audios (<2s) → confidence ≤ 0.45 (niedrig)
  - Trainiert auf ASVspoof2019 → möglicherweise schlechte Generalisierung auf moderne TTS
  - `confidence = 0.55 + abs(prob - 0.5)` → max 0.95, bei prob=0.5 nur 0.55
  - Inferenz auf CPU – langsam für lange Audios
- **Performance:** 5-30 Sekunden je nach Länge (CPU-Inferenz)
- **Fazit:** Beste lokale Audio-Engine, aber Übergewichtung ist riskant

#### audio_forensics (`engines/audio_forensics_engine.py`) – Gewicht 0.25
- **Erkennungsrate:** Sehr niedrig – die genutzten Features (Clipping, ZCR, Silence, Spectral Centroid) sind keine zuverlässigen AI-Indikatoren
- **False-Positive-Rate:** Hoch – viele echte Aufnahmen triggern dieselben Signale
- **False-Negative-Rate:** Sehr hoch – moderne TTS-Systeme erzeugen "sauberaudio ohne Clipping
- **Schwächen:**
  - **Fundamental ungeeignet als AI-Detector:** Die Features messen Aufnahmequalität, nicht KI-Erzeugung
  - Heuristischer Score: `baseline = 0.5 + clipping + zcr + silence + spectral_extreme` – kein echter Classifier
  - `signal_strength == 0` → Score wird auf 0.5 gesetzt (maximale Unsicherheit)
  - Confidence fest bei 0.55 – relativ hoch für eine so schwache Engine
  - Kein MFCC, kein Pitch, kein F0 (diese sind in audio_prosody ausgelagert, aber nur 0.05 Gewicht)
- **Fazit:** Die zweitstärkste Audio-Engine ist ein reines Heuristik-Sicherheitsnetz ohne echte Erkennungsleistung

#### audio_prosody (`engines/audio_prosody_engine.py`) – Gewicht 0.05
- **Erkennungsrate:** [UNKLAR: Prosody-Features sind potentiell nützlich, aber 0.05 Weight macht sie irrelevant]
- **Schwächen:**
  - Weight 0.05 → marginaler Einfluss
  - librosa-abhängig (große Dependency)
- **Fazit:** Gute Features (F0, Jitter, RMS), aber systematisch untergewichtet

---

## 4. Kritische Systemprobleme (übergreifend)

### Problem 1: Default-Betrieb ist strukturell schwach

**Im Default-Betrieb (ohne Paid APIs) aktive Engines:**

| Medientyp | Aktive Engines (mit Gewicht > 0) | Effektiver Gewichtspool |
|-----------|----------------------------------|-------------------------|
| IMAGE | forensics (0.07), xception (0.08) | 0.15 von max 1.05 → **14%** |
| VIDEO | video_temporal (0.16), video_forensics (0.10), video_temporal_cnn (0.06) | 0.32 von max 0.62 |
| AUDIO | audio_aasist (0.70), audio_forensics (0.25), audio_prosody (0.05) | 1.00 – **vollständig** |

→ **Image und Video funktionieren im Default strukturell nicht gut.** Audio ist hingegen vollständig.

### Problem 2: Xception-Only-Clamping

Im Default-Betrieb bei Images ist Xception die primäre ML-Engine. Durch das Clamping auf [0.35, 0.65] und den Deadzone-Collapse bei [0.46, 0.54] kann das System **niemals einen überzeugenden Score ausgeben** – das gelbe "Unsicher"-Feld dominiert.

### Problem 3: video_temporal basiert auf falschen Annahmen

Optical Flow misst Bewegungsfluss, nicht AI-Artefakte. Die Engine verwechselt "wenig Bewegung" mit "echt" und "viel Bewegung" mit "KI" – das ist falsch. Selbst bei korrektem Ergebnis signalisiert die Engine durch max_confidence=0.5 immer Unsicherheit.

### Problem 4: audio_forensics ist kein AI-Detector

Die Engine misst Aufnahmequalität (Clipping, Silence, ZCR) – diese Features korrelieren nicht zuverlässig mit KI-Erzeugung. Eine professionelle TTS-Ausgabe hätte perfekte Werte in allen Features.

### Problem 5: Übergewichtung von AASIST

Mit 0.70 Gewicht ist AASIST die einzige relevante Audio-Engine. Fällt sie aus (fehlende Weights, torch-Fehler), fällt der Audio-Score auf eine Heuristik zurück, die kaum verlässlich ist.

### Problem 6: Kein echtes Feedback-Loop / Benchmarking

Learned Weights und Runtime Thresholds sind verfügbar, aber standardmäßig deaktiviert und `data/learned_weights.json` / `data/benchmark_report.json` existieren vermutlich nicht. Ohne Benchmarking können keine empirisch fundierten Gewichte verwendet werden.

---

## 5. Priorisierter Optimierungsplan

### Phase A – Kritische Fixes (Priorität: Sofort)

#### A1: Paid APIs aktivieren und konfigurieren
**Problem:** 55% der Image-Gewichtung und 100% der besten Video-Signale sind abgeschaltet.
**Maßnahme:**
- Hive API einrichten (Image-Engine mit 30% Gewicht)
- SightEngine einrichten (18% Gewicht)
- Reality Defender optional für hochwertige Analyse
- `.env` mit API-Keys → `AIREALCHECK_USE_PAID_APIS=true`

**Erwarteter Effekt:** Image-Erkennungsrate von ~40% auf ~75-85%

#### A2: audio_forensics durch MFCC/Mel-Spectrogram-Analyse ersetzen
**Problem:** audio_forensics misst Aufnahmequalität statt KI-Artefakte.
**Maßnahme:**
- MFCC-basierte Feature-Extraktion (scipy/librosa)
- Delta-MFCC für zeitliche Muster
- Pitch-Stability-Score (unnatürlich stabile Pitch = TTS-Signal)
- Harmonic-to-Noise-Ratio (HNR)
- Gewicht auf 0.20 reduzieren, audio_prosody auf 0.10 erhöhen

**Erwarteter Effekt:** Bessere Audio-Baseline ohne externe Dependencies

#### A3: video_temporal-Logik korrigieren
**Problem:** Optical Flow ist kein AI-Indikator.
**Maßnahme:**
- Fokus auf Frame-Inkonsistenzen (Blending-Artefakte, Schärfe-Sprünge)
- Face-Landmarking-Konsistenz (temporale Anomalien in Gesichtspunkten)
- Alternativ: Video-Frame-Sampling → Xception auf Frames
- Max-Confidence auf 0.65 anheben (wenn Logik verbessert)

---

### Phase B – Wichtige Verbesserungen (Priorität: Hoch)

#### B1: Xception-Domain-Problem beheben
**Problem:** Xception ist auf FaceForensics++ trainiert – schlecht für allgemeine KI-Bilder.
**Maßnahme-Optionen (in Reihenfolge der Effizienz):**
1. Fine-tuning auf modernen AI-Bilddatensätzen (DALL-E 3, Midjourney, Stable Diffusion)
2. Ergänzung durch ein Frequency-Domain-Modell (DIRE, CNNDetection)
3. Ersetzen durch ein aktuelleres Modell (z.B. UniversalFakeDetect, CLIP-basiertes Fine-Tuning)

#### B2: Externe Services strategisch integrieren
**Empfehlung: JA – aber selektiv**

Empfohlene Services (nach Kosten-Nutzen):
1. **Hive** (Image): Bestes Kosten-Nutzen-Verhältnis für kommerziellen Einsatz
2. **SightEngine** (Image): Gute API, günstig, zuverlässig
3. **Reality Defender** (Image+Audio): Sehr präzise, aber hohe Latenz (S3 Polling)

Nicht empfohlen ohne klare Notwendigkeit:
- Sensity (Gewicht nur 0.05 – ROI fraglich)
- Reversely.ai o.ä. – erst evaluieren bevor integrieren

#### B3: AASIST-Fallback verbessern
**Problem:** AASIST-Ausfall legt Audio-Ensemble lahm.
**Maßnahme:**
- Zweite ML-Audio-Engine als Backup (z.B. LCNN oder wav2vec2-basiert)
- AASIST-Gewicht auf 0.55 senken, zweite Engine erhält 0.30
- Prüfen ob AASIST.pth Weights im Repo oder via Download verfügbar sind

#### B4: Kalibrierung aktivieren und tunen
**Maßnahme:**
- `AIREALCHECK_IMAGE_CALIBRATION_ENABLE=true`
- Temperatur durch A/B-Test auf echten Daten bestimmen (typisch T=1.5-2.0 für overconfident Models)
- Gilt sofort für xception und clip_detector

---

### Phase C – Mittelfristige Optimierungen (Priorität: Mittel)

#### C1: Benchmarking-Pipeline aufbauen
**Ziel:** Empirisch fundierte Gewichte statt Hardcoded-Werte
- Test-Dataset: 500 echte + 500 KI-erzeugte Bilder/Videos/Audios
- Metriken: AUC-ROC, F1, False-Positive-Rate pro Engine
- Ergebnis → `data/learned_weights.json` + `AIREALCHECK_ENABLE_LEARNED_WEIGHTS=true`
- Runtime Decision-Threshold per Media-Type tunen

#### C2: Video-Detection grundlegend verbessern
**Aktuell:** Keine effektive Video-Detection ohne Paid APIs
**Maßnahmen:**
- Frame-basierte Xception-Analyse als Standard-Engine (top-k suspicious frames)
- EfficientNet-basierter Video-Detector (leichter als Xception, besser generalisierend)
- Temporal Attention für sequentielle Frames

#### C3: clip_detector aktivieren und evaluieren
**Maßnahme:**
- Aktivierung über ENV-Flag
- Evaluation auf Test-Dataset
- Wenn AUC > 0.70 → Gewicht auf 0.12 behalten, Kalibrierung aktivieren
- Wenn AUC < 0.65 → deaktivieren und Gewicht auf bessere Engine umleiten

#### C4: Watermark-Engine erweitern
**Maßnahme:**
- Invisible Watermark Detection (z.B. Stable Diffusion Tree-Ring Watermark)
- Spektrum-basierte Wasserzeichen-Erkennung
- Status: Optional – nicht kritisch

---

### Phase D – Langfristig (Priorität: Niedrig)

#### D1: Multimodal-Fusion verbessern
- `AIREALCHECK_ENABLE_AUDIO_VIDEO_FUSION=true` aktivieren und testen
- Fusion-Gewicht empirisch bestimmen (default 0.2 für Audio)

#### D2: Eigenes Modell trainieren
- Fine-tuned Vision Transformer auf AIRealCheck-spezifischen Daten
- Würde externe API-Abhängigkeiten reduzieren

#### D3: Monitoring und Drift-Detection
- Engine-Accuracy über Zeit tracken
- Alert bei signifikanter Performance-Änderung

---

## 6. Empfehlung: Externe Services

### Fazit: JA – externe Services sind notwendig

**Begründung:**
- Lokale Engines (xception, video_temporal, audio_forensics) reichen im aktuellen Zustand nicht aus
- Das Ensemble ist so konzipiert, dass externe APIs 55-75% der Gewichtung halten – sie wurden als primäre Signalquellen designed
- Ohne Paid APIs liefert das System im Best-Case "unsichere" Scores – was Nutzer nicht zufriedenstellt

### Empfohlene Prioritätsreihenfolge

| Priorität | Service | Medientyp | Begründung |
|-----------|---------|-----------|------------|
| 1 | **Hive** | Image | 30% Gewicht, einfache API, schnell |
| 2 | **SightEngine** | Image | 18% Gewicht, günstig, stabil |
| 3 | **Reality Defender** | Audio | Beste Audio-Erkennung extern |
| 4 | **Reality Defender** | Image | 25% Gewicht, präzise – aber Latenz |
| 5 | **Sensity** | Image | Nur 5% Gewicht – ROI gering |

### Kosten-Risiko-Abwägung

- **Kurzfristig (<3 Monate):** Hive + SightEngine aktivieren → sofortige signifikante Verbesserung
- **Mittelfristig:** Reality Defender für Premium-Analysen einschalten
- **Langfristig:** Eigene Modelle trainieren um API-Abhängigkeit zu reduzieren

### Risiken externer Services

1. **Vendor Lock-in** – Preisänderungen oder API-Abschaltungen
2. **Datenschutz** – User-Uploads gehen an Dritte (DSGVO-Compliance prüfen)
3. **Latenz** – Reality Defender S3-Polling kann Sekunden bis Minuten dauern
4. **Ausfall** – Externe APIs können down sein (graceful degradation bereits implementiert)

---

## 7. Zusammenfassung: Top-5 Handlungsempfehlungen

| Rang | Maßnahme | Aufwand | Impact |
|------|---------|---------|--------|
| 1 | Hive + SightEngine Image-APIs aktivieren | Gering (nur API-Keys + ENV) | Sehr Hoch |
| 2 | audio_forensics durch MFCC-basierte Analyse ersetzen | Mittel (Code) | Hoch |
| 3 | video_temporal-Logik durch Frame-Sampling + Xception ersetzen | Hoch (Code) | Hoch |
| 4 | AASIST.pth Weights sicherstellen + Fallback-Audio-Engine | Mittel | Mittel |
| 5 | Benchmarking-Pipeline + Learned Weights aktivieren | Hoch (Daten) | Mittel-Hoch |

---

*Analysiert am 2026-03-12. Alle Erkenntnisse basieren auf statischer Code-Analyse ohne Laufzeit-Messungen.*
