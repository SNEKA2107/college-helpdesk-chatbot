import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { usePageAnimations } from '../hooks/usePageAnimations';

/**
 * Authenticated student page shell: sidebar + topbar + mobile bottom nav.
 * `mobileExtras` renders dashboard-style mobile sections between the topbar and content.
 */
export default function Layout({ title, children, mobileExtras = null, mainClassName = 'main-content' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  usePageAnimations();

  // `has-bottom-nav` marks this as the one shell that renders <BottomNav>, so the
  // mobile CSS knows it may hide the topbar here (and only here) and reserve room
  // at the bottom for the nav bar.
  return (
    <div className="app has-bottom-nav">
      <div className={`overlay${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(o => !o)} />
        {mobileExtras}
        <main className={mainClassName}>{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
