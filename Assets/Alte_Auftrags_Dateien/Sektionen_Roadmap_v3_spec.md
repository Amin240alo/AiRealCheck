---
title: "AIRealCheck"
subtitle: "Sektionen Roadmap v3"
author: "OpenAI"
date: "09.03.2026"
lang: "de-DE"
---

# AIRealCheck - Sektionen Roadmap v3

**Stand:** 09.03.2026  
**Dokumenttyp:** Produkt- und Umsetzungsroadmap v3  
**Produkt:** AIRealCheck  
**Scope:** Alle 10 Sidebar-Sektionen der App, inkl. Architektur-, Daten-, API-, UI/UX- und Monetarisierungsentscheidungen  
**App-Sprache:** Deutsch  
**Prompt-Sprache in Datei 3:** Englisch

---

## 1. Arbeitsgrundlage und Verifizierungsrahmen

### 1.1 Was in diesem Dokument als gesichert gilt
Dieses Dokument trennt bewusst zwischen drei Arten von Aussagen:

1. **Projektkontext aus dem bisherigen AIRealCheck-Verlauf**  
   Dazu gehören der bekannte Produktzweck, der bestehende Credits-Flow, ein vorhandener Auth-Flow, ein teilweise vorhandenes Admin-Panel, die Migration von Vanilla JS auf React/Next.js sowie die bekannte Problemlage beim Verlauf. Diese Punkte stammen aus dem Gesprächs- und Projektkontext dieser Arbeitssitzung. Sie wurden in dieser Aufgabe **nicht** direkt im Repository gegen den aktuellen Codebestand verifiziert.

2. **Extern verifizierte Markt- und Produktinformationen**  
   Diese sind mit Quellenmarkern wie `[Q1]` bis `[Q10]` belegt und im Quellenanhang aufgelöst.

3. **Empfehlungen / Ableitungen**  
   Diese sind bewusst als **Empfehlung**, **Soll**, **Vorschlag** oder **abgeleitete Entscheidung** formuliert. Sie sind keine behaupteten Ist-Fakten, sondern umsetzbare Architektur- und Produktentscheidungen, die aus Projektkontext, SaaS-Best-Practices und den recherchierten Marktbenchmarks abgeleitet wurden.

### 1.2 Was ich nicht bestätigen kann
- Ich kann **nicht bestätigen**, ob das aktuelle Produktions-Deployment bereits von SQLite auf PostgreSQL oder eine andere Datenbank umgestellt wurde. Aus dem Projektkontext ist für die Entwicklungsumgebung eine SQLite-basierte Struktur bekannt.
- Ich kann **nicht bestätigen**, welche exakten Flask-Endpunkte im aktuellen Stand bereits produktiv vorhanden, umbenannt oder intern refaktoriert wurden. Deshalb definiert diese Roadmap eine saubere Zielstruktur, die den bestehenden Auth-Flow nicht bricht.
- Ich kann **nicht bestätigen**, ob bereits ein voll funktionsfähiger Billing-Provider im Projekt verdrahtet ist. Deshalb beschreibt diese Roadmap Billing-Schnittstellen so, dass sie zunächst UI- und Backend-ready sind, ohne sofort einen Anbieter fest zu verdrahten.

---

## 2. Projektanalyse aus dem bisherigen AIRealCheck-Kontext

### 2.1 Produktzweck
AIRealCheck ist als professionelles SaaS-Tool gedacht, das erkennt, ob Inhalte KI-generiert oder echt / menschlich erstellt sind. Der Scope umfasst **Bilder, Audio und Video**. Der Produktcharakter ist nicht „Spielerei“, sondern **Verification / Trust / Security / Forensics light**.

### 2.2 Zielgruppen
Aus Produktlogik und Marktvergleich ergeben sich für AIRealCheck diese primären Zielgruppen:

- **Einzelanwender / Creator / Power User**  
  Wollen schnell prüfen, ob Bild-, Audio- oder Videomaterial wahrscheinlich echt oder synthetisch ist.
- **Publisher / Redaktionen / Research-Teams**  
  Brauchen nachvollziehbare Reports, Verlauf, Confidence-Erklärungen und exportierbare Ergebnisse.
- **Trust-&-Safety-Teams / Plattformen / Agenturen**  
  Brauchen wiederholbare Prüfprozesse, Team-Workflows, Credit-Verwaltung, Audit-Trails und Admin-Kontrolle.
- **Business- und Compliance-nahe Teams**  
  Brauchen Übersicht, Nachvollziehbarkeit, Account-Verwaltung, Rechnungs-/Abo-Kontext und Support-Struktur.

Diese Zielgruppenlogik passt zu vergleichbaren Marktangeboten: Winston AI positioniert sich u. a. für Institutionen, Educators und Publishers; GPTZero adressiert u. a. Teachers, Recruiters und Cybersecurity-Anwendungsfälle; Hive und Sensity adressieren Trust & Safety, Plattformen, Streaming, Corporate und Government-Use-Cases.[Q1][Q4][Q8][Q9]

### 2.3 Bekannter technischer Zustand aus dem Projektkontext
Bekannt bzw. sehr wahrscheinlich vorhanden:

- Frontend-Migration von einer älteren Vanilla-JS-Struktur auf **Next.js App Router + React + TypeScript**
- Bestehender **Auth-Flow**, der nicht gebrochen werden darf
- Bestehendes **Credits-System**
- Teilweise vorhandene **Analyse-UI**
- Teilweise vorhandenes **Admin-Panel**
- **Verlauf** ist nach der Migration funktional defekt bzw. leer
- Der User erwartet eine **dunkle, moderne, seriöse Security-Tool-Ästhetik**
- UI-Texte sollen in der App konsequent **Deutsch** bleiben

### 2.4 Geschäftsmodell-Stand
Bekannt aus dem Projektkontext:

- Es existiert bereits ein Credits-Modell.
- Neue Accounts starten im aktuellen Stand mit Credits.
- Credits werden erst nach Ergebnis / erfolgreicher Analyse belastet.
- Eine Premium-/Upgrade-Sektion ist noch nicht gebaut.

Das ist eine gute Ausgangslage, weil viele AI-Detection-Produkte Credits, Usage Units oder planabhängige Kontingente nutzen. Winston AI arbeitet credits-basiert, Sightengine operations-basiert, Copyleaks mit monatlichen Scan-Credits und Hive mit usage-based / enterprise pricing.[Q1][Q2][Q3][Q10]

---

## 3. Externe Markt- und Produktrecherche: wichtigste Erkenntnisse

### 3.1 Was der Markt heute zeigt
Die recherchierten Anbieter zeigen vier relevante Muster:

1. **Self-Serve für kleine Nutzer und Teams**  
   Winston AI und Copyleaks liegen im Self-Serve-Bereich grob im unteren bis mittleren zweistelligen Dollarbereich pro Monat, mit Kontingenten und Upsell in höhere Stufen.[Q1][Q10]

2. **Usage- oder operations-basierte Modelle für API / Moderation / Plattformen**  
   Sightengine und Hive setzen stark auf operation/usage-basierte Logik; Sightengine staffelt zusätzlich nach Performance und Video-Streaming-Kapazität.[Q2][Q3]

3. **Enterprise / Contact Sales für komplexe oder forensische Use Cases**  
   Sensity und Teile von Hive sind klar enterprise-orientiert, mit Fokus auf Forensik, Cloud/on-prem, Auditierbarkeit und Beratung statt einfacher Consumer-Pricing-Seite.[Q3][Q4]

