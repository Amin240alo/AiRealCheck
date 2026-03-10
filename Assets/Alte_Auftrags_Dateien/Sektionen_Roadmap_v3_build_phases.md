# Sektionen Roadmap v3 - Build Phases for Claude Code

**Stand:** 09.03.2026  
**Purpose:** Copy-ready implementation prompts for Claude Code, derived from the AIRealCheck Roadmap v3  
**Language of prompts:** English  
**Important app rule:** All in-app UI copy must remain **German**

---

## Phase 1 - Stabilize the analysis domain, persistence, and shared contracts

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a dark, modern SaaS product for detecting AI-generated content across images, audio, and video. The frontend stack is fixed:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2
- clsx, tailwind-merge, CVA

CONSTRAINTS
- Do not introduce breaking changes to the existing auth flow.
- Do not add new dependencies unless absolutely necessary and explicitly justified in the final summary.
- Keep all in-app UI text in German.
- API Access section must not be implemented now.
- The project already has a credits system and an existing analysis flow, but the history/persistence layer is currently unreliable after the migration from older frontend code.

TASK
Build and/or refactor the shared analysis domain so every completed analysis has one stable canonical record. The goal is to make the rest of the app build on top of a trustworthy data model.

REQUIREMENTS
1. Establish a stable analysis entity with:
   - analysis id
   - user id
   - status
   - media type
   - created/completed timestamps
   - credits charged
   - verdict label
   - confidence score / band
2. Establish related storage for:
   - uploaded asset metadata
   - engine-level results
   - technical signals / warnings
   - report metadata
3. Ensure the completion flow is transactionally safe:
   - analysis record exists early
   - result data persists before final status becomes completed
   - credits are charged only after success
4. Create or normalize typed frontend contracts for:
   - AnalysisSummary
   - AnalysisDetail
   - AnalysisEngineResult
   - AnalysisSignal
   - CreditSummary
5. Build a clean service layer for analysis-related requests, instead of scattering fetch logic across components.
6. Add proper loading/error handling contracts for all analysis reads.

EXPECTED OUTPUT
- Updated domain types/interfaces
- Stable backend/API contract for analysis persistence
- Frontend service helpers
- Any needed migrations or schema updates
- A concise summary of what was changed and any assumptions

DELIVERABLE STANDARD
Do not stop at “it compiles”. Make the structure robust enough so Dashboard, Results, Verlauf, and Admin can all reuse the same analysis domain without duplicate logic.
```

---

## Phase 2 - Rebuild the Verlauf page and fix the broken history pipeline

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a SaaS verification tool for AI-generated images, audio, and video. The app uses:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Do not break the existing auth flow.
- Keep all UI copy in German.
- Do not add new dependencies unless clearly justified.
- Reuse the shared analysis domain from the previous phase.
- The current history page is effectively empty / broken after migration.

TASK
Implement a production-ready Verlauf page and make sure newly completed analyses actually appear there.

REQUIREMENTS
1. Build a dedicated Verlauf route/page with:
   - search
   - filters for media type, verdict, date range, confidence band
   - sort options
   - pagination or incremental loading
2. Add a detail experience for a selected history item:
   - drawer or detail panel on desktop
   - mobile-friendly full detail experience
3. Show for each item:
   - verdict
   - confidence
   - media type
   - created date
   - credits charged
   - thumbnail/poster/preview if available
4. Implement complete empty states:
   - no analyses yet
   - no results for current filters
   - backend/load error
5. Fix the backend/frontend history contract so completed analyses persist and are queryable by user.
6. Make sure the history page reads persisted records only, never transient client state.
7. Use the same detail fields as the results domain wherever possible.

DESIGN REQUIREMENTS
- Dark, modern, serious security-tool aesthetic
- High-quality spacing
- Clear filter bar
- Clean status chips
- No cramped table layout
- Skeleton rows/cards during loading

EXPECTED OUTPUT
- Fully working Verlauf page
- Repaired history data flow
- Shared detail rendering where sensible
- Short implementation summary plus any migration notes
```

