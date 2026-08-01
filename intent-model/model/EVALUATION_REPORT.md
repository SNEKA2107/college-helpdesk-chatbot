# CampusAssist Intent Classifier — Evaluation Report

Generated `2026-08-01 11:59:44Z` · commit `3348fd8c72ef` · seed `42`

Regenerate with `python intent-model/train.py`.

## Dataset

| Split | Rows |
|---|---|
| train | 4070 |
| validation | 500 |
| test | 500 |

- Intents: **78**, identical across all three splits
- Train examples per intent: min **51**, max **53** — distribution 32 intents x 51 rows, 46 intents x 53 rows
- Duplicate questions within any split: **0**
- Cross-split question overlap: train|validation = 0, train|test = 0, validation|test = 0
- Roles present: admin, alumni, applicant, faculty, parent, student, visitor

Feature space: TF-IDF word 1-2 grams + char_wb 3-5 grams -> **16386** dimensions.

## Model selection (validation)

Selection metric is **macro-F1**: with 78 balanced classes, accuracy can look healthy while an individual intent is never predicted at all.

| Model | Val accuracy | Val macro-F1 | Val macro-P | Val macro-R | Fit (s) |
|---|---|---|---|---|---|
| LinearSVC **(selected)** | 0.9340 | 0.9340 | 0.9415 | 0.9353 | 0.4 |
| LogisticRegression | 0.9260 | 0.9264 | 0.9352 | 0.9280 | 3.0 |
| MultinomialNB | 0.8660 | 0.8666 | 0.8835 | 0.8666 | 0.0 |
| RandomForest | 0.8420 | 0.8424 | 0.8575 | 0.8446 | 1.9 |

Selected: **LinearSVC**. After calibration, validation accuracy 0.9360 / macro-F1 0.9364.

> `LinearSVC` exposes decision-function margins, not probabilities. The Node client needs a confidence score to decide when to fall back, so the selected model is wrapped in `CalibratedClassifierCV(method="sigmoid", ensemble=False)`. `ensemble=False` fits one base estimator plus a single calibrator instead of retaining all five fold models, which keeps the pickle at a deployable size.

## Confidence threshold (chosen on validation)

Below the cut-off, `intentClassifier.js` abandons the model and falls back to keyword routing. Measured on validation — test plays no part in this choice.

| Threshold | Answered | Coverage | Precision on answered |
|---|---|---|---|
| 0.30 | 493 | 98.6% | 0.9412 |
| 0.40 | 490 | 98.0% | 0.9449 |
| 0.50 | 479 | 95.8% | 0.9478 |
| 0.60 | 459 | 91.8% | 0.9564 |
| 0.70 **<-** | 432 | 86.4% | 0.9792 |
| 0.80 | 407 | 81.4% | 0.9828 |

**Chosen: 0.70** — highest-coverage cut-off that still reaches 97% precision while keeping at least 80% of traffic on the model. At this cut-off the model answers 86.4% of validation traffic at 97.9% precision; the remaining 13.6% falls through to the keyword router.

Recorded as `confidence_threshold` in `model_meta.json`.

## Final test results

test.csv was read once, after the model and threshold were frozen.

| Metric | This run | Baseline | Delta |
|---|---|---|---|
| Accuracy | 0.9240 | 0.9240 | +0.0000 |
| Macro-F1 | 0.9235 | 0.9235 | +0.0000 |
| Macro precision | 0.9345 | — | — |
| Macro recall | 0.9249 | — | — |

Acceptance gate: **PASS**

## Ten worst intents

The aggregate is the least useful number here. An overall 0.92 across 78 classes means a handful of intents are close to unusable, and these are they — this table is the list of places to add training data.

| # | Intent | F1 | Precision | Recall | Support | Missed | Most often predicted as |
|---|---|---|---|---|---|---|---|
| 1 | `admin_audit_log` | 0.667 | 1.000 | 0.500 | 6 | 3 | `fees_history` (x2) |
| 2 | `faculty_approve_leave` | 0.667 | 0.667 | 0.667 | 6 | 2 | `admin_approve_students` (x2) |
| 3 | `fallback_unsupported` | 0.727 | 0.800 | 0.667 | 6 | 2 | `bot_capabilities` (x2) |
| 4 | `fees_due_date` | 0.769 | 0.833 | 0.714 | 7 | 2 | `fees_balance` (x1) |
| 5 | `bot_capabilities` | 0.769 | 0.714 | 0.833 | 6 | 1 | `thanks_goodbye` (x1) |
| 6 | `parent_ward_progress` | 0.769 | 0.714 | 0.833 | 6 | 1 | `admin_verify_fees` (x1) |
| 7 | `faculty_my_classes` | 0.800 | 1.000 | 0.667 | 6 | 2 | `greeting` (x1) |
| 8 | `profile_update` | 0.800 | 1.000 | 0.667 | 6 | 2 | `parent_ward_progress` (x2) |
| 9 | `attendance_subject_wise` | 0.800 | 0.750 | 0.857 | 7 | 1 | `backlog_query` (x1) |
| 10 | `fees_balance` | 0.800 | 0.750 | 0.857 | 7 | 1 | `fees_due_date` (x1) |

