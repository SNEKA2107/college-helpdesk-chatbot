# CampusAssist Intent Dataset — Statistics

Seed `20260801` — regenerate with `python generate_dataset.py`.

## Totals

| Split | Rows |
|---|---|
| train | 4070 |
| test | 500 |
| validation | 500 |
| **total** | **5070** |

- Intents: **78**
- Unique questions: **5070** (duplicates removed: 0 — dedup is global and normalised)
- Roles covered: admin, alumni, applicant, faculty, parent, student, visitor
- Mean questions/intent: 65.0 (min 65, max 65)

## Augmentation provenance

| Source | Rows | Share |
|---|---|---|
| seed | 1798 | 35.5% |
| prefix | 1454 | 28.7% |
| synonym | 1019 | 20.1% |
| typo | 643 | 12.7% |
| followup | 156 | 3.1% |

## Class balance

| Intent | Category | Total | Train | Test | Val |
|---|---|---|---|---|---|
| `attendance_check` | Attendance | 65 | 51 | 7 | 7 |
| `attendance_shortage` | Attendance | 65 | 51 | 7 | 7 |
| `attendance_subject_wise` | Attendance | 65 | 51 | 7 | 7 |
| `marks_view` | Marks | 65 | 51 | 7 | 7 |
| `cgpa_query` | Marks | 65 | 51 | 7 | 7 |
| `backlog_query` | Marks | 65 | 51 | 7 | 7 |
| `results_status` | Marks | 65 | 51 | 7 | 7 |
| `timetable_today` | General | 65 | 51 | 7 | 7 |
| `timetable_weekly` | General | 65 | 51 | 7 | 7 |
| `exam_schedule` | Exams | 65 | 51 | 7 | 7 |
| `exam_hall_ticket` | Exams | 65 | 51 | 7 | 7 |
| `exam_practicals` | Exams | 65 | 51 | 7 | 7 |
| `coursework_assignments` | General | 65 | 51 | 7 | 7 |
| `coursework_materials` | General | 65 | 51 | 7 | 7 |
| `academic_calendar` | General | 65 | 51 | 7 | 7 |
| `fees_balance` | Fees | 65 | 51 | 7 | 7 |
| `fees_due_date` | Fees | 65 | 51 | 7 | 7 |
| `fees_payment` | Fees | 65 | 51 | 7 | 7 |
| `fees_verification` | Fees | 65 | 51 | 7 | 7 |
| `fees_history` | Fees | 65 | 51 | 7 | 7 |
| `leave_apply` | General | 65 | 51 | 7 | 7 |
| `leave_status` | General | 65 | 51 | 7 | 7 |
| `od_request` | General | 65 | 51 | 7 | 7 |
| `certificate_request` | General | 65 | 51 | 7 | 7 |
| `request_status` | General | 65 | 51 | 7 | 7 |
| `library_search` | General | 65 | 51 | 7 | 7 |
| `library_borrowed` | General | 65 | 51 | 7 | 7 |
| `library_renew` | General | 65 | 51 | 7 | 7 |
| `library_hours` | General | 65 | 51 | 7 | 7 |
| `notices_latest` | General | 65 | 51 | 7 | 7 |
| `notice_search` | General | 65 | 51 | 7 | 7 |
| `events_list` | General | 65 | 51 | 7 | 7 |
| `events_register` | General | 65 | 53 | 6 | 6 |
| `faculty_directory` | Faculty | 65 | 53 | 6 | 6 |
| `faculty_hod` | Faculty | 65 | 53 | 6 | 6 |
| `contact_department` | General | 65 | 53 | 6 | 6 |
| `departments_list` | General | 65 | 53 | 6 | 6 |
| `profile_view` | General | 65 | 53 | 6 | 6 |
| `profile_update` | General | 65 | 53 | 6 | 6 |
| `login_help` | General | 65 | 53 | 6 | 6 |
| `password_reset` | General | 65 | 53 | 6 | 6 |
| `registration_approval` | General | 65 | 53 | 6 | 6 |
| `account_status` | General | 65 | 53 | 6 | 6 |
| `settings_help` | General | 65 | 53 | 6 | 6 |
| `performance_summary` | Placements | 65 | 53 | 6 | 6 |
| `placement_readiness` | Placements | 65 | 53 | 6 | 6 |
| `placement_eligibility` | Placements | 65 | 53 | 6 | 6 |
| `placement_companies` | Placements | 65 | 53 | 6 | 6 |
| `placement_skills` | Placements | 65 | 53 | 6 | 6 |
| `knowledge_base_query` | General | 65 | 53 | 6 | 6 |
| `hostel_info` | Hostel | 65 | 53 | 6 | 6 |
| `transport_info` | Transport | 65 | 53 | 6 | 6 |
| `scholarship_info` | Scholarships | 65 | 53 | 6 | 6 |
| `faculty_mark_attendance` | Attendance | 65 | 53 | 6 | 6 |
| `faculty_enter_marks` | Marks | 65 | 53 | 6 | 6 |
| `faculty_approve_leave` | General | 65 | 53 | 6 | 6 |
| `faculty_assignments_manage` | General | 65 | 53 | 6 | 6 |
| `faculty_materials_upload` | General | 65 | 53 | 6 | 6 |
| `faculty_my_classes` | General | 65 | 53 | 6 | 6 |
| `faculty_analytics` | General | 65 | 53 | 6 | 6 |
| `admin_approve_students` | General | 65 | 53 | 6 | 6 |
| `admin_publish_notice` | General | 65 | 53 | 6 | 6 |
| `admin_manage_timetable` | General | 65 | 53 | 6 | 6 |
| `admin_publish_exam` | Exams | 65 | 53 | 6 | 6 |
| `admin_verify_fees` | Fees | 65 | 53 | 6 | 6 |
| `admin_process_requests` | General | 65 | 53 | 6 | 6 |
| `admin_analytics` | General | 65 | 53 | 6 | 6 |
| `admin_knowledge_manage` | General | 65 | 53 | 6 | 6 |
| `admin_audit_log` | General | 65 | 53 | 6 | 6 |
| `parent_ward_progress` | General | 65 | 53 | 6 | 6 |
| `admission_enquiry` | Admissions | 65 | 53 | 6 | 6 |
| `alumni_records` | General | 65 | 53 | 6 | 6 |
| `visitor_campus_info` | General | 65 | 53 | 6 | 6 |
| `greeting` | General | 65 | 53 | 6 | 6 |
| `thanks_goodbye` | General | 65 | 53 | 6 | 6 |
| `bot_capabilities` | General | 65 | 53 | 6 | 6 |
| `out_of_scope_technical` | General | 65 | 53 | 6 | 6 |
| `fallback_unsupported` | General | 65 | 53 | 6 | 6 |

