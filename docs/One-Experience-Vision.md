# One — Experience Vision & Architecture

*The unified internal digital experience for WSO2. Web · Mobile · Agentic.*

**Status:** Design vision, grounded in the One App Experience Brainstorming Session (Jun 26, 2026). This document is meant to be the working template the team agreed to draft — a single reference to prototype against.

**Author's framing:** Principal Product Designer perspective, opinionated by intent. Where the meeting made a decision, I treat it as settled and build on it. Where the meeting left a question open, I make a recommendation and flag it.

---

## 0. What we decided (and what this document builds on)

The session settled the spine of the product. Everything below assumes these as fixed:

- **The brand is "One."** Agreed at leadership level. Web lives at a single front door (e.g., `one.wso2.com`); the mobile super-app keeps its store branding with "One" inside.
- **Three channels, not many apps:** a **web** experience, a **mobile** super-app, and an **agentic** experience (an always-available assistant plus autonomous background agents).
- **Internal employee experience first.** The customer portal, billing, invoicing, and contracting are explicitly **out of scope** for One — they belong to a separate **Cloud** experience (think AWS EC2/S3-style consoles). One is for employees and the internal side of partners/hiring.
- **Navigation is built on "Perspectives,"** not on a domain map. A role-based home perspective loads on login and is switchable.
- **Gmail is the reference model:** log in once, get a one-stop-shop, with perspectives the way Gmail surfaces Mail / Calendar / Chat / Tasks.
- **The front end is a monolith** (single React app, single deployment) over independent, modular backends joined by SSO. Backed by a strict contribution process.
- **Ship low-hanging fruit first.** Don't over-engineer configurable dashboards on day one. **Phase 1 launches CSM and People Operations.**

> **One-sentence vision:** *One is the single place a WSO2 employee logs in to get their day done — a Gmail-simple shell where your role loads the right perspective, an assistant is always one keystroke away, and the tools you used to chase across a dozen apps now live under one roof.*

---

## 1. Strategy — Digital foundation, agentic layer

The mental model from the session: **Digital Transformation is the foundational layer; the Agentic Enterprise is a layer added on top of it** — not a competing idea, and not a sub-part of digital. First we make the enterprise fully digital (every interaction has a clean, unified surface and a clean backend). Then agents operate *on* that digital substrate.

```
            ┌─────────────────────────────────────────────┐
            │           AGENTIC ENTERPRISE  (layer 2)       │
            │   assistant in every perspective · autonomous │
            │   background agents · natural-language action │
            ├─────────────────────────────────────────────┤
            │        DIGITAL TRANSFORMATION (layer 1)        │
            │   One: unified web + mobile + clean backends   │
            │   perspectives · SSO · consolidated internal   │
            │             applications                       │
            └─────────────────────────────────────────────┘
```

**Why this ordering matters for UX:** it tells us not to bolt a chatbot onto a mess. The assistant is only as good as the digital surface beneath it. So the first job of One is to *consolidate* — kill the "scattered, isolated applications" problem — and the assistant rides on top of that consolidation, getting smarter because everything now lives in one coherent place.

**The three channels:**

| Channel | Role | Design stance |
|---|---|---|
| **Web** (the focus of this doc) | The deep-work surface — the one-stop-shop where perspectives and tools live | Needs the most design work; today's scattered web apps are the problem we're solving |
| **Mobile** super-app | Glance, approve, request, capture on the go | Largely solved already as a unified super-app; keep store branding, add "One" inside |
| **Agentic** | An assistant for users + autonomous agents that act without a human in the loop | Always present in web & mobile; autonomous agents surface results as emails, issues, PRs — not screens |

---

## 2. Scope — what One is, and what it is not

```
  IN SCOPE (One — internal)                 OUT OF SCOPE (→ Cloud experience)
  ─────────────────────────────             ─────────────────────────────────
  • CSM tools (Phase 1)                      • Customer Portal
  • People Ops / hiring (Phase 1)            • Billing & invoicing
  • Sales / Revenue Ops                      • Contracting
  • Marketing                                • Customer-facing platform consoles
  • Finance ops                                (delivered AWS-console-style under Cloud)
  • "My" (everyone): profile, performance,
     promotions, personal details
  • Service requests: infra, expenses,
     new email, publish a job, etc.
  • Internal partner & hiring workflows
```

**The clean line:** if it's an employee getting their job done, it's One. If it's a customer interacting with WSO2's commercial surface (buy, bill, contract, operate the product), it's Cloud. The partner relationship straddles both — the *internal* side of partnering (the people, the process, hiring-adjacent flows) is One; the partner's commercial portal is Cloud.