4. **Nicht nur Erkennung, sondern Workflow**  
   Marktführer verkaufen nicht nur „einen Score“, sondern einen Workflow: Reports, Help Center, Documentation, Dashboard, Team/Rules, Billing-Verwaltung, History, Exporte, Support, Compliance-Signale.[Q1][Q5][Q6][Q7]

### 3.2 Ableitung für AIRealCheck
**Empfehlung:** AIRealCheck sollte sich im Produktdesign zwischen drei Welten positionieren:

- **schnell genug für Einzel- und Pro-User**
- **ernsthaft genug für Research, Redaktion und Trust & Safety**
- **sauber genug für spätere Business-/Team-Erweiterung**

Das bedeutet konkret:

- Keine rein spielerische Consumer-Oberfläche
- Keine überkomplexe Enterprise-Maschine im ersten Schritt
- Stattdessen: **professioneller Self-Serve mit glaubwürdiger Tiefe**

### 3.3 UI/UX-Muster, die übernommen werden sollten
Aus den Marktbeobachtungen und SaaS-Best-Practices folgt:

- Ergebnisseiten müssen **eine klare Primär-Aussage** haben
- Sekundärinfos wie Engine-Breakdown, technische Signale und Warnungen gehören in **saubere Informationshierarchie**
- Verlauf, Exporte und Nachvollziehbarkeit sind kein Extra, sondern Kernfunktion
- Billing / Upgrade / Subscription-Management muss in Konto + Pricing + CTA konsistent gespiegelt werden
- Support braucht mindestens **FAQ, Kontaktweg, Doku-Zugang und Status-Link**
- Admin braucht **Rules, Review, Logs, Health, User-Management, Kosten-Überblick**

Genau diese Muster sieht man auf den offiziellen Produkt- und Doku-Seiten von Winston, Hive, Sightengine und Sensity.[Q1][Q2][Q4][Q5][Q6][Q7]

---

## 4. Systemweite Produkt- und Architekturentscheidungen

## 4.1 Unveränderlicher Stack
- Frontend: **Next.js 16.1.6**, **App Router**, **TypeScript 5**, **React 19**
- Styling: **Tailwind CSS 4**, **Framer Motion 12**, **Lucide React**
- Utilities: **Sonner 2**, **clsx**, **tailwind-merge**, **CVA**
- Design-Richtung: dunkel, modern, professionell, seriös
- Primärfarben: Near-Black / Deep Charcoal, **Electric Cyan**, **Soft Violet**

## 4.2 Bauprinzipien
**Empfehlung:**
- **Server Components** für datenlastige, SEO-irrelevante, lesende Bereiche mit gutem initialem Render
- **Client Components** nur dort, wo Interaktion nötig ist: Upload, Filter, Drawer, Tabs, Live-Status, animierte Charts, Formularzustände
- Ein **zentrales API-/service-Layer** im Frontend, das bestehende Backend-Endpunkte kapselt
- Keine Änderung am Auth-Flow; stattdessen **Anpassung der Daten- und UI-Verträge um den Auth-Flow herum**
- Lade-, Fehler- und Empty-States sind **Pflichtbestandteil** jeder Sektion
- Keine neue UI-Bibliothek; die nötige Tiefe soll mit vorhandenem Stack gebaut werden
- Score-Ringe, Balken, kleine Diagramme und Verlaufssparklines sollen per **SVG/CSS/Framer Motion** umgesetzt werden, damit keine zusätzliche Chart-Dependency nötig ist

## 4.3 Gemeinsames Designsystem für alle 10 Sektionen
### Visuelle Regeln
- Grundfläche: sehr dunkler Hintergrund
- Cards: leicht heller als Background, weiche Border, subtile Innen-/Außenschatten
- Akzent 1: Electric Cyan für Fokus, aktive Zustände, Ring-Fortschritt, CTA-Highlights
- Akzent 2: Soft Violet für sekundäre Hervorhebungen, Diagramm-Kontrast, Premium-Kommunikation
- Warnfarbe: Amber
- Fehlerfarbe: Rot, aber nie hart gesättigt
- Erfolg / wahrscheinlich echt: gedecktes Grün / Cyan-Grün, nicht Neon

### Layout-Regeln
- Max-Content-Breite für leselastige Bereiche: 1200-1320 px
- Kartenraster mit viel Luft; nie „alles auf engstem Raum“
- Sticky Page Header pro Sektion mit Titel, Untertitel, Primäraktion
- Standardkartenradius: großzügig
- Standard-Transition: 160-220 ms
- Hover subtil; keine verspielten Sprünge

### UI-Grundbausteine
- Hero-/Section-Banner
- KPI-Cards
- Filterbar + searchable Table/List
- Detail-Drawer / Side Panel
- Score-Ring
- Segmented Controls
- Tabs
- Soft Empty State
- Skeleton Loader
- Toasts nur für kurze Rückmeldungen, keine komplexen Fehlermeldungen

## 4.4 Gemeinsames Datenmodell (Zielbild)
**Empfehlung:** Alle Sektionen sollen langfristig auf dieses gemeinsame Kernmodell einzahlen:

- `users`
- `user_profiles`
- `oauth_accounts`
- `subscriptions`
- `subscription_events`
- `credit_ledger`
- `analyses`
- `analysis_assets`
- `analysis_results`
- `analysis_engine_results`
- `analysis_signals`
- `analysis_reports`
- `feedback_entries`
- `support_tickets`
- `support_messages`
- `notification_preferences`
- `privacy_export_requests`
- `account_deletion_requests`
- `admin_audit_logs`
- `system_health_snapshots`
- `engine_configs`
- `engine_health_logs`

Nicht jede Tabelle muss sofort in Phase 1 gebaut werden; sie ist das Zielschema, damit Verlauf, Resultate, Admin und Billing später nicht auseinanderlaufen.

## 4.5 Gemeinsame API-Regeln
**Empfehlung:**
- Versionierte JSON-API unter `/api/v1/...`
- Frontend spricht niemals direkt „wild“ mit Engine-spezifischen Endpunkten
- Analysen werden als **eigene Domänenressource** behandelt
- Jede Analyse bekommt eine stabile `analysis_id`
- Ergebnis, Engine-Details, Warnungen, technische Signale und Report-Metadaten hängen an dieser ID
- Jeder schreibende Flow muss idempotent oder transaktionssicher designt sein, damit History, Credits und Resultat nie auseinanderfallen

---

## 5. Roadmap der 10 Sidebar-Sektionen

# 5.1 Dashboard

## Zweck & Ziel
Das Dashboard ist die operative Startseite nach dem Login. Es soll in 5-10 Sekunden drei Dinge klarmachen:

1. Was ist mein aktueller Nutzungsstatus?
2. Was ist zuletzt passiert?
3. Was ist mein nächster sinnvoller Schritt?

Das Dashboard darf nicht wie eine „leere Statistikseite“ wirken. Es soll AIRealCheck als ernsthaftes Produkt mit Überblick, Tiefe und Tempo zeigen.

## Soll-Inhalte / Features
- Begrüßungsbereich mit kurzer Kontextzeile
- Credit-Status inkl. verbleibender Credits und Verbrauch in diesem Zeitraum
- Quick Actions:
  - Neue Analyse starten
  - Verlauf öffnen
  - Upgrade auf Premium
  - Support öffnen