## Category distribution

| Category | Rows |
|---|---|
| General | 3120 |
| Fees | 390 |
| Marks | 325 |
| Placements | 325 |
| Attendance | 260 |
| Exams | 260 |
| Faculty | 130 |
| Hostel | 65 |
| Transport | 65 |
| Scholarships | 65 |
| Admissions | 65 |

## Role distribution

| Role | Rows |
|---|---|
| student | 2724 |
| faculty | 789 |
| admin | 657 |
| parent | 448 |
| visitor | 184 |
| applicant | 135 |
| alumni | 133 |

## Entity coverage

| Entity | Occurrences |
|---|---|
| subject | 189 |
| leave_type | 102 |
| office | 90 |
| department | 89 |
| semester | 81 |
| company | 69 |
| skill | 60 |
| certificate_type | 57 |
| grade | 52 |
| event_category | 42 |
| payment_mode | 41 |
| day | 27 |
| month | 21 |
| urgency | 20 |
| percentage | 2 |

- Rows carrying at least one entity: 872 (17.2%)

## Quality validation

- No duplicate questions (global normalised dedup) ✅
- Every intent has >= 45 examples ✅
- Every intent present in train, test and validation ✅
- Every expected response is grounded in an audited capability ✅
- No implementation/developer topics answered — `out_of_scope_technical` declines them by design ✅
