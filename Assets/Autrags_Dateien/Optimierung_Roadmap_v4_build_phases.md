# AIRealCheck – Optimierungs-Roadmap v4 (Build Phases)

Diese Datei teilt die v4-Roadmap in sequentielle, in sich abgeschlossene Phasen auf. Jede Phase ist als vollständiger Copy-Paste-Prompt für Claude Code formuliert.

**Reihenfolge:** Bugs → Allgemeines → Features → UI  
**Datum:** 10.03.2026  
**Stack:** Flask + SQLite + Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4

---
## Phase 1 – Session-Stabilität und Auth-Härtung

### Kontext: Fixe den Session-Timeout-Bug zuerst, ohne den bestehenden Auth-Flow oder Google OAuth zu brechen.

**Abhängigkeiten:** Keine  
**Roadmap-Umfang:** B1

### Prompt:

```bash
# ROLLE
Du bist ein erfahrener Senior Full-Stack-Entwickler für Flask-, SQLite-, Next.js-, React-, TypeScript- und Tailwind-Projekte.
Du arbeitest präzise, defensiv und ohne Breaking Changes.

# PROJEKT
AIRealCheck ist eine professionelle SaaS-Web-App zur KI-Inhalts-Erkennung für Bilder, Audio und Video.

# FESTER STACK
- Backend: Python / Flask
- Datenbank: SQLite (`app.db`)
- Frontend: Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4
- Struktur: `frontend/app/(app)/`, `frontend/app/(auth)/`, `frontend/components/layout/`, `frontend/lib/`, `frontend/contexts/AuthContext.tsx`
- Auth: Session-basiert + Google OAuth

# AUFGABE
Behebe den Session-Timeout-Bug ohne den bestehenden Auth-Flow oder Google OAuth zu brechen.

# PROBLEM
User werden nach ungefähr 10 Minuten automatisch ausgeloggt. Das darf nicht passieren.

# ZIEL
- Session-Lifetime auf mindestens 24 Stunden stabil
- Option/Effekt „eingeloggt bleiben“
- Automatisches Refresh bei Aktivität
- Kein unerwarteter Logout während aktiver Nutzung
- Kein Breaking Change am bestehenden Login-, Logout- oder Google-OAuth-Flow

# BETROFFENE BEREICHE
- Flask-App-Konfiguration für Sessions/Cookies
- Login-Flow
- Google-OAuth-Flow
- Request-/401-Handling im Frontend
- `frontend/contexts/AuthContext.tsx`
- relevante Auth-/Lib-Dateien unter `frontend/lib/`
- relevante Backend-Dateien für Auth/Session/App-Setup

# ANFORDERUNGEN
1. Verwende saubere Flask-Session-Konfiguration.
2. Stelle sicher, dass permanente Sessions bewusst gesetzt werden.
3. Konfiguriere mindestens 24 Stunden Session-Laufzeit.
4. Nutze ein Activity-basiertes Session-Refresh, damit aktive Nutzer nicht rausfliegen.
5. Falls Flask-Login oder vergleichbare Remember-Me-Logik vorhanden ist, verdrahte sie korrekt statt Workarounds zu bauen.
6. Cookie-Härtung sauber setzen:
   - `HttpOnly`
   - `Secure` in Produktion
   - sinnvoller `SameSite`-Wert, der den Google-OAuth-Flow nicht kaputt macht
7. Bei echter Session-Ablauf-Situation:
   - sauberer Redirect zur Login-Seite
   - klare Fehlermeldung/Toast
   - kein kaputter leerer UI-Zustand
8. Keine neuen Pakete einführen, außer es ist absolut nötig. Wenn doch, begründe sie.
9. Keine Breaking Changes an bestehenden API-Verträgen, außer zwingend nötig. Dann exakt dokumentieren.

# WICHTIGE QUELLENLOGIK
- `PERMANENT_SESSION_LIFETIME`
- `SESSION_REFRESH_EACH_REQUEST`
- Remember-Me / persistent login
- `SameSite` nicht blind auf `Strict`, wenn Google OAuth betroffen ist

# ERWARTETES ERGEBNIS
- Session bleibt bei aktiver Nutzung stabil
- Google OAuth funktioniert unverändert weiter
- Auth bleibt sicher und vorhersehbar
- Frontend reagiert sauber auf echte 401-Fälle

# LIEFERFORMAT
1. Ändere den Code direkt.
2. Gib danach:
   - Kurzfassung
   - geänderte Dateien
   - genaue Erklärung der Session-Änderungen
   - Tests/Checks, die ich manuell machen soll
```

