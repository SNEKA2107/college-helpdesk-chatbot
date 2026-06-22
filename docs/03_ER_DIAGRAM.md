# Database ER Diagram

MongoDB (document) database, 23 collections. References below are `ObjectId` links (Mongoose `ref`). Diagram uses Mermaid `erDiagram`.

## 3.1 Core entity relationships

```mermaid
erDiagram
    USER ||--o{ CONVERSATION : owns
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ QUERYLOG : asks
    MESSAGE ||--o| QUERYLOG : "rated by (training example)"
    USER ||--o{ SUCCESSMETRIC : "daily snapshot"
    USER ||--o{ ATTENDANCE : has
    USER ||--o{ MARKS : has
    USER ||--o| FEE : has
    USER ||--o{ REQUEST : files
    USER ||--o{ LEAVE : applies
    USER ||--o{ BORROWEDBOOK : borrows
    BOOK ||--o{ BORROWEDBOOK : "is copy of"
    USER ||--o{ AUDITLOG : "actor of"

    USER {
        ObjectId _id
        string name
        string studentId UK
        string email UK
        string password "bcrypt"
        string department
        string semester
        string role "student|admin"
        number cgpa
        array skills
        array projects
        string approvalStatus
    }
    CONVERSATION {
        ObjectId _id
        ObjectId user FK
        string title
        date lastMessageAt
        number messageCount
    }
    MESSAGE {
        ObjectId _id
        ObjectId conversation FK
        string role "user|assistant"
        string content
        string intent
        array sources "citations"
        array followUps
        string feedback "up|down|null"
        number latencyMs
    }
    QUERYLOG {
        ObjectId _id
        ObjectId user FK
        ObjectId message FK
        string query
        string intent
        boolean matched
        string response
        string rating "up|down|null"
        string category
        string role
        number hour
    }
    SUCCESSMETRIC {
        ObjectId _id
        ObjectId student FK
        number successScore
        number attHealth
        number academic
        number placement
        number engagement
        string snapshotDate
    }
```

## 3.2 Knowledge & directory entities (Phase 7)

```mermaid
erDiagram
    KNOWLEDGEDOCUMENT {
        ObjectId _id
        string title
        string category "10 categories"
        string docType "regulation|handbook|policy|faq..."
        string content "searchable, text-indexed"
        string section "citation reference"
        array tags
        string fileData "base64 PDF (optional)"
        string status "draft|published"
        number accessCount
        string uploadedBy
    }
    KNOWLEDGEARTICLE {
        ObjectId _id
        string title
        string body
        string category
        array tags
        string status
    }
    FACULTY {
        ObjectId _id
        string name
        string department
        string designation
        string email
        array subjects "text-indexed"
        string officeLocation
        boolean isHOD
    }
    NOTICE {
        ObjectId _id
        string title
        string content
        string category
        string audience
        string status
        string summary "AI"
        array keyDates "AI"
        array actionItems "AI"
        string aiPriority "AI"
    }
```
*These four are not foreign-key joined to USER — they are the institutional knowledge corpus the Copilot retrieves from at query time (RAG sources).*

## 3.3 Academic & service entities

```mermaid
erDiagram
    USER ||--o{ ATTENDANCE : ""
    USER ||--o{ MARKS : ""
    EXAM ||--o{ EXAM_SCHEDULE : "embeds"
    TIMETABLE ||--o{ PERIOD : "embeds"
    USER ||--o{ EVENT_REG : "registers (embedded in EVENT)"

    ATTENDANCE {
        ObjectId student FK
        string subject
        date date
        string status "Present|Absent"
    }
    MARKS {
        ObjectId student FK
        string semester
        string subject
        number credits
        number gradePoint
    }
    EXAM {
        ObjectId _id
        string department
        string semester
        string status "draft|published|archived"
        array schedule "embedded {date,subject,code,session}"
        array practicals
    }
    FEE {
        ObjectId student FK
        string semester
        number total
        number balance
        string status
    }
    NOTICE }o--|| USER : "createdBy (admin)"
```

## 3.4 Schema design notes

- **Document references over embedding** for high-cardinality, independently-queried data (attendance, marks, messages). **Embedding** for tightly-bound sub-documents that are always read together (exam `schedule[]`, timetable periods, event registrations, message `sources[]`).
- **Text indexes** on `KnowledgeArticle`, `KnowledgeDocument`, `Faculty` power keyword retrieval for the Copilot (upgrade path: Atlas Vector Search via the reserved `embedding` field).
- **`QueryLog` is the training corpus** — each row is a labelled `(query → response, rating, intent, category, role)` example, linked to its `Message`. Additive Phase-7 fields keep it backward compatible.
- **`SuccessMetric`** stores one upserted snapshot per student per day → enables trend charts on the Success/Home/Placement dashboards.
- **Soft compatibility** — lifecycle/audience/AI fields default so legacy rows created before a feature existed still validate and render.
