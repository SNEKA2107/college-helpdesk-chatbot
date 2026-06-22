# System Architecture Diagram

CampusAssist AI is a classic **three-tier SPA** (presentation → application/API → data) with an **AI services layer** and an external **LLM provider**. Diagrams use Mermaid (renders on GitHub).

## 2.1 High-level architecture

```mermaid
flowchart TB
    subgraph Client["🖥️ Presentation Tier — React 18 + Vite SPA"]
        direction LR
        SP["Student pages<br/>(Home, Chat, Success,<br/>Placement, Academics...)"]
        AP["Admin panel<br/>(17 tabs)"]
        APK["📱 Android APK<br/>(Capacitor 8)"]
    end

    subgraph API["⚙️ Application Tier — Node.js + Express"]
        direction TB
        MW["Middleware:<br/>helmet · CORS allowlist · rate-limit ·<br/>JWT protect/adminOnly · morgan"]
        RT["23 REST route modules /api/*"]
        SVC["🤖 AI Services Layer<br/>aiAgent · successEngine · summarizer ·<br/>placementEngine · homeBriefing"]
        MW --> RT --> SVC
    end

    subgraph Data["🗄️ Data Tier"]
        DB[("MongoDB Atlas<br/>23 collections")]
    end

    LLM["☁️ Anthropic Claude API<br/>claude-haiku-4-5"]

    SP -->|"HTTPS + JWT (Bearer)"| MW
    AP -->|"HTTPS + JWT"| MW
    APK -->|"HTTPS to hosted API"| MW
    RT -->|Mongoose ODM| DB
    SVC -->|grounded prompt| LLM
    LLM -->|answer + follow-ups| SVC

    classDef ai fill:#a855f7,color:#fff;
    classDef ext fill:#0ea5e9,color:#fff;
    class SVC ai
    class LLM ext
```

## 2.2 Request lifecycle (authenticated API call)

```mermaid
sequenceDiagram
    participant U as React SPA
    participant E as Express
    participant M as Middleware
    participant R as Route + Service
    participant DB as MongoDB
    participant C as Claude API

    U->>E: HTTPS request + Authorization: Bearer <JWT>
    E->>M: helmet → CORS → rate-limit
    M->>M: protect: verify JWT → load req.user
    alt admin route
        M->>M: adminOnly: role === 'admin'
    end
    M->>R: dispatch
    R->>DB: query/aggregate (Mongoose)
    DB-->>R: documents
    opt AI route (chat / briefing / prep)
        R->>C: grounded prompt (facts + memory)
        C-->>R: generated answer (or graceful fallback)
    end
    R-->>U: JSON { success, data }
```

## 2.3 Deployment topology

```mermaid
flowchart LR
    Dev["👩‍💻 Developer"] -->|git push| GH["GitHub<br/>SNEKA2107/college-helpdesk-chatbot"]
    GH -->|auto-deploy branch| Render["Render Web Service<br/>(Node, free plan)"]
    Render -->|postinstall: build frontend| Build["frontend/dist (static)"]
    Render -->|serves SPA + /api| Users["🌐 Browsers / 📱 APK"]
    Render -->|TLS| Atlas[("MongoDB Atlas")]
    Render -->|HTTPS| Claude["Anthropic Claude API"]
    Render -. ANTHROPIC_API_KEY / MONGO_URI / JWT_SECRET .-> Env["Environment vars"]
```

## 2.4 Architectural principles

1. **Single deployable unit** — Express serves both the API (`/api/*`) and the built React SPA (`frontend/dist`) with an SPA catch-all fallback; one Render service, no separate CDN.
2. **Stateless API** — JWT bearer tokens; no server sessions, so the API scales horizontally.
3. **Thin routes, rich services** — routes handle HTTP/validation; the 5 AI engines hold business logic and are independently unit-testable and reusable (e.g. `successEngine` is reused by Copilot, Home and Placement).
4. **Graceful AI degradation** — every Claude call has a deterministic fallback (retrieval-only answer / heuristic summary / template plan), so the app fully functions even without an API key.
5. **Defense in depth** — helmet + CSP, CORS allowlist, layered rate limits, input sanitization, audit logging, hashed credentials.
6. **Citations by construction** — the retrieval layer records a source for every fact it injects, so answers are always traceable.
