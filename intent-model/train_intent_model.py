# -*- coding: utf-8 -*-
"""
CampusAssist HelpDesk — intent classifier.

Loads the generated dataset, vectorises with TF-IDF (word + character n-grams),
compares four classifiers, evaluates the winner on the held-out test split and
persists the artefacts the Node backend loads at inference time.

Outputs (in ./model):
    intent_model.pkl    fitted classifier
    vectorizer.pkl      fitted TF-IDF vectorizer
    label_encoder.pkl   intent label encoder
    intent_responses.json   intent -> grounded response + category
    EVALUATION_REPORT.md
    confusion_matrix.csv

Run:  python train_intent_model.py
"""
import csv, json, os, sys, time
import numpy as np
import pandas as pd
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion
from sklearn.preprocessing import LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, precision_recall_fscore_support,
                             classification_report, confusion_matrix)
from sklearn.model_selection import cross_val_score
from sklearn.calibration import CalibratedClassifierCV

HERE  = os.path.dirname(os.path.abspath(__file__))
DATA  = os.path.join(HERE, "data")
MODEL = os.path.join(HERE, "model")
os.makedirs(MODEL, exist_ok=True)
RANDOM_STATE = 42

# ── 1. Load ──────────────────────────────────────────────────────────────────
def load(split):
    df = pd.read_csv(os.path.join(DATA, "%s.csv" % split), encoding="utf-8")
    df["question"] = df["question"].astype(str).str.strip()
    return df

train, test, val = load("train"), load("test"), load("validation")
print("Loaded  train=%d  test=%d  validation=%d  intents=%d"
      % (len(train), len(test), len(val), train["intent"].nunique()))

le = LabelEncoder().fit(pd.concat([train, test, val])["intent"])
y_train, y_test, y_val = (le.transform(d["intent"]) for d in (train, test, val))

# ── 2. Vectorise ─────────────────────────────────────────────────────────────
# Word n-grams capture phrasing; character n-grams absorb the misspellings that
# real help-desk users type ("attendence", "libary", "certificat").
vectorizer = FeatureUnion([
    ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True,
                             min_df=1, strip_accents="unicode", lowercase=True)),
    ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True,
                             min_df=2, strip_accents="unicode", lowercase=True)),
])
X_train = vectorizer.fit_transform(train["question"])
X_test  = vectorizer.transform(test["question"])
X_val   = vectorizer.transform(val["question"])
print("TF-IDF feature space: %d features" % X_train.shape[1])

# ── 3. Compare models ────────────────────────────────────────────────────────
MODELS = {
    "Logistic Regression":     LogisticRegression(C=10, max_iter=2000, random_state=RANDOM_STATE),
    "Linear SVM":              LinearSVC(C=1.0, random_state=RANDOM_STATE),
    "Multinomial Naive Bayes": MultinomialNB(alpha=0.08),
    "Random Forest":           RandomForestClassifier(n_estimators=400, min_samples_leaf=1,
                                                      n_jobs=-1, random_state=RANDOM_STATE),
}

def metrics(y_true, y_pred):
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    pw, rw, fw, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)
    return dict(accuracy=accuracy_score(y_true, y_pred),
                precision=p, recall=r, f1=f,
                precision_w=pw, recall_w=rw, f1_w=fw)

results = {}
for name, clf in MODELS.items():
    t0 = time.time()
    clf.fit(X_train, y_train)
    fit_s = time.time() - t0
    res = dict(val=metrics(y_val, clf.predict(X_val)),
               test=metrics(y_test, clf.predict(X_test)),
               fit_seconds=fit_s, model=clf)
    cv = cross_val_score(clf, X_train, y_train, cv=5, scoring="accuracy", n_jobs=-1)
    res["cv_mean"], res["cv_std"] = cv.mean(), cv.std()
    results[name] = res
    print("%-24s val_acc=%.4f  test_acc=%.4f  test_f1=%.4f  cv=%.4f±%.4f  (%.1fs)"
          % (name, res["val"]["accuracy"], res["test"]["accuracy"],
             res["test"]["f1"], res["cv_mean"], res["cv_std"], fit_s))

# Selection is on VALIDATION accuracy; test stays a clean held-out estimate.
best_name = max(results, key=lambda k: results[k]["val"]["accuracy"])
best = results[best_name]["model"]
print("\nSelected: %s (validation accuracy %.4f)" % (best_name, results[best_name]["val"]["accuracy"]))