## Per-intent metrics (ascending by F1)

| Intent | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| `admin_audit_log` | 1.000 | 0.500 | 0.667 | 6 |
| `faculty_approve_leave` | 0.667 | 0.667 | 0.667 | 6 |
| `fallback_unsupported` | 0.800 | 0.667 | 0.727 | 6 |
| `fees_due_date` | 0.833 | 0.714 | 0.769 | 7 |
| `bot_capabilities` | 0.714 | 0.833 | 0.769 | 6 |
| `parent_ward_progress` | 0.714 | 0.833 | 0.769 | 6 |
| `faculty_my_classes` | 1.000 | 0.667 | 0.800 | 6 |
| `profile_update` | 1.000 | 0.667 | 0.800 | 6 |
| `attendance_subject_wise` | 0.750 | 0.857 | 0.800 | 7 |
| `fees_balance` | 0.750 | 0.857 | 0.800 | 7 |
| `performance_summary` | 0.667 | 1.000 | 0.800 | 6 |
| `cgpa_query` | 1.000 | 0.714 | 0.833 | 7 |
| `leave_status` | 1.000 | 0.714 | 0.833 | 7 |
| `library_borrowed` | 1.000 | 0.714 | 0.833 | 7 |
| `attendance_check` | 0.857 | 0.857 | 0.857 | 7 |
| `backlog_query` | 0.857 | 0.857 | 0.857 | 7 |
| `request_status` | 0.857 | 0.857 | 0.857 | 7 |
| `admin_approve_students` | 0.750 | 1.000 | 0.857 | 6 |
| `admin_verify_fees` | 0.750 | 1.000 | 0.857 | 6 |
| `thanks_goodbye` | 0.750 | 1.000 | 0.857 | 6 |
| `fees_history` | 0.778 | 1.000 | 0.875 | 7 |
| `admin_analytics` | 1.000 | 0.833 | 0.909 | 6 |
| `contact_department` | 1.000 | 0.833 | 0.909 | 6 |
| `events_register` | 1.000 | 0.833 | 0.909 | 6 |
| `knowledge_base_query` | 1.000 | 0.833 | 0.909 | 6 |
| `password_reset` | 1.000 | 0.833 | 0.909 | 6 |
| `exam_hall_ticket` | 1.000 | 0.857 | 0.923 | 7 |
| `exam_schedule` | 1.000 | 0.857 | 0.923 | 7 |
| `library_renew` | 1.000 | 0.857 | 0.923 | 7 |
| `marks_view` | 1.000 | 0.857 | 0.923 | 7 |
| `notices_latest` | 1.000 | 0.857 | 0.923 | 7 |
| `od_request` | 1.000 | 0.857 | 0.923 | 7 |
| `timetable_weekly` | 1.000 | 0.857 | 0.923 | 7 |
| `admin_manage_timetable` | 0.857 | 1.000 | 0.923 | 6 |
| `admin_process_requests` | 0.857 | 1.000 | 0.923 | 6 |
| `admin_publish_notice` | 0.857 | 1.000 | 0.923 | 6 |
| `admission_enquiry` | 0.857 | 1.000 | 0.923 | 6 |
| `greeting` | 0.857 | 1.000 | 0.923 | 6 |
| `registration_approval` | 0.857 | 1.000 | 0.923 | 6 |
| `academic_calendar` | 0.875 | 1.000 | 0.933 | 7 |
| `leave_apply` | 0.875 | 1.000 | 0.933 | 7 |
| `library_hours` | 0.875 | 1.000 | 0.933 | 7 |
| `library_search` | 0.875 | 1.000 | 0.933 | 7 |
| `results_status` | 0.875 | 1.000 | 0.933 | 7 |
| `timetable_today` | 0.875 | 1.000 | 0.933 | 7 |
| `account_status` | 1.000 | 1.000 | 1.000 | 6 |
| `admin_knowledge_manage` | 1.000 | 1.000 | 1.000 | 6 |
| `admin_publish_exam` | 1.000 | 1.000 | 1.000 | 6 |
| `alumni_records` | 1.000 | 1.000 | 1.000 | 6 |
| `attendance_shortage` | 1.000 | 1.000 | 1.000 | 7 |
| `certificate_request` | 1.000 | 1.000 | 1.000 | 7 |
| `coursework_assignments` | 1.000 | 1.000 | 1.000 | 7 |
| `coursework_materials` | 1.000 | 1.000 | 1.000 | 7 |
| `departments_list` | 1.000 | 1.000 | 1.000 | 6 |
| `events_list` | 1.000 | 1.000 | 1.000 | 7 |
| `exam_practicals` | 1.000 | 1.000 | 1.000 | 7 |
| `faculty_analytics` | 1.000 | 1.000 | 1.000 | 6 |
| `faculty_assignments_manage` | 1.000 | 1.000 | 1.000 | 6 |
| `faculty_directory` | 1.000 | 1.000 | 1.000 | 6 |
| `faculty_enter_marks` | 1.000 | 1.000 | 1.000 | 6 |
| `faculty_hod` | 1.000 | 1.000 | 1.000 | 6 |
| `faculty_mark_attendance` | 1.000 | 1.000 | 1.000 | 6 |
| `faculty_materials_upload` | 1.000 | 1.000 | 1.000 | 6 |
| `fees_payment` | 1.000 | 1.000 | 1.000 | 7 |
| `fees_verification` | 1.000 | 1.000 | 1.000 | 7 |
| `hostel_info` | 1.000 | 1.000 | 1.000 | 6 |
| `login_help` | 1.000 | 1.000 | 1.000 | 6 |
| `notice_search` | 1.000 | 1.000 | 1.000 | 7 |
| `out_of_scope_technical` | 1.000 | 1.000 | 1.000 | 6 |
| `placement_companies` | 1.000 | 1.000 | 1.000 | 6 |
| `placement_eligibility` | 1.000 | 1.000 | 1.000 | 6 |
| `placement_readiness` | 1.000 | 1.000 | 1.000 | 6 |
| `placement_skills` | 1.000 | 1.000 | 1.000 | 6 |
| `profile_view` | 1.000 | 1.000 | 1.000 | 6 |
| `scholarship_info` | 1.000 | 1.000 | 1.000 | 6 |
| `settings_help` | 1.000 | 1.000 | 1.000 | 6 |
| `transport_info` | 1.000 | 1.000 | 1.000 | 6 |
| `visitor_campus_info` | 1.000 | 1.000 | 1.000 | 6 |

