import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../services/api';
import { getUser, logout } from '../services/auth';
import OverviewTab from './admin/OverviewTab';
import RequestsTab from './admin/RequestsTab';
import LeavesTab from './admin/LeavesTab';
import NoticesTab from './admin/NoticesTab';
import MessagesTab from './admin/MessagesTab';
import StudentsTab from './admin/StudentsTab';
import ExamsTab from './admin/ExamsTab';
import AttendanceTab from './admin/AttendanceTab';
import EventsTab from './admin/EventsTab';
import TimetableTab from './admin/TimetableTab';

const NAV_SECTIONS = [
  {
    title: 'Admin',
    tabs: [
      { id: 'overview', icon: '📊', label: 'Overview', title: 'Overview' },
      { id: 'requests', icon: '📋', label: 'Requests', title: 'Requests' },
      { id: 'leaves', icon: '📝', label: 'Leave Applications', title: 'Leave Applications' },
      { id: 'notices', icon: '🔔', label: 'Notices', title: 'Notices' },
      { id: 'messages', icon: '✉️', label: 'Messages', title: 'Messages' },
      { id: 'students', icon: '👥', label: 'Students', title: 'Students' },
    ],
  },
  {
    title: 'Academics',
    tabs: [
      { id: 'exams', icon: '📑', label: 'Exams', title: 'Exam Information' },
      { id: 'attendance', icon: '✅', label: 'Attendance', title: 'Attendance' },
      { id: 'events', icon: '🎉', label: 'Events', title: 'Campus Events' },
      { id: 'timetable', icon: '🗓️', label: 'Timetable', title: 'Class Timetable' },
    ],
  },
];

const ALL_TABS = NAV_SECTIONS.flatMap(s => s.tabs);

const EMPTY_DATA = { requests: [], leaves: [], notices: [], students: [], messages: [], events: [], exam: null, timetables: [] };

export default function Admin() {
  const user = getUser();
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);

  const loadAdminData = useCallback(async () => {
    const [rRes, lRes, nRes, sRes, mRes, eRes, xRes, tRes] = await Promise.all([
      apiCall('/requests'),
      apiCall('/leave'),
      apiCall('/notices'),
      apiCall('/students'),
      apiCall('/contact'),
      apiCall('/events'),
      apiCall('/exam'),
      apiCall('/timetable/all'),
    ]);
    setData(prev => ({
      requests: rRes.ok ? rRes.data.requests || [] : prev.requests,
      leaves: lRes.ok ? lRes.data.leaves || [] : prev.leaves,
      notices: nRes.ok ? nRes.data.notices || [] : prev.notices,
      students: sRes.ok ? sRes.data.students || [] : prev.students,
      messages: mRes.ok ? mRes.data.messages || [] : prev.messages,
      events: eRes.ok ? eRes.data.events || [] : prev.events,
      exam: xRes.ok ? xRes.data.exam : null, // 404 = nothing published yet
      timetables: tRes.ok ? tRes.data.timetables || [] : prev.timetables,
    }));
    setLoaded(true);
  }, []);

  useEffect(() => { loadAdminData(); }, [loadAdminData]);

  const showTab = (id) => { setTab(id); setSidebarOpen(false); };
  const pageTitle = ALL_TABS.find(t => t.id === tab)?.title || tab;
  const tabProps = { data, setData, loaded, reload: loadAdminData, showTab };

  return (
    <div className="app">
      <div className={`overlay${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <a href="#" className="logo-wrap" onClick={e => { e.preventDefault(); showTab('overview'); }}>
            <div className="logo-icon">🎓</div>
            <div className="logo-text"><h2>CampusAssist</h2><span>Admin Panel</span></div>
          </a>
        </div>
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="nav-section-title">{section.title}</p>
              {section.tabs.map(t => (
                <a
                  key={t.id}
                  href="#"
                  className={`nav-link${tab === t.id ? ' active' : ''}`}
                  onClick={e => { e.preventDefault(); showTab(t.id); }}
                >
                  <span className="nav-icon">{t.icon}</span> {t.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{(user?.name || 'A')[0].toUpperCase()}</div>
            <div className="user-info">
              <h4>{user?.name || 'Admin'}</h4>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Administrator</span>
            </div>
          </div>
          <a href="#" className="nav-link logout" onClick={e => { e.preventDefault(); logout(); }}>
            <span className="nav-icon">🚪</span> Logout
          </a>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <h1 className="page-title">{pageTitle}</h1>
          </div>
          <div className="topbar-right">
            <div className="topbar-profile">
              <div className="topbar-avatar">{(user?.name || 'A')[0].toUpperCase()}</div>
              <span className="topbar-name">{user?.name || 'Admin'}</span>
            </div>
          </div>
        </header>

        <main className="main-content">
          {tab === 'overview' && <OverviewTab {...tabProps} />}
          {tab === 'requests' && <RequestsTab {...tabProps} />}
          {tab === 'leaves' && <LeavesTab {...tabProps} />}
          {tab === 'notices' && <NoticesTab {...tabProps} />}
          {tab === 'messages' && <MessagesTab {...tabProps} />}
          {tab === 'students' && <StudentsTab {...tabProps} />}
          {tab === 'exams' && <ExamsTab {...tabProps} />}
          {tab === 'attendance' && <AttendanceTab {...tabProps} />}
          {tab === 'events' && <EventsTab {...tabProps} />}
          {tab === 'timetable' && <TimetableTab {...tabProps} />}
        </main>
      </div>
    </div>
  );
}
