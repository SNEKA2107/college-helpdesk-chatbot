/**
 * Per-account login failure tracking.
 *
 * express-rate-limit keys on IP address, which stops one host guessing quickly
 * but does nothing about credential stuffing spread across many source
 * addresses — the attacker simply rotates IPs and the high-value account sees
 * no additional friction at all. This counter is keyed on the ACCOUNT, so the
 * defence follows the target rather than the source.
 *
 * Two escalating responses:
 *   1. Progressive delay after a few failures — cheap for a real user who
 *      mistyped, expensive for an automated run.
 *   2. A hard lock after the threshold, releasing automatically.
 *
 * State lives in memory. That is deliberate for this deployment: a single
 * long-lived Render instance keeps one shared map, and losing it on restart
 * fails open rather than locking people out. A multi-instance deployment should
 * move this to Redis or a Mongo collection — noted in the assessment report as a
 * documented limitation rather than left as a silent assumption.
 */

const WINDOW_MS = Number(process.env.LOGIN_FAILURE_WINDOW_MS || 15 * 60 * 1000);
const LOCK_THRESHOLD = Number(process.env.LOGIN_LOCK_THRESHOLD || 10);
const DELAY_THRESHOLD = Number(process.env.LOGIN_DELAY_THRESHOLD || 4);
const LOCK_MS = Number(process.env.LOGIN_LOCK_MS || 15 * 60 * 1000);
const MAX_DELAY_MS = 4000;

/** key -> { count, first, lockedUntil } */
const attempts = new Map();

// Bound the map so a flood of unique identifiers cannot grow it without limit.
const MAX_TRACKED = 10000;

function normaliseKey(identifier) {
  return String(identifier == null ? '' : identifier).trim().toLowerCase();
}

function prune(now) {
  if (attempts.size < MAX_TRACKED) return;
  for (const [k, v] of attempts) {
    if (now - v.first > WINDOW_MS && (!v.lockedUntil || v.lockedUntil < now)) attempts.delete(k);
    if (attempts.size < MAX_TRACKED * 0.9) break;
  }
}

/**
 * Current state for an identifier.
 * @returns {{locked: boolean, retryAfterSec: number, delayMs: number, failures: number}}
 */
function check(identifier) {
  const key = normaliseKey(identifier);
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec) return { locked: false, retryAfterSec: 0, delayMs: 0, failures: 0 };

  if (rec.lockedUntil && rec.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000),
      delayMs: 0,
      failures: rec.count,
    };
  }
  // Window elapsed with no lock in force — the slate is clean.
  if (now - rec.first > WINDOW_MS) {
    attempts.delete(key);
    return { locked: false, retryAfterSec: 0, delayMs: 0, failures: 0 };
  }
  const over = Math.max(0, rec.count - DELAY_THRESHOLD + 1);
  const delayMs = over > 0 ? Math.min(MAX_DELAY_MS, 250 * 2 ** (over - 1)) : 0;
  return { locked: false, retryAfterSec: 0, delayMs, failures: rec.count };
}

/** Record a failed attempt. Returns the state AFTER recording. */
function recordFailure(identifier) {
  const key = normaliseKey(identifier);
  if (!key) return { locked: false, failures: 0 };
  const now = Date.now();
  prune(now);

  let rec = attempts.get(key);
  if (!rec || (now - rec.first > WINDOW_MS && (!rec.lockedUntil || rec.lockedUntil < now))) {
    rec = { count: 0, first: now, lockedUntil: 0 };
    attempts.set(key, rec);
  }
  rec.count += 1;
  if (rec.count >= LOCK_THRESHOLD) {
    rec.lockedUntil = now + LOCK_MS;
    console.warn(`🔒 Account locked after ${rec.count} failed attempts: ${key}`);
  }
  return { locked: Boolean(rec.lockedUntil > now), failures: rec.count };
}

/** Clear the counter — called on a successful authentication. */
function recordSuccess(identifier) {
  attempts.delete(normaliseKey(identifier));
}

/** Test/ops helper. */
function reset() { attempts.clear(); }

module.exports = {
  check, recordFailure, recordSuccess, reset,
  LOCK_THRESHOLD, DELAY_THRESHOLD, WINDOW_MS, LOCK_MS,
};
