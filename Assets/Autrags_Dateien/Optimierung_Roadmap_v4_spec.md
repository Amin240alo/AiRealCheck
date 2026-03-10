# AIRealCheck – Optimierungs-Roadmap v4 (Spec)

**Version:** v4  
**Datum:** 10.03.2026  
**Projekt:** AIRealCheck  
**Ziel:** Vollständige technische Spec zur Umsetzung der Optimierungs-Roadmap v4 in Claude Code.  

## Kurz-Zusammenfassung der Projektanalyse (max. 200 Wörter)

AIRealCheck ist bereits als SaaS-Grundgerüst weit fortgeschritten: Auth (inkl. Google OAuth), Credits, Analyse, Verlauf, Admin-Panel, Profil, Einstellungen sowie Dark/Light-Shell sind vorhanden. Die größten Lücken liegen nicht mehr in fehlenden Grundfunktionen, sondern in Systemkohärenz: Session-Stabilität, zentralisierte Produktkonfiguration (Credits/Kontaktadresse), echte Lokalisierung, feinere Rollenlogik und saubere UI-Konsistenz über Analyse, Pricing und Light Mode. Die externen Best Practices stützen genau diese Stoßrichtung: Skeletons und sichtbare Statusschritte verbessern die wahrgenommene Geschwindigkeit und Transparenz; Pricing-Seiten profitieren von klaren Vergleichsankern, Social Proof und backendgesteuerter Flexibilität; Flask-Sessions sollten bewusst über Lebensdauer, Remember-Me, Cookie-Flags und Aktivitäts-Refresh gehärtet werden; und Light-Mode-/Lokalisierungsarbeit muss WCAG-AA-Kontrast sowie sprachsensitive Formatierung respektieren. Daraus folgt für v4: zuerst Stabilität und Single-Source-of-Truth, dann Funktionsausbau, danach UX-/Conversion-Polish.

## Projektkontext

- [ ] Stack unveränderlich: Python/Flask, SQLite (`app.db`), Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS 4.
- [ ] Bekannte Struktur: `frontend/app/(app)/`, `frontend/app/(auth)/`, `frontend/components/layout/`, `frontend/lib/`, `frontend/contexts/AuthContext.tsx`.
- [ ] Vorhanden: Account-System, Credits-System, Analyse-UI, History, Admin-Panel, Sidebar/Bottom Navigation, Profil, Einstellungen.
- [ ] Constraints: kein Breaking Change am Auth-Flow, keine DB-Änderung ohne Migrationsbeschreibung, keine neuen Pakete ohne Angabe + Begründung, keine Platzhalter/TODOs.

## Quellenbasis

- [ ] [I1] Roadmap_Analyse_optimierungv1.pdf (vom Nutzer bereitgestellt)
- [ ] [I2] Roadmap_Pricing_Optimierung_v1.pdf (vom Nutzer bereitgestellt)
- [ ] [S1] Flask Documentation 3.1.x – Configuration Handling (`PERMANENT_SESSION_LIFETIME`) — https://flask.palletsprojects.com/en/stable/config/
- [ ] [S2] Flask Documentation 3.1.x – API (`permanent_session_lifetime` default 31 days) — https://flask.palletsprojects.com/en/stable/api/
- [ ] [S3] Flask Documentation 3.1.x – Configuration Handling (`SESSION_REFRESH_EACH_REQUEST`) — https://flask.palletsprojects.com/en/stable/config/
- [ ] [S4] Flask-Login Documentation 0.7.0 — https://flask-login.readthedocs.io/
- [ ] [S5] Flask-Login Documentation 0.6.3 – Remember Me — https://flask-login.readthedocs.io/en/0.6.3/
- [ ] [S6] Flask Documentation 3.1.x – Security Considerations — https://flask.palletsprojects.com/en/stable/web-security/
- [ ] [S7] OWASP Session Management Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- [ ] [S8] OWASP CSRF Prevention Cheat Sheet – SameSite Cookie Attribute — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- [ ] [S9] MDN – Set-Cookie Header (`SameSite=Lax` und Top-Level-Navigation) — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- [ ] [S10] OWASP Web Security Testing Guide – Testing for Cookies Attributes (`SameSite=Strict`) — https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes
- [ ] [S11] React Docs – `useContext` — https://react.dev/reference/react/useContext
- [ ] [S12] MDN – `Intl.DateTimeFormat` — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- [ ] [S13] MDN – `Intl` namespace — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
- [ ] [S14] Next.js Docs – Internationalization (App Router / Guides) — https://nextjs.org/docs/app/guides/internationalization
- [ ] [S15] Nielsen Norman Group – Skeleton Screens — https://www.nngroup.com/articles/skeleton-screens/
- [ ] [S16] web.dev – Perceived Performance — https://web.dev/performance-perception/
- [ ] [S17] W3C – WCAG 2.2, Success Criterion 1.4.3 Contrast (Minimum) — https://www.w3.org/TR/WCAG22/
- [ ] [S18] web.dev – Color and contrast accessibility — https://web.dev/articles/color-and-contrast-accessibility
- [ ] [S19] W3C – Understanding Success Criterion 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- [ ] [S20] Nielsen Norman Group – Social Proof in the User Experience — https://www.nngroup.com/articles/social-proof-ux/
- [ ] [S21] Baymard Institute – Digital Subscriptions & SaaS UX Benchmark — https://baymard.com/ux-benchmark/collections/digital-subscriptions

## Roadmap-Sektionen

## ANALYSE

### A1 – Analyse-UI/UX Optimierung

**Beschreibung:** Alle Punkte aus `Roadmap_Analyse_optimierungv1.pdf` müssen 1:1 und vollständig übernommen werden. Kein Punkt darf entfallen, zusammengefasst oder vereinfacht werden.  
**Ziel:** Die Analyse soll während des Wartens transparenter, professioneller und schneller wirkend erscheinen und nach dem Ergebnis eine dynamische, erklärbare und zukunftssichere Datenarchitektur besitzen.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: Analyse-Route und Ergebnis-Komponenten unter `frontend/app/(app)/` und `frontend/components/`.
- [ ] Backend: Analyse-Response-Struktur, Status-/Engine-Events, Credit-Abzug, Result-Mapping.
**Quellenbasis:** [S15] [S16]  

**Technische Details:**
- [ ] Die sieben Pflichtpunkte aus der PDF als verbindliche Unterpunkte A1.1 bis A1.7 umsetzen.
- [ ] Zusätzlich die Analyse-Response so normalisieren, dass die UI für Bild, Audio und Video dieselben Kernblöcke robust rendern kann.
- [ ] Die UI muss backend-dynamisch bleiben und darf keine festen Engine- oder Signalannahmen codieren.

**Akzeptanzkriterien:**
- [ ] Alle Inhalte der PDF sind in v4 vollständig enthalten.
- [ ] Kein A1-Unterpunkt wurde gekürzt oder in einen Sammelpunkt verschmolzen.
- [ ] Die Analyse-Oberfläche bleibt bei zukünftigen Backend-Änderungen kompatibel.

**Pflichtübernahme aus `Roadmap_Analyse_optimierungv1.pdf` (1:1 und vollständig):**