---

## Phase 3 - Finalize the Analyse empty state and upload UX

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck detects AI-generated content in images, audio, and video. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Keep existing auth flow intact.
- Keep all UI text in German.
- Do not add new dependencies unless clearly justified.
- The Analyse page already exists in partial form and is close to finished, but it needs polish and stronger UX.

TASK
Refine and professionalize the Analyse page empty state and upload flow.

REQUIREMENTS
1. Build a premium-quality upload experience for:
   - Bild
   - Audio
   - Video
2. Add clear affordances for:
   - drag and drop
   - click to upload
   - supported formats
   - max sizes / durations
   - credit usage expectation
3. Add front-end validation before upload:
   - unsupported format
   - too large
   - too long
   - no credits
4. Keep server-side validation authoritative.
5. Separate the flow into:
   - upload asset
   - create analysis from uploaded asset
6. Add polished upload and analysis-start loading states.
7. Add an informative but compact explanatory area describing what the user gets:
   - verdict
   - confidence
   - technical signals
   - history storage
8. Add excellent empty-state design:
   - strong dropzone
   - subtle glow
   - serious styling, not playful
   - responsive layout

DESIGN REQUIREMENTS
- Dark premium SaaS style
- Electric cyan + soft violet accents
- Subtle motion only
- Spacious layout
- No visual crowding
- Mobile-first responsive behavior

EXPECTED OUTPUT
- Refined Analyse page
- Better validation and UX flow
- Clear state handling
- Summary of changed files and rationale
```

---

## Phase 4 - Build the premium results experience

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a multimodal AI-detection SaaS for images, audio, and video. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Keep auth flow unchanged.
- Keep UI text in German.
- Do not add new dependencies unless clearly justified.
- Reuse the shared analysis domain from previous phases.

TASK
Rebuild or significantly improve the post-analysis result experience so it feels like a serious verification product, not a single-score screen.

REQUIREMENTS
1. Create a strong result hero card with:
   - main verdict
   - confidence score
   - animated score ring
   - short verdict explanation
   - file metadata
   - credits charged
2. Add structured secondary sections in this order:
   - confidence explanation
   - engine breakdown
   - technical signals
   - warnings / limitations
3. Support image/audio/video context display:
   - image thumbnail
   - audio duration and basic audio metadata
   - video poster frame and duration
4. Add user actions:
   - open/download report
   - copy result summary
   - go to history
   - start new analysis
5. Handle uncertain cases gracefully:
   - not only binary “real/fake”
   - include neutral / unclear band if supported by the scoring logic
6. Make sure all labels are understandable in German for non-technical users.
7. Use modular components so the same data can be reused in Verlauf details and Admin views.

DESIGN REQUIREMENTS
- Clear information hierarchy
- No duplicated cards saying the same thing
- Elegant animation only on first load
- High readability
- Serious, trustworthy look
- Excellent responsive behavior

EXPECTED OUTPUT
- Upgraded results page
- Shared reusable result modules
- Clear summary of data assumptions and UI decisions
```

---

## Phase 5 - Build the Dashboard on top of real data

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a multimodal AI verification SaaS. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- No auth-flow breakage
- No new dependencies unless explicitly justified
- Keep all app UI text in German
- Reuse the stable history, credits, and analysis domains from earlier phases

TASK
Build a complete, professional Dashboard that gives users immediate operational value.

REQUIREMENTS
1. Add a summary hero area with:
   - current plan
   - available credits
   - quick actions
2. Add KPI cards for:
   - total analyses
   - likely AI count
   - likely human count
   - average confidence
   - credits used in period
3. Add a recent analyses preview (latest 5)
4. Add media-type distribution visualization
5. Add a lightweight engine/system health module
6. Add context-aware banners:
   - Free users: upgrade-oriented
   - paid users: usage/report/team-oriented
7. Make the dashboard useful with and without data:
   - polished empty state
   - real loading skeletons
   - graceful error state
8. Keep data contracts clean and reusable.

