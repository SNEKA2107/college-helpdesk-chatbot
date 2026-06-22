# CampusAssist AI — Final Submission Package

Complete documentation, diagrams, and defense material for the CampusAssist AI major project. All content reflects the **actually implemented** codebase (`demo-branch`, HEAD `21ad702`).

| # | Document | Purpose |
|---|---|---|
| 01 | [Project Inventory](01_PROJECT_INVENTORY.md) | Stack, metrics, features, models, APIs, security, layout |
| 02 | [System Architecture](02_SYSTEM_ARCHITECTURE.md) | 3-tier diagrams, request lifecycle, deployment topology |
| 03 | [ER Diagram](03_ER_DIAGRAM.md) | 23-collection data model (Mermaid) |
| 04 | [AI Workflow](04_AI_WORKFLOW.md) | RAG pipeline, feedback loop, AI flows |
| 05 | [Presentation Outline](05_PRESENTATION_OUTLINE.md) | 30-slide PPT deck plan |
| 06 | [Demo Script](06_DEMO_SCRIPT.md) | 5–7 min live walkthrough + fallbacks |
| 07 | [Viva Q&A](07_VIVA_QA.md) | 50 questions with answers |
| 08 | [Report Structure](08_PROJECT_REPORT_STRUCTURE.md) | Full report skeleton + mapping |
| 09 | [Deployment Readiness](09_DEPLOYMENT_READINESS.md) | Verification results + branch-deploy action |
| 10 | [Evaluation Checklist](10_EVALUATION_CHECKLIST.md) | Submission self-assessment |

## Quick facts
- **Stack:** React 18 + Vite · Node/Express · MongoDB Atlas · JWT · Anthropic Claude (Haiku 4.5) · Capacitor (Android)
- **Scale:** 23 models · 23 API modules · 5 AI engines · 24 pages · 17 admin tabs · 7 AI phases
- **Demo accounts:** student `22IT101 / student123` · admin `ADMIN01 / admin@123`
- **Seed:** `node backend/scripts/seed-success-demo.js` and `node backend/scripts/seed-knowledge-demo.js`
- **Live URL:** https://college-helpdesk-chatbot-l4bk.onrender.com *(serves `main`; merge `demo-branch` to expose the AI phases — see doc 09)*

> Mermaid diagrams render directly on GitHub. For the PPT/report, screenshot the rendered diagrams or paste the Mermaid into mermaid.live to export PNG/SVG.

## ⚠️ One action before the live URL shows the AI work
The AI phases live on `demo-branch`; the deployed branch (`main`) predates them. Merge `demo-branch` → `main` (or repoint Render's branch), then re-run the live smoke tests. Full steps in [09_DEPLOYMENT_READINESS](09_DEPLOYMENT_READINESS.md).
