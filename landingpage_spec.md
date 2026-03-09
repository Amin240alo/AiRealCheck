# AIRealCheck Landingpage Specification

This document is the source of truth for the AIRealCheck public landing page.

It defines:
- page structure
- section order
- copy
- design system
- motion rules
- mobile behavior

Claude Code must follow this document when building the landing page.
Do not change the section order or core messaging.





AIRE■■CHECK
Landing Page Roadmap
Optimierte Version — Next.js · Framer Motion · Tailwind CSS 4
Next.js 16 TypeScript 5 Framer Motion 12 Tailwind CSS 4
Version 2.0 · 2026 · Vertraulich
Dieses Dokument definiert Struktur, Inhalt, visuelle Sprache und Interaktionslogik der AIRealCheck Landing Page — optimiert
für den bestehenden Stack. Es legt fest was gebaut wird, nicht wie.
Was optimiert wurde Details
✓ Pricing konkretisiert
Arbeitshypothesen mit echten Zahlen hinterlegt — kein 'Flexible' mehr auf der
LP
✓ Demo-Section geklärt Explizit als animierter Fake-Demo definiert bis Backend steht
✓ USP geschärft Konkrete Engine-Anzahl als Differentiator benannt
✓ Mobile-First verankert Tailwind-Breakpoints & Stack-Verhalten explizit für jeden Abschnitt definiert
✓ Stack-Integration Framer Motion Varianten, Tailwind-Klassen & Component-Hinweise ergänzt
1 Conversion-Reihenfolge & Strategie Fundament
Jede Sektion folgt einem klaren psychologischen Ziel. Reihenfolge ist nicht verhandelbar.
# Sektion Ziel Mobile
1 Hero Sofortige Klarheit über das Produkt Full-height, Stack-Layout
2 Live Demo Produkt beweisen bevor Sign-up Vereinfachte Demo-Card
3 Trust Strip Schnelle Legitimität (4 Punkte) 2x2 Grid
4 Features Tiefe zeigen, kein Blackbox-Tool Single Column Cards
5 How it Works Komplexität reduzieren (3 Steps) Vertical Timeline
6 Comparison Differenzierung zu einfachen Tools Stacked Columns
7 Pricing Friction entfernen, Einstieg klar machen Single Column
8 Audience Fit Relevanz ohne fake Social Proof 2x2 Grid
9 FAQ Letzte Einwände beseitigen Accordion
10 Final CTA Conversion-Catch nach Überzeugung Centered, large CTA
11 Footer Ordnung, Legal, Navigation Stacked Columns
2 Design System Visual Identity
2.1 — Visuelle Richtung
Premium SaaS + subtile futuristische Energie. Dark, spacious, trustworthy. Kein visuelles Clutter, keine Rainbow-Gradienten.
→ Dark Theme Baseline — tiefes Charcoal & Near-Black Surfaces
→ Electric Cyan als primärer Präzisions-Akzent (Buttons, Score-Ringe, Highlights)
→ Soft Violet als sekundärer Premium-Akzent (Cards, Labels, Badges)
→ Starke Whitespace + saubere Typografie
→ Selektives Glassmorphism — nur für Panels & Overlays, nicht überall
→ Glow-Effekte nur um Hero-Mockup, CTA-Zones, Score-Ringe
→ Layering + Shadow-Depth für Premium-Tiefe
2.2 — Farbpalette
Token Hex Verwendung Vorschau
Background 900 #06070A Primärer Hintergrund
Background 850 #0B0D12 Layered Dark Surface
Background 800 #10131A Panel Background
Text 100 #F5F7FB Primärtext
Text 200 #D9E0EA Sekundärtext
Text 300 #9AA6B2 Muted Text
Accent Cyan #35D6FF Primärer Produkt-Akzent
Accent Cyan Strong #10BEE8 CTA / Active Highlight
Accent Violet #8B5CF6 Premium Sekundär-Akzent
Accent Violet Soft #A78BFA Sanfter Supporting Highlight
Success #22C55E Positive States
Warning #F59E0B Warning States
Danger #EF4444 Critical States
2.3 — Typografie
→ Headlines: tight, bold, premium, high contrast — kurz & stark
→ Body Copy: neutral, lesbar, ruhig — großzügiges Line-Spacing
→ Monospace: NUR in analytischen UI-Fragmenten (Scores, Signal-Namen, Detector-Data)
→ Sublines: erklären klar — kein Marketing-Theater
→ Kein Inter / Roboto / Arial — charakterstarke Font-Paarungen wählen
3 Sektionen — Detailspezifikation Vollständig
3.1 — Hero Section
Zweck: Besucher muss in unter 3 Sekunden verstehen: AIRealCheck erkennt KI-generierte Inhalte.
Layout: Split-Hero: Links Messaging, Rechts Premium Product Mockup. Fast-Fullscreen. Nav clean & light.
INHALT
→ Headline: "Know if an image is real or AI-generated — in seconds."
→ Subline: "AIRealCheck uses ensemble analysis across 6+ detection engines to verify visual content."
→ Primary CTA: "Start Free Analysis"
→ Secondary CTA: "Watch Live Demo"
→ Trust Line: "100 free credits. No credit card required."
→ Feature Chips: "6 Engines", "Ensemble Detection", "Confidence Score", "Fast Results"
STACK-INTEGRATION (Next.js / Framer Motion / Tailwind)
■ Framer Motion: staggerChildren für Feature Chips (0.1s delay)
■ Framer Motion: whileHover={{ scale: 1.02 }} auf CTA-Buttons
■ Framer Motion: subtle parallax auf Mockup (useScroll + useTransform)
■ Tailwind: md:grid-cols-2 für Split-Layout
■ Glow: box-shadow mit cyan rgba für Mockup-Container
✓ OPTIMIERUNG: Feature Chip '6 Engines' statt vager 'Ensemble Detection' — konkreter USP
3.2 — Demo / Live Preview Section
Zweck: Produkt beweisen bevor Sign-up gefordert wird. Animierter Fake-Demo bis Backend steht.
Layout: Große Showcase-Card dominiert. Erklärung seitlich oder darüber.
INHALT
→ Label: "See it in action"
→ Headline: "A live preview of how AIRealCheck analyzes visual content."
→ UI: Upload-Area → Progress-Animation → Score-Ring → Model-Cards → Signal-Panel
→ Sample: "AI Probability: 78%", "Confidence: High", "6/6 Engines responded"
→ CTA: "Try it with 100 free credits"
STACK-INTEGRATION (Next.js / Framer Motion / Tailwind)
■ Animierter Fake-Demo (kein echter API-Call) — useEffect + setTimeout Sequenz
■ 3 Stages: idle → loading (shimmer) → result (staggered reveal)
■ Score-Ring: SVG stroke-dashoffset Animation via Framer Motion
■ Framer Motion: AnimatePresence für Stage-Transitions
■ HINWEIS: Nach Backend-Launch durch echten Upload ersetzen
✓ OPTIMIERUNG: Explizit als animierter Fake-Demo definiert — verhindert Architektur-Konflikte beim Build
3.3 — Trust / Stats Strip
Zweck: Schnelle Credibility nach Demo. 4 Punkte, skimmable.
Layout: Kompakter horizontaler Strip. Auf Mobile: 2x2 Grid.
INHALT
→ "100 Free Credits" — Testen ohne Upgrade
→ "6+ Detection Engines" — Mehr als ein Score
→ "Built for Verification" — Journalisten, Teams, Creator
→ "Results in < 5s" — Schnell & verlässlich
STACK-INTEGRATION (Next.js / Framer Motion / Tailwind)
■ Framer Motion: CountUp-Animation für Zahlen beim Scroll-Eintritt
■ Tailwind: grid-cols-4 → grid-cols-2 auf Mobile
■ Subtle top-glow via border-t + cyan rgba
✓ OPTIMIERUNG: "6+ Detection Engines" statt "Multi-Engine" — konkret & überzeugender
3.4 — Features Section
Zweck: Tiefe zeigen — kein einfaches Ja/Nein-Tool.
Layout: Spacious Feature-Card Grid. Eine Karte breiter für Rhythmus.
INHALT
→ "Ensemble Detection" — 6+ Engines, reduzierte Abhängigkeit von einem Modell
→ "Technical Signal Analysis" — Artifacts, Compression, Edge-Verhalten, Texturen
→ "Confidence Scoring" — Klare Range statt vagem Score
→ "Model-Level Breakdown" — Wie jeder Detektor reagiert hat
→ "Fast Credit-Based Workflow" — Nutzung tracken, schnell analysieren
→ "Built for Real Verification Work" — Editorial, Agency, Interne Checks
STACK-INTEGRATION (Next.js / Framer Motion / Tailwind)
■ Framer Motion: whileHover={{ y: -4 }} auf Cards
■ Glow: box-shadow mit cyan/violet rgba on hover
■ Lucide React Icons für jede Feature-Card
■ Tailwind: grid-cols-3 → grid-cols-1 auf Mobile
✓ OPTIMIERUNG: Engine-Anzahl (6+) in 'Ensemble Detection' Card verankert
3.5 — How It Works Section
Zweck: 3 Schritte — sophistiziert unter der Haube, simpel in der Nutzung.
Layout: Drei verbundene Cards. Desktop horizontal, Mobile vertikal gestapelt.
INHALT
→ Step 1: "Upload your image" — Datei in Sekunden hinzufügen
→ Step 2: "Run the analysis" — Ensemble-Detection + Technical Signal Checks
→ Step 3: "Review the result" — Score, Confidence, Detector-Breakdown, Signal-Summary
STACK-INTEGRATION (Next.js / Framer Motion / Tailwind)
■ Framer Motion: Connection-Line zeichnet sich beim Scroll (SVG pathLength Animation)
■ Schritte erscheinen nacheinander via staggerChildren
■ Tailwind: flex-row → flex-col auf Mobile
■ Numbered Nodes: styled divs mit cyan bg
3.6 — Comparison Section
Zweck: Differenzierung zu shallow Detektoren mit nur einem Score.
Layout: Zwei Spalten. AIRealCheck-Seite visuell stärker.
INHALT
→ Basic Detector: Einzelner Score, keine Transparenz, kein Model-Breakdown
→ AIRealCheck: Ensemble (6+ Engines), Model-Level Output, Technical Signals, Confidence-Framing
→ CTA: "Try the difference"
STACK-INTEGRATION (Next.js / Framer Motion / Tailwind)
■ Rows enthüllen sich progressiv via Framer Motion stagger
■ AIRealCheck-Spalte: subtle cyan border + stärkeres Highlight
■ Checkmarks via Lucide React (Check / X icons)
■ Tailwind: grid-cols-2 → grid-cols-1 auf Mobile (AIRealCheck zuerst)
✓ OPTIMIERUNG: Auf Mobile: AIRealCheck-Spalte erscheint ZUERST — höherer Impact
4 Pricing Section — Optimiert Kritisch
Friction entfernen und Einstiegsweg klar machen. Konkrete Zahlen statt 'Flexible' — auch wenn Preise noch Hypothesen
sind.
■ HINWEIS: Alle Preise sind Arbeitshypothesen. Vor Launch gegen API-Kosten & Marktanalyse validieren.
Plan Preis Credits / Monat Highlights CTA
Free €0 100 Core-Analyse, kein Upload-Limit, keine Kreditkarte Start Free
Basic ab 9 €/Mo 500 Erhöhte Credits, Standard-Support Get Basic
Pro ab 29 €/Mo 2.500 API-Zugang, schnellere Analyse, Priority Support Get Pro
Business ab 99 €/Mo Unbegrenzt Bulk-Upload, erweiterte Details, Team-Accounts Contact Us
Stack: Framer Motion whileHover lift auf Cards · Pro-Card mit Violet border hervorgehoben · Tailwind: grid-cols-4 → grid-cols-1 auf Mobile
(Free zuerst).
5 Weitere Sektionen Audience / FAQ / CTA / Footer
5.1 — Audience Fit Section
Vier Karten: Journalisten, Agenturen, Unternehmen, Creator. Kein erfundener Social Proof. Klare Aussage wer das Produkt
nutzt und warum.
Stack: 2x2 Grid → Single Column Mobile · Simple hover elevation via Framer Motion · Lucide Icons
5.2 — FAQ Section
Accordion-Layout. 6 Kernfragen zu: Genauigkeit, Account, Score-Bedeutung, Model-Output, Zielgruppe, Credits.
Stack: AnimatePresence + height animation für Accordion · Plus/Minus via Lucide · Glass-Panel Styling
5.3 — Final CTA Section
Zentriertes Premium CTA-Panel. Headline → Subline → Primary CTA → Secondary CTA. Besucher fühlt sich bereit, nicht
unter Druck.
Stack: Gradient Aura via radial-gradient · Shimmer-Effekt auf Card-Border · whileHover glow auf Buttons
5.4 — Footer
Dark Footer: Brand-Line · Product-Links · Company-Links · Legal-Links · Copyright. Kein visueller Overkill — orderly &
premium.
Stack: 4-Column Grid → 2-Column Mobile · Subtle hover brighten via Tailwind hover:text-white
6 Motion & Interaction Prinzipien Framer Motion 12
Pattern Wo Framer Motion Implementation
Scroll Reveal Alle Sektionen whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
Stagger Children Feature Cards, Steps, FAQ staggerChildren: 0.08 in parent variants
Hover Lift Alle Cards & Buttons whileHover={{ y: -4, scale: 1.01 }}
Glow Pulse Hero Mockup, CTA Zone CSS keyframe animation, subtle rgba glow
Path Draw How-it-Works Connector pathLength: 0→1 on scroll via useScroll
Count Up Trust Strip Zahlen useEffect + requestAnimationFrame beim Eintritt
Stage Transition Demo Preview AnimatePresence: idle→loading→result
Parallax Hero Mockup useScroll + useTransform, subtle y movement
Regel: Motion ist kontrolliert, premium, präzise — niemals hektisch. viewport={{ once: true }} auf allen scroll-triggered Animationen für
Performance.
7 Copy & CTA System Textstrategie
Typ Text Wo
Primary CTA "Start Free Analysis" Hero, Final CTA
Primary CTA "Get Started Free" Final CTA Section
Primary CTA "Start Free" Pricing Free Plan
Secondary CTA "Watch Live Demo" Hero
Secondary CTA "Explore the Demo" Final CTA Section
Secondary CTA "View Premium Options" Pricing
Trust Line "100 free credits. No credit card required." Hero
Pricing Badge "Most Popular" Pro Card
Prinzip: Headlines kurz & stark. Sublines erklären — kein Marketing-Theater. Copy klingt: trustworthy · premium · klar.
8 Mobile-First Strategie NEU — Optimierung
Mobile-First ist nicht optional. Tailwind CSS 4 mit sm:/md:/lg: Breakpoints von Anfang an in jeden Component einbauen.
✓ OPTIMIERUNG: Dieser Abschnitt war in v1 nicht vorhanden.
Sektion Desktop Mobile (< 768px)
Hero Split: 2 Columns Stack: Full-width, Mockup unter Text
Trust Strip 4 Columns horizontal 2x2 Grid
Features 3 Columns Grid Single Column
How it Works Horizontal Timeline Vertical Timeline, lines nach unten
Comparison 2 Columns AIRealCheck zuerst, Basic darunter
Pricing 2 Cards nebeneinander Single Column, Free zuerst
Audience Fit 4 Cards Grid 2x2 Grid
FAQ Max-width 720px centered Full-width, größere Touch-Targets
Footer 4 Columns 2 Columns → 1 Column
9 Implementation Intent Abschluss
Aspekt Definition
Haupt-Outcome Modernes, premium Dark-Mode SaaS Landing Page
Primary Message KI-generierte Bilder erkennen — mit tieferer Analyse als Konkurrenz
Conversion Path Freier Einstieg durch 100 Credits — kein Risiko
Visual Emphasis Produktbeweis · Premium Tiefe · Fokussierte Motion · Trust
Stack Next.js 16 App Router · TypeScript 5 · Tailwind CSS 4 · Framer Motion 12
Demo-Status Animierter Fake-Demo bis Backend bereit — dann echten Upload integrieren
Pricing-Status Arbeitshypothesen — vor Launch validieren gegen API-Kosten
AIRealCheck · Landing Page Roadmap v2.0 · 2026 · Optimiert & Stack-integriert · Vertraulich — Nur für interne Verwendung