- KPI-Grid:
  - Analysen gesamt
  - Anteil „wahrscheinlich KI“
  - Anteil „wahrscheinlich echt“
  - durchschnittliche Confidence
  - Credits verbraucht im aktuellen Zeitraum
- Verlaufs-Vorschau der letzten 5 Analysen
- Medientyp-Verteilung (Bild / Audio / Video)
- System-/Engine-Status light
- Persönlicher Banner:
  - Free-User: Upgrade-Hinweis
  - Pro/Business: Nutzungs- / Report- / Team-Hinweis

## UI/UX-Anforderungen
- Oberer Hero-/Summary-Bereich mit dezentem Glow
- KPI-Cards mit Mikroanimation beim Laden
- Verlaufsvorschau als klickbare Liste mit Status-Chips
- Verteilungsvisualisierung als einfacher Ring oder horizontale Segmentbar
- Keine überfrachteten Voll-Diagramme; eher 1-2 präzise Visuals mit hoher Lesbarkeit
- Dashboard muss auch ohne viele Daten gut aussehen:
  - Empty State mit „Erste Analyse starten“
  - erklärt in 2-3 kurzen Sätzen, was nach dem ersten Upload sichtbar wird

## Datenmodell / DB-Felder
**Benötigte Tabellen/Felder:**
- `users.id`
- `credit_ledger.user_id, delta, reason, created_at`
- `analyses.user_id, media_type, verdict_label, confidence_score, created_at`
- optional aggregiert:
  - `dashboard_daily_stats.user_id, day, analyses_count, ai_count, human_count, credits_used`

