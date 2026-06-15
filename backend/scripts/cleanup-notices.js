/**
 * Notice data-cleanup auditor.
 *
 * Scans the `notices` collection for test / development / security-audit artifacts
 * (DAST probes, "Phase 3" notes, test/sample data, etc.) and reports them.
 *
 *   DRY RUN (default) — only lists candidates, changes nothing:
 *       cd backend && node scripts/cleanup-notices.js
 *
 *   APPLY — ARCHIVES the flagged notices (status: 'archived'). This is reversible
 *   (admins can re-publish) and NON-destructive — it never deletes:
 *       cd backend && node scripts/cleanup-notices.js --apply
 *
 * Requires MONGO_URI in backend/.env. Take a snapshot before --apply.
 * Per policy this tool NEVER deletes records.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Each rule: a reason + a regex tested against title + content + postedBy.
const RULES = [
  { reason: 'Security-scan / DAST probe artifact', re: /\b(dast|sast|probe|burp|zap|nikto|nessus|acunetix|qualys|pentest|vuln)\b/i },
  { reason: 'Injection / XSS test payload',        re: /(<script|onerror=|onload=|javascript:|alert\(|\bxss\b|\bsqli\b|sql injection|csrf|payload|';--)/i },
  { reason: 'Test / sample / placeholder data',    re: /\b(test|testing|qa|sample|dummy|lorem|ipsum|asdf|qwerty|placeholder|foobar)\b/i },
  { reason: 'Development / phase / temporary note', re: /\b(phase\s?\d+|dev|development|debug|staging|sandbox|temp|temporary|delete me|do not use|ignore this)\b/i },
  { reason: 'Automated / non-human author',        re: /\b(test|dev|qa|script|automation|bot|seed|probe)\b/i, field: 'postedBy' },
];

function flag(notice) {
  const hay = `${notice.title || ''} ${notice.content || ''}`;
  const reasons = [];
  for (const rule of RULES) {
    const target = rule.field === 'postedBy' ? (notice.postedBy || '') : hay;
    if (rule.re.test(target)) reasons.push(rule.reason);
  }
  return reasons;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set in backend/.env');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI, { tls: true });
  const col = mongoose.connection.collection('notices');

  const all = await col.find({}).toArray();
  const flagged = all
    .map(n => ({ notice: n, reasons: flag(n) }))
    .filter(x => x.reasons.length && (x.notice.status !== 'archived'));

  console.log(`\nScanned ${all.length} notices — ${flagged.length} candidate(s) for cleanup.\n`);
  console.log('| # | Title | Posted By | Reason(s) | Recommended action |');
  console.log('|---|-------|-----------|-----------|--------------------|');
  flagged.forEach((x, i) => {
    const t = (x.notice.title || '(untitled)').slice(0, 60).replace(/\|/g, '/');
    console.log(`| ${i + 1} | ${t} | ${x.notice.postedBy || '—'} | ${x.reasons.join('; ')} | Archive |`);
  });

  if (!flagged.length) {
    console.log('\n✅ No test/dev/security artifacts found. Nothing to do.');
  } else if (apply) {
    const ids = flagged.map(x => x.notice._id);
    const r = await col.updateMany({ _id: { $in: ids } }, { $set: { status: 'archived' } });
    console.log(`\n🗄️  --apply: archived ${r.modifiedCount} notice(s). They are hidden from students but recoverable.`);
  } else {
    console.log('\nℹ️  DRY RUN — no changes made. Re-run with --apply to archive (non-destructive) the rows above.');
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('❌ cleanup-notices failed:', err);
  process.exit(1);
});