**Phase 1 is deliberately narrow:** CSM and People Operations. These are the highest-pain, most-scattered internal areas and give us the fastest visible value. Marketing and finance follow; customer surfaces arrive later via Cloud (targeted ~2027).

---

## 3. The Perspectives model — the heart of One

A **perspective** is a role- or purpose-shaped view of One: a curated home dashboard plus the navigation and tools relevant to *what you're doing right now*. This replaces "which app do I open?" with "which hat am I wearing?"

This is the single most important concept in the product. The session was explicit that we are designing **persona-first, not domain-first** — the interface should prioritize *what a person needs to accomplish at a specific moment*, not mirror our internal org chart or system boundaries.

### 3.1 Two kinds of perspectives

```
                         ┌──────────── PERSPECTIVES ────────────┐
                         │                                       │
              FUNCTIONAL (role-gated)            CROSS-CUTTING (everyone)
              ──────────────────────             ────────────────────────
              • CSM                               • My  (profile, performance,
              • Sales                                   promotions, personal)
              • Revenue Ops                       • Service Requests
              • Marketing                              (infra, expenses, new email,
              • People Ops                              publish a job, IT, ...)
              • Finance
              • Leadership / Exec view
                 (a customer/portfolio view)

   Access to a functional perspective is a permission (team/group driven).
   Cross-cutting perspectives are available to all employees.
```

**Functional perspectives** give you the tools and data of a job role. A CS engineer's CSM perspective shows their cases, accounts, and the customer details connected to them. Whether you can see a given functional perspective is a permission question, driven by team/group membership.

**Cross-cutting perspectives** are the things *everyone* does regardless of role. The **"My"** perspective is your personal hub — profile, performance, promotions, your details. **Service Requests** is the place to ask the org for something — request infrastructure, submit an expense, request a new email/group, publish a job — even though those requests are fulfilled by different teams behind the scenes. (On the fulfilment side, the infra-ops team sees those requests in *their* functional perspective, ServiceNow-style: requester on one side, facilitator on the other.)

### 3.2 The home perspective

On login you land on your **home perspective** — pre-set to the role that fits your background (a CS engineer lands in CSM; a recruiter lands in People Ops). You can change your home perspective in preferences, and you can switch to any perspective you have access to at any time.

**Design recommendation (resolving an open question from the session):** keep the default home perspective *opinionated and low-config* for launch. The session warned against over-engineering a fully configurable dashboard up front — so the home perspective ships as a sensible, role-curated default. We add user configuration ("make my home the My-dashboard instead of CSM," pin favorites) as a fast-follow, not a Phase-1 dependency. Configurability is a setting, not a blocker.

### 3.3 Why perspectives beat the alternatives