# ── 3b. Calibrate ────────────────────────────────────────────────────────────
# The deployed model must expose predict_proba: the backend only accepts a
# predicted intent above a confidence threshold and otherwise falls back to the
# existing keyword router. LinearSVC gives margins, not probabilities, so wrap it.
calibrated = False
if not hasattr(best, "predict_proba"):
    print("Calibrating %s for probability output..." % best_name)
    # ensemble=False fits ONE base estimator on all the data plus a single
    # calibrator from cross-validated predictions. The default (ensemble=True)
    # keeps all 5 fold-models, which made the pickle ~5x larger for no gain.
    best = CalibratedClassifierCV(results[best_name]["model"], cv=5,
                                  method="sigmoid", ensemble=False)
    best.fit(X_train, y_train)
    calibrated = True
    cal_val, cal_test = metrics(y_val, best.predict(X_val)), metrics(y_test, best.predict(X_test))
    print("  calibrated  val_acc=%.4f  test_acc=%.4f  test_f1=%.4f"
          % (cal_val["accuracy"], cal_test["accuracy"], cal_test["f1"]))
    results[best_name]["val"], results[best_name]["test"] = cal_val, cal_test

# Confidence-threshold analysis: at each cut-off, how much traffic the model
# answers on its own and how accurate it is on that traffic.
proba_test = best.predict_proba(X_test)
conf = proba_test.max(axis=1)
pred_test = best.predict(X_test)
thresholds = [0.0, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80]
threshold_rows = []
for t in thresholds:
    keep = conf >= t
    n = int(keep.sum())
    acc = accuracy_score(y_test[keep], pred_test[keep]) if n else float("nan")
    threshold_rows.append((t, n, 100.0 * n / len(y_test), acc))

# ── 4. Evaluate the winner ───────────────────────────────────────────────────
y_pred = best.predict(X_test)
labels = np.arange(len(le.classes_))
report_txt = classification_report(y_test, y_pred, labels=labels,
                                   target_names=le.classes_, zero_division=0, digits=3)
cm = confusion_matrix(y_test, y_pred, labels=labels)

pd.DataFrame(cm, index=le.classes_, columns=le.classes_)\
  .to_csv(os.path.join(MODEL, "confusion_matrix.csv"), encoding="utf-8")

# Every off-diagonal cell, so confusable intents are actionable rather than buried.
confusions = [(le.classes_[i], le.classes_[j], int(cm[i, j]))
              for i in range(len(cm)) for j in range(len(cm))
              if i != j and cm[i, j] > 0]
confusions.sort(key=lambda t: -t[2])

# Per-class recall on the test split, to surface the weakest intents.
per_class = precision_recall_fscore_support(y_test, y_pred, labels=labels, zero_division=0)
weakest = sorted(zip(le.classes_, per_class[0], per_class[1], per_class[2], per_class[3]),
                 key=lambda t: (t[3], t[2]))[:12]

# ── 5. Persist ───────────────────────────────────────────────────────────────
joblib.dump(best,        os.path.join(MODEL, "intent_model.pkl"),  compress=3)
joblib.dump(vectorizer,  os.path.join(MODEL, "vectorizer.pkl"),    compress=3)
joblib.dump(le,          os.path.join(MODEL, "label_encoder.pkl"), compress=3)
for _f in ("intent_model.pkl", "vectorizer.pkl", "label_encoder.pkl"):
    print("  %-20s %6.1f MB" % (_f, os.path.getsize(os.path.join(MODEL, _f)) / 1e6))

with open(os.path.join(DATA, "intents.json"), encoding="utf-8") as f:
    spec = json.load(f)
responses = {i["intent"]: {"category": i["category"], "roles": i["roles"],
                           "response": i["response"]} for i in spec["intents"]}
with open(os.path.join(MODEL, "intent_responses.json"), "w", encoding="utf-8") as f:
    json.dump(responses, f, indent=2, ensure_ascii=False)

meta = dict(best_model=best_name, random_state=RANDOM_STATE,
            features=int(X_train.shape[1]), intents=len(le.classes_),
            train_rows=len(train), test_rows=len(test), val_rows=len(val),
            test_accuracy=results[best_name]["test"]["accuracy"],
            test_macro_f1=results[best_name]["test"]["f1"],
            sklearn_artifacts=["intent_model.pkl", "vectorizer.pkl", "label_encoder.pkl"])
