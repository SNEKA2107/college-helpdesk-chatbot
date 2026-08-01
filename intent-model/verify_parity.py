#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Gate the pure-JS port against scikit-learn.

Scores every question in train + validation + test (5,070 rows) with both
implementations and requires an identical predicted intent on every single one.
The JS port is only fit to deploy if this passes; a reimplemented char_wb
analyzer that is subtly wrong shows up here as a handful of flipped intents
rather than as quiet misrouting in production.

Also cross-checks the analyzers term-for-term on a sample, so a failure points
at the specific tokeniser that diverged.

    python intent-model/verify_parity.py

Exit codes: 0 pass · 1 mismatch · 2 harness error
"""
import json
import os
import subprocess
import sys
import tempfile

import joblib
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MODEL = os.path.join(HERE, "model")

# float32 coefficients and a different summation order make bitwise equality
# impossible; anything under this is numerical noise, not a logic difference.
CONF_TOLERANCE = 1e-5
ANALYZER_SAMPLE = 400


def load_questions():
    frames = [pd.read_csv(os.path.join(DATA, "%s.csv" % s), encoding="utf-8",
                          keep_default_na=False, dtype=str)
              for s in ("train", "validation", "test")]
    qs = pd.concat(frames)["question"].astype(str).str.strip().tolist()
    return qs


def main() -> int:
    clf = joblib.load(os.path.join(MODEL, "intent_model.pkl"))
    vec = joblib.load(os.path.join(MODEL, "vectorizer.pkl"))
    enc = joblib.load(os.path.join(MODEL, "label_encoder.pkl"))

    questions = load_questions()
    print("questions: %d" % len(questions))

    # ── Python side ─────────────────────────────────────────────────────────
    X = vec.transform(questions)
    proba = clf.predict_proba(X)
    py_idx = proba.argmax(axis=1)
    py_intent = enc.inverse_transform(py_idx)
    py_conf = proba.max(axis=1)

    # ── JS side ─────────────────────────────────────────────────────────────
    tmp = tempfile.mkdtemp(prefix="parity-")
    in_path, out_path = os.path.join(tmp, "in.json"), os.path.join(tmp, "out.json")
    with open(in_path, "w", encoding="utf-8") as fh:
        json.dump(questions, fh, ensure_ascii=False)

    proc = subprocess.run(
        ["node", os.path.join(HERE, "parity_runner.js"), in_path, out_path],
        capture_output=True, text=True)
    if proc.returncode != 0:
        print("node runner failed (exit %d)\n%s" % (proc.returncode, proc.stderr))
        return 2
    print(proc.stderr.strip())
    with open(out_path, encoding="utf-8") as fh:
        js = json.load(fh)

    if len(js) != len(questions):
        print("length mismatch: js=%d python=%d" % (len(js), len(questions)))
        return 2

    # ── Compare ─────────────────────────────────────────────────────────────
    js_intent = [r["intent"] for r in js]
    js_conf = np.array([r["confidence"] for r in js])

    mismatches = [i for i in range(len(questions)) if js_intent[i] != py_intent[i]]
    conf_delta = np.abs(js_conf - py_conf)
    over_tol = int((conf_delta > CONF_TOLERANCE).sum())
    empty = [i for i, r in enumerate(js) if r["nActive"] == 0]

    print("\nintent agreement : %d / %d  (%.4f%%)"
          % (len(questions) - len(mismatches), len(questions),
             100 * (len(questions) - len(mismatches)) / len(questions)))
    print("confidence delta : max %.3e  mean %.3e  over tolerance(%.0e): %d"
          % (conf_delta.max(), conf_delta.mean(), CONF_TOLERANCE, over_tol))
    print("rows with no recognised features: %d" % len(empty))

    if mismatches:
        print("\nfirst mismatches:")
        for i in mismatches[:15]:
            print("  %-58s py=%-26s js=%-26s (py %.4f / js %.4f)"
                  % (questions[i][:57], py_intent[i], js_intent[i], py_conf[i], js_conf[i]))

    # ── Analyzer cross-check ────────────────────────────────────────────────
    print("\nanalyzer cross-check on %d sampled questions..." % ANALYZER_SAMPLE)
    rng = np.random.RandomState(0)
    sample = [questions[i] for i in rng.choice(len(questions), ANALYZER_SAMPLE, replace=False)]
    with open(in_path, "w", encoding="utf-8") as fh:
        json.dump(sample, fh, ensure_ascii=False)
    proc = subprocess.run(
        ["node", os.path.join(HERE, "parity_runner.js"), in_path, out_path, "--analyzers"],
        capture_output=True, text=True)
    if proc.returncode != 0:
        print("analyzer run failed:\n%s" % proc.stderr)
        return 2
    with open(out_path, encoding="utf-8") as fh:
        js_an = json.load(fh)

    word_an = vec.transformer_list[0][1].build_analyzer()
    char_an = vec.transformer_list[1][1].build_analyzer()
    word_bad = char_bad = 0
    first_bad = None
    for q, r in zip(sample, js_an):
        if word_an(q) != r["word"]:
            word_bad += 1
            first_bad = first_bad or ("word", q, word_an(q), r["word"])
        if char_an(q) != r["char"]:
            char_bad += 1
            first_bad = first_bad or ("char_wb", q, char_an(q), r["char"])
    print("  word 1-2 gram   : %s" % ("identical" if not word_bad else "%d/%d DIFFER" % (word_bad, len(sample))))
    print("  char_wb 3-5 gram: %s" % ("identical" if not char_bad else "%d/%d DIFFER" % (char_bad, len(sample))))
    if first_bad:
        kind, q, py, jsv = first_bad
        print("\n  first %s divergence on %r" % (kind, q[:60]))
        pset, jset = set(py), set(jsv)
        print("    python-only: %s" % sorted(pset - jset)[:12])
        print("    js-only    : %s" % sorted(jset - pset)[:12])

    ok = not mismatches and not word_bad and not char_bad
    print("\n%s" % ("PARITY PASS — the JS port is equivalent to scikit-learn."
                    if ok else "PARITY FAIL — do not deploy this port."))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