- **vs. one mega-app with every tool visible:** overwhelming; forces everyone to wade through tools they never use.
- **vs. separate apps per domain (today's state):** the "scattered, isolated applications" problem — interconnected work (People Ops ↔ hiring ↔ profiles) gets fragmented, and you lose context every time you jump.
- **vs. a pure chatbot:** great for fast actions, but people doing a job want to *see* their cases, pipeline, or candidates — not interrogate a prompt for everything.

Perspectives give the focus of a dedicated app, the coherence of a single product, and a natural home for the assistant in every context.

---

## 4. Information Architecture — the Gmail-style one-stop-shop

The explicit reference is **Gmail**: you log in once and everything you need is right there, with perspectives (Calendar, Chat, Tasks) a click away. One adopts the same one-stop-shop posture.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ◴ One        🔎  Ask One or search…                       ⊞   🔔   (CK)  │ ← global bar
│                   (assistant + search, always present)   perspectives     │
├────────────┬───────────────────────────────────────────────────────────────┤
│ PERSPECTIVE│                                                                 │
│  ◎ Home    │                                                                 │
│            │                                                                 │
│ FUNCTIONAL │                  CANVAS                                         │
│  ◉ CSM     │        (the active perspective's dashboard + tools)             │
│  ○ Sales   │                                                                 │
│  ○ Rev Ops │                                                                 │
│  ○ People  │                                                                 │
│            │                                                                 │
│ FOR YOU    │                                                                 │
│  ◑ My      │                                                                 │
│  ⚡ Requests│                                                                 │
│            │                                                                 │
│  ⚙ Settings│                                                                 │
└────────────┴───────────────────────────────────────────────────────────────┘
```

Three persistent elements:

1. **The global bar (top).** Holds the **always-present assistant/search box** ("Ask One or search…"), the **perspective switcher** (the `⊞` waffle, Google-apps style), notifications, and profile. These are global modes you invoke from anywhere — they overlay, never replace, your current context.

2. **The perspective rail (left).** Shows Home, the functional perspectives you have access to (grouped), and the cross-cutting ones (My, Requests). Switching perspective reloads the canvas; the bar stays put. This is also where favorites/pinned tools can live.

3. **The canvas (center).** The active perspective: its dashboard, its navigation, its tools. Tools open *inside* the canvas — no jumping to a different app, no lost context.

### 4.1 Navigation hierarchy

```
One  (one.wso2.com — single login)
├── Global bar
│   ├── Ask One (assistant + universal search)   ← always present
│   ├── ⊞ Perspective switcher
│   ├── 🔔 Notifications (global)
│   └── Profile (→ My perspective, preferences, home-perspective setting)
├── Home perspective (role default, switchable)
├── Functional perspectives  (permission-gated)
│   ├── CSM            → cases · accounts · customer context
│   ├── Sales          → opportunities · accounts
│   ├── Revenue Ops    → pipeline · forecasting
│   ├── Marketing      → campaigns · assets
│   ├── People Ops     → hiring · candidates · profiles · performance admin
│   ├── Finance        → approvals · budgets
│   └── Leadership     → cross-functional / portfolio view
└── Cross-cutting perspectives  (everyone)
    ├── My             → profile · performance · promotions · personal details
    └── Service Requests → infra · expenses · email/group · publish a job · IT
```

---

## 5. The Agentic Experience

The session's end-game for the agentic channel: a Gmail-/Google-Chat-style assistant you can use to *do anything and pull anything out of the system*, plus autonomous agents that run without a human attached.

### 5.1 The assistant — always present, context follows perspective

The assistant lives in the global bar as a single box ("Ask One…") that is **always available**, exactly like Gmail's search field — but its **context changes with the active perspective.** Type into it from CSM and it's scoped to your cases and accounts; type into it from People Ops and it's scoped to candidates and hiring. It is the "get things done fast and easy" tool: state an intent ("apply for X," "submit this expense," "summarize this account") and it does it.

```
   ASK ONE  (one box, three jobs — like Gmail's search, but it acts)
   ┌──────────────────────────────────────────────────────────────┐
   │  🔎  ask, search, or tell One to do something…                 │
   └──────────────────────────────────────────────────────────────┘
        │  type a noun → search        │ type a question → answer
        │  type a verb → run a workflow (scoped to current perspective)
        ▼
   context = active perspective  (CSM → cases/accounts · People Ops → candidates)
```

**Design stance:** the assistant box is persistent, but it does not hijack the screen. In a perspective you still *see* your work (cases, pipeline, candidates); the box accelerates it. This balances the two things the session went back and forth on — an assistant-first "type to do anything" surface *and* a real dashboard to look at. The answer is: both, with the dashboard as the resting state and the box as the accelerator.

### 5.2 Autonomous agents — no screen, just outcomes

Some agents run unattended. They have **no human-facing screen**; their output arrives as an email, a created issue, a pull request, a populated register — whatever the natural artifact is. One's job for these is governance and visibility: a place to see what agents did, on whose behalf, with the ability to review and undo. (This aligns with WSO2's own agentic-identity direction — agents as first-class, permissioned, auditable actors.)

### 5.3 The interaction contract

Whether the assistant is drafting on request or an autonomous agent is acting, One should always make three things visible: the **plan** (what it intends to do), the **provenance** (where the data came from), and the **permission** (the autonomy level governing it). That triad is how we make "the assistant did something for me" trustworthy rather than unnerving.

---

## 6. Perspective deep-dives

Same shell, same components — different data bindings and tools per perspective. (Phase-1 perspectives marked ★.)

### 6.1 ★ CSM (Customer Success Management) — a launch perspective
Home shows the CS engineer's world: open cases ranked by urgency, the accounts they own, and the customer context connected to each. Assistant scoped to "this case / this account." Tools: case management, account health, knowledge lookup. This is the view *every* CS person sees on login, with role variants (engineer vs. lead vs. leadership) decided when the perspective is authored.

```
┌── CSM ─────────────────────────────────────────────────────────────┐
│  My cases (4)                         Accounts I own (12)           │
│  🔴 #4821 Acme — latency  P1          ● Acme    health ●●●○         │
│  🟠 #4799 Globex — SSO    P2          ● Globex  health ●●○○ ⚠       │
│  ○  #4760 Initech — docs  P3          ● Northwind …                 │
│  ───────────────────────────────────────────────────────────────  │
│  Ask One:  "summarize Acme's open issues and draft an update"  ⏎   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 ★ People Ops / Hiring — a launch perspective
Consolidates the scattered hiring and people applications the session called out: submit/track a hiring request, see candidate history and profiles (including past-experience notes so we don't repeat bad fits), manage performance and promotion workflows. The interconnection between hiring, profiles, and people data — fragmented today — becomes one coherent perspective.

### 6.3 Sales / Revenue Ops
Opportunities, accounts, pipeline, forecasting. Assistant scoped to deals ("which of my opportunities is most at risk?").

### 6.4 Marketing
Campaigns, assets, collateral. A fast-follow after Phase 1.

### 6.5 Finance
Approvals, budgets, expense oversight (the fulfilment side of expense service-requests).

### 6.6 Leadership / Exec
A cross-functional view: customers and portfolio health, the high-level read across CSM, Sales, People, Finance. Not a separate product — the same perspective machinery, pointed at roll-up data.

### 6.7 ◑ My (cross-cutting, everyone)
Your personal hub: profile, personal details, performance, promotions, your requests. Can be set as your home perspective if you prefer a neutral landing.

### 6.8 ⚡ Service Requests (cross-cutting, everyone)
One place to ask the org for things even though many teams fulfil them: request infrastructure, submit an expense, request a new email/group, publish a job opening, raise IT tickets. Verb-first and form-light.

**A note on auto-generated request UIs:** the session floated generating request forms directly from service definitions (parse an HTTP service's operations and arguments → render a form-like UI automatically). This is a strong fit for Service Requests — new internal services could appear as requestable actions with minimal hand-built UI. Recommended as a framework capability, not a Phase-1 must.

---

## 7. Screens (web)

### 7.1 Home (CSM as default for a CS engineer)
Lands on the CSM perspective. Top: the always-present **Ask One** box. Canvas: my cases + my accounts + connected customer context, with one AI insight line. Left rail: perspective switcher. The fastest path from login to "what needs me."

### 7.2 Perspective switcher
The `⊞` waffle opens a Google-apps-style grid: Functional perspectives I can access (CSM, Sales, Rev Ops, People Ops…) and Cross-cutting (My, Requests). One click reloads the canvas; the bar and assistant persist.

```
┌── Switch perspective ─────────────────────┐
│  FUNCTIONAL                                │
│  [◉ CSM]  [Sales]  [Rev Ops]               │
│  [People Ops]  [Marketing]  [Finance]      │
│  FOR YOU                                   │
│  [My]  [Service Requests]                  │
│  ───────────────────────────────────────  │
│  Set home perspective ▾   (default: CSM)   │
└────────────────────────────────────────────┘
```

### 7.3 A functional perspective (CSM) — detail
Covered in §6.1. Cases and accounts are the canvas; the assistant box is scoped to CSM; tools open inside the canvas.

### 7.4 My perspective
Profile, performance, promotions, personal details. Calm, personal, available to everyone.

### 7.5 Service request flow
From Requests, pick "Submit expense" → a short form (auto-generated where the service definition allows) → assistant can pre-fill ("same as last month?") → submit → tracked. The infra/finance team sees it in their functional perspective.

### 7.6 Ask One (assistant)
Persistent box → expands to a conversation that respects the current perspective's context, shows its plan and sources, and leaves results where you can review them. Autonomous-agent activity and audit live here too.

### 7.7 Mobile super-app home
Thumb-first: a briefing, approvals (swipe), notifications, digital ID/wallet, and Ask One via voice/text. Perspectives collapse into a bottom sheet; the assistant does the heavy lifting on small screens.

---

## 8. Visual Language

Built on WSO2's brand: **monochrome foundation, the orange pulse (`#F14E23`) as a single precise accent, signal over noise** — and Gmail-grade clarity and restraint, since Gmail is our reference for "calm one-stop-shop."

- **Color:** grayscale does ~90% of the UI; orange marks one thing per view (primary action, live signal, the assistant). Status colors (emerald/amber/red/blue) for state only. Dark mode is a first-class peer.
- **Typography:** one humanist sans (Inter-class) for UI; tabular numerals wherever data lives; a small, rhythmic scale (12/14/16/20/24/32) with weight carrying hierarchy. Mono for IDs/keys — WSO2 is developer-rooted; honor it.
- **Spacing/layout:** 8-pt grid; generous at rest, compact on demand (a density setting). Fixed bar + rail; reflowing canvas.
- **Cards:** flat, 1px hairline border, ~12px radius, no resting shadows; elevation only on active/drag. A card is a contract: title, key datum, optional sparkline/status, contextual actions on hover (incl. ✦ Ask).
- **Iconography:** one geometric line set, 1.5px stroke, echoing the simplified pulse signal; color only to carry status.
- **The assistant has a subtle signature** — a faint orange halo on Ask-One surfaces so "the assistant is here/working" reads without a label.
- **Principles:** clarity over cleverness; trust is visible (plan/provenance/permission rendered, not buried); performance is a feature (sub-100ms, optimistic UI, nothing blocks on the assistant); one component library across all perspectives; progressive disclosure; WCAG 2.2 AA.

---

## 9. Technical posture (UX-relevant)

The session's architecture decisions shape the experience, so they belong here:

- **Frontend monolith.** A single React app, single deployment, delivering one seamless experience over independent modular backends joined by SSO. The smoothness of One depends on this — but it only works with a **strict, well-run contribution process** (clear ownership, a folder/module per perspective, review discipline), because many teams contribute to one codebase. AI-assisted development makes this maintainable in a way it wouldn't have been a few years ago.
- **Modular backends, unified front.** Backends stay free to use the right approach per domain; the front end hides that seam entirely. Users never feel the boundaries between systems.
- **Generated UI where it pays.** Service-definition-driven form generation for Service Requests (and similar) reduces hand-built UI and lets new internal services show up as requestable actions quickly.
- **Build for value first.** Don't gate launch on the configurable-dashboard framework or generated-UI engine. Ship CSM + People Ops with curated perspectives; layer the framework niceties as fast-follows.

---

## 10. Phasing & roadmap

```
  NOW ──────────────► NEXT ──────────────► LATER ──────────────► 2027+
  Phase 1             Phase 2              Phase 3               Cloud
  ───────             ───────              ───────               ─────
  • CSM perspective   • Marketing          • Configurable home   • Customer Portal
  • People Ops/       • Finance              dashboards            (separate Cloud
    hiring            • Sales / Rev Ops    • Generated-UI          experience)
  • Ask One (assist)    full                 request engine      • Billing / contracts
  • My + Service      • Autonomous         • Deeper agentic      • Partner commercial
    Requests (core)     agents (early)       autonomy              portal
  • Mobile parity     • Leadership view
   (low-hanging fruit first, curated perspectives, monolith FE)
```

Phase 1 is intentionally a thin slice that proves the model end-to-end: one shell, two functional perspectives (CSM, People Ops), the cross-cutting essentials (My, Requests), and the always-present assistant. Everything after is more perspectives and more agentic depth on the same spine.

---

## 11. The agentic end-game

As the digital foundation matures, the balance shifts from *you operating tools* to *you directing agents and reviewing their work*. The assistant graduates from "type to get something done" to a fleet of autonomous agents you scope once and supervise — each surfacing outcomes as emails, issues, PRs, or register entries rather than screens. One becomes the place you **hire, scope, supervise, and audit** those agents, and the trust boundary for agent-to-agent exchanges. The constant from Phase 1 onward is the same contract — **plan, provenance, permission** — which is why we build it into the assistant now, while the surface is still simple.

---

## Appendix A — Day in the life (CS engineer, after One ships)

```
08:30  Log in to one.wso2.com → lands on CSM home (role default)
08:31  Canvas: 4 cases, Acme P1 at top; Ask One: "summarize Acme + draft update" → review → send
09:00  ⊞ switch to My → check performance snapshot, accept a promotion-cycle task
09:10  ⊞ switch to Service Requests → "submit expense" (assistant pre-fills) → done, no app-hop
10:00  Back in CSM; an autonomous account-watch agent filed an issue overnight → review in Ask One
12:30  Mobile: approve a teammate's request on the go (swipe), voice "what's my afternoon?"
```

## Appendix B — Open questions to resolve in build
1. **Home-perspective configurability** — confirm Phase-1 default-only vs. user-set (recommended: default-only, config as fast-follow).
2. **Perspective taxonomy** — lock the Phase-1 functional list (CSM, People Ops) and the cross-cutting set (My, Service Requests); name the leadership view.
3. **Assistant scope rules** — define exactly how context narrows per perspective.
4. **Generated-UI engine** — decide whether Service Requests in Phase 1 use hand-built forms or the parser approach.
5. **Monolith governance** — the contribution process (ownership, module boundaries, review) that keeps the front-end monolith healthy.
6. **Cloud boundary** — confirm the exact line where an internal partner/hiring flow ends and the Cloud commercial portal begins.

---

*Design rationale in one line: One shell, many perspectives, one always-present assistant — Gmail-simple on the surface, a monolith front end over modular backends underneath, internal-first with CSM and People Ops leading, and an agentic layer that grows on top of a clean digital foundation.*

---

**Sources:** [WSO2 Brand Guidelines](https://wso2.com/about/brand) · [WSO2 — Agentic Enterprise](https://wso2.com/)