DESIGN REQUIREMENTS
- Premium dark SaaS aesthetic
- More visual depth than plain cards
- subtle glow/shadow
- restrained motion
- clear spacing
- no clutter
- charts/rings built without introducing a chart dependency if possible

EXPECTED OUTPUT
- Fully implemented Dashboard page
- Reusable KPI and preview components
- Data loading strategy summary
```

---

## Phase 6 - Build Profil and Einstellungen

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a SaaS verification product with an existing auth flow, credits system, and partially built account area. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Do not break or replace the existing auth flow.
- Keep all in-app UI text in German.
- No unnecessary new dependencies.
- Billing provider integration may not be fully live yet; support graceful placeholders where needed.

TASK
Implement a complete Profil page and a complete Einstellungen page.

PROFIL REQUIREMENTS
1. Show:
   - name
   - email
   - role/plan
   - account created date
   - credit snapshot
   - linked OAuth accounts
2. Add editable forms for:
   - display name
   - email
   - password
   - avatar (optional if already supported)
3. Add proper validation and save states.
4. Use inline form sections, not modal overload.

EINSTELLUNGEN REQUIREMENTS
1. Add sections for:
   - Sprache / Locale
   - Abo & Premium verwalten
   - Benachrichtigungen
   - Datenschutz / Daten-Export
   - Account löschen
2. Add sensible additional preference areas if the current architecture supports them:
   - default history filters
   - default dashboard range
   - result detail mode
3. Implement destructive actions carefully and visibly.
4. If billing is not fully wired, keep the structure ready and honest rather than fake-functional.

DESIGN REQUIREMENTS
- Clean account-management UI
- Consistent card/form spacing
- Strong visual hierarchy
- Destructive area clearly separated
- Excellent responsiveness

EXPECTED OUTPUT
- Complete Profil page
- Complete Einstellungen page
- Any necessary API/service wiring
- Short summary of assumptions and follow-up needs
```

---

## Phase 7 - Build Support & Hilfe, Feedback, and the API placeholder

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a dark, modern SaaS for AI-generated content verification. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Keep all UI text in German.
- Do not implement the real API access product in this phase.
- No unnecessary dependencies.
- Preserve existing auth behavior.

TASK
Build three support/product-support surfaces:
1. Support & Hilfe
2. Feedback
3. API-Zugang placeholder

SUPPORT & HILFE REQUIREMENTS
- FAQ / knowledge base home
- search entry
- topic categories
- contact / ticket form
- documentation link
- status-page link
- polished empty and success states

FEEDBACK REQUIREMENTS
- separate modes for:
  - feature request
  - bug report
  - general feedback
- optional satisfaction / NPS capture
- structured bug report form
- ability to connect feedback to an analysis id if relevant

API PLACEHOLDER REQUIREMENTS
- honest “coming later” page
- optional waitlist / interest form only if simple to support
- no fake API dashboard, no fake docs

DESIGN REQUIREMENTS
- serious product-help design
- useful, not decorative
- elegant card-based layout
- strong search/entry points
- clear forms
- no dead pages

EXPECTED OUTPUT
- Support & Hilfe page
- Feedback page
- API placeholder page
- Necessary data models / service calls if implemented
- Short implementation summary
```

---

## Phase 8 - Build the Upgrade auf Premium page and pricing/billing surfaces

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck is a multimodal AI-detection SaaS with a credits system. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

BUSINESS MODEL TO IMPLEMENT
Use this pricing model in the UI unless existing backend constraints force a minor adjustment:
- Free: 0 EUR, 100 starter credits
- Pro: 19 EUR/month, 1,500 credits/month
- Business: 79 EUR/month, 10,000 credits/month

Planned credit logic for explanation:
- image analysis: 5 credits per file
- audio analysis: 10 credits per started minute
- video analysis: 25 credits per started minute

CONSTRAINTS
- Keep all in-app UI text in German.
- Do not hard-break the existing credits flow.
- If billing checkout is not live yet, implement a clean stub/disabled state or provider-ready contract rather than fake success.
- No new dependencies unless clearly justified.

TASK
Implement a professional Upgrade auf Premium page and connect the relevant billing summary surfaces.

REQUIREMENTS
1. Build a high-quality pricing hero
2. Add 3 pricing cards:
   - Free
   - Pro (recommended)
   - Business
3. Add a feature comparison table
4. Explain the credit model clearly
5. Add FAQ for subscriptions and credits
6. Add multiple CTAs without making the page spammy
7. Surface plan state consistently if the current user already has a plan
8. Reuse plan badges or summary blocks in account-related areas if appropriate

DESIGN REQUIREMENTS
- conversion-oriented but trustworthy
- serious and premium
- dark with cyan/violet accents
- strong hierarchy
- clear CTA emphasis
- elegant FAQ section

EXPECTED OUTPUT
- Complete upgrade page
- Plan/billing summary wiring
- Any plan constants/config
- Concise summary of implementation and any backend gaps
```