## What data to add next

Ranked by the table above, not by intuition:

- **`admin_audit_log`** (F1 0.667) is absorbed by `fees_history` 2 time(s). These two share vocabulary; the fix is examples that separate them on the distinguishing phrasing, not more examples of either one in isolation.
- **`faculty_approve_leave`** (F1 0.667) is absorbed by `admin_approve_students` 2 time(s). These two share vocabulary; the fix is examples that separate them on the distinguishing phrasing, not more examples of either one in isolation.
- **`fallback_unsupported`** (F1 0.727) is absorbed by `bot_capabilities` 2 time(s). These two share vocabulary; the fix is examples that separate them on the distinguishing phrasing, not more examples of either one in isolation.
- **`fees_due_date`** (F1 0.769) is absorbed by `fees_balance` 1 time(s). These two share vocabulary; the fix is examples that separate them on the distinguishing phrasing, not more examples of either one in isolation.
- **`bot_capabilities`** (F1 0.769) is absorbed by `thanks_goodbye` 1 time(s). These two share vocabulary; the fix is examples that separate them on the distinguishing phrasing, not more examples of either one in isolation.

Two structural notes that bound what more synthetic data can achieve:

- The corpus is 12.7% typo augmentation and 20.1% synonym substitution. Adding more of the same generated variation mostly re-states patterns the model has already learned.
- `QueryLog` in the running system stores real queries with intent labels and up/down ratings. That is the corpus that will move these numbers; the thumbs-down rows are already a labelled list of what this model gets wrong in production.

## Artefacts

| File | Contents |
|---|---|
| `intent_model.pkl` | calibrated LinearSVC |
| `vectorizer.pkl` | fitted FeatureUnion (word + char_wb TF-IDF) |
| `label_encoder.pkl` | fitted LabelEncoder over 78 intents |
| `intent_responses.json` | intent -> category, roles, canonical response |
| `confusion_matrix.csv` | 78x78, labelled |
| `model_meta.json` | provenance, versions, threshold, test metrics |
