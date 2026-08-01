# -*- coding: utf-8 -*-
"""
Intent classification sidecar for CampusAssist.

Loads the trained artefacts once at start-up and exposes a single endpoint the
Node backend calls. It classifies ONLY — it never touches the database and never
composes an answer. Retrieval and generation stay in aiAgent.js.

    POST /classify   {"message": "how much fees do i owe"}
    -> {"intent": "fees_balance", "confidence": 0.94, "retrieval": "fees",
        "entities": {...}, "category": "Fees", "low_confidence": false}

Run:
    pip install fastapi uvicorn scikit-learn joblib
    uvicorn serve_intent:app --host 127.0.0.1 --port 8100
"""
import json, os, re, sys
import joblib
from fastapi import FastAPI
from pydantic import BaseModel

HERE  = os.path.dirname(os.path.abspath(__file__))
ROOT  = os.path.dirname(HERE)
MODEL = os.path.join(ROOT, "model")
sys.path.insert(0, ROOT)
from generate_dataset import extract_entities          # one entity implementation, reused

# Below this the backend should not trust the prediction. Chosen from the
# confidence-threshold table in model/EVALUATION_REPORT.md.
THRESHOLD = float(os.environ.get("INTENT_THRESHOLD", "0.40"))

model      = joblib.load(os.path.join(MODEL, "intent_model.pkl"))
vectorizer = joblib.load(os.path.join(MODEL, "vectorizer.pkl"))
encoder    = joblib.load(os.path.join(MODEL, "label_encoder.pkl"))
with open(os.path.join(MODEL, "intent_responses.json"), encoding="utf-8") as f:
    RESPONSES = json.load(f)
with open(os.path.join(HERE, "retrieval_map.json"), encoding="utf-8") as f:
    RETRIEVAL = json.load(f)["map"]

app = FastAPI(title="CampusAssist Intent Classifier", version="1.0")

class Query(BaseModel):
    message: str
    top_k: int = 3

@app.get("/health")
def health():
    return {"status": "ok", "intents": len(encoder.classes_), "threshold": THRESHOLD}

@app.post("/classify")
def classify(q: Query):
    text = (q.message or "").strip()
    if not text:
        return {"intent": "fallback_unsupported", "confidence": 0.0,
                "retrieval": "general", "low_confidence": True, "entities": {}}

    proba = model.predict_proba(vectorizer.transform([text]))[0]
    order = proba.argsort()[::-1][:max(1, q.top_k)]
    labels = encoder.inverse_transform(order)
    intent, confidence = labels[0], float(proba[order[0]])

    ent_str = extract_entities(text)
    entities = dict(p.split("=", 1) for p in ent_str.split(";") if p)
    route = RETRIEVAL.get(intent, {})

    return {
        "intent": intent,
        "confidence": round(confidence, 4),
        "low_confidence": confidence < THRESHOLD,
        "retrieval": route.get("retrieval", "general"),
        "grounded_today": route.get("grounded_today", False),
        "category": RESPONSES.get(intent, {}).get("category", "General"),
        "entities": entities,
        "alternatives": [{"intent": l, "confidence": round(float(proba[i]), 4)}
                         for l, i in zip(labels[1:], order[1:])],
    }