with open(os.path.join(MODEL, "model_meta.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)

# ── 6. Report ────────────────────────────────────────────────────────────────
L = []
A = L.append
A("# CampusAssist Intent Classifier — Evaluation Report\n")
A("Dataset: **%d train / %d test / %d validation** across **%d intents**."
  % (len(train), len(test), len(val), len(le.classes_)))
A("Features: TF-IDF word 1-2 grams + char_wb 3-5 grams -> **%d** dimensions.\n" % X_train.shape[1])

A("## Model comparison\n")
A("| Model | CV acc (5-fold) | Val acc | Test acc | Test precision | Test recall | Test F1 | Fit (s) |")
A("|---|---|---|---|---|---|---|---|")
for n, r in sorted(results.items(), key=lambda kv: -kv[1]["val"]["accuracy"]):
    A("| %s%s | %.4f ± %.4f | %.4f | %.4f | %.4f | %.4f | %.4f | %.1f |"
      % (n, " **(selected)**" if n == best_name else "", r["cv_mean"], r["cv_std"],
         r["val"]["accuracy"], r["test"]["accuracy"], r["test"]["precision"],
         r["test"]["recall"], r["test"]["f1"], r["fit_seconds"]))
A("\nPrecision / recall / F1 are **macro-averaged** (every intent weighted equally, "
  "which is the honest measure on a balanced 78-class problem). Weighted F1 for the "
  "selected model: **%.4f**.\n" % results[best_name]["test"]["f1_w"])

A("## Selected model — %s\n" % best_name)
m = results[best_name]["test"]
A("| Metric | Test |"); A("|---|---|")
A("| Accuracy | %.4f |" % m["accuracy"])
A("| Precision (macro) | %.4f |" % m["precision"])
A("| Recall (macro) | %.4f |" % m["recall"])
A("| F1 (macro) | %.4f |" % m["f1"])
A("| F1 (weighted) | %.4f |" % m["f1_w"])

if calibrated:
    A("\n> The selected model is wrapped in `CalibratedClassifierCV` (sigmoid, 5-fold) "
      "so it exposes `predict_proba`. The backend needs a confidence score to decide "
      "when to trust the classifier and when to fall back to the existing keyword router.\n")

A("\n## Confidence threshold analysis (test split)\n")
A("Use this to pick the production cut-off: below it, defer to the existing "
  "keyword router instead of trusting the classifier.\n")
A("| Threshold | Answered | Coverage | Accuracy on answered |"); A("|---|---|---|---|")
for t, n, covpct, acc in threshold_rows:
    A("| %.2f | %d | %.1f%% | %.4f |" % (t, n, covpct, acc))
_rec = max((r for r in threshold_rows if r[3] >= 0.95), key=lambda r: r[2], default=None)
if _rec:
    A("\n**Recommended cut-off: %.2f** — answers %.1f%% of traffic at %.1f%% accuracy; "
      "the remainder falls through to the keyword router." % (_rec[0], _rec[2], 100 * _rec[3]))
else:
    A("\nNo threshold reaches 95%% accuracy on this split; keep the cut-off at 0.50 "
      "and let the fallback handle the rest.")

A("\n## Weakest intents (test split)\n")
A("| Intent | Precision | Recall | F1 | Support |"); A("|---|---|---|---|---|")
for name, p, r, f, s in weakest:
    A("| `%s` | %.3f | %.3f | %.3f | %d |" % (name, p, r, f, s))

A("\n## Confusion matrix\n")
A("Full 78x78 matrix: `model/confusion_matrix.csv`. Off-diagonal pairs:\n")
if confusions:
    A("| True intent | Predicted as | Count |"); A("|---|---|---|")
    for a, b, c in confusions[:25]:
        A("| `%s` | `%s` | %d |" % (a, b, c))
    A("\nTotal misclassified: **%d / %d**." % (sum(c for *_, c in confusions), len(test)))
else:
    A("No off-diagonal entries — every test question was classified correctly.")

A("\n## Per-class report\n"); A("```"); A(report_txt); A("```")
A("\n## Artefacts\n")
A("- `model/intent_model.pkl` — fitted %s" % best_name)
A("- `model/vectorizer.pkl` — fitted TF-IDF FeatureUnion")
A("- `model/label_encoder.pkl` — intent label encoder")
A("- `model/intent_responses.json` — intent -> grounded response + category")
A("- `model/confusion_matrix.csv`, `model/model_meta.json`")

with open(os.path.join(MODEL, "EVALUATION_REPORT.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(L) + "\n")

print("\nTest accuracy %.4f | macro-F1 %.4f | misclassified %d/%d"
      % (m["accuracy"], m["f1"], sum(c for *_, c in confusions), len(test)))
print("Artefacts written to %s" % MODEL)

# ── 7. Smoke test ────────────────────────────────────────────────────────────
print("\nSanity predictions:")
for q in ["how much attendance do i have", "wen is my hall ticket avilable",
          "i forgot my password", "which companies can i apply to",
          "what database do you use", "hi there", "is my bonafide ready",
          "can i see my daughter's marks", "library timing"]:
    X = vectorizer.transform([q])
    p = best.predict_proba(X)[0]
    print("  %-38s -> %-24s (%.2f)" % (q, le.inverse_transform([p.argmax()])[0], p.max()))