---
## Phase 2 – Globale Text- und Kontakt-Konsistenz

### Kontext: Bereinige allgemeine Inkonsistenzen, bevor Features und neue UI-Layer darauf aufbauen.

**Abhängigkeiten:** Phase 1  
**Roadmap-Umfang:** G1, G2

### Prompt:

```bash
# ROLLE
Du bist ein erfahrener Senior Frontend-/Backend-Entwickler für saubere SaaS-Konsistenz und Text-Qualität.

# PROJEKT
AIRealCheck – SaaS zur Erkennung von KI-generierten Bildern, Audio und Video.

# STACK
- Backend: Flask
- DB: SQLite
- Frontend: Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4

# AUFGABE
Bereinige die globalen Inkonsistenzen:
1. echte deutsche Umlaute überall korrekt
2. überall exakt dieselbe offizielle E-Mail-Adresse

# VERBINDLICHE REGELN
- Umlaute: `ä, ö, ü, Ä, Ö, Ü, ß` müssen überall korrekt erscheinen
- Keine künstlichen Umschreibungen wie `ae`, `oe`, `ue`, wenn es echte deutsche UI-Texte sind
- Die einzige gültige E-Mail-Adresse in der gesamten App ist: `info@airealcheck.app`
- Alle anderen Platzhalter-Adressen ersetzen

# BETROFFENE BEREICHE
- alle Texte unter `frontend/app/`
- Komponenten unter `frontend/components/`
- Hilfsdateien unter `frontend/lib/`
- E-Mail-Texte / Mail-Templates im Backend
- Footer, Kontakt-Links, Hilfetexte, Pricing, Admin-Panel, Toasts, Tooltips, Empty States

# ANFORDERUNGEN
1. Quelltexte konsistent UTF-8 behandeln.
2. Alle deutschen UI-Strings, Server-Strings und Mail-Texte prüfen und korrigieren.
3. Eine zentrale Konstante/Konfiguration für die Kontakt-E-Mail einführen.
4. Alle Verwendungen von `pricing@`, `support@` oder sonstigen Altadressen ersetzen.
5. `mailto:`-Links, Footer, Hilfeblöcke und E-Mail-Vorlagen alle auf dieselbe zentrale Quelle umstellen.
6. Keine optischen Regressionen oder Layout-Brüche erzeugen.
7. Keine neue Bibliothek einführen.

# ERWARTETES ERGEBNIS
- In der gesamten App erscheinen deutsche Umlaute korrekt.
- In der gesamten App existiert nur noch `info@airealcheck.app`.
- Keine vergessenen Altadressen in Templates, Footer, Pricing oder E-Mails.

# LIEFERFORMAT
1. Code direkt ändern.
2. Danach ausgeben:
   - Kurzfassung
   - geänderte Dateien
   - Liste der ersetzten Altadressen
   - manuelle Prüf-Checkliste
```

---
## Phase 3 – Credits-System und Kosten-Single-Source

### Kontext: Zentralisiere Credit-Kosten und sorge für atomare Abbuchung nur nach erfolgreicher Analyse.

**Abhängigkeiten:** Phase 1-2  
**Roadmap-Umfang:** C1, P3

### Prompt:

```bash
# ROLLE
Du bist ein Senior Full-Stack-Entwickler für transaktionssichere SaaS-Credit-Systeme.

# PROJEKT
AIRealCheck – Credits-basierte KI-Inhalts-Erkennung für Bild, Audio und Video.

# STACK
- Flask
- SQLite
- Next.js + React + TypeScript + Tailwind

# AUFGABE
Zentralisiere das Credits-System und aktualisiere die Credit-Kosten überall.

# VERBINDLICHE NEUE KOSTEN
- Bild: 15 Credits
- Audio: 20 Credits
- Video: 30 Credits

# ZIELE
1. Credit-Abzug nur nach erfolgreicher Analyse
2. Bei Fehlern kein Credit-Abzug
3. Echtzeit-/Sofort-Refresh des Credit-Stands in UI
4. Neue Kostenwerte überall konsistent

# BETROFFENE BEREICHE
- Backend-Analysefluss
- Credit-Logik / Credit-Transaktionen
- API-Responses
- Admin-Panel
- Pricing
- Analyse-UI
- Sidebar / Profil / Tooltips / Hilfetexte

# ANFORDERUNGEN
1. Führe eine Single Source of Truth für Medientyp → Credit-Kosten ein.
2. Entferne verstreute Hardcodes.
3. Buche Credits atomar erst dann ab, wenn die Analyse erfolgreich abgeschlossen und speicherbar ist.
4. Wenn Upload/Analyse/Engine/Backend fehlschlägt und kein gültiges Ergebnis vorliegt:
   - keine Abbuchung
   - klare Fehlermeldung
5. Stelle sicher, dass API-Responses den aktuellen Credit-Stand sauber zurückgeben oder dass das Frontend sofort sauber refetchen kann.
6. Sidebar, Profil und Analyse-Seite müssen nach erfolgreicher Analyse denselben neuen Credit-Stand zeigen.
7. Admin-Panel und Pricing müssen dieselben Kostenwerte wie die Analyse-Oberfläche anzeigen.
8. Falls historische Datensätze bereits `credits_charged` oder ähnliche Felder enthalten, diese Historie nicht verfälschen.

# CONSTRAINTS
- Kein Breaking Change am Auth-Flow
- Keine unnötige DB-Änderung
- Wenn doch eine DB-Anpassung nötig ist, Migration exakt beschreiben

# ERWARTETES ERGEBNIS
- Neue Analysen ziehen exakt 15/20/30 Credits ab
- Fehlerfälle ziehen nichts ab
- Alte Restwerte verschwinden aus UI/API/Admin

# LIEFERFORMAT
1. Direkt implementieren.
2. Danach ausgeben:
   - Kurzfassung
   - geänderte Dateien
   - wo die Kosten-Single-Source liegt
   - Testfälle für Erfolg/Fehler
```

---
## Phase 4 – Lokalisierung und Spracheinstellungen

### Kontext: Mache die Sprachauswahl funktional und überführe Hardcodes in eine echte Übersetzungsstruktur.

**Abhängigkeiten:** Phase 2  
**Roadmap-Umfang:** E1, G1

### Prompt:

```bash
# ROLLE
Du bist ein Senior Frontend-Architekt für Internationalisierung in Next.js-/React-SaaS-Apps.

# PROJEKT
AIRealCheck – vorhandene Sprachauswahl existiert, ist aber noch nicht funktional.

# STACK
- Frontend: Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4
- Backend: Flask
- DB: SQLite

# AUFGABE
Mache die Sprachauswahl vollständig funktional.

# VERBINDLICHE SPRACHEN
- Deutsch
- Englisch
- Französisch
- Spanisch

# ZIELE
- Alle UI-Texte der App übersetzbar
- Sprachwechsel ohne Page-Reload, wo technisch möglich
- Sprachpräferenz speichern
- Beim Login wiederherstellen

# BETROFFENE BEREICHE
- `frontend/app/(app)/`
- `frontend/app/(auth)/`
- `frontend/components/layout/`
- `frontend/lib/`
- `frontend/contexts/AuthContext.tsx`
- Backend-Endpunkte/Modelle für Nutzerpräferenz

# ANFORDERUNGEN
1. Baue eine saubere Übersetzungsarchitektur statt verstreuter Hardcodes.
2. Übersetze alle Kernseiten:
   - Dashboard
   - Analyse
   - Ergebnisse
   - Verlauf
   - Pricing / Upgrade
   - Profil
   - Einstellungen
   - Admin
3. Berücksichtige auch:
   - Form-Validierungen
   - Toasts
   - Tooltips
   - Loader-Schritte
   - Empty States
   - E-Mail-Texte
4. Sprachwechsel soll im laufenden Frontend direkt sichtbar werden, ohne harten Full Reload, wo möglich.
5. Für eingeloggte Nutzer:
   - Sprachpräferenz in DB speichern
   - beim Login wiederherstellen
6. Für Gäste:
   - Session/Cookie-basierter Fallback
7. Verwende für Datums-/Zahlenformatierung native Intl-APIs oder bereits vorhandene Mittel.
8. Keine neue i18n-Bibliothek einführen, außer wirklich nötig. Wenn eingeführt, exakt begründen.

# WICHTIG
- Keine Routing-Zerstörung
- Keine Auth-Regression
- Keine halbfertige Mischlösung aus übersetzten und nicht übersetzten Kerntexten

# ERWARTETES ERGEBNIS
- Spracheinstellungen funktionieren wirklich
- DE/EN/FR/ES sind sichtbar nutzbar
- Nach erneutem Login bleibt die gewählte Sprache erhalten

# LIEFERFORMAT
1. Direkt implementieren.
2. Danach ausgeben:
   - Kurzfassung
   - geänderte Dateien
   - Aufbau der Übersetzungsstruktur
   - offene Sonderfälle, die du bereits mitgelöst hast
   - manuelle Testliste
```