#### A1.1 – Skeleton Screen während der Analyse
**Originalpunkte aus PDF:**
- [ ] Während der Analyse wird kein einfacher Spinner angezeigt, sondern ein Platzhalter-Layout (Skeleton Screen).
- [ ] Der Nutzer sieht bereits die Struktur des späteren Ergebnisses: Ergebnis-Karte, Confidence-Ring, Engine-Liste und technische Signale.
- [ ] Die Elemente sind grau und besitzen eine leichte Shimmer-Animation, bis die echten Daten geladen sind.
- [ ] Ziel: Wahrgenommene Geschwindigkeit erhöhen und Wartezeit angenehmer machen.
- [ ] Quelle: Nielsen Norman Group – Skeleton Screens (https://www.nngroup.com/articles/skeleton-screens/)
**Technische Umsetzung in v4:**
- [ ] Im Frontend eine feste Analyse-Skeleton-Komposition einführen, die die endgültige Ergebnisstruktur 1:1 spiegelt, aber keine Fake-Daten zeigt.
- [ ] Skeleton nur für Analyse-Latenzen >300–500 ms anzeigen, um kurzes Flackern zu vermeiden; bei schneller Antwort direkt das Ergebnis rendern.
- [ ] Shimmer-Animation dezent halten und per `prefers-reduced-motion` deaktivierbar machen.
- [ ] Der Skeleton-Zustand muss dieselben Card-Dimensionen nutzen wie der fertige Ergebniszustand, damit keine Layout-Sprünge entstehen.
**Akzeptanzkriterien:**
- [ ] Während der Analyse ist nirgends ein reiner Spinner als primärer Ladezustand sichtbar.
- [ ] Ergebnis-Karte, Ring, Engine-Liste und technische Signale erscheinen als Skeleton in finaler Größe.
- [ ] Beim Wechsel vom Skeleton zum echten Ergebnis verschiebt sich das Layout nicht sichtbar.

#### A1.2 – Analyse-Status mit klaren Schritten
**Originalpunkte aus PDF:**
- [ ] Während der Analyse werden sichtbare Schritte angezeigt, damit Nutzer verstehen, was gerade passiert.
- [ ] Beispiel-Schritte: Uploading file → Extracting signals → Running AI engines → Combining results → Preparing report.
- [ ] Der aktuelle Schritt wird visuell hervorgehoben.
- [ ] Ziel: Transparenz erhöhen und Vertrauen schaffen.
- [ ] Quelle: Google UX Research – Perceived Performance (https://web.dev/performance-perception/)
**Technische Umsetzung in v4:**
- [ ] Das Backend oder der Analyse-Orchestrator soll statusfähige Stufen liefern; das Frontend rendert diese Stufen dynamisch statt hart verdrahtet.
- [ ] Die aktuelle Stufe wird mit Accent-Farbe, Icon-Status und `aria-live="polite"` ausgezeichnet.
- [ ] Schrittnamen lokalisiert ausgeben; Backend liefert stabile Schlüssel, Frontend mappt sie auf sichtbare Übersetzungen.
**Akzeptanzkriterien:**
- [ ] Der Nutzer sieht jederzeit, in welcher Analyse-Stufe sich der Job befindet.
- [ ] Die aktive Stufe ist visuell klar markiert.
- [ ] Die Schrittanzeige funktioniert für Bild, Audio und Video.

#### A1.3 – Progress Bar mit optimierter Wahrnehmung
**Originalpunkte aus PDF:**
- [ ] Die Fortschrittsanzeige verläuft nicht linear.
- [ ] Beispiel: 0–40 % Upload → 40–70 % Analyse → 70–90 % Ensemble-Auswertung → 90–100 % Ergebnis rendern.
- [ ] Der Anfang wirkt schneller, das Ende langsamer.
- [ ] Ziel: Analyse wirkt schneller und Nutzer bleiben geduldiger.
- [ ] Quelle: Harrison, Yeo & Hudson (2010) – Faster Progress Bars: Manipulating Perceived Duration (CHI Conference).
**Technische Umsetzung in v4:**
- [ ] Keinen rein zufälligen Fake-Fortschritt verwenden; stattdessen Stage-Weights definieren und reale Stufen auf Prozentbereiche abbilden.
- [ ] Wenn exakte Prozentwerte aus dem Backend fehlen, den Fortschritt pro Stufe glatt animieren, aber beim Stufenwechsel streng synchronisieren.
- [ ] Die Bar muss während langer Engine-Läufe weiterleben, ohne rückwärts zu springen oder bei 99 % hängen zu bleiben.
**Akzeptanzkriterien:**
- [ ] Die Fortschrittsanzeige startet schnell, läuft dann kontrolliert aus und springt nicht rückwärts.
- [ ] Jede Analyse endet sauber bei 100 % erst dann, wenn das Ergebnis tatsächlich renderbar ist.
- [ ] Die Progress Bar ist konsistent mit der sichtbaren Schrittanzeige.

#### A1.4 – Live Engine Activity während der Analyse
**Originalpunkte aus PDF:**
- [ ] Während die Analyse läuft, werden aktive Engines sichtbar dargestellt.
- [ ] Beispiel: ✓ Artifact Detection, ✓ GAN Pattern Scanner, ■ Vision Transformer Model.
- [ ] Der Nutzer sieht, welche Modelle bereits abgeschlossen sind und welche noch laufen.
- [ ] Ziel: System wirkt transparenter und professioneller.
- [ ] Quelle: Empfehlungen zu Explainable AI und Transparenz in KI-Systemen (Microsoft Responsible AI, Google Explainable AI).
**Technische Umsetzung in v4:**
- [ ] Engine-Namen, Status und optional Laufzeit dynamisch aus der Backend-Response rendern; keine feste Anzahl oder feste Engine-Reihenfolge annehmen.
- [ ] Statusmodelle mindestens `queued`, `running`, `done`, `failed`, `skipped` unterstützen.
- [ ] Engine-Ausfälle als Teilstatus anzeigen, ohne den gesamten Result-Drawer zu zerstören, sofern das Ensemble trotzdem ein Ergebnis liefern kann.
**Akzeptanzkriterien:**
- [ ] Mindestens laufende und abgeschlossene Engines sind während der Analyse sichtbar.
- [ ] Die UI funktioniert korrekt, wenn Engines hinzugefügt, entfernt oder umbenannt werden.
- [ ] Einzelne Engine-Fehler führen nicht zu inkonsistenten Statusanzeigen.

#### A1.5 – Confidence Score visuell darstellen
**Originalpunkte aus PDF:**
- [ ] Das Ergebnis wird nicht nur als Text angezeigt, sondern mit einem visuellen Score-Ring oder Gauge.
- [ ] Beispiel: 'Likely AI-Generated – Confidence: 82 %'.
- [ ] Ziel: Wahrscheinlichkeiten schneller verständlich machen.
- [ ] Quelle: IBM Design – Communicating Uncertainty in AI (https://www.ibm.com/design/ai/fundamentals/uncertainty/)
**Technische Umsetzung in v4:**
- [ ] Score-Ring/Gauge an eine normierte `confidence`-Struktur binden (`label`, `score`, `direction`, `band`, `reasoning-summary`).
- [ ] Neben dem visuellen Ring muss immer ein Klartext-Label stehen, damit Unsicherheit nicht nur farblich kommuniziert wird.
- [ ] Farbbänder in beiden Themes kontrastreich und WCAG-konform gestalten; kein rein rot/grün-basiertes Verständnis erzwingen.
**Akzeptanzkriterien:**
- [ ] Jedes Ergebnis zeigt Klartext + Prozentwert + visuellen Ring/Gauge.
- [ ] Die Darstellung bleibt im Light und Dark Mode lesbar.
- [ ] Screenreader erhalten eine sinnvolle Textalternative zum Ring.

#### A1.6 – Technical Signals anzeigen (Explainable AI)
**Originalpunkte aus PDF:**
- [ ] Unterhalb des Ergebnisses wird angezeigt, welche Signale zur Entscheidung geführt haben.
- [ ] Beispiele: GAN frequency artifacts, Lighting inconsistencies, Pixel noise irregularities.
- [ ] Ziel: Entscheidung der KI nachvollziehbarer machen.
- [ ] Quelle: DARPA Explainable AI Program / IBM Explainable AI.
**Technische Umsetzung in v4:**
- [ ] Technische Signale als strukturierte Liste oder Badges mit Kurzbeschreibung und ggf. Stärke/Gewichtung ausgeben.
- [ ] Zwischen nutzerfreundlicher Erklärung und Expertensicht unterscheiden: kurze Beschreibung standardmäßig, technische Rohdetails optional aufklappbar.
- [ ] Signale vollständig aus der Backend-Antwort rendern; keine feste Whitelist voraussetzen.
**Akzeptanzkriterien:**
- [ ] Unter jedem Ergebnis sind nachvollziehbare technische Signale sichtbar.
- [ ] Neue Signaltypen können ohne Frontend-Umbau erscheinen.
- [ ] Die Standardansicht bleibt auch für Nicht-Techniker verständlich.

#### A1.7 – Dynamische Architektur der Analyse (wichtig für zukünftige Erweiterungen)
**Originalpunkte aus PDF:**
- [ ] Die Analyse-Oberfläche muss dynamisch aufgebaut sein und sich automatisch an Änderungen im Backend anpassen.
- [ ] Das Backend und die Analyse-Engines von AIRealCheck sind noch in Entwicklung und können sich jederzeit ändern.
- [ ] Neue Engines können hinzugefügt werden, bestehende Engines können entfernt oder ersetzt werden.
- [ ] Auch neue Analyse-Signale, neue Ergebnisfelder oder zusätzliche Analyse-Module können später integriert werden.
- [ ] Die UI darf daher keine festen Engine-Namen oder feste Anzahl an Engines erwarten.
- [ ] Stattdessen sollen Engine-Ergebnisse, Signale und Analyse-Daten dynamisch aus der Backend-Response gerendert werden.
- [ ] Ziel: Die Oberfläche bleibt kompatibel, auch wenn sich das Analyse-System weiterentwickelt.
**Technische Umsetzung in v4:**
- [ ] Ein typsicheres Frontend-Normalisierungsmodell einführen, das unbekannte Felder toleriert und bekannte Kernfelder absichert.
- [ ] UI-Komponenten als datengetriebene Blöcke strukturieren: `summary`, `confidence`, `engines`, `signals`, `warnings`, `meta`, `media`.
- [ ] Backend-Antworten versionieren oder mindestens per optionalen Feldern evolvierbar halten; Frontend muss fehlende Felder defensiv behandeln.
**Akzeptanzkriterien:**
- [ ] Die Analyse-Seite bricht nicht, wenn neue Engines oder neue Signaltypen auftauchen.
- [ ] Fehlende optionale Felder erzeugen keine Laufzeitfehler.
- [ ] Das Ergebnislayout kann zusätzliche Backend-Daten aufnehmen, ohne neu gebaut werden zu müssen.

### A2 – Analyse Card Größe & Layout

**Beschreibung:** Die leere Analyse-Card und die begleitende Infocard sind noch nicht optimal proportioniert.  
**Ziel:** Mehr Raum für Upload und Dateiinformationen, symmetrischere Zweispalten-Komposition und Buttons, die wie echte interaktive Controls wirken.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: Analyse-Route unter `frontend/app/(app)/` und zugehörige UI-Komponenten.
- [ ] Gemeinsame Button-/Card-Stile in den Frontend-Komponenten/Tailwind-Utilities.
**Quellenbasis:** [S15] [S16]  

**Technische Details:**
- [ ] Die leere Analyse-Card im Default-State um etwa 20 % verbreitern und insgesamt etwas größer skalieren, ohne Mobile zu verschlechtern.
- [ ] Die danebenliegende Card 'Was du bekommst' exakt auf dieselbe Höhe bringen wie die Analyse-Card; gleiche vertikale Außenkanten und gleiche visuelle Grundlinie.
- [ ] Die Zweier-Komposition auf Desktop mit stabilen Min-/Max-Breiten und gleichmäßigen Gaps aufbauen; auf kleineren Breakpoints sauber untereinander stapeln.
- [ ] Medientyp-Buttons (Bild, Video, Audio) als echte Button-Komponenten mit klarer Border, Hover, Fokus, Active State und Tastatur-Fokus-Outline umsetzen.
- [ ] Nicht nur Text wechseln, sondern auch Icon, Hintergrundtint und Border im aktiven Zustand anpassen, damit die Auswahl sofort lesbar ist.
- [ ] Button-Labels und Kostenhinweise aus zentraler Media-Type-Konfiguration beziehen, damit spätere Änderungen an Credits/Kopien nicht mehrfach gepflegt werden.

**Akzeptanzkriterien:**
- [ ] Die leere Analyse-Card ist sichtbar breiter/größer als vorher.
- [ ] Die Card 'Was du bekommst' hat auf Desktop exakt dieselbe Höhe wie die Analyse-Card.
- [ ] Bild/Video/Audio sehen wie echte Buttons aus und besitzen klare Hover-, Fokus- und Active-States.

### A3 – Dropzone Größe fixiert

**Beschreibung:** Die Dropzone darf während Upload und Analyse nicht springen oder wachsen.  
**Ziel:** Eine stabil dimensionierte Upload-Fläche ohne Layout Shift, auch bei langen Dateinamen und Zustandswechseln.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: Analyse-Upload-Komponenten unter `frontend/app/(app)/` / `frontend/components/`.
**Quellenbasis:** [S15]  

**Technische Details:**
- [ ] Feste Mindest- und Zielhöhe der Dropzone definieren und in allen Zuständen beibehalten: leer, Datei gewählt, Upload läuft, Analyse läuft, Fehler.
- [ ] Dateiname innerhalb der gegebenen Breite begrenzen: bevorzugt einzeilig mit Ellipsis; optional zweizeilig mit kontrolliertem Clamp, aber ohne Höhenexplosion.
- [ ] Statusinformationen (Dateigröße, Typ, Credits, Fehlermeldung) innerhalb reservierter Bereiche rendern, damit die Dropzone nicht nach unten wächst.
- [ ] Lange Dateinamen und exotische Extensions explizit testen.
- [ ] Bei Upload-/Analyse-Status nur den Inhalt in der Dropzone wechseln, nicht die äußeren Dimensionen.

**Akzeptanzkriterien:**
- [ ] Die Dropzone verändert ihre äußere Größe beim Datei-Upload nicht.
- [ ] Lange Dateinamen werden sauber gekürzt oder kontrolliert umgebrochen.
- [ ] Es gibt beim Wechsel zwischen leerem, Upload- und Analysezustand keinen sichtbaren Layout Shift.

## PREMIUM / ABO

### P1 – Pricing-UI/UX Optimierung

**Beschreibung:** Alle Punkte aus `Roadmap_Pricing_Optimierung_v1.pdf` müssen 1:1 und vollständig übernommen werden. Kein Punkt darf entfallen, zusammengefasst oder vereinfacht werden.  
**Ziel:** Eine moderne, vertrauenswürdige und conversion-starke Pricing-Seite mit dynamischer Backend-Steuerung und sauberer Plan-Kommunikation.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: Pricing-Seiten/Upgrade-Flows unter `frontend/app/(app)/` und `frontend/components/`.
- [ ] Backend: Plan-/Pricing-Konfiguration und API-Response für Pläne.
**Quellenbasis:** [S20] [S21]  

**Technische Details:**
- [ ] Die sieben Pflichtpunkte aus der PDF als verbindliche Unterpunkte P1.1 bis P1.7 umsetzen.
- [ ] Pricing-Cards und eventuelle Vergleichstabelle strikt datengetrieben aufbauen.
- [ ] Badge-, Rabatt-, Preis- und CTA-Logik vollständig lokalisierbar und planbasiert halten.

**Akzeptanzkriterien:**
- [ ] Alle Inhalte der Pricing-PDF sind in v4 vollständig enthalten.
- [ ] Pricing kann mit wechselnden Planstrukturen ohne UI-Umbau arbeiten.
- [ ] Die Seite unterstützt spätere Experimente/A-B-Tests strukturell bereits.

**Pflichtübernahme aus `Roadmap_Pricing_Optimierung_v1.pdf` (1:1 und vollständig):**

#### P1.1 – Ziel dieser Roadmap
**Originalpunkte aus PDF:**
- [ ] Diese Roadmap beschreibt UX- und Conversion-Strategien für die Premium-Pricing-Seite von AIRealCheck.
- [ ] Die Struktur dient als Grundlage für die Implementierung durch Entwickler (z.B. Claude / Codex).
- [ ] Die konkreten Preise, Rabatte und Plan-Namen werden später dynamisch angepasst.
- [ ] Ziel ist eine Pricing-Seite, die Vertrauen schafft und gleichzeitig die Conversion-Rate erhöht.
**Technische Umsetzung in v4:**
- [ ] Die Pricing-Ansicht als produktionsreife SaaS-Verkaufsseite planen, nicht als statische Platzhaltersektion.
- [ ] Alle Preis-, Rabatt- und Badge-Werte ausschließlich aus zentraler Konfiguration oder Backend-Response laden.
**Akzeptanzkriterien:**
- [ ] Die Pricing-Seite ist vollständig dynamisch befüllbar.
- [ ] Es existieren keine fest eingebrannten Testpreise oder Hardcodes im UI.

#### P1.2 – Anchoring (Preis-Anker einsetzen)
**Originalpunkte aus PDF:**
- [ ] Der ursprüngliche höhere Preis wird zuerst angezeigt und anschließend durchgestrichen dargestellt.
- [ ] Darunter wird der aktuelle reduzierte Preis angezeigt.
- [ ] Beispiel: 49€ → 29€. Der ursprüngliche Preis dient als Vergleichspunkt.
- [ ] Der Nutzer bewertet den Preis nicht absolut, sondern relativ zum vorher gesehenen Wert.
- [ ] Diese Technik wird als Anchoring Bias bezeichnet.
- [ ] Quelle: Kahneman & Tversky (1974) – Judgment under Uncertainty: Heuristics and Biases.
**Technische Umsetzung in v4:**
- [ ] Pro Plan separate Felder für `originalPrice`, `currentPrice`, `currency`, `billingInterval` und `discountLabel` vorsehen.
- [ ] Der Altpreis darf nur angezeigt werden, wenn ein echter Vergleichswert vorhanden ist; keine künstlichen Scheinrabatte.
- [ ] Typografische Hierarchie klar trennen: Altpreis sekundär, aktueller Preis primär.
**Akzeptanzkriterien:**
- [ ] Plans mit Rabatt zeigen durchgestrichenen Altpreis und dominanten Aktionspreis.
- [ ] Plans ohne Rabatt rendern sauber ohne leere Anker-Fläche.
- [ ] Alle Werte lassen sich ohne Codeänderung backendseitig austauschen.

#### P1.3 – Social Proof (Beliebtester Plan hervorheben)
**Originalpunkte aus PDF:**
- [ ] Eine Pricing-Card wird visuell hervorgehoben und mit einem Badge versehen.
- [ ] Typische Badge-Bezeichnungen: 'Most Popular', 'Best Value', 'Recommended'.
- [ ] Diese Markierung signalisiert Nutzern, welcher Plan am häufigsten gewählt wird.
- [ ] Menschen orientieren sich bei Entscheidungen stark am Verhalten anderer Nutzer.
- [ ] Der Badge reduziert Unsicherheit bei der Kaufentscheidung.
- [ ] Quelle: Robert Cialdini – Influence: The Psychology of Persuasion.
**Technische Umsetzung in v4:**
- [ ] Genau eine Card darf den `featured`-Status besitzen; diese erhält Badge, stärkeren Kontrast, leicht größere visuelle Prominenz und priorisierte CTA.
- [ ] Badge-Text muss lokalisierbar und backendsteuerbar sein.
- [ ] Die Hervorhebung darf Lesbarkeit und mobile Vergleichbarkeit nicht verschlechtern.
**Akzeptanzkriterien:**
- [ ] Ein hervorgehobener Plan ist auf Desktop und Mobile sofort erkennbar.
- [ ] Badge und Highlight funktionieren in beiden Themes.
- [ ] Die Featured-Card bleibt trotz Hervorhebung vollständig barrierefrei lesbar.

#### P1.4 – Loss Aversion (Rabatte als Einsparung kommunizieren)
**Originalpunkte aus PDF:**
- [ ] Rabatte werden nicht nur als niedrigerer Preis dargestellt, sondern als Einsparung.
- [ ] Beispiel: 'Save 40%' statt nur '29€ pro Monat'.
- [ ] Menschen reagieren stärker auf potenzielle Verluste als auf gleich große Gewinne.
- [ ] Die Formulierung zeigt dem Nutzer, wie viel Geld er verlieren würde, wenn er das Angebot nicht nutzt.
- [ ] Quelle: Kahneman & Tversky (1979) – Prospect Theory.
**Technische Umsetzung in v4:**
- [ ] Rabatt-Hinweise als explizites Spar-Label oder Jahresersparnis darstellen (`Spare 40 %`, `Spare 120 € / Jahr`).
- [ ] Nur echte, rechnerisch korrekte Einsparungen ausweisen; keine frei formulierten Marketingwerte.
- [ ] Rabatttexte unterhalb des Preises platzieren, damit Preis und Einsparung gemeinsam gelesen werden.
**Akzeptanzkriterien:**
- [ ] Rabattierte Pläne kommunizieren neben dem Preis auch die konkrete Ersparnis.
- [ ] Die Ersparnis stimmt rechnerisch mit Altpreis und Neu-Preis überein.
- [ ] Nicht rabattierte Pläne zeigen keinen irreführenden Savings-Hinweis.

#### P1.5 – Struktur einer optimalen Pricing Card
**Originalpunkte aus PDF:**
- [ ] Plan-Name (z.B. Basic, Pro, Premium).
- [ ] Preisbereich mit Anchoring (alter Preis durchgestrichen, neuer Preis hervorgehoben).
- [ ] Optionaler Badge für den beliebtesten Plan.
- [ ] Rabatt-Hinweis wie 'Save X%' oder 'Limited offer'.
- [ ] Liste der wichtigsten Features des Plans.
- [ ] Klare Call-to-Action-Schaltfläche (z.B. 'Start Now', 'Upgrade').
**Technische Umsetzung in v4:**
- [ ] Jede Pricing-Card mit konsistentem Slot-Modell aufbauen: Header, Preisblock, Benefit-Block, Feature-Liste, CTA, optional Fußnote.
- [ ] Feature-Liste auf entscheidungsrelevante Unterschiede begrenzen; lange Details in Vergleichstabelle oder FAQ auslagern.
- [ ] CTA-Beschriftung dynamisch aus Abo-Status ableiten.
**Akzeptanzkriterien:**
- [ ] Jede Card enthält Name, Preis, Rabattstatus, Features und CTA in konsistenter Reihenfolge.
- [ ] Der Unterschied zwischen Free, Pro und Business ist auf einen Blick erkennbar.
- [ ] Auf Mobile bleiben CTA und Kernfeatures ohne Scrollen innerhalb der Card auffindbar.

#### P1.6 – Dynamische Anpassbarkeit der Pricing-Seite
**Originalpunkte aus PDF:**
- [ ] Die Pricing-UI darf keine festen Preise oder festen Rabattwerte erwarten.
- [ ] Preise, Rabatte, Badge-Texte und Plan-Strukturen müssen dynamisch vom Backend geladen werden.
- [ ] Neue Pläne können später hinzugefügt werden.
- [ ] Bestehende Pläne können geändert oder entfernt werden.
- [ ] Rabatte können zeitlich begrenzt oder experimentell angepasst werden.
- [ ] Ziel ist eine flexible Architektur, die zukünftige Änderungen ohne UI-Änderungen erlaubt.
**Technische Umsetzung in v4:**
- [ ] Ein planbasiertes Konfigurationsmodell definieren (`planId`, `name`, `rank`, `featured`, `prices`, `features`, `cta`, `limits`, `badge`).
- [ ] Rendering über sortierte Arrays und nicht über hartcodierte Drei-Card-Layouts steuern.
- [ ] Optionales Vergleichsmodul nur für gemeinsam verfügbare Features generieren, fehlende Werte sauber kennzeichnen.
**Akzeptanzkriterien:**
- [ ] Die Pricing-Seite funktioniert mit 2, 3 oder mehr Plänen.
- [ ] Badge-Texte, Rabatte und Feature-Listen lassen sich komplett backendseitig ändern.
- [ ] Das Layout bleibt stabil, auch wenn ein Plan temporär deaktiviert wird.

#### P1.7 – Langfristige Optimierung (A/B-Tests)
**Originalpunkte aus PDF:**
- [ ] Pricing-Elemente sollten regelmäßig getestet werden.
- [ ] Mögliche Tests: unterschiedliche Rabatthöhen, verschiedene Badge-Texte, unterschiedliche Plan-Reihenfolgen.
- [ ] A/B-Testing hilft dabei herauszufinden, welche Variante die höchste Conversion-Rate erzielt.
- [ ] Quelle: Baymard Institute – Pricing Page UX Research.
**Technische Umsetzung in v4:**
- [ ] Zunächst A/B-test-fähige Slots und Telemetriepunkte vorbereiten, auch wenn noch kein Experiment-Framework live ist.
- [ ] Events für Pricing-View, CTA-Click, Checkout-Start und Plan-Auswahl strukturieren.
- [ ] Experiment-Varianten strikt konfigurationsgetrieben halten, damit keine UI-Duplikate entstehen.
**Akzeptanzkriterien:**
- [ ] Pricing-Komponenten können unterschiedliche Badge-Texte, Reihenfolgen und Rabattdarstellungen ohne Code-Fork rendern.
- [ ] Die wichtigsten Conversion-Schritte sind messbar instrumentiert.
- [ ] Spätere Experimente erfordern keine Neustrukturierung der Pricing-Seite.

### P2 – Sidebar Upgrade-Button Beschriftung

**Beschreibung:** Die Upgrade-CTA in der Sidebar soll planabhängig korrekt sein.  
**Ziel:** Kontextbezogene Upgrade-Kommunikation ohne falsche oder redundante Handlungsaufforderungen.  
**Datei-Referenzen (wo bekannt):**  
- [ ] `frontend/components/layout/` für Sidebar/Navigation.
- [ ] `frontend/contexts/AuthContext.tsx` oder Plan-/User-Kontext für aktiven Tarif.
**Quellenbasis:** Projektvorgabe  

**Technische Details:**
- [ ] Beschriftung dynamisch aus aktuellem Nutzerplan ableiten.
- [ ] Regeln verbindlich umsetzen: Free Plan → 'Upgrade auf Pro'; Pro Plan → 'Upgrade auf Business'; Business Plan → Button ausblenden oder 'Aktiver Plan' anzeigen.
- [ ] CTA immer mit aktuellem Pricing-Entry-Point verknüpfen, nicht mit statischen URLs oder falschen Zielplänen.
- [ ] Im Business-Fall keine aggressive Upsell-CTA mehr anzeigen.

**Akzeptanzkriterien:**
- [ ] Free-Nutzer sehen 'Upgrade auf Pro'.
- [ ] Pro-Nutzer sehen 'Upgrade auf Business'.
- [ ] Business-Nutzer sehen keinen unpassenden Upgrade-CTA mehr.

### P3 – Credit-Kosten überall aktualisieren

**Beschreibung:** Die neuen Credit-Kosten müssen in allen Produkt-, UI- und Backend-Stellen konsistent sein.  
**Ziel:** Eine einzige verbindliche Kostenbasis ohne alte Restwerte in UI, Pricing, Tooltips, DB-Flows, API-Responses oder Admin-Oberfläche.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Backend: Analyse-/Credit-Konfiguration, API und Admin-Views.
- [ ] Frontend: Pricing, Analyse, Sidebar/Profil, Tooltips, Hilfetexte.
**Quellenbasis:** Projektvorgabe  

**Technische Details:**
- [ ] Verbindliche neue Kosten definieren und zentralisieren: Bild 15 Credits, Audio 20 Credits, Video 30 Credits.
- [ ] Frontend-Anzeigen überall aktualisieren: Analyse-Buttons, Tooltips, Pricing-Karten, FAQ, 'Was du bekommst', Credits-Hinweise, eventuelle Empty States.
- [ ] Backend-Kostenlogik, API-Responses, Admin-Labels und Credit-Transaktionen auf dieselben Werte umstellen.
- [ ] Wenn historische Analysen bereits einen gespeicherten `credits_charged`-Wert besitzen, diese historischen Datensätze nicht rückwirkend umschreiben; nur neue Berechnungen nach dem neuen Tarif laufen lassen.
- [ ] Kostenkonfiguration nicht mehrfach pflegen; Single Source of Truth im Backend, Frontend konsumiert diese oder teilt sich eine zentrale Konstante.

**Akzeptanzkriterien:**
- [ ] Kein UI-Bereich zeigt alte Credit-Werte an.
- [ ] Neue Analysen rechnen mit 15/20/30 Credits.
- [ ] Admin-Panel und API-Responses sind mit der UI synchron.

## EINSTELLUNGEN

### E1 – Sprachauswahl funktional machen

**Beschreibung:** Die vorhandene Sprachauswahl existiert, ist aber noch nicht funktional.  
**Ziel:** Vollständige, sofort wirksame Lokalisierung der App ohne unnötigen Reload, mit persistenter Sprachpräferenz pro Nutzer.  
**Datei-Referenzen (wo bekannt):**  
- [ ] `frontend/contexts/AuthContext.tsx` für Nutzer-/Session-Kontext.
- [ ] `frontend/app/(app)/`, `frontend/app/(auth)/`, `frontend/components/layout/`, `frontend/lib/` für Übersetzungen und Formatierung.
- [ ] Backend: User-Modell und Settings-/Profile-Endpunkte für persistente Präferenz.
**Quellenbasis:** [S11] [S12] [S13] [S14]  

**Technische Details:**
- [ ] Sprachen für v4 verbindlich festlegen: Deutsch, Englisch, Französisch und Spanisch. Begründung: Diese vier Sprachen decken Kernmarkt + internationale SaaS-Basiserweiterung ab und bleiben komplett LTR, was das Risiko gegenüber einer frühen RTL-Einführung deutlich senkt.
- [ ] Alle UI-Texte in strukturierte Übersetzungsdateien auslagern; keine verstreuten Hardcodes in Komponenten belassen.
- [ ] Lokale Sprachumschaltung über zentralen Locale-Context lösen, damit React-Komponenten ohne Full Reload neu rendern können. React `useContext` ist dafür geeignet, da Consumer auf Context-Änderungen reagieren. [S11]
- [ ] Für Datums-, Zahlen- und ggf. Währungsformatierung native Intl-APIs verwenden (`Intl.DateTimeFormat`, `Intl.NumberFormat`) statt manuelle Stringlogik. [S12][S13]
- [ ] Bei eingeloggten Nutzern die Sprachpräferenz in der DB speichern; bei Gästen Fallback über Session/Cookie. Beim Login wird DB-Präferenz priorisiert und im Frontend initial gesetzt.
- [ ] Mit dem App-Router kompatibel aufbauen: keine erzwungene Routing-Umbaupflicht in v4, aber Struktur so wählen, dass spätere locale-segmentierte Routen möglich bleiben. Next.js dokumentiert Internationalization im App-Umfeld weiterhin explizit. [S14]
- [ ] Komponenten mit schwer zugänglichen Texten nicht vergessen: Form-Validierungen, Toasts, Loader-Schritte, Pricing-Badges, Admin-Filter, Empty States, E-Mail-Templates.
- [ ] Keine neue Bibliothek zwingend voraussetzen. Falls später ein dediziertes i18n-Paket eingeführt wird, nur mit klarer Begründung: Message-Plurals, ICU-Formatierung, Namespacing, lazy-loading großer Sprachpakete.

**Akzeptanzkriterien:**
- [ ] Sprachwechsel in den Einstellungen aktualisiert sichtbare UI-Texte ohne kompletten Page Reload, soweit technisch möglich.
- [ ] Nach neuem Login erscheint die zuvor gespeicherte Sprache automatisch wieder.
- [ ] Alle Kernseiten (Dashboard, Analyse, Ergebnisse, Verlauf, Pricing, Profil, Einstellungen, Admin) sind in DE/EN/FR/ES vollständig übersetzt.

## ADMIN-PANEL

### AP1 – Rollen-Management

**Beschreibung:** Admins sollen Rollen anderer Nutzer ändern können, ohne sich selbst auszusperren.  
**Ziel:** Ein minimales, sauberes Rollenmodell mit sofort wirksamer Berechtigungskontrolle und sicherer Selbstschutz-Logik.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Backend: User-Modell, Admin-Endpunkte, Rollenprüfung/Middleware, Migration für SQLite.
- [ ] Frontend: Admin-User-Verwaltung unter `frontend/app/(app)/...` bzw. zugehörige Admin-Komponenten.
**Quellenbasis:** Projektvorgabe  

**Technische Details:**
- [ ] Für v4 Rollenmodell festlegen: `user`, `moderator`, `admin`. Begründung: Es bleibt klein, deckt aber vorhandene Moderation/Admin-Flächen sinnvoll ab, ohne unnötige Enterprise-RBAC-Komplexität einzuführen.
- [ ] Berechtigungen klar trennen: `user` = normale Nutzung; `moderator` = Moderation/Review + begrenzte Einsicht; `admin` = volle Admin-Rechte inkl. Rollen, Credits, Engines, Logs.
- [ ] Migration beschreiben: Falls bisher nur ein Bool-Feld wie `is_admin` existiert, neues `role`-Feld per SQLite-Migration hinzufügen, bestehende Admins auf `admin` backfillen, Standard für alle anderen `user`; alte Logik während der Übergangsphase kompatibel halten.
- [ ] Rollenwechsel serverseitig autorisieren und audit-loggen; UI alleine genügt nicht.
- [ ] Rollenänderung nach erfolgreicher Mutation sofort im Admin-Panel und bei der betroffenen Nutzer-Session wirksam machen.
- [ ] Selbstschutz: Ein Admin darf die eigene Rolle nicht auf einen niedrigeren Rang setzen. Zusätzlich darf nie der letzte verbleibende Admin entfernt oder herabgestuft werden.
- [ ] Admin-UI: Rollen-Dropdown/Action im User-Detail oder in der User-Tabelle, mit klaren Statusmeldungen und Schutzdialogen.

**Akzeptanzkriterien:**
- [ ] Admins können andere Nutzerrollen ändern.
- [ ] Nicht-Admins können keine Rollenänderungen ausführen.
- [ ] Ein Admin kann die eigene Rolle nicht entfernen und der letzte Admin im System bleibt geschützt.
- [ ] Rollenwechsel wird sofort wirksam und im Audit-Log nachvollziehbar gespeichert.

## ALLGEMEIN

### G1 – Umlaute überall korrekt

**Beschreibung:** Aktuell dürfen in der gesamten App keine Ausweichschreibungen wie ae/oe/ue mehr als Ersatz für ä/ö/ü/ß stehen, sofern es echte deutsche UI-Texte sind.  
**Ziel:** Alle deutschen Oberflächen, E-Mails und Admin-Inhalte verwenden echte deutsche Zeichen in konsistenter UTF-8-Darstellung.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: alle UI-Texte unter `frontend/app/`, `frontend/components/`, `frontend/lib/`.
- [ ] Backend: E-Mail-Templates und serverseitige Stringquellen im Flask-Backend.
**Quellenbasis:** Projektvorgabe  

**Technische Details:**
- [ ] Alle Frontend- und Backend-Quelltexte als UTF-8 konsolidieren; keine gemischten Encodings oder fehlerhaften Copy/Paste-Zeichen tolerieren.
- [ ] Zentrale Textquellen einführen bzw. bereinigen: UI-Strings, E-Mail-Vorlagen, Toasts, Tooltips, leere Zustände, Admin-Texte.
- [ ] Besonders prüfen: serverseitig erzeugte E-Mails und Response-Strings; Mail-Templates müssen mit UTF-8/MIME sauber versendet werden.
- [ ] Snapshot-/String-QA ergänzen: gezielter Suchlauf nach problematischen Platzhalterformen in deutschen Strings, ohne legitime Wörter falsch zu markieren.
- [ ] Lokalisierungsarchitektur so aufbauen, dass die deutsche Standardübersetzung die maßgebliche Quelle ist und nicht nachträglich in UI-Komponenten überschrieben wird.

**Akzeptanzkriterien:**
- [ ] In der gesamten App erscheinen ä, ö, ü, Ä, Ö, Ü und ß korrekt.
- [ ] Es gibt keine UI-Stellen mehr mit künstlicher Umschreibung wie 'ueber', 'fuer', 'Loeschung'.
- [ ] E-Mail-Texte und Admin-Oberfläche rendern dieselben Zeichen korrekt.

### G2 – Einheitliche E-Mail-Adresse

**Beschreibung:** In der App darf es künftig nur noch genau eine offizielle Kontaktadresse geben.  
**Ziel:** Überall konsistente Verwendung von `info@airealcheck.app` als Single Source of Truth.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: Footer, Kontakt-/Pricing-/Hilfeblöcke unter `frontend/app/` und `frontend/components/layout/`.
- [ ] Backend: Mailer-/Template-Konfiguration und versendete E-Mails.
**Quellenbasis:** Projektvorgabe  

**Technische Details:**
- [ ] Eine zentrale Konstante bzw. Konfiguration für die Support-/Kontakt-E-Mail einführen und alle UI-/Template-Verwendungen daran anbinden.
- [ ] Alle Platzhalter-Adressen (`pricing@`, `support@`, etc.) im Frontend, Backend, Footer, Hilfetexten und E-Mail-Vorlagen ersetzen.
- [ ] CTA-Links (`mailto:`), Footer-Kontaktblöcke, Pricing-FAQ, Transaktionsmails und rechtliche Seiten mit derselben Adresse synchronisieren.

**Akzeptanzkriterien:**
- [ ] In der gesamten App erscheint ausschließlich `info@airealcheck.app`.
- [ ] Footer, Kontaktlinks, E-Mail-Vorlagen und Hilfetexte nutzen dieselbe Adresse.
- [ ] Es existieren keine vergessenen Altadressen mehr in Templates oder Response-Texten.

## CREDITS-SYSTEM

### C1 – Credits-System vollständig korrekt

**Beschreibung:** Credits dürfen nur bei erfolgreicher Analyse abgezogen werden und der Stand muss überall konsistent erscheinen.  
**Ziel:** Transaktionssicheres, nachvollziehbares Credits-Verhalten mit zentralen Kostenregeln und sofortigem UI-Refresh.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Backend: Credit-Logik, Analyse-Orchestrierung, API-Responses, Admin-Transaktionen.
- [ ] Frontend: Credit-Badges/Anzeigen in Sidebar, Profil und Analyse-Kontext.
**Quellenbasis:** Projektvorgabe  

**Technische Details:**
- [ ] Die verbindlichen Kosten als zentrale Backend-Konfiguration definieren: Bild 15 Credits, Audio 20 Credits, Video 30 Credits.
- [ ] Abbuchung strikt erst nach erfolgreicher Analyse und final speicherbarem Resultat durchführen; nicht beim Upload-Start.
- [ ] Analyse-Fehler, Engine-Failures ohne Ergebnis und technische Timeouts dürfen keinen Credit-Abzug erzeugen.
- [ ] Credits-Transaktion atomar mit Analyseerfolg koppeln; bei Backend-Fehlern Rollback erzwingen.
- [ ] Frontend-Credit-Anzeigen an einen gemeinsamen Refresh-Mechanismus binden: Sidebar, Profil, Analyse-Seite und Pricing/Upgrade-Kontext.
- [ ] API-Responses sollen den aktuellen Credit-Stand nach erfolgreicher Analyse mitliefern, damit kein separater Full Reload nötig ist.
- [ ] History/Admin-Ansicht soll den tatsächlich abgezogenen Wert pro Analyse anzeigen, damit spätere Preisänderungen historische Einträge nicht verfälschen.

**Akzeptanzkriterien:**
- [ ] Bei Analysefehlern bleibt der Credit-Stand unverändert.
- [ ] Nach erfolgreicher Analyse reduziert sich das Guthaben exakt um 15/20/30 Credits je Medientyp.
- [ ] Sidebar, Profil und Analyse-Seite zeigen den neuen Credit-Stand sofort konsistent an.

## LIGHT MODE

### L1 – Light Mode Optimierung

**Beschreibung:** Der Light Mode wirkt aktuell stellenweise zu blass, inkonsistent oder übernimmt Dark-Mode-Reste.  
**Ziel:** Ein eigenständiger, hochwertiger Light Mode mit klaren Kontrasten, sauberer Hierarchie und WCAG-AA-konformer Lesbarkeit.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Frontend: Theme-Tokens/Styles, Layout-Komponenten und alle App-Views.
- [ ] `frontend/components/layout/` und globale Styling-Schicht/Tailwind-Theme.
**Quellenbasis:** [S17] [S18] [S19]  

**Technische Details:**
- [ ] Sidebar-Texte und Überschriften im Light Mode dunkler setzen; keine hellgrauen Texte auf fast weißen Hintergründen für Standardtext.
- [ ] Off-White bzw. sehr helles Grau als Flächenbasis nutzen, damit Cards und Sektionen sich sauber abheben.
- [ ] Cards, Borders, Hover-Flächen und Disabled-States als eigene Light-Mode-Tokens definieren statt Dark-Mode-Farben nur umzufärben.
- [ ] WCAG 2.2 AA einhalten: mindestens 4.5:1 für normalen Text, 3:1 für großen Text sowie 3:1 für relevante UI-Komponenten/States. [S17][S18][S19]
- [ ] Fokus-Ringe, aktive Tabs, Input-Borders und Buttons im Light Mode auf Non-Text-Contrast prüfen. [S19]
- [ ] Farbsystem pro Theme tokenisieren, damit kein Element versehentlich im Dark-Mode-Zustand bleibt.
- [ ] Visuelle QA für alle Kernansichten durchführen: Dashboard, Analyse, Ergebnisse, History, Pricing, Profil, Einstellungen, Admin.

**Akzeptanzkriterien:**
- [ ] Im Light Mode sind Sidebar, Texte, Cards und Eingabeelemente klar lesbar und harmonisch abgestuft.
- [ ] Es bleiben keine dunklen Restflächen oder Dark-Mode-Komponenten im Light Theme übrig.
- [ ] Normaler Text erreicht mindestens 4.5:1 Kontrast, große Texte mindestens 3:1 und relevante UI-Komponenten mindestens 3:1.

## BUGS

### B1 – Session-Timeout Fix

**Beschreibung:** Aktuell werden Nutzer nach etwa 10 Minuten automatisch ausgeloggt. Das ist für eine SaaS-App mit längeren Analyse- und Admin-Sessions UX- und Vertrauens-schädlich.  
**Ziel:** Mindestens 24 Stunden stabile Session-Lebensdauer, optionales Eingeloggt-bleiben-Verhalten, Activity-Refresh ohne unerwartete Logouts und ohne Breaking Change im bestehenden Auth-Flow.  
**Datei-Referenzen (wo bekannt):**  
- [ ] Backend: Session-/Auth-Konfiguration im Flask-App-Setup und Login-/OAuth-Flow (konkrete Datei im Backend-Projekt prüfen).
- [ ] Frontend: globale Auth-Behandlung in `frontend/contexts/AuthContext.tsx` sowie Request-/401-Handling in `frontend/lib/`.
**Quellenbasis:** [S1] [S2] [S3] [S4] [S5] [S6] [S7] [S8] [S9] [S10]  

**Technische Details:**
- [ ] Beim Login den permanenten Session-Modus sauber setzen (`session.permanent = True`) und die effektive Lebensdauer zentral konfigurieren. Flask verwendet bei permanenten Sessions `PERMANENT_SESSION_LIFETIME`; Standard ist 31 Tage, die App soll mindestens 24 Stunden zuverlässig abdecken. [S1][S2]
- [ ] `SESSION_REFRESH_EACH_REQUEST` aktiv lassen bzw. bewusst konfigurieren, damit permanente Sessions bei Aktivität verlängert werden. [S3]
- [ ] Für echte 'Eingeloggt bleiben'-Semantik das bestehende Session-Login mit Flask-Login-Remember-Cookie koppeln (`remember=True`), statt nur die Browser-Session zu verlängern. Flask-Login stellt das dafür explizit bereit. [S4][S5]
- [ ] Session-Cookies gehärtet ausliefern: `HttpOnly`, `Secure` in Produktion, sinnvoller `SameSite`-Wert. OWASP und Flask empfehlen diese Attribute ausdrücklich. [S6][S7][S8]
- [ ] Wegen Google OAuth keinen unreflektierten `SameSite=Strict`-Schritt erzwingen: `Lax` ist meist der kompatible Basiswert für Top-Level-Navigationen; `Strict` ist restriktiver und kann Cross-Site-Navigationspfade einschränken. [S8][S9][S10]
- [ ] Heartbeat- bzw. Activity-Refresh nur dann senden, wenn der Nutzer aktiv ist (Analyse-Seite, Admin-Panel, History, Settings), damit Sessions nicht künstlich ewig offen bleiben.
- [ ] Klare Session-Fehlerbehandlung ergänzen: Wenn eine Session wirklich abläuft, sauberer Redirect zur Login-Seite mit Toast/Hinweis statt stiller 401/leerem UI-Zustand.

**Akzeptanzkriterien:**
- [ ] Ein eingeloggter Nutzer bleibt bei aktiver Nutzung mindestens 24 Stunden ohne Überraschungs-Logout in der App.
- [ ] Analyse, History, Profil, Einstellungen und Admin-Panel verlieren bei normaler Nutzung nicht nach ~10 Minuten die Session.
- [ ] Google-OAuth-Login funktioniert weiter unverändert.
- [ ] Session-Cookies tragen in Produktion die Flags `HttpOnly`, `Secure` und einen bewusst gewählten `SameSite`-Wert.

## Phasen-Übersicht

### Phase 1 – Session-Stabilität und Auth-Härtung

- [ ] **Kontext:** Fixe den Session-Timeout-Bug zuerst, ohne den bestehenden Auth-Flow oder Google OAuth zu brechen.
- [ ] **Abhängigkeiten:** Keine
- [ ] **Umfang:** B1

### Phase 2 – Globale Text- und Kontakt-Konsistenz

- [ ] **Kontext:** Bereinige allgemeine Inkonsistenzen, bevor Features und neue UI-Layer darauf aufbauen.
- [ ] **Abhängigkeiten:** Phase 1
- [ ] **Umfang:** G1, G2

### Phase 3 – Credits-System und Kosten-Single-Source

- [ ] **Kontext:** Zentralisiere Credit-Kosten und sorge für atomare Abbuchung nur nach erfolgreicher Analyse.
- [ ] **Abhängigkeiten:** Phase 1-2
- [ ] **Umfang:** C1, P3

### Phase 4 – Lokalisierung und Spracheinstellungen

- [ ] **Kontext:** Mache die Sprachauswahl funktional und überführe Hardcodes in eine echte Übersetzungsstruktur.
- [ ] **Abhängigkeiten:** Phase 2
- [ ] **Umfang:** E1, G1

### Phase 5 – Admin-Rollen und sichere Berechtigungen

- [ ] **Kontext:** Baue ein minimales Rollenmodell mit Migration und Schutz gegen Selbst-Aussperrung.
- [ ] **Abhängigkeiten:** Phase 1
- [ ] **Umfang:** AP1

### Phase 6 – Analyse-Datenmodell und Ladezustände

- [ ] **Kontext:** Baue die Analysefläche dynamisch und robust, inklusive kompletter Pflichtübernahme aus der Analyse-PDF.
- [ ] **Abhängigkeiten:** Phase 3-4
- [ ] **Umfang:** A1, A2, A3

### Phase 7 – Pricing/Premium-Optimierung

- [ ] **Kontext:** Baue die Pricing-Seite und Upgrade-CTA conversion-stärker und komplett dynamisch, inklusive kompletter Pflichtübernahme aus der Pricing-PDF.
- [ ] **Abhängigkeiten:** Phase 3-4
- [ ] **Umfang:** P1, P2, P3

### Phase 8 – Light-Mode-Polish und Abschluss-QA

- [ ] **Kontext:** Führe zum Schluss Theme-, Responsive- und Regression-QA durch und optimiere den Light Mode als letzten visuellen Schritt.
- [ ] **Abhängigkeiten:** Phase 1-7
- [ ] **Umfang:** L1, A2, P1, P2

