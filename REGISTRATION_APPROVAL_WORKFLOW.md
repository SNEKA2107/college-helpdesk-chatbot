# REGISTRATION APPROVAL WORKFLOW — Phase 2 (H4)

**Date:** 2026-06-14 · **Status:** Implemented & verified.

## Problem
Previously, `POST /api/auth/register` returned a JWT and the frontend logged the user in immediately — anyone could self-activate an account.

## States (`User.approvalStatus`)
`pending → approved | rejected`. **Default `approved`** so existing users and the admin account keep working with no migration; **new registrations are explicitly set to `pending`.**

## Workflow
```
Student registers
  → User created with approvalStatus:'pending'
  → response: { success, pending:true, message } — NO token, NO auto-login
  → frontend shows "pending admin approval", links to Login

Student tries to log in while pending  → 403 "pending admin approval"
Student tries to log in after reject    → 403 "registration was not approved"

Admin → GET /api/students/pending        (list awaiting)
      → PUT /api/students/:id/approve     → approvalStatus:'approved' (audited)
      → PUT /api/students/:id/reject      → approvalStatus:'rejected' (audited)

Approved student logs in → success (token issued)
```

## API changes
| Endpoint | Change |
|----------|--------|
| `POST /auth/register` | sets `pending`; returns no token; `pending:true` flag |
| `POST /auth/login` | blocks `pending` (403) and `rejected` (403); `approved` proceeds |
| `GET /students?status=` | filter by approval status |
| `GET /students/pending` | **new** — registrations awaiting approval |
| `PUT /students/:id/approve` | **new** (admin, audited) |
| `PUT /students/:id/reject` | **new** (admin, audited) |

## Frontend
- `Register.jsx`: no `setSession`; success state now reads "Registration Submitted — pending admin approval" → **Go to Login**.
- `Login.jsx`: already surfaces the server message, so pending/rejected reasons display automatically.
- `StudentsTab.jsx`: approval-status badge, status filter (All/Pending/Approved/Rejected with pending count), and **Approve/Reject** buttons on pending rows.

## Backward compatibility
Existing users (no `approvalStatus` field) hydrate with the default `'approved'`, so **all current logins continue to work**, including admin. Verified: admin login + previously-existing accounts unaffected.

## Verification (live API)
- ✅ Register → `pending:true`, no token.
- ✅ Pending login → 403.
- ✅ Admin sees pending, approves → student can log in.
- ✅ Reject → student login 403.
- ✅ Approve/reject are audit-logged; non-admin blocked from approve (403).

*Verification only — DO NOT COMMIT.*
