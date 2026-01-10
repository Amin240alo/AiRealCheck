# AiRealCheck
AIRealCheck ist eine Web-App, die erkennt, ob ein Bild, Video oder eine Audioaufnahme (aktuell vor Bilder)  **echt oder von einer KI generiert** ist. Die App analysiert hochgeladene Medien und liefert eine Einschätzung wie z. B. „92 % real / 8 % AI“.
Ziel ist ein **zuverlässiges, schnelles und einfach nutzbares Tool**, das Nutzer im Alltag, auf Social Media oder beruflich nutzen können, um Deepfakes zu erkennen.

## Was ist es und wofür?
AiRealCheck hilft dabei, KI-generierte Inhalte schneller einzuschätzen, indem Uploads an ein lokales Analyse-Backend geschickt und die Ergebnisse im Browser angezeigt werden.

## Problem & Ziel
Viele Deepfakes/KI-Bilder sind schwer zu erkennen. Ziel ist eine einfache Oberfläche, die eine schnelle Einschätzung liefert und dabei ein Login- und Credit-System für geregelte Nutzung bietet.

## Funktionen (kurz)
- Datei-Upload (Analyse direkt aus dem Browser).
- Gast-Modus mit Guest-Credits (ohne Account testbar).
- Registrierung & Login (Session über Token).
- Credit-System für Analysen (Anzeige im UI).
- Profilansicht (Account-/Credit-Infos).
- Admin-Panel (Userverwaltung, Credits/Plan/PW-Aktionen – nur für Admins sichtbar).

## Tech-Stack
- Frontend: HTML, CSS, JavaScript (ES Modules)
- Backend: Python + Flask (REST API)
- Auth: JWT (Token-basiert)
- Daten: lokale DB (z. B. SQLite)


## Status
MVP / In Entwicklung