---
## Phase 5 – Admin-Rollen und sichere Berechtigungen

### Kontext: Baue ein minimales Rollenmodell mit Migration und Schutz gegen Selbst-Aussperrung.

**Abhängigkeiten:** Phase 1  
**Roadmap-Umfang:** AP1

### Prompt:

```bash
# ROLLE
Du bist ein Senior Backend-/Admin-System-Entwickler für Rollen- und Rechteverwaltung.

# PROJEKT
AIRealCheck – vorhandenes Admin-Panel soll Rollen anderer Nutzer ändern können.

# STACK
- Flask
- SQLite
- Next.js / React / TypeScript / Tailwind

# AUFGABE
Baue ein sicheres Rollen-Management ins Admin-Panel.

# ROLLENMODELL (VERBINDLICH)
- `user`
- `moderator`
- `admin`

# ZIELE
- Admin kann Rollen anderer Nutzer ändern
- Rollenwechsel sofort wirksam
- Nur Admins dürfen Rollen ändern
- Admin darf eigene Rolle nicht entfernen
- Letzter verbleibender Admin darf nicht entfernt/herabgestuft werden

# BETROFFENE BEREICHE
- User-Modell
- Admin-API
- Rollenprüfung/Middleware
- Admin-UI (User-Tabelle oder User-Detail)
- Audit-Logs

# ANFORDERUNGEN
1. Prüfe, ob aktuell nur ein Bool-Feld wie `is_admin` existiert.
2. Falls nötig:
   - ergänze ein `role`-Feld
   - beschreibe SQLite-Migration exakt
   - backfille bestehende Admins auf `admin`
   - Standard für alle anderen `user`
3. Rechte sauber definieren:
   - `user`: normale App-Nutzung
   - `moderator`: Moderation/Review, keine volle Systemkontrolle
   - `admin`: volle Admin-Rechte
4. Rollenänderung serverseitig validieren und audit-loggen.
5. Admin-UI mit klarer Rolle-Auswahl und sauberem Feedback bauen.
6. Eigene Selbst-Demotion verhindern.
7. Schutz gegen Entfernung des letzten Admins implementieren.
8. Keine Sicherheitslogik nur im Frontend.

# CONSTRAINTS
- Kein Breaking Change am Auth-Flow
- Keine unbeschriebene DB-Änderung
- Keine stillen Berechtigungs-Löcher

# ERWARTETES ERGEBNIS
- Rollen können sicher geändert werden
- Rollen greifen sofort
- Selbst-Aussperrung ist verhindert
- Audit-Log dokumentiert Rollenwechsel

# LIEFERFORMAT
1. Direkt implementieren.
2. Danach ausgeben:
   - Kurzfassung
   - geänderte Dateien
   - Migrationsbeschreibung
   - Rechte-Matrix
   - Testfälle
```

---
## Phase 6 – Analyse-Datenmodell und Ladezustände

### Kontext: Baue die Analysefläche dynamisch und robust, inklusive kompletter Pflichtübernahme aus der Analyse-PDF.

**Abhängigkeiten:** Phase 3-4  
**Roadmap-Umfang:** A1, A2, A3

### Prompt:

