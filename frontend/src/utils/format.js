export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Normalize a stored time string into the "HH:MM" 24-hour value that a
// native <input type="time"> expects. Accepts already-24h values ("14:30",
// "09:00") and legacy 12-hour strings ("9 AM", "2 PM", "10:00 AM"). Returns
// "" for anything unparseable so the picker stays empty instead of breaking.
export function toTimeInput(value) {
  if (!value) return '';
  const s = String(value).trim();
  let m = s.match(/^(\d{1,2}):(\d{2})$/); // 24-hour HH:MM
  if (m) return `${String(Math.min(23, +m[1])).padStart(2, '0')}:${m[2]}`;
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp])[Mm]$/); // h[:mm] AM/PM
  if (m) {
    let h = +m[1] % 12;
    if (/[Pp]/.test(m[3])) h += 12;
    return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
  }
  return '';
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
