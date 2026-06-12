import { useEffect, useState } from 'react';
import { apiCall } from '../services/api';
import { isLoggedIn } from '../services/auth';

/** Unread notice count for the topbar/bell badge (read ids tracked in localStorage). */
export function useUnreadNotices() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    apiCall('/notices').then(res => {
      if (cancelled || !res.ok) return;
      const notices = res.data.notices || [];
      const read = JSON.parse(localStorage.getItem('ca_read_notices') || '[]');
      setUnread(notices.filter(n => !read.includes(n._id)).length);
    });
    return () => { cancelled = true; };
  }, []);

  return unread;
}