```bash
# ROLLE
Du bist ein Senior Frontend-/Produkt-Entwickler für professionelle Analyse-Interfaces in modernen SaaS-Apps.

# PROJEKT
AIRealCheck – Web-App zur Erkennung von KI-generierten Bildern, Audio und Video.

# STACK
- Frontend: Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4
- Backend: Flask
- DB: SQLite

# AUFGABE
Optimiere die Analyse-Oberfläche vollständig. Die Analyse muss modern, professionell, transparent und zukunftssicher wirken.

# WICHTIGSTE CONSTRAINTS
- Kein Breaking Change am Auth-Flow
- Keine feste Erwartung an bestimmte Engine-Namen oder feste Engine-Anzahl
- Keine UI, die nur für Bilder funktioniert; Bild, Audio und Video müssen im selben System sauber unterstützt werden
- Keine neuen Pakete ohne Begründung

# VERBINDLICHE PFLICHTÜBERNAHME AUS DER PDF
Alle folgenden Punkte müssen 1:1 inhaltlich vollständig umgesetzt werden. Nichts weglassen, nichts zusammenfassen:

A1.1 – Skeleton Screen während der Analyse
- Während der Analyse wird kein einfacher Spinner angezeigt, sondern ein Platzhalter-Layout (Skeleton Screen).
- Der Nutzer sieht bereits die Struktur des späteren Ergebnisses: Ergebnis-Karte, Confidence-Ring, Engine-Liste und technische Signale.
- Die Elemente sind grau und besitzen eine leichte Shimmer-Animation, bis die echten Daten geladen sind.
- Ziel: Wahrgenommene Geschwindigkeit erhöhen und Wartezeit angenehmer machen.
- Quelle: Nielsen Norman Group – Skeleton Screens (https://www.nngroup.com/articles/skeleton-screens/)
A1.2 – Analyse-Status mit klaren Schritten
- Während der Analyse werden sichtbare Schritte angezeigt, damit Nutzer verstehen, was gerade passiert.
- Beispiel-Schritte: Uploading file → Extracting signals → Running AI engines → Combining results → Preparing report.
- Der aktuelle Schritt wird visuell hervorgehoben.
- Ziel: Transparenz erhöhen und Vertrauen schaffen.
- Quelle: Google UX Research – Perceived Performance (https://web.dev/performance-perception/)
A1.3 – Progress Bar mit optimierter Wahrnehmung
- Die Fortschrittsanzeige verläuft nicht linear.
- Beispiel: 0–40 % Upload → 40–70 % Analyse → 70–90 % Ensemble-Auswertung → 90–100 % Ergebnis rendern.
- Der Anfang wirkt schneller, das Ende langsamer.
- Ziel: Analyse wirkt schneller und Nutzer bleiben geduldiger.
- Quelle: Harrison, Yeo & Hudson (2010) – Faster Progress Bars: Manipulating Perceived Duration (CHI Conference).
A1.4 – Live Engine Activity während der Analyse
- Während die Analyse läuft, werden aktive Engines sichtbar dargestellt.
- Beispiel: ✓ Artifact Detection, ✓ GAN Pattern Scanner, ■ Vision Transformer Model.
- Der Nutzer sieht, welche Modelle bereits abgeschlossen sind und welche noch laufen.
- Ziel: System wirkt transparenter und professioneller.
- Quelle: Empfehlungen zu Explainable AI und Transparenz in KI-Systemen (Microsoft Responsible AI, Google Explainable AI).
A1.5 – Confidence Score visuell darstellen
- Das Ergebnis wird nicht nur als Text angezeigt, sondern mit einem visuellen Score-Ring oder Gauge.
- Beispiel: 'Likely AI-Generated – Confidence: 82 %'.
- Ziel: Wahrscheinlichkeiten schneller verständlich machen.
- Quelle: IBM Design – Communicating Uncertainty in AI (https://www.ibm.com/design/ai/fundamentals/uncertainty/)
A1.6 – Technical Signals anzeigen (Explainable AI)
- Unterhalb des Ergebnisses wird angezeigt, welche Signale zur Entscheidung geführt haben.
- Beispiele: GAN frequency artifacts, Lighting inconsistencies, Pixel noise irregularities.
- Ziel: Entscheidung der KI nachvollziehbarer machen.
- Quelle: DARPA Explainable AI Program / IBM Explainable AI.
A1.7 – Dynamische Architektur der Analyse (wichtig für zukünftige Erweiterungen)
- Die Analyse-Oberfläche muss dynamisch aufgebaut sein und sich automatisch an Änderungen im Backend anpassen.
- Das Backend und die Analyse-Engines von AIRealCheck sind noch in Entwicklung und können sich jederzeit ändern.
- Neue Engines können hinzugefügt werden, bestehende Engines können entfernt oder ersetzt werden.
- Auch neue Analyse-Signale, neue Ergebnisfelder oder zusätzliche Analyse-Module können später integriert werden.
- Die UI darf daher keine festen Engine-Namen oder feste Anzahl an Engines erwarten.
- Stattdessen sollen Engine-Ergebnisse, Signale und Analyse-Daten dynamisch aus der Backend-Response gerendert werden.
- Ziel: Die Oberfläche bleibt kompatibel, auch wenn sich das Analyse-System weiterentwickelt.

# ZUSÄTZLICHE VERBINDLICHE ANFORDERUNGEN
1. Leere Analyse-Card soll etwa 20 % breiter und insgesamt etwas größer sein.
2. Die Card „Was du bekommst“ daneben soll exakt dieselbe Höhe wie die Analyse-Card haben.
3. Medientyp-Buttons (Bild, Video, Audio) müssen wie echte moderne Buttons aussehen:
   - klarer Rahmen
   - Hover-Effekt
   - aktiver Zustand
   - gute Fokus-States
4. Die Dropzone darf ihre Größe beim Datei-Upload NICHT verändern.
5. Lange Dateinamen müssen an die Breite angepasst werden:
   - Ellipsis oder kontrollierter Wrap
6. Dropzone-Dimensionen müssen während der gesamten Analyse konstant bleiben.

# BETROFFENE BEREICHE
- Analyse-Seite unter `frontend/app/(app)/`
- Analyse-/Result-Komponenten unter `frontend/components/`
- Status-/Progress-/Engine-/Signal-Komponenten
- gemeinsame UI-Tokens / Tailwind-Klassen
- Backend-Response-Mapping im Frontend

# ERWARTETES VERHALTEN NACH DER IMPLEMENTIERUNG
- Während der Analyse: Skeleton + Schrittstatus + Progress + Live-Engine-Aktivität
- Nach der Analyse: klarer visueller Confidence-Score + Technical Signals
- Ergebnisdarstellung bleibt robust, auch wenn das Backend Engines/Signale/Felder später ändert
- Keine Layout-Sprünge durch Dropzone oder Result-Container

# WICHTIG
Baue die Analysefläche datengetrieben. Keine hartcodierten Engine-Namen. Keine feste Anzahl an Signals/Warnings/Result-Feldern.
Die Oberfläche muss spätere Backend-Erweiterungen ohne Frontend-Umbau tolerieren.

# LIEFERFORMAT
1. Implementiere direkt.
2. Gib danach aus:
   - Kurzfassung
   - geänderte Dateien
   - welche A1-Unterpunkte umgesetzt wurden
   - welche Datenstruktur du für dynamisches Rendering verwendest
   - manuelle Testschritte für Bild/Audio/Video
```

