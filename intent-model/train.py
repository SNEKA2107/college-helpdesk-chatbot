#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CampusAssist intent classifier — reproducible training pipeline.

Single entry point: three CSVs in data/ -> every artefact in model/.

    python intent-model/train.py

Discipline enforced by this script
----------------------------------
* Vectorizers are fit on TRAIN ONLY. Validation and test are transform-only.
* Model selection is decided on VALIDATION macro-F1. With 78 balanced classes,
  plain accuracy hides an intent that fails outright; macro-F1 does not.
* The confidence threshold is also chosen on VALIDATION.
* test.csv is loaded exactly once, inside final_evaluation(), after the model
  and the threshold are frozen. No earlier code path opens it, with the single
  documented exception of audit_split_disjointness(), which reads the question
  column only (no labels) to prove there is no leakage, and which cannot
  influence any modelling decision.
* Artefacts are written only if the run clears the acceptance gate, so a
  regression can never overwrite a good model.

Artefact filenames and pickle contents are a contract with
integration/serve_intent.py. Do not rename them.
"""
from __future__ import annotations

import csv
import json
import os
import platform
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix,
                             precision_recall_fscore_support)
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import FeatureUnion
from sklearn.preprocessing import LabelEncoder
from sklearn.svm import LinearSVC

# ── Configuration ────────────────────────────────────────────────────────────
SEED = 42

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MODEL = os.path.join(HERE, "model")

EXPECTED_ROWS = {"train": 4070, "validation": 500, "test": 500}
EXPECTED_INTENTS = 78

# The artefacts already in model/ scored this on test. A new run must match or
# beat it, otherwise it does not get to overwrite them.
#
# These are the EXACT values recorded in the previous model_meta.json, not their
# 4-decimal display form. The baseline is quoted elsewhere as "0.9235", which is
# the rounding of 0.9234821802129495 — gating on the rounded figure rejects a run
# that reproduces the baseline bit-for-bit, because 0.92348... < 0.9235 by 1.8e-5.
# GATE_TOLERANCE absorbs float-ordering noise across BLAS/threading differences;
# it is far smaller than any change that would matter.
BASELINE_ACCURACY = 0.924
BASELINE_MACRO_F1 = 0.9234821802129495
GATE_TOLERANCE = 1e-9

# Candidate cut-offs for the fallback threshold, evaluated on validation.
THRESHOLD_GRID = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80]
# A threshold is only worth adopting if the model is clearly more reliable above
# it than the keyword router it replaces.
TARGET_PRECISION = 0.97
MIN_COVERAGE = 0.80


def log(msg: str = "") -> None:
    print(msg, flush=True)


def rule(title: str) -> None:
    log("\n" + "=" * 78)
    log(title)
    log("=" * 78)


class DataValidationError(RuntimeError):
    """Raised when the dataset contradicts what the pipeline requires."""


# ── 1. Load and validate ─────────────────────────────────────────────────────
def load_split(name: str) -> pd.DataFrame:
    path = os.path.join(DATA, "%s.csv" % name)
    if not os.path.exists(path):
        raise DataValidationError("missing split file: %s" % path)
    df = pd.read_csv(path, encoding="utf-8", keep_default_na=False, dtype=str)
    required = {"question", "intent", "role", "entities", "expected_response"}
    missing = required - set(df.columns)
    if missing:
        raise DataValidationError("%s.csv missing columns: %s" % (name, sorted(missing)))
    df["question"] = df["question"].str.strip()
    return df


def read_questions_only(name: str) -> set:
    """
    Leakage audit helper.

    Reads ONLY the question column, discarding every label and every other
    field. Used so the disjointness check below can cover test.csv without any
    label ever entering the process before final_evaluation(). Nothing derived
    from this function reaches the model, the selection or the threshold.
    """
    path = os.path.join(DATA, "%s.csv" % name)
    with open(path, encoding="utf-8", newline="") as fh:
        return {row["question"].strip() for row in csv.DictReader(fh)}


def audit_split_disjointness() -> dict:
    qs = {s: read_questions_only(s) for s in ("train", "validation", "test")}
    overlaps = {
        "train|validation": len(qs["train"] & qs["validation"]),
        "train|test": len(qs["train"] & qs["test"]),
        "validation|test": len(qs["validation"] & qs["test"]),
    }
    for pair, n in overlaps.items():
        if n:
            raise DataValidationError("question overlap across splits %s: %d rows" % (pair, n))
    return overlaps


def validate(train: pd.DataFrame, val: pd.DataFrame, spec_intents: set) -> dict:
    """Fail loudly on any structural problem. A silent data fault costs more
    than a point of accuracy."""
    problems: list[str] = []
    facts: dict = {}

    # Row counts
    for name, df in (("train", train), ("validation", val)):
        if len(df) != EXPECTED_ROWS[name]:
            problems.append("%s row count %d != expected %d" % (name, len(df), EXPECTED_ROWS[name]))
    test_rows = len(read_questions_only("test"))
    if test_rows != EXPECTED_ROWS["test"]:
        problems.append("test row count %d != expected %d" % (test_rows, EXPECTED_ROWS["test"]))
    facts["rows"] = {"train": len(train), "validation": len(val), "test": test_rows}

    # Intent sets — train and validation must agree exactly. Test's intent set
    # is re-checked in final_evaluation(), where its labels are legitimately read.
    tr_i, va_i = set(train["intent"]), set(val["intent"])
    if len(tr_i) != EXPECTED_INTENTS:
        problems.append("train has %d distinct intents, expected %d" % (len(tr_i), EXPECTED_INTENTS))
    if tr_i != va_i:
        only_tr, only_va = sorted(tr_i - va_i), sorted(va_i - tr_i)
        problems.append("intent sets differ — train-only=%s validation-only=%s" % (only_tr, only_va))
    facts["intents"] = len(tr_i)

    # Every intent must be defined in intents.json
    undefined = sorted(tr_i - spec_intents)
    if undefined:
        problems.append("intents absent from intents.json: %s" % undefined)

    # Duplicates within a split
    for name, df in (("train", train), ("validation", val)):
        dupes = len(df) - df["question"].nunique()
        if dupes:
            problems.append("%s contains %d duplicate questions" % (name, dupes))

    # Cross-split leakage (question text only)
    facts["overlaps"] = audit_split_disjointness()

    # Real per-intent distribution — reported, not assumed
    counts = Counter(train["intent"])
    facts["train_per_intent"] = {
        "min": min(counts.values()),
        "max": max(counts.values()),
        "distribution": dict(sorted(Counter(counts.values()).items())),
    }
    empty = [i for i in tr_i if counts[i] == 0]
    if empty:
        problems.append("intents with zero training examples: %s" % empty)

    facts["roles"] = sorted(set(train["role"]))

    if problems:
        raise DataValidationError(
            "dataset validation failed:\n  - " + "\n  - ".join(problems))
    return facts


# ── 2. Features ──────────────────────────────────────────────────────────────
def build_vectorizer() -> FeatureUnion:
    """
    Word n-grams carry phrasing; character n-grams carry spelling.

    The char_wb half is load-bearing rather than decorative: 12.7% of the
    training set is deliberately typo-augmented, and word features alone cannot
    match a token they have never seen ("attendence", "libary", "certificat").
    """
    return FeatureUnion([
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2),
                                 sublinear_tf=True, min_df=1,
                                 strip_accents="unicode", lowercase=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5),
                                 sublinear_tf=True, min_df=2,
                                 strip_accents="unicode", lowercase=True)),
    ])


def candidates() -> dict:
    return {
        "LinearSVC": LinearSVC(C=1.0, random_state=SEED),
        "LogisticRegression": LogisticRegression(C=10, max_iter=2000, random_state=SEED),
        "MultinomialNB": MultinomialNB(alpha=0.08),
        "RandomForest": RandomForestClassifier(n_estimators=400, min_samples_leaf=1,
                                               n_jobs=-1, random_state=SEED),
    }


def score(y_true, y_pred) -> dict:
    p, r, f, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0)
    return {"accuracy": float(accuracy_score(y_true, y_pred)),
            "precision_macro": float(p), "recall_macro": float(r), "macro_f1": float(f)}


# ── 4. Threshold selection (on validation) ───────────────────────────────────
def threshold_table(proba, y_true) -> list:
    """For each cut-off: how much traffic the model keeps, and how accurate it
    is on the traffic it keeps. Everything below the cut-off falls through to
    the keyword router in intentClassifier.js."""
    conf = proba.max(axis=1)
    pred = proba.argmax(axis=1)
    rows = []
    for t in THRESHOLD_GRID:
        keep = conf >= t
        n = int(keep.sum())
        acc = float(accuracy_score(y_true[keep], pred[keep])) if n else float("nan")
        rows.append({"threshold": t, "answered": n,
                     "coverage": n / len(y_true), "precision": acc})
    return rows


def choose_threshold(rows: list) -> tuple:
    """Highest coverage that still clears TARGET_PRECISION, provided it retains
    at least MIN_COVERAGE of traffic. Falls back to the best precision/coverage
    compromise if nothing qualifies."""
    ok = [r for r in rows if r["precision"] >= TARGET_PRECISION and r["coverage"] >= MIN_COVERAGE]
    if ok:
        best = max(ok, key=lambda r: r["coverage"])
        why = ("highest-coverage cut-off that still reaches %.0f%% precision while "
               "keeping at least %.0f%% of traffic on the model"
               % (100 * TARGET_PRECISION, 100 * MIN_COVERAGE))
        return best, why
    best = max(rows, key=lambda r: (r["precision"], r["coverage"]))
    why = ("no cut-off met the %.0f%% precision / %.0f%% coverage target; selected the "
           "best available precision/coverage compromise"
           % (100 * TARGET_PRECISION, 100 * MIN_COVERAGE))
    return best, why


# ── 5. Final evaluation — the ONLY place test.csv is read ────────────────────
def final_evaluation(model, vectorizer, encoder) -> dict:
    test = load_split("test")

    te_i = set(test["intent"])
    if te_i != set(encoder.classes_):
        raise DataValidationError(
            "test intent set differs from the trained label set: "
            "test-only=%s model-only=%s"
            % (sorted(te_i - set(encoder.classes_)), sorted(set(encoder.classes_) - te_i)))

    X = vectorizer.transform(test["question"])
    y = encoder.transform(test["intent"])
    pred = model.predict(X)

    labels = np.arange(len(encoder.classes_))
    overall = score(y, pred)
    p, r, f, s = precision_recall_fscore_support(y, pred, labels=labels, zero_division=0)
    cm = confusion_matrix(y, pred, labels=labels)

    per_intent = sorted(
        ({"intent": encoder.classes_[i], "precision": float(p[i]), "recall": float(r[i]),
          "f1": float(f[i]), "support": int(s[i])} for i in labels),
        key=lambda d: (d["f1"], d["recall"]))

    # For each intent, the label it is most often mistaken for.
    worst = []
    for row in per_intent[:10]:
        i = list(encoder.classes_).index(row["intent"])
        off = cm[i].copy()
        off[i] = 0
        partner, n = (encoder.classes_[int(off.argmax())], int(off.max())) if off.max() > 0 else ("-", 0)
        worst.append({**row, "confused_with": partner, "confused_count": n,
                      "misclassified": int(cm[i].sum() - cm[i, i])})

    zero_recall = [d["intent"] for d in per_intent if d["recall"] == 0.0]

    return {"rows": len(test), "overall": overall, "per_intent": per_intent,
            "worst": worst, "zero_recall": zero_recall,
            "confusion": cm, "classes": list(encoder.classes_)}


# ── Reporting ────────────────────────────────────────────────────────────────
def git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=HERE,
                                       stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return "unknown"


def write_report(path, facts, comparison, selected, cal_val, thresholds,
                 chosen, why, final, dims, gate):
    L = []
    A = L.append
    A("# CampusAssist Intent Classifier — Evaluation Report\n")
    A("Generated `%s` · commit `%s` · seed `%d`\n"
      % (datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ"), git_sha()[:12], SEED))
    A("Regenerate with `python intent-model/train.py`.\n")

    A("## Dataset\n")
    A("| Split | Rows |"); A("|---|---|")
    for k in ("train", "validation", "test"):
        A("| %s | %d |" % (k, facts["rows"][k]))
    A("")
    A("- Intents: **%d**, identical across all three splits" % facts["intents"])
    d = facts["train_per_intent"]
    A("- Train examples per intent: min **%d**, max **%d** — distribution %s"
      % (d["min"], d["max"], ", ".join("%d intents x %d rows" % (v, k)
                                       for k, v in d["distribution"].items())))
    A("- Duplicate questions within any split: **0**")
    A("- Cross-split question overlap: %s"
      % ", ".join("%s = %d" % (k, v) for k, v in facts["overlaps"].items()))
    A("- Roles present: %s" % ", ".join(facts["roles"]))
    A("\nFeature space: TF-IDF word 1-2 grams + char_wb 3-5 grams -> **%d** dimensions.\n" % dims)

    A("## Model selection (validation)\n")
    A("Selection metric is **macro-F1**: with 78 balanced classes, accuracy can look "
      "healthy while an individual intent is never predicted at all.\n")
    A("| Model | Val accuracy | Val macro-F1 | Val macro-P | Val macro-R | Fit (s) |")
    A("|---|---|---|---|---|---|")
    for name, m in sorted(comparison.items(), key=lambda kv: -kv[1]["macro_f1"]):
        A("| %s%s | %.4f | %.4f | %.4f | %.4f | %.1f |"
          % (name, " **(selected)**" if name == selected else "",
             m["accuracy"], m["macro_f1"], m["precision_macro"], m["recall_macro"], m["fit_seconds"]))
    A("\nSelected: **%s**. After calibration, validation accuracy %.4f / macro-F1 %.4f.\n"
      % (selected, cal_val["accuracy"], cal_val["macro_f1"]))
    A("> `LinearSVC` exposes decision-function margins, not probabilities. The Node client "
      "needs a confidence score to decide when to fall back, so the selected model is wrapped "
      "in `CalibratedClassifierCV(method=\"sigmoid\", ensemble=False)`. `ensemble=False` fits one "
      "base estimator plus a single calibrator instead of retaining all five fold models, which "
      "keeps the pickle at a deployable size.\n")

    A("## Confidence threshold (chosen on validation)\n")
    A("Below the cut-off, `intentClassifier.js` abandons the model and falls back to keyword "
      "routing. Measured on validation — test plays no part in this choice.\n")
    A("| Threshold | Answered | Coverage | Precision on answered |")
    A("|---|---|---|---|")
    for r in thresholds:
        mark = " **<-**" if r["threshold"] == chosen["threshold"] else ""
        A("| %.2f%s | %d | %.1f%% | %.4f |"
          % (r["threshold"], mark, r["answered"], 100 * r["coverage"], r["precision"]))
    A("\n**Chosen: %.2f** — %s. At this cut-off the model answers %.1f%% of validation traffic "
      "at %.1f%% precision; the remaining %.1f%% falls through to the keyword router.\n"
      % (chosen["threshold"], why, 100 * chosen["coverage"],
         100 * chosen["precision"], 100 * (1 - chosen["coverage"])))
    A("Recorded as `confidence_threshold` in `model_meta.json`.\n")

    A("## Final test results\n")
    A("test.csv was read once, after the model and threshold were frozen.\n")
    o = final["overall"]
    A("| Metric | This run | Baseline | Delta |"); A("|---|---|---|---|")
    A("| Accuracy | %.4f | %.4f | %+.4f |"
      % (o["accuracy"], BASELINE_ACCURACY, o["accuracy"] - BASELINE_ACCURACY))
    A("| Macro-F1 | %.4f | %.4f | %+.4f |"
      % (o["macro_f1"], BASELINE_MACRO_F1, o["macro_f1"] - BASELINE_MACRO_F1))
    A("| Macro precision | %.4f | — | — |" % o["precision_macro"])
    A("| Macro recall | %.4f | — | — |" % o["recall_macro"])
    A("\nAcceptance gate: **%s**\n" % ("PASS" if gate else "FAIL"))

    A("## Ten worst intents\n")
    A("The aggregate is the least useful number here. An overall 0.92 across 78 classes "
      "means a handful of intents are close to unusable, and these are they — this table is "
      "the list of places to add training data.\n")
    A("| # | Intent | F1 | Precision | Recall | Support | Missed | Most often predicted as |")
    A("|---|---|---|---|---|---|---|---|")
    for n, w in enumerate(final["worst"], 1):
        A("| %d | `%s` | %.3f | %.3f | %.3f | %d | %d | `%s` (x%d) |"
          % (n, w["intent"], w["f1"], w["precision"], w["recall"], w["support"],
             w["misclassified"], w["confused_with"], w["confused_count"]))

    A("\n## Per-intent metrics (ascending by F1)\n")
    A("| Intent | Precision | Recall | F1 | Support |"); A("|---|---|---|---|---|")
    for d in final["per_intent"]:
        A("| `%s` | %.3f | %.3f | %.3f | %d |"
          % (d["intent"], d["precision"], d["recall"], d["f1"], d["support"]))

    A("\n## What data to add next\n")
    A("Ranked by the table above, not by intuition:\n")
    for w in final["worst"][:5]:
        if w["confused_count"]:
            A("- **`%s`** (F1 %.3f) is absorbed by `%s` %d time(s). These two share vocabulary; "
              "the fix is examples that separate them on the distinguishing phrasing, not more "
              "examples of either one in isolation."
              % (w["intent"], w["f1"], w["confused_with"], w["confused_count"]))
        else:
            A("- **`%s`** (F1 %.3f) has diffuse errors with no dominant confusion partner, "
              "which points at too little signal rather than a specific collision."
              % (w["intent"], w["f1"]))
    A("\nTwo structural notes that bound what more synthetic data can achieve:\n")
    A("- The corpus is 12.7% typo augmentation and 20.1% synonym substitution. Adding more of "
      "the same generated variation mostly re-states patterns the model has already learned.")
    A("- `QueryLog` in the running system stores real queries with intent labels and up/down "
      "ratings. That is the corpus that will move these numbers; the thumbs-down rows are "
      "already a labelled list of what this model gets wrong in production.")

    A("\n## Artefacts\n")
    A("| File | Contents |"); A("|---|---|")
    A("| `intent_model.pkl` | calibrated %s |" % selected)
    A("| `vectorizer.pkl` | fitted FeatureUnion (word + char_wb TF-IDF) |")
    A("| `label_encoder.pkl` | fitted LabelEncoder over %d intents |" % len(final["classes"]))
    A("| `intent_responses.json` | intent -> category, roles, canonical response |")
    A("| `confusion_matrix.csv` | %dx%d, labelled |" % (len(final["classes"]), len(final["classes"])))
    A("| `model_meta.json` | provenance, versions, threshold, test metrics |")

    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")


# ── Main ─────────────────────────────────────────────────────────────────────
def main() -> int:
    np.random.seed(SEED)

    rule("1. LOAD AND VALIDATE")
    with open(os.path.join(DATA, "intents.json"), encoding="utf-8") as fh:
        spec = json.load(fh)
    spec_intents = {i["intent"] for i in spec["intents"]}

    train = load_split("train")
    val = load_split("validation")
    facts = validate(train, val, spec_intents)

    log("rows            train=%d validation=%d test=%d"
        % (facts["rows"]["train"], facts["rows"]["validation"], facts["rows"]["test"]))
    log("intents         %d, identical across splits" % facts["intents"])
    d = facts["train_per_intent"]
    log("train/intent    min=%d max=%d  (%s)"
        % (d["min"], d["max"], ", ".join("%d intents x %d" % (v, k)
                                         for k, v in d["distribution"].items())))
    log("duplicates      0 within every split")
    log("cross-split     %s" % ", ".join("%s=%d" % (k, v) for k, v in facts["overlaps"].items()))
    log("roles           %s" % ", ".join(facts["roles"]))
    log("intents.json    all %d CSV intents defined" % facts["intents"])
    log("validation OK")

    rule("2. FEATURES  (fit on train only)")
    encoder = LabelEncoder().fit(sorted(set(train["intent"])))
    y_train = encoder.transform(train["intent"])
    y_val = encoder.transform(val["intent"])

    vectorizer = build_vectorizer()
    X_train = vectorizer.fit_transform(train["question"])
    X_val = vectorizer.transform(val["question"])
    dims = X_train.shape[1]
    log("dimensionality  %d  (baseline 16386, delta %+d)" % (dims, dims - 16386))

    rule("3. MODEL SELECTION  (decided on validation macro-F1)")
    import time
    comparison = {}
    fitted = {}
    for name, clf in candidates().items():
        t0 = time.time()
        clf.fit(X_train, y_train)
        secs = time.time() - t0
        m = score(y_val, clf.predict(X_val))
        m["fit_seconds"] = secs
        comparison[name] = m
        fitted[name] = clf
        log("%-20s val_acc=%.4f  val_macroF1=%.4f  (%.1fs)"
            % (name, m["accuracy"], m["macro_f1"], secs))

    selected = max(comparison, key=lambda k: comparison[k]["macro_f1"])
    log("\nselected: %s  (validation macro-F1 %.4f)" % (selected, comparison[selected]["macro_f1"]))

    rule("4. CALIBRATE AND CHOOSE THRESHOLD")
    model = CalibratedClassifierCV(fitted[selected], cv=5, method="sigmoid", ensemble=False)
    model.fit(X_train, y_train)
    cal_val = score(y_val, model.predict(X_val))
    log("calibrated      val_acc=%.4f  val_macroF1=%.4f" % (cal_val["accuracy"], cal_val["macro_f1"]))

    proba_val = model.predict_proba(X_val)
    thresholds = threshold_table(proba_val, y_val)
    log("\n threshold  answered  coverage  precision")
    for r in thresholds:
        log("     %.2f      %4d    %6.1f%%     %.4f"
            % (r["threshold"], r["answered"], 100 * r["coverage"], r["precision"]))
    chosen, why = choose_threshold(thresholds)
    log("\nchosen threshold %.2f — %s" % (chosen["threshold"], why))

    rule("5. FINAL EVALUATION  (first and only read of test.csv)")
    final = final_evaluation(model, vectorizer, encoder)
    o = final["overall"]
    log("test accuracy   %.4f   (baseline %.4f, delta %+.4f)"
        % (o["accuracy"], BASELINE_ACCURACY, o["accuracy"] - BASELINE_ACCURACY))
    log("test macro-F1   %.4f   (baseline %.4f, delta %+.4f)"
        % (o["macro_f1"], BASELINE_MACRO_F1, o["macro_f1"] - BASELINE_MACRO_F1))

    log("\nten worst intents:")
    log("  %-30s %6s %6s %6s  %s" % ("intent", "F1", "prec", "rec", "confused with"))
    for w in final["worst"]:
        log("  %-30s %.3f  %.3f  %.3f  %s (x%d)"
            % (w["intent"], w["f1"], w["precision"], w["recall"],
               w["confused_with"], w["confused_count"]))

    # ── Acceptance gate ──────────────────────────────────────────────────────
    rule("6. ACCEPTANCE GATE")
    failures = []
    meets_baseline = o["macro_f1"] >= BASELINE_MACRO_F1 - GATE_TOLERANCE
    if not meets_baseline:
        failures.append("test macro-F1 %.10f < baseline %.10f"
                        % (o["macro_f1"], BASELINE_MACRO_F1))
    if final["zero_recall"]:
        failures.append("intents never predicted (zero recall): %s" % final["zero_recall"])

    log("  macro-F1 this run %.10f  vs baseline %.10f  (delta %+.2e)"
        % (o["macro_f1"], BASELINE_MACRO_F1, o["macro_f1"] - BASELINE_MACRO_F1))
    for check, ok in (("macro-F1 >= baseline", meets_baseline),
                      ("every intent has non-zero recall", not final["zero_recall"])):
        log("  [%s] %s" % ("PASS" if ok else "FAIL", check))

    if failures:
        log("\nGATE FAILED — existing artefacts left untouched:")
        for f in failures:
            log("  - %s" % f)
        return 1

    # ── Write artefacts ──────────────────────────────────────────────────────
    rule("7. WRITE ARTEFACTS")
    os.makedirs(MODEL, exist_ok=True)

    joblib.dump(model, os.path.join(MODEL, "intent_model.pkl"), compress=3)
    joblib.dump(vectorizer, os.path.join(MODEL, "vectorizer.pkl"), compress=3)
    joblib.dump(encoder, os.path.join(MODEL, "label_encoder.pkl"), compress=3)

    # Shape is a contract with serve_intent.py, which reads ["category"].
    responses = {i["intent"]: {"category": i["category"], "roles": i["roles"],
                               "response": i["response"]} for i in spec["intents"]}
    with open(os.path.join(MODEL, "intent_responses.json"), "w", encoding="utf-8") as fh:
        json.dump(responses, fh, indent=2, ensure_ascii=False)

    pd.DataFrame(final["confusion"], index=final["classes"], columns=final["classes"]) \
        .to_csv(os.path.join(MODEL, "confusion_matrix.csv"), encoding="utf-8")

    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_commit": git_sha(),
        "random_state": SEED,
        "python_version": platform.python_version(),
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
        "pandas_version": pd.__version__,
        "joblib_version": joblib.__version__,
        "algorithm": selected,
        "calibration": "CalibratedClassifierCV(method='sigmoid', ensemble=False, cv=5)",
        "hyperparameters": {k: str(v) for k, v in fitted[selected].get_params().items()},
        "vectorizer": {
            "type": "FeatureUnion",
            "word": "TfidfVectorizer(analyzer='word', ngram_range=(1,2), sublinear_tf=True, min_df=1)",
            "char": "TfidfVectorizer(analyzer='char_wb', ngram_range=(3,5), sublinear_tf=True, min_df=2)",
            "n_features": int(dims),
        },
        "intents": len(final["classes"]),
        "rows": facts["rows"],
        "confidence_threshold": chosen["threshold"],
        "confidence_threshold_basis": {
            "selected_on": "validation",
            "coverage": round(chosen["coverage"], 4),
            "precision_on_answered": round(chosen["precision"], 4),
            "rationale": why,
        },
        "validation_metrics": {k: round(v, 6) for k, v in cal_val.items()},
        "test_metrics": {k: round(v, 6) for k, v in o.items()},
        "baseline": {"accuracy": BASELINE_ACCURACY, "macro_f1": BASELINE_MACRO_F1},
        "sklearn_artifacts": ["intent_model.pkl", "vectorizer.pkl", "label_encoder.pkl"],
    }
    with open(os.path.join(MODEL, "model_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    write_report(os.path.join(MODEL, "EVALUATION_REPORT.md"), facts, comparison, selected,
                 cal_val, thresholds, chosen, why, final, dims, gate=True)

    for f in ("intent_model.pkl", "vectorizer.pkl", "label_encoder.pkl",
              "intent_responses.json", "confusion_matrix.csv", "model_meta.json",
              "EVALUATION_REPORT.md"):
        log("  %-24s %8.1f KB" % (f, os.path.getsize(os.path.join(MODEL, f)) / 1024))

    log("\nDone. Artefacts written to %s" % MODEL)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except DataValidationError as exc:
        log("\nDATA VALIDATION ERROR\n%s" % exc)
        sys.exit(2)
