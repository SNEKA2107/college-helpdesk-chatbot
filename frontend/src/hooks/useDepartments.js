import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../services/api';

/**
 * Departments, loaded from the server instead of a hardcoded array.
 *
 * Audit finding H-1: the department list was duplicated across five frontend
 * files and three models, and the copies disagreed — admin/shared.js listed only
 * five, so ECE/EEE/MECH/CIVIL students could register but could not be given a
 * timetable, exam or attendance record.
 *
 * The endpoint is public (the registration page needs it before login), so this
 * hook works on authenticated and unauthenticated pages alike.
 */

// Module-level cache: the list changes rarely and several tabs mount at once.
let cache = null;
let inflight = null;

export function invalidateDepartments() { cache = null; inflight = null; }

async function fetchDepartments() {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${API_BASE}/departments`)
      .then(r => r.json())
      .then(d => {
        cache = Array.isArray(d.departments) ? d.departments : [];
        return cache;
      })
      .catch(() => {
        inflight = null;   // allow a retry on the next mount
        return [];
      });
  }
  return inflight;
}

/**
 * @param {{ academicOnly?: boolean }} opts  academicOnly drops non-teaching
 *        buckets such as 'Admin' from student-facing pickers.
 * @returns {{ departments: Array, codes: string[], loading: boolean, reload: fn }}
 */
export function useDepartments({ academicOnly = false } = {}) {
  const [departments, setDepartments] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    fetchDepartments().then(list => {
      if (!alive) return;
      setDepartments(list);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Memoised so `departments` and `codes` keep a stable identity between renders.
  // Several callers use them as effect dependencies (to default a <select> once
  // the list arrives); a fresh array each render would re-run those effects on
  // every render.
  const filtered = useMemo(
    () => (academicOnly ? departments.filter(d => d.isAcademic !== false) : departments),
    [departments, academicOnly],
  );
  const codes = useMemo(() => filtered.map(d => d.code), [filtered]);

  const reload = useCallback(async () => {
    invalidateDepartments();
    const list = await fetchDepartments();
    setDepartments(list);
    return list;
  }, []);

  return { departments: filtered, codes, loading, reload };
}

export default useDepartments;