## API-Endpunkte
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/recent-analyses?limit=5`
- `GET /api/v1/dashboard/media-distribution?range=30d`
- `GET /api/v1/credits/summary`

**Response-Vorschlag `dashboard/summary`:**
- `availableCredits`
- `usedCreditsThisPeriod`
- `analysesTotal`
- `aiLikelyCount`
- `humanLikelyCount`
- `avgConfidence`
- `currentPlan`
- `upgradeSuggested`
- `engineStatusLight[]`

## Wie es gebaut wird
- Server Component als Seiten-Container
- parallelisierte Datenabfragen über service layer
- einzelne KPI- und Preview-Module als Client Components nur dort, wo Animation/Fallback nötig ist
- Skeletons pro Card, nicht ein globaler Spinner
- Realtime ist nicht nötig; Dashboard darf per Request frisch geladen werden

## Priorität / Abhängigkeiten
**Priorität:** Hoch  
**Abhängigkeiten:** funktionsfähiger Verlauf / Analyse-Persistenz, Credits-API

---

# 5.2 Analyse - Leerzustand

## Zweck & Ziel
Der Analyse-Startzustand muss Vertrauen und Klarheit schaffen. Er soll dem Nutzer sofort zeigen:

- welche Dateitypen erlaubt sind
- wie der Upload funktioniert
- was er als Ergebnis bekommt
- wie Credits belastet werden

Der Bereich ist fast fertig, braucht aber Finish, Konsistenz und mehr Produktqualität.

## Soll-Inhalte / Features
- Großer Upload-Dropzone-Bereich
- Tabs oder Segmentumschalter für:
  - Bild
  - Audio
  - Video
- Unterstützte Formate / Größenlimits
- Hinweis auf Credits und Abrechnung
- Mini-Erklärung „So läuft die Analyse ab“
- Beispiel-Resultat / Preview-Card rechts oder darunter
- CTA für Demo-/Beispieldatei (optional, wenn real vorhanden)
- Upload-Fortschritt
- Vorvalidierung:
  - unsupported file
  - zu groß
  - zu lang
  - keine Credits
  - unbekannter Fehler

## UI/UX-Anforderungen
- Sehr sauberer Fokus auf Dropzone
- Dropzone mit feinem Glow und aktivem Hover-/Drag-State
- Medientyp-Icons klar und seriös
- Unterstützte Formate nicht als langer Fließtext, sondern als kompakte Meta-Chips
- Mobile-first: Dropzone darf mobil nicht zu groß und nicht zu eng sein
- Neben/unter der Dropzone ein kurzer Nutzenblock:
  - „Erkennt synthetische Muster“
  - „Zeigt Confidence und technische Signale“
  - „Speichert Ergebnisse im Verlauf“

## Datenmodell / DB-Felder
Noch keine endgültige Analyse nötig, aber vorbereitend:
- `analysis_assets.temp_upload_id`
- `analysis_assets.original_filename`
- `analysis_assets.media_type`
- `analysis_assets.mime_type`
- `analysis_assets.file_size_bytes`
- `analysis_assets.duration_ms` (Audio/Video)
- `analysis_assets.width/height` (Bild/Video optional)
- `analysis_assets.sha256`

## API-Endpunkte
- `POST /api/v1/uploads`
- `POST /api/v1/analyses`
- `GET /api/v1/credits/eligibility`
- `GET /api/v1/analysis-limits`

## Wie es gebaut wird
- Page als Client-Container für Upload-Interaktionen
- File validation zuerst clientseitig für UX, dann serverseitig verbindlich
- Upload und Analyse-Erstellung trennen:
  1. Upload
  2. Server gibt validierten Asset-Record zurück
  3. Analyse wird mit Asset-ID erstellt
- So werden Fehlerszenarien sauberer und Verlauf / Credits später stabiler

## Priorität / Abhängigkeiten
**Priorität:** Hoch  
**Abhängigkeiten:** Upload-Endpoint, Limits-Endpoint, Credits-Eligibility

---

# 5.3 Ergebnisse - nach erfolgreicher Analyse

## Zweck & Ziel
Die Resultatseite ist das Herz des Produkts. Sie darf nie wie „ein einzelner Satz plus Prozentzahl“ wirken. Sie muss erklären, belegen, einordnen und Vertrauen schaffen.

## Soll-Inhalte / Features
- Große Primärkarte mit:
  - Hauptverdict
  - Confidence-Score
  - Score-Ring
  - kurze verbale Einordnung
- Sekundäre Kontextinfos:
  - Medientyp
  - Dateiname
  - Dateigröße / Dauer
  - Analysezeitpunkt
  - Credits verbraucht
- Engine-Breakdown
- Technische Signale / Detektionshinweise
- Warnungen / Unsicherheiten / Limitierungen
- Confidence-Erklärung in einfacher Sprache
- Aktionleiste:
  - Report herunterladen
  - Verlauf öffnen
  - Neue Analyse starten
  - Ergebnis kopieren / teilen
- Optional:
  - Bei Bild: Thumbnail
  - Bei Audio: Mini-Waveform / Dauer
  - Bei Video: Posterframe + Dauer

## UI/UX-Anforderungen
- Hero-Result-Card zuerst
- Danach klare vertikale Reihenfolge:
  1. Hauptaussage
  2. Confidence-Erklärung
  3. Engine-Breakdown
  4. technische Signale
  5. Warnungen / Limitierungen
- Score-Ring animiert beim Laden einmal ein
- Keine doppelten Infos in mehreren Karten
- Labeling muss für Laien verständlich sein:
  - nicht nur „0.87“
  - sondern z. B. „hohe Wahrscheinlichkeit für synthetische Merkmale“
- Für unklare Fälle muss es einen neutralen Zwischenzustand geben:
  - z. B. „nicht eindeutig“
  - nicht alles hart binär

## Datenmodell / DB-Felder
### `analyses`
- `id`
- `user_id`
- `status` (`queued`, `processing`, `completed`, `failed`)
- `media_type`
- `created_at`
- `completed_at`
- `credits_charged`
- `verdict_label`
- `confidence_score`
- `confidence_band`
- `summary_text_de`

### `analysis_results`
- `analysis_id`
- `overall_score`
- `human_score`
- `ai_score`
- `decision_reason_short`
- `decision_reason_long`
- `limitations_text_de`
- `report_version`

### `analysis_engine_results`
- `analysis_id`
- `engine_key`
- `engine_name`
- `score`
- `weight`
- `normalized_score`
- `status`
- `latency_ms`
- `raw_label`

### `analysis_signals`
- `analysis_id`
- `signal_key`
- `signal_label_de`
- `signal_category`
- `signal_strength`
- `description_de`

### `analysis_reports`
- `analysis_id`
- `pdf_url`
- `json_url`
- `created_at`

## API-Endpunkte
- `GET /api/v1/analyses/{analysisId}`
- `GET /api/v1/analyses/{analysisId}/engines`
- `GET /api/v1/analyses/{analysisId}/signals`
- `GET /api/v1/analyses/{analysisId}/report`
- `POST /api/v1/analyses/{analysisId}/rerun` (optional, später)
- interner Abschluss-Endpoint:
  - `POST /api/v1/internal/analyses/{analysisId}/complete`

## Wie es gebaut wird
- Ergebnisseite als Route mit `analysisId`
- read-heavy Daten serverseitig laden
- Engine-Breakdown und technische Signale als modulare Cards
- Report-Download und Copy-Actions als Client Components
- Alle Texte zentral mappen, damit Ergebnislabeling in der App konsistent bleibt

## Priorität / Abhängigkeiten
**Priorität:** Sehr hoch  
**Abhängigkeiten:** stabile Analyse-Persistenz, Engine-Ergebnis-Normalisierung, Report-Generierung

---

# 5.4 Verlauf

## Zweck & Ziel
Der Verlauf ist aktuell die größte strukturelle Lücke. Er ist nicht nur „nice to have“, sondern Kern des Produkts. Ohne Verlauf fehlen Nachvollziehbarkeit, Wiederauffindbarkeit, Reporting und Vertrauenswürdigkeit.

## Soll-Inhalte / Features
- Vollständige Liste aller Analysen pro User
- Suchfunktion
- Filter:
  - Medientyp
  - Verdict
  - Zeitraum
  - Confidence-Band
- Sortierung:
  - neueste zuerst
  - höchste Confidence
  - höchste Credits
- Detail-Drawer / Detail-Seite pro Eintrag
- Bulk-Auswahl später optional
- Quick Actions:
  - Report öffnen
  - erneut prüfen
  - kopieren
  - löschen / archivieren (optional)
- Leere Zustände:
  - keine Analysen
  - kein Treffer im Filter
  - Ladefehler

## Kritische technische Zielsetzung
Der Verlauf braucht nicht nur UI, sondern eine **saubere Persistenzreparatur**. Neue Analysen müssen nach Abschluss zuverlässig in History auftauchen.

## Wahrscheinlich notwendige Reparatur
**Empfehlung:**
- Analyseerstellung, Resultatspeicherung und Credit-Abbuchung müssen als zusammenhängender Workflow gedacht werden.
- Der Abschluss einer Analyse darf den Verlauf nicht „implizit“ hoffen lassen, sondern muss transaktionssicher persistieren:
  1. Analyse-Record existiert früh
  2. Asset hängt an Analyse
  3. Engine- und Ergebnisdaten werden gespeichert
  4. Credits werden gebucht
  5. Status wird auf `completed` gesetzt
- History liest **nur persistierte Analyse-Records**, nicht flüchtige Frontend-State-Daten

## Datenmodell / DB-Felder
Zusätzlich relevant:
- `analyses.id`
- `analyses.user_id`
- `analyses.status`
- `analyses.media_type`
- `analyses.verdict_label`
- `analyses.confidence_score`
- `analyses.credits_charged`
- `analyses.created_at`
- `analysis_assets.preview_url`
- `analysis_reports.pdf_url`

Optional:
- `analyses.archived_at`
- `analyses.deleted_at`
- `analyses.source_channel`

## API-Endpunkte
- `GET /api/v1/analyses`
- `GET /api/v1/analyses/{analysisId}`
- `DELETE /api/v1/analyses/{analysisId}` (wenn Soft Delete gewollt)
- `POST /api/v1/analyses/{analysisId}/archive` (optional)
- `GET /api/v1/analyses/export?format=csv` (später)

**Query-Parameter für `GET /analyses`:**
- `page`
- `limit`
- `q`
- `mediaType`
- `verdict`
- `from`
- `to`
- `confidenceBand`
- `sort`

## UI/UX-Anforderungen
- Desktop: Liste links / Detail rechts oder Tabelle + Drawer
- Mobile: Kartenliste mit Fullscreen-Detail
- Status-Chips farblich klar, aber seriös
- Such- und Filterbar sticky oberhalb der Liste
- Vorschaubilder / Posterframes klein, sauber, ohne Layoutbruch
- Skeleton Rows statt leerem Flimmern

## Wie es gebaut wird
- Verlauf zuerst backend-seitig reparieren
- Dann UI als eigene Seiten-Route mit pagination + filters
- Detailinhalt aus derselben Analyse-Domain lesen wie die Resultatseite
- Resultatseite und Verlauf dürfen keine konkurrierenden Datenmodelle besitzen

## Priorität / Abhängigkeiten
**Priorität:** Sehr hoch  
**Abhängigkeiten:** stabile Analyse-Persistenz, Credits-Ledger, Analyse-Result-Domain

---

# 5.5 Profil

## Zweck & Ziel
Die Profilseite soll kein statisches „Account-Infoblatt“ sein, sondern eine echte Kontoverwaltung für den Nutzer.

## Soll-Inhalte / Features
- Profilübersicht:
  - Name
  - E-Mail
  - Rollenstatus
  - Account seit
  - aktueller Plan
- Bearbeitung:
  - Name ändern
  - E-Mail ändern
  - Passwort ändern
  - Profilbild ändern (optional)
- Security-Infos:
  - verknüpfte OAuth-Accounts
  - letzte Anmeldung
  - aktive Sitzungen light (optional)
- Credit-Snapshot
- Plan-/Billing-Snapshot
- Button zu Einstellungen / Premium / Support

## UI/UX-Anforderungen
- Oben kompakte Profilkarte mit Avatar, Name, Plan, Credits
- Darunter editierbare Form-Sektionen
- Veränderungen mit Inline-Validierung
- sensible Änderungen mit Re-Auth / Passwortbestätigung, falls Backend das verlangt
- kein Modal-Overkill; besser klare Form-Sektionen

## Datenmodell / DB-Felder
### `users`
- `id`
- `email`
- `display_name`
- `role`
- `created_at`
- `last_login_at`

### `user_profiles`
- `user_id`
- `avatar_url`
- `locale`
- `timezone`
- `company_name` (optional später)

### `oauth_accounts`
- `user_id`
- `provider`
- `provider_account_id`
- `linked_at`

## API-Endpunkte
- `GET /api/v1/me`
- `PATCH /api/v1/me/profile`
- `PATCH /api/v1/me/email`
- `PATCH /api/v1/me/password`
- `GET /api/v1/me/oauth-accounts`
- `POST /api/v1/me/avatar` (optional)
- `GET /api/v1/credits/summary`

## Wie es gebaut wird
- Seite als serverseitig geladene Account-Übersicht
- einzelne Edit-Forms als Client Components
- pro Formular eigener Save-State
- Erfolg/Fehler per Toast + Inline-Message
- keine breaking changes am bestehenden Auth-Flow; nur Profile-Endpoints ergänzen

## Priorität / Abhängigkeiten
**Priorität:** Mittel-Hoch  
**Abhängigkeiten:** bestehender User-/Auth-Kontext, Credits-Übersicht, OAuth-Verknüpfungen

---

# 5.6 Einstellungen

## Zweck & Ziel
Die Einstellungen-Seite ist aktuell leer und muss vollständig neu gebaut werden. Sie ist die Steuerzentrale für Personalisierung, Datenschutz, Billing und Benachrichtigungen.

## Soll-Inhalte / Features
### Pflichtbereiche
1. **Sprache / Locale**
2. **Abo & Premium verwalten**
3. **Benachrichtigungseinstellungen**
4. **Datenschutz / Daten-Export**
5. **Account löschen**

### Sinnvolle Ergänzungen
6. Standard-Ansicht / Startseite
7. Standard-Filter für Verlauf
8. Ergebnisdarstellung:
   - einfache vs. technische Ansicht
9. Report-Präferenzen:
   - PDF mit / ohne technische Details
10. Sicherheitsoptionen:
   - Session-Hinweise
   - OAuth-Verknüpfungen verlinken

## UI/UX-Anforderungen
- linke Settings-Navigation oder Tabs
- klare Trennung zwischen:
  - persönlicher Präferenz
  - Billing
  - Datenschutz
  - destruktiven Aktionen
- Destructive Zone ganz unten mit Warnbox
- Export-/Deletion-Flow immer mit klarer Erklärung, was passiert und wie lange es dauert

## Datenmodell / DB-Felder
### `user_profiles`
- `locale`
- `timezone`
- `default_dashboard_range`
- `default_history_view`

### `notification_preferences`
- `user_id`
- `email_product_updates`
- `email_analysis_finished`
- `email_credit_low`
- `email_billing`
- `in_app_announcements`

### `privacy_export_requests`
- `id`
- `user_id`
- `status`
- `requested_at`
- `completed_at`
- `download_url`

### `account_deletion_requests`
- `id`
- `user_id`
- `status`
- `requested_at`
- `scheduled_delete_at`
- `confirmed_at`

## API-Endpunkte
- `GET /api/v1/settings`
- `PATCH /api/v1/settings/profile-preferences`
- `PATCH /api/v1/settings/notifications`
- `GET /api/v1/billing/summary`
- `POST /api/v1/privacy/export`
- `POST /api/v1/account/delete-request`
- `POST /api/v1/account/delete-cancel` (optional)

## Wie es gebaut wird
- Settings-Seite als shell mit subsections
- Daten pro subsection getrennt laden/speichern
- Billing-Teil darf zunächst auch read-only mit Platzhaltern starten, wenn Provider noch nicht verdrahtet ist
- Locale-Änderung muss App-Texte perspektivisch unterstützen; wenn zunächst nur Deutsch aktiv ist, soll die UI das ehrlich kommunizieren

## Priorität / Abhängigkeiten
**Priorität:** Mittel  
**Abhängigkeiten:** Profil-API, Billing-Kontext, Notification- und Privacy-Endpunkte

---

# 5.7 Support & Hilfe

## Zweck & Ziel
Support & Hilfe soll Friktion senken, Vertrauen erhöhen und Ticketlast reduzieren. Gute SaaS-Produkte lösen hier Probleme, bevor der Nutzer abspringt.

## Soll-Inhalte / Features
- FAQ / Knowledge Base Startseite
- Suchfeld für Hilfeartikel
- Themenkategorien:
  - Analyse verstehen
  - Credits & Abrechnung
  - Konto & Login
  - Datenschutz
  - Dateien & Formate
  - Reports & Verlauf
- Kontaktformular / Ticket-Erstellung
- Link zur Dokumentation
- Link zur Status-Page
- Bereich „Beliebte Fragen“
- Bereich „Was tun bei unklaren Ergebnissen?“

Das passt zu marktüblichen Mustern: Winston hat Help Center, Kontaktformular, Billing-/Abo-Hilfe und Privacy-/Security-Artikel; Hive hat umfangreiche Produktdokumentation und Moderation-Dashboard-Guides.[Q5][Q6]

## UI/UX-Anforderungen
- oberes Suchfeld mit schneller Kategoriewahl
- Knowledge-Base-Karten statt trockener Linkliste
- Ticketformular nicht verstecken
- Kontaktweg klar sichtbar
- bei Free-Usern Support realistisch framen:
  - z. B. Standard-Support
  - Pro/Business: priorisiert

## Datenmodell / DB-Felder
### `support_tickets`
- `id`
- `user_id`
- `category`
- `subject`
- `status`
- `priority`
- `created_at`
- `updated_at`

### `support_messages`
- `id`
- `ticket_id`
- `sender_type`
- `message`
- `created_at`

Optional für CMS-ähnliche Hilfeartikel:
- `help_articles`
- `help_categories`

## API-Endpunkte
- `GET /api/v1/help/articles`
- `GET /api/v1/help/articles/{slug}`
- `GET /api/v1/help/search?q=...`
- `POST /api/v1/support/tickets`
- `GET /api/v1/support/tickets`
- `GET /api/v1/system/status-link`

## Wie es gebaut wird
- Start mit statischer / halb-statischer Help-Content-Struktur
- Ticketsystem kann zunächst einfach sein:
  - Formular + Ticketliste + Status
- Dokumentationslink darf vorerst extern sein
- Status-Page-Link kann zunächst auf externe Status-Seite oder interne Status-URL zeigen

## Priorität / Abhängigkeiten
**Priorität:** Mittel  
**Abhängigkeiten:** keine harte Produktabhängigkeit; gut parallel baubar

---

# 5.8 Feedback

## Zweck & Ziel
Feedback ist das strukturierte Sprachrohr der Nutzer. Es soll nicht wie ein langweiliges Formular wirken, sondern wie ein echter Kanal für Verbesserung.

## Soll-Inhalte / Features
- Drei primäre Modi:
  1. Feature Request
  2. Bug Report
  3. Allgemeines Feedback
- Optional NPS / Zufriedenheitsfrage
- Prioritäts-/Dringlichkeitswahl für Bugs
- Kategorieauswahl
- Freitextfeld
- optional Dateianhang / Screenshot
- „Bereits angefragt“-Bereich für häufige Wünsche
- Erfolgszustand mit ehrlicher Erwartungssteuerung

## UI/UX-Anforderungen
- Modus-Karten mit klarer Auswahl
- motivierende, aber seriöse Texte
- Bug Reports sollen strukturierter sein als freie Meinung
- Feature Requests sollen Raum für Business-Nutzen bieten
- keine endlosen Formulare; progressive disclosure nutzen

## Datenmodell / DB-Felder
### `feedback_entries`
- `id`
- `user_id`
- `type` (`feature`, `bug`, `general`, `nps`)
- `title`
- `message`
- `category`
- `priority`
- `nps_score`
- `status`
- `created_at`

Optional:
- `attachment_url`
- `analysis_id` (wenn Feedback auf konkretes Ergebnis bezogen ist)

## API-Endpunkte
- `POST /api/v1/feedback`
- `GET /api/v1/feedback/me`
- `GET /api/v1/feedback/popular-requests` (optional)

## Wie es gebaut wird
- eigenständige Seite, aber mit schneller Einstiegs-UI
- Formular per client-side state
- bei Ergebnis-/Verlaufskontext kann `analysis_id` automatisch vorbefüllt werden
- Admin-Panel muss diese Einträge später sehen und triagieren können

## Priorität / Abhängigkeiten
**Priorität:** Mittel  
**Abhängigkeiten:** Admin-Panel-Feedback-Review später nützlich, aber kein blocker

---

# 5.9 API-Zugang

## Zweck & Ziel
Diese Sektion wird in v3 bewusst **nicht** gebaut. Das ist richtig, denn API-Produktisierung ist ein eigener Track.

## Soll-Zustand in v3
- sauberer Platzhalter
- ehrlich formuliert
- kein totes, kaputtes UI
- optional Wartelisten-/Interessenformular

## UI/UX-Anforderungen
- kleine Premium-/Business-nahe Teaserkarte
- Text wie:
  - „API-Zugang ist geplant“
  - „Für v3 noch nicht Teil des Umsetzungsumfangs“
- CTA:
  - „Interesse anmelden“ oder „Sales kontaktieren“ (nur wenn Kontaktweg real existiert)

## Datenmodell / DB-Felder
Für v3 keine Pflicht. Optional:
- `api_waitlist_entries.email, company, use_case, created_at`

## API-Endpunkte
Für v3 keine Pflicht. Optional:
- `POST /api/v1/api-waitlist`

## Wie es gebaut wird
- sehr klein halten
- keine Schein-Funktionalität
- keine versteckte API-Doku anlegen, wenn sie noch nicht gepflegt werden kann

## Priorität / Abhängigkeiten
**Priorität:** Niedrig / bewusst geparkt  
**Abhängigkeiten:** keine

---

# 5.10 Admin-Panel

## Zweck & Ziel
Das Admin-Panel muss von einer teilweise unfertigen Oberfläche zu einer echten Kommandozentrale werden. Es ist die interne Betriebszentrale für Betrieb, Support, Qualität, Kosten und Risiko.

## Ziel-Subbereiche
1. Überblick / KPIs
2. User-Management
3. Analysen
4. Credits & Billing
5. Engine-Verwaltung
6. Kosten-Monitoring
7. Fehler-Logs
8. System-Health
9. Feedback & Support Inbox
10. Audit-Log / Admin-Aktionen

## 5.10.1 Überblick / KPIs
### Inhalte
- aktive Nutzer
- neue Nutzer
- Analysen heute / 7d / 30d
- Erfolgsquote
- Fehlerrate
- Credit-Verbrauch
- Umsatz-Indikatoren
- Engine-Status light

### UI
- KPI-Grid
- kleine Trendindikatoren
- Incident-/Warnbanner oben, falls relevant

## 5.10.2 User-Management
### Inhalte
- Suche nach Usern
- Detailansicht
- sperren / entsperren
- Credits anpassen
- Rollen einsehen
- OAuth-Status sehen
- Ticket- / Feedback-Kontext sehen

### Daten
- `users`
- `user_profiles`
- `credit_ledger`
- `subscriptions`
- `admin_audit_logs`

### Endpunkte
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{userId}`
- `POST /api/v1/admin/users/{userId}/suspend`
- `POST /api/v1/admin/users/{userId}/unsuspend`
- `POST /api/v1/admin/users/{userId}/credits/adjust`

