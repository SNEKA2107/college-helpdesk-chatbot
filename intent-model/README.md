# CampusAssist — Intent Model

NLP training data and intent classifier for the Campus HelpDesk assistant.

Every intent, question and expected response is grounded in a capability that
actually exists in this repository — see [`CAPABILITY_AUDIT.md`](CAPABILITY_AUDIT.md)
for the audit that defines the scope. The assistant is a **campus help desk**,
not a software assistant: implementation topics are declined by design via the
`out_of_scope_technical` intent.

## Layout

```
intent-model/
├── CAPABILITY_AUDIT.md        what the chatbot may answer, and why
├── INTEGRATION_GUIDE.md       how to wire the model into aiAgent.js
├── intent_spec.py             78 intents: seeds, roles, grounded responses
├── generate_dataset.py        expansion → augmentation → dedup → split → report
├── train_intent_model.py      TF-IDF + 4-model comparison → evaluation → .pkl
├── data/
│   ├── train.csv  test.csv  validation.csv     4070 / 500 / 500
│   ├── intents.json  entities.json
│   ├── faq_dataset.csv  evaluation_dataset.csv
│   └── DATASET_STATISTICS.md
├── model/
│   ├── intent_model.pkl  vectorizer.pkl  label_encoder.pkl
│   ├── intent_responses.json  confusion_matrix.csv  model_meta.json
│   └── EVALUATION_REPORT.md
└── integration/
    ├── serve_intent.py        FastAPI classification sidecar
    ├── intentClassifier.js    Node client with keyword fallback
    ├── build_retrieval_map.py 78 intents → retrieve()'s 10 buckets
    └── retrieval_map.json
```

## Reproduce

```bash
pip install scikit-learn pandas numpy joblib
python generate_dataset.py      # deterministic: SEED = 20260801
python train_intent_model.py
python integration/build_retrieval_map.py
```

## Dataset

| | |
|---|---|
| Intents | 78 |
| Train / Test / Validation | 4070 / 500 / 500 |
| Total unique questions | 5070 (0 duplicates, globally normalised dedup) |
| Balance | exactly 65 per intent |
| Roles | student, faculty, admin, parent, applicant, alumni, visitor |
| Composition | 35.4% seed · 28.7% natural prefix · 20.1% synonym · 12.7% typo · 3.1% contextual follow-up |

CSV schema: `question,intent,role,entities,expected_response`.

## Model

TF-IDF (word 1–2 grams + `char_wb` 3–5 grams, 16,386 features) → Linear SVM,
calibrated for probability output.

| Model | CV acc | Val acc | Test acc | Test macro-F1 |
|---|---|---|---|---|
| **Linear SVM (selected)** | 0.9189 | **0.9360** | **0.9240** | **0.9235** |
| Logistic Regression | 0.9098 | 0.9260 | 0.9140 | 0.9134 |
| Multinomial Naive Bayes | 0.8494 | 0.8660 | 0.8780 | 0.8768 |
| Random Forest | 0.8324 | 0.8420 | 0.8300 | 0.8321 |

Character n-grams are what let the classifier absorb the misspellings real users
type — `"wats my attendence"` still resolves to `attendance_check` at 0.82.

With the confidence gate at 0.60 the model answers 85.8% of traffic at 99.3%
accuracy and defers the rest to the existing keyword router. See
[`model/EVALUATION_REPORT.md`](model/EVALUATION_REPORT.md).

## Integration in one line

The classifier decides *what is being asked*; Mongo and the existing business
logic still decide *what is true*. Read [`INTEGRATION_GUIDE.md`](INTEGRATION_GUIDE.md).
