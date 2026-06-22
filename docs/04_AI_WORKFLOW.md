# AI Workflow Diagram

The Campus Copilot is a **grounded (RAG-style) assistant**: deterministic intent classification → scoped retrieval with source tracking → Claude generation with conversation memory → persistence + training-data capture. Every Claude call has a deterministic fallback.

## 4.1 End-to-end Copilot pipeline

```mermaid
flowchart TD
    Q["💬 Student question"] --> CLS{"1 · Intent classification<br/>(keyword routing)"}
    CLS -->|performance| R
    CLS -->|exam/fees/marks/attendance| R
    CLS -->|placement| R
    CLS -->|faculty| R
    CLS -->|notice/general| R

    subgraph R["2 · Grounded Retrieval (scoped to intent + student)"]
        direction TB
        DB[("Live records:<br/>attendance, marks, fees, exams")]
        ENG["AI engines:<br/>successEngine · placementEngine"]
        KB["KnowledgeArticle + KnowledgeDocument<br/>(text search → section citation)"]
        FAC["Faculty Directory<br/>(subjects / HOD / email)"]
        NOT["Recent Notices"]
    end

    R --> CTX["📋 context + sources[]<br/>(one citation per fact)"]
    CTX --> KEY{"3 · ANTHROPIC_API_KEY set?"}

    KEY -->|Yes| GEN["Claude claude-haiku-4-5<br/>system = grounding rules + FACTS<br/>+ last 8 turns (memory)"]
    KEY -->|No| FB["Fallback: retrieval-only answer<br/>(still cites sources)"]

    GEN --> PARSE["Parse reply + 3 follow-ups"]
    PARSE --> OUT
    FB --> OUT["4 · Response"]

    OUT --> PERSIST["Persist Message (sources, intent, latency)<br/>+ update Conversation"]
    OUT --> LOG["Log QueryLog training example<br/>(query, response, intent, category, role, matched)"]
    OUT --> UI["Render answer + 📎 source chips<br/>+ follow-up pills + 👍/👎"]
    UI --> FBK["5 · Feedback → Message.feedback<br/>+ QueryLog.rating"]
    FBK --> TRAIN[("🧠 Training dataset<br/>for future fine-tuning")]

    classDef ai fill:#a855f7,color:#fff;
    class GEN,ENG ai
```

## 4.2 Retrieval grounding (Module 2 — RAG)

```mermaid
flowchart LR
    M["User message + intent"] --> S{Source selection by intent}
    S --> A["Student-scoped DB facts"]
    S --> B["KB articles + documents<br/>$text search"]
    S --> C["Faculty directory<br/>$text / HOD filter"]
    S --> D["Recent notices (always)"]
    A & B & C & D --> ADD["add(type, refId, label, text)"]
    ADD --> CITE["sources[] → citation chips<br/>📘 exam · 📊 attendance · 📖 KB · 👤 faculty"]
    ADD --> TXT["context string → grounding prompt"]
```

## 4.3 Feedback → training-data loop (Modules 3 & 4)

```mermaid
flowchart TD
    ANS["Copilot answer (messageId)"] --> RATE{"Student rates"}
    RATE -->|👍 up| UP["POST /api/chat/feedback"]
    RATE -->|👎 down| DN["POST /api/chat/feedback"]
    UP & DN --> WRITE["Message.feedback = rating<br/>QueryLog.rating = rating"]
    WRITE --> AGG["/api/knowledge/analytics aggregation"]
    AGG --> A1["Most / Least helpful answers"]
    AGG --> A2["Helpful rate %"]
    AGG --> A3["Intent distribution"]
    AGG --> A4["Training dataset size"]
    AGG --> A5["Missing knowledge areas (matched=false)"]
```

## 4.4 Other AI flows (reuse `successEngine` as the single source of truth)

```mermaid
flowchart LR
    SE["successEngine.computeSuccess()<br/>(attendance·marks·placement·engagement)"]
    SE --> SUCC["Phase 2: Success Dashboard<br/>score, risks, recommendations, trends"]
    SE --> HOME["Phase 5: Home AI daily briefing<br/>(Claude prose + template fallback)"]
    SE --> PLACE["Phase 6: Placement readiness<br/>+ eligibility, skill-gap, resume score"]
    SE --> COP["Phase 1: Copilot 'performance' intent"]

    NOTICE["New/edited Notice"] --> SUM["Phase 3: summarizer<br/>(Claude → summary/keyDates/<br/>actionItems/priority, heuristic fallback)"]
```

## 4.5 Design rationale

- **Deterministic intent routing** (not an LLM classifier): cheap, predictable, fully testable, and logged for analytics — appropriate for a campus assistant where the source domains are known.
- **Retrieve-then-generate (RAG)**: Claude answers *only* from injected FACTS, eliminating hallucinated dates/fees/grades and guaranteeing every claim is citable.
- **Conversation memory**: last 8 turns are replayed so follow-ups ("and the next one?") resolve in context.
- **Graceful degradation**: the demo never breaks — without an API key the Copilot returns the grounded retrieval text and the summarizer/briefing use heuristics/templates.
- **Closed feedback loop**: thumbs ratings flow into `QueryLog`, turning routine usage into a labelled dataset that quantifies answer quality and surfaces knowledge gaps — the foundation for future fine-tuning (Phase 7's stated goal).