## 5.10.3 Analysen
### Inhalte
- globale Analyse-Liste
- Filter nach Status, Medientyp, Verdict, User, Zeitraum
- Detailansicht mit Engine- und Signal-Infos
- Fehlgeschlagene Jobs separat sichtbar
- Reprocessing / retry optional

### Endpunkte
- `GET /api/v1/admin/analyses`
- `GET /api/v1/admin/analyses/{analysisId}`
- `POST /api/v1/admin/analyses/{analysisId}/retry` (optional)

## 5.10.4 Credits & Billing
### Inhalte
- Gesamtverbrauch
- Top-up-/Abo-Ereignisse
- auffällige Nutzung
- Low-credit-Churn-Risiko
- Planverteilung

### Daten
- `credit_ledger`
- `subscriptions`
- `subscription_events`

## 5.10.5 Engine-Verwaltung
### Inhalte
- aktive Engines
- Ein/Aus-Status
- Gewichtung
- letzte Nutzung
- Fehlerraten
- Latenz
- Maintenance-Flags

Hive dokumentiert Workflows rund um Moderation Dashboard, Rules und Actions; für AIRealCheck ist die analoge Ableitung: Admin braucht steuerbare Betriebsregeln statt nur passive Tabellen.[Q6][Q7]

### Daten
- `engine_configs`
- `engine_health_logs`

