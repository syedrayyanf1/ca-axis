# ICAP PRC Prep — Progressive Web App Implementation Plan

An offline-ready, lightweight MCQ testing and exam analytics platform designed specifically for ICAP Chartered Accountancy (Pre-Requisite Competencies — PRC Level) students. It combines realistic timed ICAP exam simulations, rich accounting table and statistical formula rendering, chapter-and-source mastery analytics, and a zero-cost client-side architecture.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and design choices have been confirmed from your preferences and integrated into the plan below:

- **Confirmed Testing Mode**: **Timed ICAP Exam Simulation Mode with Flag-for-Review**, alongside flexible chapter and source filtering (`ICAP Self-Test`, `ICAP APQ`, and `Practice Set`) and instant post-exam or per-question explanation review.
- **Confirmed Analytics Focus**: **Chapter-wise and Source-wise Mastery Breakdown**, paired with Recharts learning curve visualizations so students can pinpoint weak chapters and question sources across all 4 PRC modules.
- **Confirmed Visual Theme**: **Crisp Light Academic Theme with Dark Mode Toggle**, engineered for extended exam study sessions with high-contrast legibility, tabular financial numerals, and zero eye strain.

---

## 1. Overview & Core Concept

- **What It Does**: Provides ICAP PRC students with a dedicated workspace to practice and simulate official computer-based examinations across four core subject modules:
  1. **PRC 1**: Fundamentals of Accounting (with Markdown financial statements, ledgers, and trial balance tables)
  2. **PRC 2**: Quantitative Analysis for Business & Statistics (with KaTeX mathematical equations, probability distributions, and regression formulas)
  3. **PRC 3 (Vol 1)**: Business Insights
  4. **PRC 3 (Vol 2)**: Economic Insights
- **Target Audience / Persona**: Chartered Accountancy (PRC Level) students preparing for ICAP computer-based exams on mobile phones, tablets, or laptops—often under intermittent connectivity—plus educators/admins curating question banks.
- **Key Value**: Zero database bandwidth costs via static question banks and persistent local storage, authentic timed exam simulation with a question palette and flagging workflow, and granular mastery diagnostics by chapter and source.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Subject Dashboard & Quick Launch**:
   - Students land on a clean academic overview displaying the 4 PRC subject modules (`PRC 1`, `PRC 2`, `PRC 3 Vol 1`, `PRC 3 Vol 2`) with real-time mastery percentages, total attempted MCQs, and recent simulation scores.
   - Clicking a subject opens the **Exam Configuration & Chapter Selector**, allowing students to filter by specific chapters, question sources (`ICAP Self-Test`, `ICAP APQ`, `Practice Set`), question count, and timer settings (or launch a full standard timed simulation).
2. **Timed ICAP Exam Simulation Environment**:
   - A distraction-free two-zone workspace:
     - **Left/Main Stage (70% width)**: Displays the question stem rendered with GitHub-Flavored Markdown tables and KaTeX math equations, four interactive single-choice option cards (`A`, `B`, `C`, `D`) with keyboard shortcut support (`1-4` or `A-D`), and a live countdown timer in the header.
     - **Right/Collapsible Navigator Deck (30% width)**: A structured question grid showing status states (**Answered**, **Unanswered**, **Flagged for Review**, **Current**) with one-click jumping, a **"Flag for Review"** toggle, and a **"Submit Exam"** confirmation flow.
   - Optional **Instant Practice Toggle** lets students check answers and read step-by-step Markdown/LaTeX explanations immediately when doing untimed chapter drills.
3. **Post-Exam Diagnostic & Solution Review**:
   - Upon submission, displays the score breakdown, pass/fail status against ICAP's passing threshold, time spent, accuracy by chapter and source, and a full interactive question-by-question solution walkthrough with expandable explanations.
