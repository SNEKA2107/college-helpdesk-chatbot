// Phase 2 (H2): timetable conflict detection, run before publish.
// Detects: duplicate period slots, section clash (another published timetable for the
// same cohort), and faculty / classroom clashes against other PUBLISHED timetables at
// the same day + period. Faculty/room are resolved via `subjectDetails[cellKey]`.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const IGNORE_CELLS = new Set(['', '-', 'Lunch', 'Break']);

// Build a map: "Day#slotIndex" -> { faculty, room, subject } for non-empty cells.
function cellMap(tt) {
  const details = tt.subjectDetails || {};
  const sched = tt.schedule || {};
  const map = {};
  for (const day of DAYS) {
    const row = Array.isArray(sched[day]) ? sched[day] : [];
    row.forEach((cell, i) => {
      if (!cell || IGNORE_CELLS.has(cell)) return;
      const d = details[cell] || {};
      map[`${day}#${i}`] = {
        subject: cell,
        faculty: (d.faculty || '').trim(),
        room: (d.room || '').trim(),
      };
    });
  }
  return map;
}

const sameCohort = (a, b) =>
  a.department === b.department &&
  (a.year || '') === (b.year || '') &&
  a.semester === b.semester &&
  (a.section || '') === (b.section || '');

// target: the timetable being published. others: array of currently-published timetables.
function detectConflicts(target, others) {
  const conflicts = [];

  // 1. Duplicate period slots within the timetable.
  const slots = target.slots || [];
  const seen = new Set();
  for (const s of slots) {
    const key = String(s).trim();
    if (!key) continue;
    if (seen.has(key)) conflicts.push({ type: 'duplicate-slot', message: `Duplicate period slot "${key}".` });
    seen.add(key);
  }

  const publishedOthers = (others || []).filter(o => String(o._id) !== String(target._id));

  // 2. Section clash — only one published timetable allowed per cohort.
  for (const o of publishedOthers) {
    if (sameCohort(target, o)) {
      conflicts.push({
        type: 'section-clash',
        message: `A timetable is already published for ${target.department} · ${target.semester} sem${target.year ? ` · ${target.year} yr` : ''}${target.section ? ` · Sec ${target.section}` : ''}.`,
        otherId: String(o._id),
      });
    }
  }

  // 3. Faculty / classroom clashes at the same day + period.
  const tMap = cellMap(target);
  for (const o of publishedOthers) {
    const oMap = cellMap(o);
    for (const key of Object.keys(tMap)) {
      const a = tMap[key];
      const b = oMap[key];
      if (!b) continue;
      const [day, idx] = key.split('#');
      const when = `${day}, period ${Number(idx) + 1}`;
      if (a.faculty && b.faculty && a.faculty.toLowerCase() === b.faculty.toLowerCase()) {
        conflicts.push({
          type: 'faculty-clash',
          message: `Faculty "${a.faculty}" is already scheduled on ${when} (${o.department} ${o.semester} sem${o.section ? ` Sec ${o.section}` : ''}).`,
          otherId: String(o._id),
        });
      }
      if (a.room && b.room && a.room.toLowerCase() === b.room.toLowerCase()) {
        conflicts.push({
          type: 'room-clash',
          message: `Room "${a.room}" is already in use on ${when} (${o.department} ${o.semester} sem${o.section ? ` Sec ${o.section}` : ''}).`,
          otherId: String(o._id),
        });
      }
    }
  }

  return conflicts;
}

module.exports = { detectConflicts };