### Endpunkte
- `GET /api/v1/admin/engines`
- `PATCH /api/v1/admin/engines/{engineKey}`
- `GET /api/v1/admin/engines/{engineKey}/health`

## 5.10.6 API-Kosten-Monitoring
### Inhalte
- Kosten je Engine / Provider / Zeitraum
- Kosten je Medientyp
- Kosten pro Analyse
- Margen-Hinweise gegenüber Plänen
- Ausreißer / Spitzen

### Daten
- `provider_cost_events`
- `analysis_engine_results.latency_ms`
- `analyses.credits_charged`

## 5.10.7 Fehler-Logs
### Inhalte
- Backend-Fehler
- Upload-Fehler
- Analyse-Fehler
- Billing-/Credit-Fehler
- Ticket-/Support-Referenz

### Daten
- `system_error_logs`
- `admin_audit_logs`

## 5.10.8 System-Health / KPIs
### Inhalte
- Queue-Lage
- Analyse-Laufzeiten
- Engine-Verfügbarkeit
- letzten Incidents
- Storage-/Upload-Fehlerquote

### Daten
- `system_health_snapshots`
- `engine_health_logs`

## 5.10.9 Feedback & Support Inbox
### Inhalte
- neue Feedback-Einträge
- offene Tickets
- Statuswechsel
- interne Notizen später optional

## 5.10.10 Audit-Log
### Inhalte
- alle Admin-Aktionen
- wer hat Credits geändert
- wer hat User gesperrt
- wer hat Engine-Konfiguration geändert

### Daten
- `admin_audit_logs`
  - `id`
  - `admin_user_id`
  - `action_type`
  - `target_type`
  - `target_id`
  - `payload_json`
  - `created_at`

## UI/UX-Anforderungen für das gesamte Admin-Panel
- strikt funktional, aber visuell sauber
- kein Farbcollision-Chaos
- konsistente Button-/Input-Größen
- Filterleisten mit genug Luft
- Tabellen nur dort, wo Tabellen sinnvoll sind
- Drawer für Details
- Badges für Status
- leere Zustände professionell formuliert
- rote Farbe nur für echte Gefahr / destruktive Aktionen