4. **Mastery Analytics View**:
   - Interactive **Recharts** visualizations showing:
     - **Chapter-Wise Mastery Bar Chart**: Accuracy percentage and attempt volume per chapter for the selected PRC subject.
     - **Source-Wise Performance Breakdown**: Comparative mastery across `Self-Test`, `ICAP APQ`, and `Practice Sets` to verify readiness across difficulty tiers.
     - **Learning Curve Trend Line**: Historical exam simulation scores over time.
5. **Question Bank Import & Schema Converter Utility**:
   - A built-in utility modal/view where instructors or developers can paste raw Markdown, CSV, or JSON question sets, automatically parse them into the strict `Question` TypeScript schema, preview rendered Markdown tables and `$LaTeX$` formulas live, and either merge them into the active study bank or download the formatted `.json` file.
6. **PWA Installation & Offline Experience**:
   - Prominent **Install App** trigger in the top bar (handling native `beforeinstallprompt` on Android/Desktop and guided Safari Share sheet instructions on iOS) plus an automatic offline readiness indicator.

### Visual Identity & Theme

- **Aesthetic Direction**: **Crisp Academic Editorial & Precision Assessment**—clean structural lines, generous reading margins for accounting tables and math formulas, single-elevation cards with 1px hairline borders, and zero decorative clutter.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Canvas**: Crisp Alabaster White (`#F8FAFC`) in Light Mode; Deep Slate (`#0F172A`) in Dark Mode.
  - **30% Structural Surfaces**: Pure White (`#FFFFFF`) / Elevated Slate (`#1E293B`) containers with subtle hairline dividers (`#E2E8F0` / `#334155`) and high-contrast slate typography (`#0F172A` / `#F1F5F9`).
  - **10% Semantic & Brand Accents**:
    - **Primary Academic Emerald (`#047857` / `#10B981`)**: Active navigation, primary exam actions, and nominal/mastered indicators (referencing ICAP's classic institutional palette).
    - **Flagged / Review Amber (`#D97706` / `#F59E0B`)**: Paired with a flag icon and explicit `Flagged` label in the exam navigator.
    - **Incorrect / Alert Crimson (`#DC2626` / `#EF4444`)**: Paired with explicit `Incorrect` / `Needs Review` indicators.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - **Display & Headings**: `Plus Jakarta Sans` (SemiBold/Bold, tight tracking, `text-wrap: balance`) for clear academic hierarchy.
  - **Body & Question Stems**: `DM Sans` (15px–16px, relaxed line height) for effortless reading during timed exams.
  - **Financial Tables, Timers & Metrics**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` so accounting ledger columns, countdown timers, and percentages align vertically without layout jitter.
  - **Mathematical Formulas**: Native `KaTeX` math serif rendering for PRC-2 statistics and equations.
- **Layout & Top Bar Contract**:
  - Single-row top navigation bar adhering strictly to the 3-zone contract: Brand Wordmark (`ICAP PRC Prep`) on the left, concise single-line view links (`Dashboard`, `Exam Simulator`, `Analytics`, `Question Bank`) in the center, and primary utility action (`Install App` / theme switcher) on the right.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Static JSON Question Banks + LocalStorage Persistence (Zero-Cost Architecture)**
  - *Chosen Approach*: Bundle structured question banks per subject module alongside a client-side persistence layer that stores exam attempts, per-question history, flagged items, and custom imported questions in `localStorage`.
  - *Why*: Eliminates database latency and cloud bandwidth costs, ensures 100% instant question transitions during timed exams, and enables full offline PWA functionality after initial load.
  - *Alternatives Considered*: Remote database fetching per question was rejected because network latency disrupts timed exam flow and breaks offline study on mobile commutes.
- **Decision 2: Unified Markdown + GFM Tables + KaTeX Rendering Pipeline**
  - *Chosen Approach*: Configure a shared `RichContentRenderer` using `react-markdown`, `remark-gfm`, `remark-math`, and `rehype-katex` with custom-styled table wrappers (`overflow-x-auto`, tabular numerals, bordered accounting headers).
  - *Why*: PRC-1 requires multi-column trial balances and T-accounts, while PRC-2 requires summation notation, standard deviation, and probability equations. A unified renderer supports both seamlessly in question stems, options, and explanations.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ICAP PRC Prep (PWA Shell)                            │
│  ┌───────────────────────┬──────────────────────────┬────────────────────┐  │
│  │ Brand: ICAP PRC Prep  │ Nav: Dashboard · Exam ·  │ Theme Toggle &     │  │
│  │                       │ Analytics · Import Tool  │ PWA Install Prompt │  │
│  └───────────────────────┴──────────────────────────┴────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Static Question   │     │   Client Storage    │     │  Service Worker &   │
│   Banks (4 Modules) │     │   & State Engine    │     │  Web App Manifest   │
│  • PRC 1 Accounting │────▶│  • Exam Attempts    │     │  • Offline Cache    │
│  • PRC 2 Quant/Stat │     │  • Question Mastery │     │  • Standalone UI    │
│  • PRC 3 V1 Bus.    │     │  • Custom Imports   │     │  • iOS/Android Meta │
│  • PRC 3 V2 Econ.   │     │  • Theme Preference │     └─────────────────────┘
└─────────────────────┘     └──────────┬──────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. Subject & Setup │     │  2. Timed Exam      │     │  3. Mastery &       │
│     Dashboard       │     │     Simulator       │     │     Import Studio   │
│  • 4 PRC Cards      │────▶│  • Countdown Timer  │────▶│  • Recharts Chapter │
│  • Chapter Filter   │     │  • RichMD + KaTeX   │     │    & Source Charts  │
│  • Source Filter    │     │  • Flag for Review  │     │  • MD/CSV/JSON      │
│  • Mode Selection   │     │  • Question Palette │     │    Live Converter   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### Data Model & State

- **`Question` Entity**:
  - `id`: Unique identifier (e.g., `"PRC1-CH01-ST-001"`)
  - `subjectId`: `'prc-1' | 'prc-2' | 'prc-3-v1' | 'prc-3-v2'`
  - `chapterId`: Numeric chapter index
  - `chapterName`: Human-readable ICAP syllabus chapter title
  - `source`: `'self-test' | 'apq' | 'practice-set'`
  - `questionText`: Markdown string supporting GFM accounting tables and `$LaTeX$` formulas
  - `options`: Array of `{ id: 'A' | 'B' | 'C' | 'D', text: string }`
  - `correctOption`: `'A' | 'B' | 'C' | 'D'`
  - `explanation`: Step-by-step solution supporting Markdown tables and `$LaTeX$` derivations
- **`ExamAttempt` & `QuestionStat` Records**:
  - Tracks timestamp, `subjectId`, selected filters, total time elapsed, per-question selected option, flagged status, and accuracy metrics aggregated by `chapterId` and `source`.

### Interactive Component & State Mapping

- **Exam Simulator State Machine**:
  - `setup` $\to$ `active-exam` $\to$ `review-summary`:
  - During `active-exam`, an interval timer decrements remaining seconds, automatically submitting when time expires. Users can select/change options `A–D`, toggle the **Flag for Review** state on any question, filter the navigator palette (`All`, `Unanswered`, `Flagged`), and navigate via Previous/Next buttons or keyboard keys.
- **Analytics Aggregation Engine**:
  - Dynamically computes chapter-level mastery (`Correct / Total Attempted` and `Unique Coverage %` across chapter questions) and source-level breakdown (`Self-Test` vs. `APQ` vs. `Practice Set`), rendering interactive Recharts bar, radar/breakdown, and line charts with empty-state guidance when a subject has no attempts yet.
- **Markdown / JSON / CSV Import Parser**:
  - Parses structured Markdown blocks (supporting `# Question`, table blocks, `A)–D)` options, `Answer:`, `Explanation:`), CSV rows, or raw JSON arrays; validates every item against the `Question` schema; renders a live KaTeX/GFM preview; and provides one-click **Save to Local Bank** or **Export JSON File** actions.
