# -*- coding: utf-8 -*-
"""
Map the 78 fine-grained classifier intents onto the retrieval buckets that
backend/services/aiAgent.js already implements.

This is the piece that keeps the existing database and business logic in charge:
the classifier decides WHAT the user is asking; `retrieve()` still decides WHERE
the answer comes from and runs the same Mongo queries it runs today.

`grounded: true`   -> retrieve() already fetches real records for this bucket.
`grounded: false`  -> no retrieval handler exists yet; the bucket falls back to
                      'general' (notices + knowledge base), which is exactly what
                      the keyword router does today, so nothing regresses.

Run:  python build_retrieval_map.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

# Buckets aiAgent.retrieve() understands today.
GROUNDED = {"performance", "placement", "exam", "fees", "attendance", "marks",
            "faculty", "notice", "contact", "general"}

# fine intent -> (retrieval bucket, needs a NEW retrieval handler to be fully grounded)
MAP = {
    # already grounded by retrieve()
    "attendance_check":        ("attendance", False),
    "attendance_shortage":     ("attendance", False),
    "attendance_subject_wise": ("attendance", False),
    "marks_view":              ("marks", False),
    "cgpa_query":              ("marks", False),
    "backlog_query":           ("marks", False),
    "results_status":          ("marks", False),
    "exam_schedule":           ("exam", False),
    "exam_hall_ticket":        ("exam", False),
    "exam_practicals":         ("exam", False),
    "fees_balance":            ("fees", False),
    "fees_due_date":           ("fees", False),
    "fees_payment":            ("fees", False),
    "fees_verification":       ("fees", False),
    "fees_history":            ("fees", False),
    "performance_summary":     ("performance", False),
    "placement_readiness":     ("placement", False),
    "placement_eligibility":   ("placement", False),
    "placement_companies":     ("placement", False),
    "placement_skills":        ("placement", False),
    "faculty_directory":       ("faculty", False),
    "faculty_hod":             ("faculty", False),
    "notices_latest":          ("notice", False),
    "notice_search":           ("notice", False),
    "contact_department":      ("contact", False),
    "knowledge_base_query":    ("general", False),

    # answerable, but retrieve() has no handler yet -> add one to ground them
    "timetable_today":         ("timetable", True),
    "timetable_weekly":        ("timetable", True),
    "leave_apply":             ("leave", True),
    "leave_status":            ("leave", True),
    "od_request":              ("leave", True),
    "certificate_request":     ("request", True),
    "request_status":          ("request", True),
    "library_search":          ("library", True),
    "library_borrowed":        ("library", True),
    "library_renew":           ("library", True),
    "library_hours":           ("library", True),
    "events_list":             ("event", True),
    "events_register":         ("event", True),
    "academic_calendar":       ("calendar", True),
    "coursework_assignments":  ("coursework", True),
    "coursework_materials":    ("coursework", True),
    "profile_view":            ("profile", True),
    "profile_update":          ("profile", True),

    # static / policy answers - no per-student record needed, answer from the
    # canned response plus whatever the knowledge base returns
    "login_help":              ("general", False),
    "password_reset":          ("general", False),
    "registration_approval":   ("general", False),
    "account_status":          ("general", False),
    "settings_help":           ("general", False),
    "departments_list":        ("general", False),
    "hostel_info":             ("general", False),
    "transport_info":          ("general", False),
    "scholarship_info":        ("general", False),
    "admission_enquiry":       ("general", False),
    "alumni_records":          ("general", False),
    "visitor_campus_info":     ("general", False),
    "parent_ward_progress":    ("general", False),

    # faculty portal
    "faculty_mark_attendance":    ("general", True),
    "faculty_enter_marks":        ("general", True),
    "faculty_approve_leave":      ("general", True),
    "faculty_assignments_manage": ("general", True),
    "faculty_materials_upload":   ("general", True),
    "faculty_my_classes":         ("general", True),
    "faculty_analytics":          ("general", True),

    # admin portal
    "admin_approve_students":  ("general", True),
    "admin_publish_notice":    ("general", True),
    "admin_manage_timetable":  ("general", True),
    "admin_publish_exam":      ("general", True),
    "admin_verify_fees":       ("general", True),
    "admin_process_requests":  ("general", True),
    "admin_analytics":         ("general", True),
    "admin_knowledge_manage":  ("general", True),
    "admin_audit_log":         ("general", True),

    # conversational
    "greeting":                ("general", False),
    "thanks_goodbye":          ("general", False),
    "bot_capabilities":        ("general", False),
    "out_of_scope_technical":  ("general", False),
    "fallback_unsupported":    ("general", False),
}

def main():
    with open(os.path.join(DATA, "intents.json"), encoding="utf-8") as f:
        spec = json.load(f)
    known = {i["intent"] for i in spec["intents"]}
    responses = {i["intent"]: i["response"] for i in spec["intents"]}
    roles = {i["intent"]: i["roles"] for i in spec["intents"]}

    missing, extra = known - set(MAP), set(MAP) - known
    if missing or extra:
        print("MAP is out of sync with intents.json")
        if missing: print("  missing:", sorted(missing))
        if extra:   print("  unknown:", sorted(extra))
        sys.exit(1)

    out = {}
    for intent, (bucket, needs_handler) in sorted(MAP.items()):
        out[intent] = dict(retrieval=bucket,
                           grounded_today=bucket in GROUNDED and not needs_handler,
                           needs_new_handler=needs_handler,
                           roles=roles[intent],
                           fallback_response=responses[intent])

    path = os.path.join(HERE, "retrieval_map.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dict(version="1.0", buckets_supported_today=sorted(GROUNDED),
                       intent_count=len(out), map=out), f, indent=2, ensure_ascii=False)

    g = sum(1 for v in out.values() if v["grounded_today"])
    n = sum(1 for v in out.values() if v["needs_new_handler"])
    print("Wrote %s" % path)
    print("  %d intents mapped" % len(out))
    print("  %d route to a bucket retrieve() already handles" % g)
    print("  %d would be better grounded by adding a retrieval handler" % n)
    print("     (until then they fall back to 'general' = notices + knowledge base,")
    print("      which is exactly what the keyword router does today)")

if __name__ == "__main__":
    main()