---
## Phase 7 – Pricing/Premium-Optimierung

### Kontext: Baue die Pricing-Seite und Upgrade-CTA conversion-stärker und komplett dynamisch, inklusive kompletter Pflichtübernahme aus der Pricing-PDF.

**Abhängigkeiten:** Phase 3-4  
**Roadmap-Umfang:** P1, P2, P3

### Prompt:

```bash
# ROLLE
Du bist ein Senior SaaS-Produktdesigner und Frontend-Architekt für Pricing-, Upgrade- und Conversion-Seiten.

# PROJEKT
AIRealCheck – Pricing/Upgrade-Bereich für Free, Pro und Business.

# STACK
- Frontend: Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4
- Backend: Flask
- DB: SQLite

# AUFGABE
Optimiere die Premium-/Pricing-Oberfläche vollständig und mache sie conversion-stark, dynamisch und sauber mit dem restlichen Produkt verbunden.

# VERBINDLICHE PFLICHTÜBERNAHME AUS DER PDF
Alle folgenden Punkte müssen 1:1 inhaltlich vollständig umgesetzt werden. Nichts weglassen, nichts zusammenfassen:

P1.1 – Ziel dieser Roadmap
- Diese Roadmap beschreibt UX- und Conversion-Strategien für die Premium-Pricing-Seite von AIRealCheck.
- Die Struktur dient als Grundlage für die Implementierung durch Entwickler (z.B. Claude / Codex).
- Die konkreten Preise, Rabatte und Plan-Namen werden später dynamisch angepasst.
- Ziel ist eine Pricing-Seite, die Vertrauen schafft und gleichzeitig die Conversion-Rate erhöht.
P1.2 – Anchoring (Preis-Anker einsetzen)
- Der ursprüngliche höhere Preis wird zuerst angezeigt und anschließend durchgestrichen dargestellt.
- Darunter wird der aktuelle reduzierte Preis angezeigt.
- Beispiel: 49€ → 29€. Der ursprüngliche Preis dient als Vergleichspunkt.
- Der Nutzer bewertet den Preis nicht absolut, sondern relativ zum vorher gesehenen Wert.
- Diese Technik wird als Anchoring Bias bezeichnet.
- Quelle: Kahneman & Tversky (1974) – Judgment under Uncertainty: Heuristics and Biases.
P1.3 – Social Proof (Beliebtester Plan hervorheben)
- Eine Pricing-Card wird visuell hervorgehoben und mit einem Badge versehen.
- Typische Badge-Bezeichnungen: 'Most Popular', 'Best Value', 'Recommended'.
- Diese Markierung signalisiert Nutzern, welcher Plan am häufigsten gewählt wird.
- Menschen orientieren sich bei Entscheidungen stark am Verhalten anderer Nutzer.
- Der Badge reduziert Unsicherheit bei der Kaufentscheidung.
- Quelle: Robert Cialdini – Influence: The Psychology of Persuasion.
P1.4 – Loss Aversion (Rabatte als Einsparung kommunizieren)
- Rabatte werden nicht nur als niedrigerer Preis dargestellt, sondern als Einsparung.
- Beispiel: 'Save 40%' statt nur '29€ pro Monat'.
- Menschen reagieren stärker auf potenzielle Verluste als auf gleich große Gewinne.
- Die Formulierung zeigt dem Nutzer, wie viel Geld er verlieren würde, wenn er das Angebot nicht nutzt.
- Quelle: Kahneman & Tversky (1979) – Prospect Theory.
P1.5 – Struktur einer optimalen Pricing Card
- Plan-Name (z.B. Basic, Pro, Premium).
- Preisbereich mit Anchoring (alter Preis durchgestrichen, neuer Preis hervorgehoben).
- Optionaler Badge für den beliebtesten Plan.
- Rabatt-Hinweis wie 'Save X%' oder 'Limited offer'.
- Liste der wichtigsten Features des Plans.
- Klare Call-to-Action-Schaltfläche (z.B. 'Start Now', 'Upgrade').
P1.6 – Dynamische Anpassbarkeit der Pricing-Seite
- Die Pricing-UI darf keine festen Preise oder festen Rabattwerte erwarten.
- Preise, Rabatte, Badge-Texte und Plan-Strukturen müssen dynamisch vom Backend geladen werden.
- Neue Pläne können später hinzugefügt werden.
- Bestehende Pläne können geändert oder entfernt werden.
- Rabatte können zeitlich begrenzt oder experimentell angepasst werden.
- Ziel ist eine flexible Architektur, die zukünftige Änderungen ohne UI-Änderungen erlaubt.
P1.7 – Langfristige Optimierung (A/B-Tests)
- Pricing-Elemente sollten regelmäßig getestet werden.
- Mögliche Tests: unterschiedliche Rabatthöhen, verschiedene Badge-Texte, unterschiedliche Plan-Reihenfolgen.
- A/B-Testing hilft dabei herauszufinden, welche Variante die höchste Conversion-Rate erzielt.
- Quelle: Baymard Institute – Pricing Page UX Research.

# ZUSÄTZLICHE VERBINDLICHE ANFORDERUNGEN
1. Sidebar-Upgrade-Button dynamisch nach aktuellem Plan:
   - Free Plan → „Upgrade auf Pro“
   - Pro Plan → „Upgrade auf Business“
   - Business Plan → Button ausblenden oder „Aktiver Plan“ anzeigen
2. Neue Credit-Kosten überall korrekt anzeigen:
   - Bild: 15 Credits
   - Audio: 20 Credits
   - Video: 30 Credits
3. Alle alten Kostenwerte in UI, Tooltips, Pricing, API-Responses und Admin-Panel ersetzen.

# WEITERE PRODUKTANFORDERUNGEN
- Pricing-Seite darf keine festen Preise, festen Rabattwerte oder feste Badge-Texte erwarten
- Plan-Struktur muss dynamisch vom Backend ladbar sein
- Spätere neue Pläne dürfen die UI nicht brechen
- Highlight-/Featured-Plan muss auf Mobile und Desktop gut funktionieren
- CTA-Logik muss zum aktuellen Planstatus passen

# BETROFFENE BEREICHE
- Pricing-/Upgrade-Seiten unter `frontend/app/(app)/`
- Sidebar/Navigation unter `frontend/components/layout/`
- Plan-/Pricing-Datenmodell im Backend
- API-Responses für Plan- und Credit-Informationen
- Admin-Panel-Anzeigen für Credit-Kosten / Pricing-bezogene Texte

# WICHTIG
Keine Fake-Rabatte. Keine statischen Demo-Werte. Keine hart verdrahtete Drei-Karten-UI, die bei zusätzlichen Plänen zerbricht.

# ERWARTETES ERGEBNIS
- Pricing-Seite wirkt professionell und modern
- Upgrade-CTAs sind planabhängig korrekt
- Kreditkosten sind überall konsistent
- Die Seite ist strukturell A/B-test-fähig und backend-dynamisch

# LIEFERFORMAT
1. Direkt implementieren.
2. Danach ausgeben:
   - Kurzfassung
   - geänderte Dateien
   - welche P1-Unterpunkte umgesetzt wurden
   - wie Preis-/Badge-/Plan-Daten jetzt modelliert sind
   - Testschritte für Free/Pro/Business
```

