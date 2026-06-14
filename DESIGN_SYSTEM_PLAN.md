# CampusAssist — Premium Design System Plan (Phases 2–5)

**Date:** June 2026
**Status:** PROPOSAL — awaiting approval. **No code changed.**
**Guiding principle:** Upgrade at the **token + shared-component layer** so the premium look cascades
to every page automatically. Preserve all logic, markup structure, APIs, routes, schemas, and workflows.

---

## Strategy: token-first, low-risk

Because the app already uses CSS variables and a shared class vocabulary (`.card`, `.btn`, `.table`,
`.form-input`, `.badge`, `.stat-card`…), **most of the transformation happens by rewriting
`global.css` `:root` tokens and those shared classes.** ~80% of pages improve with **zero JSX edits**.
Per-page work is then surgical (swap inline-styled bits for components, add charts where wanted).

---

## PHASE 2 — Design System

### 2.1 Color — premium navy foundation

Replace the near-black default with a **navy-tinted slate** foundation (the requested "premium dark
blue/navy") with real elevation steps, and modernize the accent. *All values are proposals — tunable.*

**Default (dark navy) — proposed tokens**
```
--bg:        #0a0f1a   /* app background — deep navy-slate (was #080808 pure black) */
--bg-subtle: #0d1320   /* striping / inset */
--surface-1: #111827   /* cards (was #111) — slate-900 with navy undertone */
--surface-2: #161f30   /* raised: popover, hover, modal */
--surface-3: #1c2638   /* highest elevation */
--border:        #1f2a3d   /* default hairline */
--border-strong: #2b3a52
--text:        #e6edf6   /* primary */
--text-muted:  #94a3b8   /* slate-400 */
--text-subtle: #64748b

/* Accent — refined, with proper steps (decision: keep steel-blue family OR move to indigo) */
--accent:        #3b82f6   /* option A: brighter blue   */
--accent-strong: #2563eb
--accent-soft:   rgba(59,130,246,0.14)
--accent-ring:   rgba(59,130,246,0.35)
```
**Semantic statuses** keep green/amber/red but get `-soft` (bg) and `-text` pairs so badges/alerts
are tokenized (no hardcoded hex). Light & "night" themes get the **same token names** re-mapped, and
**all hardcoded hovers (`#111`, `#1c1c1c`, toast hexes) are replaced with tokens** → fixes the
light/night theme leaks.

> **Decision needed:** keep the existing steel-blue accent (`#4E85BF`, on-brand, safe) or modernize to
> a punchier blue/indigo (more "Stripe/Linear"). See questions.

### 2.2 Typography — disciplined scale

Keep **Inter** (already loaded). Introduce a real scale + tabular numerals.
```
--text-xs: 12px / --text-sm: 13px / --text-base: 14px / --text-md: 15px
--text-lg: 17px / --text-xl: 20px / --text-2xl: 24px / --text-3xl: 30px
--font-normal:400 --font-medium:500 --font-semibold:600 --font-bold:700
--tracking-tight: -0.011em   /* headings */
```
Rules: headings use 600–700 + tight tracking (drop the 800 weights); body 14px/500–400; stats &
table numbers use `font-variant-numeric: tabular-nums`. Replace magic sizes (13.5/11.5px) with tokens.

### 2.3 Spacing — 4px base scale
```
--space-1:4 --space-2:8 --space-3:12 --space-4:16 --space-5:20 --space-6:24 --space-8:32 --space-10:40
```
Card padding → `--space-6`; grid gaps → `--space-5`; form gaps → `--space-4`. Removes drift.

### 2.4 Elevation & radius
```
--radius-sm:8 --radius:12 --radius-lg:16 --radius-xl:20   (slightly tighter than current 24)
--shadow-xs/sm/md/lg  → softer, layered, navy-tinted (e.g. 0 1px 2px rgba(2,6,23,.4))
--ring: 0 0 0 3px var(--accent-ring)   /* unified focus-visible */
```

### 2.5 Components (shared-class upgrades — cascade everywhere)
- **Card:** add `--surface-1` bg, refined hairline, optional `card--hover` (lift + ring), proper
  header row (title + subtitle + actions). Modal → `--surface-2`, larger radius, backdrop blur kept.
- **Button:** replace opacity-dim hover with **color-shift + ring/shadow**; add `:focus-visible`
  ring, `disabled`, and a `.btn--loading` spinner state. Primary = solid accent (not gradient) by
  default, gradient kept as `.btn--gradient` option.
- **Input/Select/Textarea:** `--surface-2` field bg for contrast, unified focus ring, inline-SVG
  chevron in accent, error/help text tokens.
- **Table:** tokenized hover (fixes theme leak), optional zebra, sticky header, right-aligned numeric
  cells (tabular-nums), denser `--table-compact`, sort-affordance styling.
- **Badge → Status pill:** add dot+label variant (`.pill--success` etc.) used for request/leave/fee/
  grade statuses — the Linear/Stripe pattern.
- **Alert, Empty state, Toast, Spinner:** re-tokenize (remove hardcoded hex), consistent icon slot.
- **Navigation:** sidebar active state → accent ring + left indicator bar; tokenized text colors so it
  works in all themes; section labels refined.

### 2.6 Icons — professional library *(decision)*
Replace emoji (`🎓📋🔔💳…` in nav, card titles, buttons, theme toggle) with **`lucide-react`** — the
icon set used by Linear/Vercel/Shadcn. Consistent stroke, themeable via `currentColor`, identical on
desktop **and** Android APK. ~1 small dependency (tree-shaken). This is the **highest-impact** single
change and the most file-touching. Alternatives: keep emoji (no gain), or hybrid (icons in chrome,
emoji in content).

---

## PHASE 3 — Premium Dashboard (real data only)

All visualizations derive from **existing endpoints** — **no fake data, no new backend** (unless you
approve an aggregation endpoint later).

| Upgrade | Data source (real) | How |
|---|---|---|
| **KPI cards** | existing `/requests/stats`, `/notices`, counts | Restyle: label, big tabular number, small trend/segment, icon chip; unify desktop+mobile into one card style |
| **Request status donut** | `/api/requests` (already loaded) | client-side group by `status` |
| **Attendance ring** | `/api/attendance/summary` | % ring per subject / overall |
| **CGPA / SGPA bars** | `/api/marks/cgpa` | per-semester SGPA bars |
| **Activity feed** | recent notices/requests/leaves (already loaded) | merge + sort by `createdAt`, render as timeline |
| **Quick actions** | existing routes | restrained icon tiles (replace bright gradients) |

**Charting:** proposed **`recharts`** (declarative, small) OR **dependency-free SVG/CSS** sparklines &
rings. Decision below. Either way: **only real, already-fetched data** — no mock series.

---

## PHASE 4 — Admin Experience

- **Data tables:** apply the premium table (sticky header, zebra optional, numeric alignment, status
  pills, row hover fixed across themes, density toggle). Add **client-side pagination** for Students
  (1k rows) — **UI-only**, no API change (slice the already-fetched array; optional `?page` later).
- **Filters & search:** standardize a `Toolbar` pattern (search input + filter chips + result count)
  reused across Students/Requests/Leaves/Fees. Pure client-side over existing data.
- **Status indicators:** status pills everywhere (request lifecycle, leave, fee verified/pending, grade).
- **Forms:** the admin "form + list" tabs get the upgraded inputs/buttons + section headers + inline
  validation styling (logic unchanged).
- **Overview analytics:** add the donut/bars/feed from Phase 3 using the data already loaded in `Admin.jsx`.

## PHASE 5 — Mobile / APK

- Add a **tablet breakpoint** (768–1024) so mid-widths aren't cramped.
- **Unify** mobile + desktop card language (one system, not two).
- Ensure **44px min touch targets** (table actions, `btn-sm`, nav).
- Swap emoji→lucide so the **APK renders identically** to desktop (removes Android emoji variance).
- Re-verify bottom-nav, FAB, mobile header against new tokens; safe-area insets retained.

---

## Component-by-component upgrade plan & risk

| # | Target | Change | Files | Risk | Breaks logic? |
|---|---|---|---|---|---|
| 1 | **Tokens** | New navy palette, type/space/elevation scales, fix theme leaks | `global.css` `:root` + theme blocks | **Low** | No |
| 2 | **Buttons** | hover/focus/disabled/loading; keep classnames | `global.css` | **Low** | No |
| 3 | **Cards** | elevation, header, hover variant | `global.css`, `components.css` | **Low** | No |
| 4 | **Inputs/Select/Textarea** | field bg, focus ring, chevron | `global.css` | **Low** | No |
| 5 | **Tables** | hover fix, sticky, numeric align, density | `global.css` | **Low–Med** | No |
| 6 | **Badges → status pills** | add `.pill*` variants (keep `.badge*`) | `global.css` | **Low** | No |
| 7 | **Alerts/Toasts/Empty/Spinner** | re-tokenize | `global.css` | **Low** | No |
| 8 | **Sidebar/Topbar/Bottom-nav** | active states, tokenized colors | `global.css` | **Low** | No |
| 9 | **Icons → lucide** | replace emoji in chrome + components | nav/topbar/tabs + many pages | **Med** | No (visual only) |
| 10 | **Dashboard (student)** | KPI restyle + donut/ring/feed; unify mobile | `Dashboard.jsx` (+ chart cmp) | **Med** | No (read-only data) |
| 11 | **Admin Overview** | KPIs + donut/bars/feed | `OverviewTab.jsx` | **Med** | No |
| 12 | **Admin tables** | premium table + toolbar + client pagination | `StudentsTab`, `RequestsTab`, `LeavesTab`, `FeesTab`, `AttendanceTab`, `MarksTab` | **Med** | No (UI over existing data) |
| 13 | **Auth screens** | bring Login/Register onto system, branded | `Login.jsx`, `Register.jsx`, modules | **Med** | No |
| 14 | **Content pages** | swap inline-styled bits for components | Notices/Events/Requests/Leave/Profile/Calendar/Marks/Chat | **Low–Med** | No |

**Verification per step:** `npm run build` + IDE diagnostics after each layer; visual check in all 3
themes; mobile/tablet widths; confirm no API/route/markup-contract change.

---

## Impact & risk summary

- **Functional risk: very low.** Changes are CSS tokens, shared classes, icon swaps, and presentational
  JSX. No business logic, API calls, data shapes, routes, schemas, or auth touched. The earlier
  uncommitted **Critical fixes remain intact** (this layers on top).
- **Highest-impact, lowest-risk:** Steps 1–8 (token + shared-class overhaul) — do first.
- **Highest-impact, higher-touch:** Step 9 (icons) and Steps 10–12 (dashboards/tables/charts).
- **New dependencies (only if approved):** `lucide-react` (icons), `recharts` (charts). Both are small,
  tree-shaken, widely used. Charts can instead be dependency-free SVG/CSS.
- **Effort estimate:** Steps 1–8 ≈ half-day and transform the whole app. Steps 9–14 ≈ 1–2 days for full
  polish. Can ship incrementally (tokens first → review → icons/charts/tables).

---

## Recommended sequencing (incremental, reviewable)

1. **Group A — Foundation (Steps 1–8):** tokens + all shared components. Build, review in 3 themes. *This alone makes it look premium.*
2. **Group B — Icons (Step 9):** emoji → lucide across chrome + components.
3. **Group C — Dashboards & charts (Steps 10–11):** real-data donut/ring/bars/feed + KPI restyle.
4. **Group D — Admin tables & toolbars (Step 12).**
5. **Group E — Auth + content-page polish (Steps 13–14).**
6. **Group F — Mobile/tablet pass (Phase 5).**

I will pause for your confirmation between groups (and never commit without your say-so).

---

## Decisions required before coding
See the questions accompanying this plan: (1) icon system, (2) charts approach, (3) accent/theme
direction, (4) scope — foundation-only vs. full uplift. Defaults are pre-selected as recommendations.