## Wie es gebaut wird
- Admin als eigener Layout-Zweig
- alle Listen mit serverseitiger Pagination
- sensible Schreibaktionen mit Confirmations
- jede Admin-Aktion schreibt in Audit-Log
- kein Bereich darf rein dekorativ bleiben; lieber weniger Subbereiche, aber jeder funktional

## Priorität / Abhängigkeiten
**Priorität:** Hoch, aber nach Analyse-/Verlauf-Kern  
**Abhängigkeiten:** stabile Kern-Datenmodelle (User, Analyse, Credits, Billing, Engine Health)

---

# 5.11 Upgrade auf Premium

## Zweck & Ziel
Die Upgrade-Seite ist die Conversion-Zentrale. Sie muss Premium erklären, Vertrauen aufbauen und den Schritt von Free -> Pro -> Business logisch machen.

## Marktbeobachtung als Grundlage
- Winston AI bietet einen Free-Einstieg sowie bezahlte Stufen im Self-Serve-Bereich und credits-basierte Nutzungslogik.[Q1]
- Sightengine staffelt deutlich nach Nutzungsvolumen und Leistungsniveau von ca. 29 USD bis 399 USD monatlich plus Mehrverbrauch.[Q2]
- Hive kombiniert usage-based Einstiege mit Enterprise-Komponenten und Contact-Sales für größere Organisationen.[Q3]
- Copyleaks staffelt Self-Serve und Pro klar und verknüpft Credits mit monatlichem Nutzungsvolumen; Enterprise ist separat.[Q10]

## Ableitung für AIRealCheck
**Empfehlung:** AIRealCheck sollte für v3 auf ein **einfaches, glaubwürdiges 3-Tier-Modell** setzen:

1. **Free**
2. **Pro**
3. **Business**

Kein viertes „Enterprise“-Pseudotier in v3. Für echte Enterprise-Anfragen reicht Business + Kontaktweg.

## Empfohlene Tier-Struktur
| Tier | Preis | Zielgruppe | Credits / Monat | Kerneigenschaften |
|---|---:|---|---:|---|
| Free | 0 EUR | Testen, gelegentliche Nutzung | 100 Start-Credits, danach optional Top-up oder Upgrade | Basis-Analyse, Verlauf light, begrenzte Reports |
| Pro | 19 EUR / Monat | Einzelanwender, Creator, Research, Freelancer | 1.500 Credits / Monat | volle History, PDF-Reports, priorisierte Queue, erweiterte Ergebnisdetails |
| Business | 79 EUR / Monat | kleine Teams, Agenturen, Trust-&-Safety-nahe Nutzung | 10.000 Credits / Monat | mehrere Seats (z. B. 5), Teamnutzung light, priorisierte Verarbeitung, Exportfunktionen, besserer Support |

## Warum genau diese Zahlen?
### Preisableitung
- **19 EUR Pro** liegt bewusst in der Nähe des unteren bis mittleren Self-Serve-Marktes. Winston liegt öffentlich im Bereich von ca. 18-29 USD monatlich, je nach Plan; Copyleaks Personal liegt öffentlich bei 16.99 USD monatlich und Pro bei 99.99 USD monatlich; Sightengine startet bei 29 USD / Monat.[Q1][Q2][Q10]
- **79 EUR Business** liegt deutlich unter typischen API-/moderationsnahen Mid-Market- oder Enterprise-Bändern, bleibt aber klar über Consumer-Pricing. Das macht den Schritt von Einzel- zu Teamnutzung glaubwürdig, ohne zu früh in 199/299/399-Bänder zu springen, die Produkte wie Sightengine in höheren Volumen- und Leistungsstufen adressieren.[Q2]
- **100 Start-Credits im Free-Tier** harmonieren mit dem bereits bekannten Credits-Grundmodell im Projektkontext und begrenzen gleichzeitig die Kosten des kostenlosen Einstiegs.

### Credit-Ableitung
Die folgenden Credit-Kosten sind **Empfehlungen**, keine Markt-Fakten. Sie sind als internes Preismodell gedacht und leiten sich aus relativer Rechenkomplexität und UX-Verständlichkeit ab:

| Aktion | Empfohlene Credit-Kosten | Begründung |
|---|---:|---|
| Bildanalyse | 5 Credits / Datei | günstigster multimodaler Einstieg, schnelle Self-Serve-Nutzung |
| Audioanalyse | 10 Credits / angefangene Minute | höherer Verarbeitungsaufwand durch Segmentierung / Audio-Signale |
| Videoanalyse | 25 Credits / angefangene Minute | teuerster Flow wegen Frame-/Audio-/Zeitdimension |
| PDF-Report-Export | inklusive bei Pro/Business, 2 Credits bei Free-Top-up-Modell optional | fördert Upgrade, ohne Kernanalyse zu blockieren |

### Was diese Kontingente praktisch bedeuten
**Pro mit 1.500 Credits / Monat** ergibt ungefähr:
- 300 Bildanalysen oder
- 150 Audio-Minuten oder
- 60 Video-Minuten
- oder Mischformen daraus

**Business mit 10.000 Credits / Monat** ergibt ungefähr:
- 2.000 Bildanalysen oder
- 1.000 Audio-Minuten oder
- 400 Video-Minuten
- oder Mischformen daraus

Diese Mengen sind für v3 realistisch genug für Self-Serve und kleine Teams, ohne die Produktlogik künstlich aufzublasen.

## Empfohlene Feature-Differenzierung
| Feature | Free | Pro | Business |
|---|---|---|---|
| Bild-, Audio-, Video-Analyse | Ja | Ja | Ja |
| Verlauf | Light | Voll | Voll |
| PDF-Reports | Eingeschränkt / Wasserzeichen optional | Ja | Ja |
| technische Detailansicht | eingeschränkt | Ja | Ja |
| priorisierte Verarbeitung | Nein | Ja | Ja |
| Team-/Seat-Nutzung | Nein | Nein | Ja |
| Exportfunktionen | Nein | Basis | erweitert |
| priorisierter Support | Nein | begrenzt | Ja |
| API | Nein | Nein | Nein / später |

## UI/UX-Anforderungen
- Pricing-Hero mit klarem Nutzenversprechen
- 3 Pricing-Cards mit klarer visueller Hierarchie
- Pro als „empfohlen“
- Credit-Erklärung direkt unter den Karten, nicht versteckt
- Vergleichstabelle darunter
- FAQ zum Abo
- Vertrauenselemente:
  - sichere Zahlungen
  - jederzeit kündbar (nur wenn technisch/billingseitig real umgesetzt)
  - Credits / Monat verständlich erklärt
- CTA mehrfach sichtbar:
  - Hero
  - Pricing Cards
  - sticky mobile CTA
  - Schluss-CTA

## Datenmodell / DB-Felder
### `subscriptions`
- `id`
- `user_id`
- `plan_key`
- `status`
- `period_start`
- `period_end`
- `cancel_at_period_end`
- `provider_customer_id` (wenn Billing vorhanden)
- `provider_subscription_id` (wenn Billing vorhanden)

### `subscription_events`
- `id`
- `subscription_id`
- `event_type`
- `payload_json`
- `created_at`

### `credit_ledger`
- `user_id`
- `delta`
- `reason`
- `source_type`
- `source_id`