---
## Phase 8 – Light-Mode-Polish und Abschluss-QA

### Kontext: Führe zum Schluss Theme-, Responsive- und Regression-QA durch und optimiere den Light Mode als letzten visuellen Schritt.

**Abhängigkeiten:** Phase 1-7  
**Roadmap-Umfang:** L1, A2, P1, P2

### Prompt:

```bash
# ROLLE
Du bist ein Senior UI/UX-Engineer für Theme-Systeme, Accessibility und finale SaaS-Politur.

# PROJEKT
AIRealCheck – finaler visueller Abschluss nach den funktionalen Änderungen.

# STACK
- Next.js 16.1.6 + React 19 + TypeScript 5 + Tailwind CSS 4
- Flask + SQLite Backend

# AUFGABE
Optimiere den Light Mode vollständig und führe eine Abschluss-QA für Responsive, Theme-Konsistenz und Regressionen durch.

# VERBINDLICHE LIGHT-MODE-ANFORDERUNGEN
1. Sidebar-Texte und Überschriften dunkler für bessere Lesbarkeit
2. Alle Texte, Cards und Sections harmonisch abgestuft
3. Hintergrund leichtes Off-White oder sehr helles Grau
4. Kein Element darf im Dark-Mode-Zustand bleiben
5. Accessibility:
   - normaler Text mindestens 4.5:1
   - großer Text mindestens 3:1
   - relevante UI-Komponenten/States mindestens 3:1

# BETROFFENE BEREICHE
- globale Theme-Tokens
- Layout-Komponenten
- Sidebar / Bottom Navigation
- Cards / Inputs / Buttons / Tabs / Badges / Tables
- Analyse
- Ergebnisse
- Verlauf
- Pricing
- Profil
- Einstellungen
- Admin

# ANFORDERUNGEN
1. Light Mode als eigenes Theme behandeln, nicht nur Dark-Farben invertieren.
2. Definiere saubere Light-Mode-Farbabstufungen für:
   - Background
   - Surface / Card
   - Border
   - Text Primary / Secondary
   - Hover / Active
   - Fokus-Ring
   - Success / Warning / Danger
3. Prüfe auf übrig gebliebene Dark-Mode-Reste.
4. Führe eine visuelle Regression über Kernseiten durch.
5. Responsive QA für Mobile + Desktop machen.
6. Achte darauf, dass die Änderungen die neuen Analyse-/Pricing-/Settings-Änderungen nicht zerstören.

# ERWARTETES ERGEBNIS
- Light Mode wirkt professionell, ruhig und lesbar
- Keine Farbkollisionen, keine blassen Texte, keine Dark-Mode-Reste
- App ist nach allen v4-Änderungen konsistent und responsive

# LIEFERFORMAT
1. Direkt implementieren.
2. Danach ausgeben:
   - Kurzfassung
   - geänderte Dateien
   - welche Theme-/Token-Änderungen gemacht wurden
   - welche Screens du visuell geprüft hast
   - finale manuelle Regression-Checkliste
```

