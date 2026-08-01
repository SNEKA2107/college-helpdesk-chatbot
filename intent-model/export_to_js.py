#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Export the trained sklearn intent classifier into a form Node can execute.

TF-IDF followed by a linear model is a sparse dot product; nothing about it
needs Python at inference time. This writes the fitted parameters into
backend/services/intent-model/ so the existing Node service can score a message
itself, with no Python runtime, no second service and no cold start.

Nothing is approximated on purpose. Coefficients are cast float64 -> float32
(~1e-7 relative), and no coefficient is truncated or pruned. verify_parity.py
then checks the JS port against Python on all 5,070 dataset rows and fails the
build if a single predicted intent differs.

Layout written:
    model.json   vocabularies, idf vectors, intercept, sigmoid calibrators,
                 class names, threshold, provenance
    model.bin    coefficient matrix, float32 little-endian, FEATURE-MAJOR
                 (index = feature * n_classes + class) so inference walks only
                 the handful of features a message actually activates

Run:  python intent-model/export_to_js.py
"""
import json
import os
import struct

import joblib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODEL = os.path.join(HERE, "model")
OUT = os.path.join(ROOT, "backend", "services", "intent-model")


def main() -> int:
    os.makedirs(OUT, exist_ok=True)

    clf = joblib.load(os.path.join(MODEL, "intent_model.pkl"))
    vec = joblib.load(os.path.join(MODEL, "vectorizer.pkl"))
    enc = joblib.load(os.path.join(MODEL, "label_encoder.pkl"))
    with open(os.path.join(MODEL, "model_meta.json"), encoding="utf-8") as fh:
        meta = json.load(fh)

    word = vec.transformer_list[0][1]
    char = vec.transformer_list[1][1]

    # Guard the assumptions the JS analyzer hardcodes. If a retrain ever changes
    # one of these, fail here rather than silently serving a different model.
    assert word.analyzer == "word" and word.ngram_range == (1, 2)
    assert char.analyzer == "char_wb" and char.ngram_range == (3, 5)
    for t in (word, char):
        assert t.lowercase and t.strip_accents == "unicode"
        assert t.sublinear_tf and t.norm == "l2" and not t.binary
        assert t.stop_words is None
        assert t.token_pattern == r"(?u)\b\w\w+\b"

    assert len(clf.calibrated_classifiers_) == 1, "expected ensemble=False"
    cc = clf.calibrated_classifiers_[0]
    base = cc.estimator
    assert type(base).__name__ == "LinearSVC"
    # Class order must line up: the calibrators are indexed by the base
    # estimator's class order, and we emit scores in that same order.
    assert list(base.classes_) == list(range(len(enc.classes_)))

    n_classes = len(enc.classes_)
    n_word = len(word.vocabulary_)
    n_char = len(char.vocabulary_)
    n_feat = n_word + n_char
    assert base.coef_.shape == (n_classes, n_feat)

    # ── Coefficients: feature-major float32 ─────────────────────────────────
    coef32 = base.coef_.astype(np.float32)          # (n_classes, n_feat)
    feature_major = np.ascontiguousarray(coef32.T)  # (n_feat, n_classes)
    bin_path = os.path.join(OUT, "model.bin")
    with open(bin_path, "wb") as fh:
        fh.write(feature_major.tobytes(order="C"))

    # Sanity: the binary must round-trip to the same float32 matrix.
    back = np.frombuffer(open(bin_path, "rb").read(), dtype="<f4").reshape(n_feat, n_classes)
    assert np.array_equal(back, feature_major), "coefficient round-trip mismatch"

    max_drift = float(np.abs(coef32.astype(np.float64) - base.coef_).max())

    # ── Everything else as JSON ─────────────────────────────────────────────
    # Vocabulary values are numpy ints; json cannot serialise those.
    payload = {
        "format": 1,
        "classes": [str(c) for c in enc.classes_],
        "nClasses": n_classes,
        "nWordFeatures": n_word,
        "nCharFeatures": n_char,
        "nFeatures": n_feat,
        # char feature indices are offset by the word block inside the FeatureUnion
        "charOffset": n_word,
        "wordVocab": {str(k): int(v) for k, v in word.vocabulary_.items()},
        "wordIdf": [float(x) for x in word.idf_],
        "charVocab": {str(k): int(v) for k, v in char.vocabulary_.items()},
        "charIdf": [float(x) for x in char.idf_],
        "intercept": [float(x) for x in base.intercept_],
        "calA": [float(c.a_) for c in cc.calibrators],
        "calB": [float(c.b_) for c in cc.calibrators],
        "threshold": meta["confidence_threshold"],
        "provenance": {
            "exportedFrom": "intent-model/model/intent_model.pkl",
            "trainedAt": meta["trained_at"],
            "gitCommit": meta["git_commit"],
            "algorithm": meta["algorithm"],
            "sklearnVersion": meta["sklearn_version"],
            "testAccuracy": meta["test_metrics"]["accuracy"],
            "testMacroF1": meta["test_metrics"]["macro_f1"],
            "coefDtype": "float32",
            "maxCoefDrift": max_drift,
        },
    }
    json_path = os.path.join(OUT, "model.json")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)

    # ── Canned responses + retrieval routing, copied next to the model ──────
    with open(os.path.join(MODEL, "intent_responses.json"), encoding="utf-8") as fh:
        responses = json.load(fh)
    with open(os.path.join(OUT, "responses.json"), "w", encoding="utf-8") as fh:
        json.dump(responses, fh, indent=2, ensure_ascii=False)

    with open(os.path.join(HERE, "integration", "retrieval_map.json"), encoding="utf-8") as fh:
        retrieval = json.load(fh)
    with open(os.path.join(OUT, "retrieval_map.json"), "w", encoding="utf-8") as fh:
        json.dump(retrieval, fh, indent=2, ensure_ascii=False)

    print("exported to %s" % OUT)
    for f in ("model.json", "model.bin", "responses.json", "retrieval_map.json"):
        print("  %-20s %8.1f KB" % (f, os.path.getsize(os.path.join(OUT, f)) / 1024))
    print("\nclasses=%d  features=%d (word %d + char %d)" % (n_classes, n_feat, n_word, n_char))
    print("threshold=%.2f  max float32 coefficient drift=%.3e" % (payload["threshold"], max_drift))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