## API-Endpunkte
- `GET /api/v1/plans`
- `GET /api/v1/billing/summary`
- `POST /api/v1/billing/checkout`
- `POST /api/v1/billing/portal`
- `POST /api/v1/billing/top-up` (optional später)

## Wie es gebaut wird
- Upgrade-Seite zuerst als vollwertige Marketing-/Produktseite innerhalb der App
- Checkout-Buttons können initial auf Stub/Disabled-State laufen, **wenn** Billing technisch noch nicht live ist
- Planlogik und Feature-Gates trotzdem schon sauber im Backend modellieren
- Free/Pro/Business-Badges an Dashboard, Profil und Settings spiegeln

## Priorität / Abhängigkeiten
**Priorität:** Hoch, aber nach stabiler Kernfunktion  
**Abhängigkeiten:** Credits-Modell, Billing-Domain, Plan-Gating im Frontend

---

## 6. Globale Priorisierung und Reihenfolge

### Phase-A - Fundament zuerst
1. Analyse-Persistenz reparieren
2. Verlauf neu aufbauen
3. Ergebnis-Domain vereinheitlichen
4. Credits- und Analyse-Contracts stabilisieren

### Phase-B - Hauptnutzung perfektionieren
5. Analyse-Leerzustand finalisieren
6. Resultatseite hochwertig fertig bauen
7. Dashboard auf echte Daten aufsetzen

### Phase-C - Konto und Self-Serve-Reife
8. Profil
9. Einstellungen
10. Upgrade auf Premium

### Phase-D - Support und Produktbetrieb
11. Support & Hilfe
12. Feedback
13. API-Zugang-Platzhalter sauber setzen

### Phase-E - Interne Betriebszentrale
14. Admin-Panel vollständig überarbeiten

---

## 7. Konkrete Abhängigkeiten zwischen den Sektionen

| Sektion | Hängt ab von | Warum |
|---|---|---|
| Dashboard | Verlauf, Credits, Analysen | sonst nur Attrappe |
| Analyse-Leerzustand | Upload, Credits-Eligibility, Limits | sonst UX ohne belastbare Validierung |
| Ergebnisse | Analyse-Domain, Engine-Daten, Reports | Kernfunktion |
| Verlauf | Persistenz, Analyse-Domain, Credits | aktuell defekt |
| Profil | Auth-Kontext, Credits, OAuth-Daten | sonst nur statisch |
| Einstellungen | Profil, Billing, Privacy-Jobs | braucht Backend-Schnittstellen |
| Support & Hilfe | Help-Content / Tickets | parallel baubar |
| Feedback | Admin-Triage später hilfreich | aber früh baubar |
| API-Zugang | keine | Platzhalter |
| Admin | User-, Analyse-, Credits-, Engine-Daten | baut auf fast allem auf |
| Upgrade | Credits, Billing-Domain, Plan-Gates | für glaubwürdige Conversion nötig |

---

## 8. Was für v3 ausdrücklich **nicht** getan werden sollte

- Kein neuer Auth-Flow
- Kein chaotischer Mix aus alten und neuen Analyse-Datenmodellen
- Kein History-UI ohne persistente Grundlage
- Kein API-Bereich mit Fake-Funktionalität
- Kein Premium-Pricing mit Fantasiezahlen ohne Credit-Logik
- Keine neue schwere UI-/Chart-Library, solange SVG/CSS/Framer Motion reichen
- Kein überladenes Dashboard mit fünf halbgaren Diagrammen
- Kein Admin-Panel mit toten Unterseiten
- Keine rein binäre Ergebnislogik ohne „uneindeutig“-Band
- Keine leeren Bildschirme bei Empty States oder Fehlern

---

## 9. Umsetzungsdefinition für „fertig“

Eine Sektion gilt in v3 erst dann als fertig, wenn sie:

1. funktional nutzbar ist  
2. einen guten Empty State hat  
3. einen guten Loading State hat  
4. einen guten Error State hat  
5. responsive ist  
6. visuell zum restlichen Designsystem passt  
7. deutsche UI-Texte konsistent nutzt  
8. auf echte Daten oder ehrliche Platzhalter setzt  
9. keinen bestehenden Auth-Flow bricht  
10. für spätere Team-/Business-Erweiterung nicht im Weg steht

---

## 10. Executive Empfehlung

Wenn nur ein einziger roter Faden für v3 gelten soll, dann dieser:

**AIRealCheck muss zuerst von einem teilweise schönen Frontend zu einem stabilen, glaubwürdigen Analyse-Produkt werden.**  
Das bedeutet Reihenfolge über Eitelkeit:

1. **Persistenz + Verlauf fixen**
2. **Resultatdarstellung auf Profi-Niveau bringen**
3. **Dashboard aus echten Daten bauen**
4. **Konto, Settings und Upgrade für Self-Serve-Reife ergänzen**
5. **Admin als echte Kommandozentrale fertig machen**

So wird AIRealCheck nicht nur „schöner“, sondern tatsächlich marktfähiger.

---

## 11. Quellenanhang

### [Q1] Winston AI - Pricing
Offizielle Pricing-Seite mit Credits-Logik, Free-/Essential-/Advanced-/Elite-Stufen, Bild- und Text-Detektion, Team-Features und Top-ups.  
https://gowinston.ai/pricing/

### [Q2] Sightengine - Pricing
Offizielle Pricing-Seite mit operations-basierter Staffelung, simultanen Video-Streams, Priorisierung und Enterprise-Optionen.  
https://sightengine.com/pricing

### [Q3] Hive AI - Pricing
Offizielle Pricing-Seite mit usage-based pricing, Free Credits, API-/Model-Zugriff und Enterprise-Komponenten.  
https://thehive.ai/pricing

### [Q4] Sensity AI - Deepfake Detection
Offizielle Produktseite zu multimodaler Deepfake-Erkennung für Video, Bild und Audio, inkl. Cloud-/On-prem- und Forensik-Ausrichtung.  
https://sensity.ai/

### [Q5] Winston AI - Help Center / Account / Privacy
Offizielle Hilfeseiten zu Help Center, Billing-/Subscription-Management und Privacy-/Security-Themen.  
https://help.gowinston.ai/

### [Q6] Hive Documentation - Moderation Dashboard
Offizielle Doku zum Moderation Dashboard, Review-Workflow, Rules und adminnaher Steuerung.  
https://docs.thehive.ai/docs/what-is-the-moderation-dashboard

### [Q7] Hive - AI Generated Content Detection / Dashboard API / Government Use Cases
Offizielle Hive-Produkt- und Dokuquellen zu AI-generated detection für Bild, Video, Text und Audio sowie Dashboard-Workflow.  
https://hivemoderation.com/ai-generated-content-detection  
https://thehive.ai/apis/ai-generated-content-classification  
https://docs.thehive.ai/docs/dashboard-api-reference-v2-multi-model-support

### [Q8] GPTZero - Pricing / Positionierung
Offizielle Pricing-/Produktseite mit Zielgruppen und API-/Team-Positionierung im AI-Detection-Markt.  
https://gptzero.me/pricing

### [Q9] Sightengine - Produktübersicht
Offizielle Übersicht zu Bild-, Video- und Text-Moderation / Analyse.  
https://sightengine.com/

### [Q10] Copyleaks - Pricing
Offizielle Pricing-Seite mit Personal-/Pro-/Enterprise-Modell, Credit-Logik und Analytics-/Dashboard-Funktionen.  
https://copyleaks.com/pricing
