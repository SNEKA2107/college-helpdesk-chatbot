# Integrating the Intent Model into CampusAssist

## The governing principle

The classifier decides **what the user is asking**. It never decides **what is
true**. Every fact the assistant states — a fee balance, an attendance
percentage, a CGPA, a hall ticket date — still comes from Mongo through
`aiAgent.retrieve()` and the existing business logic, exactly as it does today.

```
message ──► intentClassifier.classify()        ← NEW: 78-class TF-IDF + Linear SVM
                    │  intent + confidence + entities
                    ▼
            retrieval bucket  ──► aiAgent.retrieve()   ← UNCHANGED: Mongo queries,
                    │                                     ownership scoping, citations
                    ▼
            Claude generation ──► reply + sources      ← UNCHANGED
```

What changes is only the first box. `retrieve()`, `generate()`'s grounding
prompt, the source citations, `Conversation`/`Message` persistence and every
permission check stay byte-for-byte as they are.

## Why replace the keyword router at all

`classifyIntent()` in `backend/services/aiAgent.js` is first-match-wins over nine
keyword lists. That has three failure modes the model fixes:

| Problem | Keyword router | Model |
|---|---|---|
| `"when is my exam timetable"` | `exam` matches first — but `timetable` is in the same list, so ordering decides | `exam_schedule`, 0.95 |
| `"wats my attendence"` | no keyword matches → `general` | `attendance_check`, 0.82 |
| `"what framework is the frontend using"` | `general` → answered as a normal query | `out_of_scope_technical`, 0.92 → declined |
| `"how do i pay my fees"` vs `"is my payment verified"` | both → `fees` | `fees_payment` / `fees_verification` |

The model also yields a **confidence score**, which is what makes safe fallback
possible, and **entities**, which give the retrieval layer something to filter on.

## Step 1 — copy the artefacts

```
backend/services/intentClassifier.js     ← integration/intentClassifier.js
backend/services/retrieval_map.json      ← integration/retrieval_map.json
```

## Step 2 — run the classifier service

The model is scikit-learn, so it runs as a small Python sidecar. It loads the
three `.pkl` files once at boot and answers in ~2–5 ms.

```bash
pip install fastapi uvicorn scikit-learn joblib
cd intent-model/integration
uvicorn serve_intent:app --host 127.0.0.1 --port 8100
```

On Render, add it as a second service (`Python` environment, start command
above) and point the Node service at it:

```
INTENT_SERVICE_URL=http://<intent-service>:8100
INTENT_THRESHOLD=0.40
INTENT_TIMEOUT_MS=600
```

**If `INTENT_SERVICE_URL` is unset, nothing changes** — `classify()` returns the
keyword result and the assistant behaves exactly as it does now. That makes this
a zero-risk deploy: ship the code first, turn the model on with an env var.

## Step 3 — patch `aiAgent.js`

Two edits in `backend/services/aiAgent.js`.

```js
// at the top
const { classify } = require('./intentClassifier');
```

```js
// in generate(), replace:  const intent = classifyIntent(message);
async function generate({ message, history = [], user }) {
  const routed = await classify(message);

  // Hard guard: the help desk never discusses how the portal is built. This is
  // enforced here rather than left to the prompt, so it cannot be talked around.
  if (routed.intent === 'out_of_scope_technical') {
    return {
      reply: RESPONSES.out_of_scope_technical,
      intent: routed.intent, sources: [], followUps: [], matched: false,
    };
  }

  // Cheap short-circuits: no records to fetch, no reason to call the model.
  if (['greeting', 'thanks_goodbye', 'bot_capabilities'].includes(routed.intent)) {
    return { reply: RESPONSES[routed.intent], intent: routed.intent,
             sources: [], followUps: [], matched: true };
  }

  // Retrieval is unchanged — it just receives a better-chosen bucket.
  const { context, sources } = await retrieve(routed.retrieval, user, message);
  const matched = sources.length > 0;
  ...
  return { reply: text, intent: routed.intent, sources, followUps, matched,
           confidence: routed.confidence, entities: routed.entities };
}
```

`RESPONSES` is `model/intent_responses.json` — the canned, capability-accurate
answers. Load it once at module scope.

Note the signature change: `classify()` is async, so `generate()` must `await`
it. `generate()` is already async and already awaited in `routes/chat.js`, so
nothing upstream changes.

## Step 4 — richer analytics (optional but cheap)