---

## Phase 9 - Rebuild the Admin-Panel as a true operations console

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
AIRealCheck has an existing but incomplete Admin-Panel. The goal is to transform it into a real operational control center. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Do not weaken auth or role protections.
- Keep all visible in-app admin UI text in German.
- No unnecessary dependencies.
- Reuse stable user, analysis, credit, engine, and audit domains from earlier phases.
- The admin area must not become visually cramped or have conflicting colors.

TASK
Expand and refine the Admin-Panel with production-grade structure and better UX.

REQUIRED SUBSECTIONS
1. Overview / KPIs
2. User management
3. Global analyses
4. Credits & billing
5. Engine management
6. Cost monitoring
7. Error logs
8. System health
9. Feedback & support inbox
10. Audit log

FUNCTIONAL REQUIREMENTS
- searchable/filterable user list
- user detail view
- suspend / unsuspend
- adjust credits
- analysis overview and detail
- engine state and health visibility
- system error visibility
- admin action logging for sensitive writes
- support/feedback triage visibility

DESIGN REQUIREMENTS
- dark, dense but readable operator UI
- consistent spacing and sizing
- no color collisions
- proper drawer/detail views
- strong status badges
- meaningful empty states
- dangerous actions clearly separated

EXPECTED OUTPUT
- Significantly upgraded admin area
- Any required backend/admin API wiring
- Audit logging for admin mutations
- Summary of changes and remaining limitations
```

---

## Phase 10 - Polish pass: consistency, responsiveness, accessibility, and quality gates

```bash
You are working inside the AIRealCheck codebase.

PROJECT CONTEXT
The major AIRealCheck sections have now been built or rebuilt. Stack:
- Next.js 16.1.6 App Router
- TypeScript 5
- React 19
- Tailwind CSS 4
- Framer Motion 12
- Lucide React
- Sonner 2

CONSTRAINTS
- Keep all app UI text in German.
- No unnecessary dependencies.
- No breaking auth changes.
- This phase is not about inventing new features; it is about making the product feel complete and professional.

TASK
Perform a product-wide polish pass across Dashboard, Analyse, Ergebnisse, Verlauf, Profil, Einstellungen, Support, Feedback, Upgrade, and Admin.

REQUIREMENTS
1. Fix spacing, sizing, and hierarchy inconsistencies
2. Fix color collisions, low-contrast states, and unreadable badges
3. Improve responsiveness across mobile, tablet, and desktop
4. Improve accessibility:
   - keyboard navigation
   - focus states
   - aria labels where needed
   - semantic headings/regions
5. Improve loading / empty / error states everywhere
6. Remove duplicated UI logic where sensible
7. Ensure plan/credit state is consistent across pages
8. Ensure route-level and component-level skeletons feel cohesive
9. Improve perceived quality with subtle motion, glow, and depth — but stay serious
10. Verify that no section feels dead, cramped, broken, or inconsistent

EXPECTED OUTPUT
- Cross-app UX/UI polish
- Fixes to responsiveness/accessibility/state handling
- Final summary grouped by:
  - UX fixes
  - visual fixes
  - technical cleanup
  - remaining known limitations
```