`routes/chat.js` already writes a `QueryLog` row per turn. Two upgrades:

```js
// utils/intentCategory.js maps only the OLD 10 intents; anything else returns
// 'General'. The classifier already knows the category, so prefer it:
category: routed.category || categoryForIntent(intent),
```

Add to `models/QueryLog.js` so the new fields survive Mongoose's strict mode:

```js
confidence: { type: Number, default: null },
entities:   { type: mongoose.Schema.Types.Mixed, default: {} },
source:     { type: String, default: 'keyword' },   // 'model' | 'keyword'
```

You then get, for free: which intents the model is unsure about, which fall back
to keywords, and — via the existing 👍/👎 `rating` field — a labelled corpus for
retraining (see *Retraining* below).

## Step 5 — ground the remaining intents

`retrieve()` currently fetches records for ten buckets. The classifier
distinguishes 78 intents, and **34 of them route to topics `retrieve()` has no
handler for** — timetable, leave, requests, library, events, calendar,
coursework, profile, and the faculty/admin workflows.

Until a handler exists those degrade to `general` (notices + knowledge base),
which is *exactly what happens today*, so nothing regresses. But each handler
you add turns a canned answer into a grounded one. The pattern is already
established in `retrieve()` — for example:

```js
if (intent === 'library') {
  const borrowed = await BorrowedBook.find({
    student: user._id, status: { $ne: 'Returned' },
  }).limit(5);
  borrowed.forEach(b => add('library', b._id, `Book: ${b.title}`,
    `"${b.title}" by ${b.author}, borrowed ${b.borrowedDate}, due ${b.dueDate}` +
    `, status ${b.status}.`));
}
```

Note it keeps the two invariants the rest of `retrieve()` observes: **scope every
query to `user._id`**, and **record a citation via `add()` for every fact**.
`retrieval_map.json` marks each intent with `needs_new_handler`, so the backlog
is enumerated for you.

Priority order by likely traffic: `timetable` → `library` → `request` → `leave`
→ `event` → `coursework`.

## Tuning the confidence threshold

From `model/EVALUATION_REPORT.md`, measured on the 500-row held-out test split:

| Threshold | Coverage | Accuracy on answered |
|---|---|---|
| 0.40 *(default)* | 95.6% | 95.4% |
| 0.50 | 91.8% | 97.2% |
| 0.60 | 85.8% | 99.3% |
| 0.70 | 73.4% | 100% |

Below the threshold the request falls through to the keyword router rather than
acting on a guess. Raise it toward 0.60 if a wrong route is costlier than a
vague one; lower it toward 0.40 for maximum coverage. Gibberish scores around
0.16 and is filtered out at any of these settings.

## Retraining on real traffic

`QueryLog` already stores `query`, `intent`, `response` and a 👍/👎 `rating`.
That is a labelled dataset that grows on its own:

1. Export thumbs-down rows and rows where `source === 'keyword'` (the model
   abstained) — these are the questions the current model handles worst.
2. Correct the labels, append them to `intent_spec.py` as new seed questions.
3. Re-run `python generate_dataset.py && python train_intent_model.py`.
4. Compare the new `EVALUATION_REPORT.md` against the old one before shipping.

Because the generator is seeded (`SEED = 20260801`), the dataset is reproducible
and diffs are meaningful.

## What not to do

- **Do not let the classifier answer.** It returns a label, not a fact. Every
  number in a reply must come from `retrieve()`. The canned responses in
  `intent_responses.json` describe *capabilities and policy* — they contain no
  student-specific data by design.
- **Do not drop the keyword fallback.** It is the reason a model outage cannot
  take the assistant down.
- **Do not bypass `protect`.** Classification happens after authentication;
  `retrieve()` scopes on `req.user._id` and that is what keeps one student from
  reading another's records.
- **Do not retrain on unreviewed logs.** Thumbs-down means "bad answer", which
  is not the same as "wrong intent" — relabel before appending.

## Alternative: no sidecar

If a second Render service isn't wanted, a TF-IDF + linear model is just a
sparse matrix multiply and can be exported to JSON and evaluated in Node
(vocabulary + idf weights + coefficients). That removes the HTTP hop and the
Python runtime, at the cost of reimplementing `char_wb` n-gram extraction
faithfully — get it slightly wrong and accuracy drops silently. The sidecar is
the safer default; export only if the operational constraint is real.
