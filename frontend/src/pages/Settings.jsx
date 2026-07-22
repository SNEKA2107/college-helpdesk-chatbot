import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { useToast } from '../hooks/useToast';
import { useTheme, THEMES } from '../hooks/useTheme';
import '../styles/profile.css';

/**
 * Student Settings — account details, password, and appearance preferences.
 * Distinct from the read-oriented "My Profile" page; reuses the same shared
 * chrome (Layout), API client, toast, and theme hook. Account saves send back
 * the full profile payload so unrelated fields (semester, parent details) are
 * never wiped by the overwrite-style PUT /auth/profile endpoint.
 */
export default function Settings() {
  const showToast = useToast();
  const { theme, apply } = useTheme();
  const [full, setFull] = useState(() => getUser() || {});
  const [account, setAccount] = useState({ name: '', phone: '' });
  const [savingAccount, setSavingAccount] = useState(false);

  const [pw, setPw] = useState({ cur: '', nw: '', conf: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function loadMe() {
    const res = await apiCall('/auth/me');
    if (res.ok) {
      const u = res.data.user;
      localStorage.setItem('ca_user', JSON.stringify(u));
      setFull(u);
      setAccount({ name: u.name || '', phone: u.phone || '' });
    }
  }
  useEffect(() => { loadMe(); }, []);

  async function saveAccount() {
    const name = account.name.trim();
    if (!name) { showToast('Name is required', 'warning'); return; }
    setSavingAccount(true);
    // Preserve every field the endpoint overwrites; only name/phone change here.
    const body = {
      name,
      phone: account.phone.trim(),
      semester: full.semester || '',
      parentName: full.parentName || '',
      motherName: full.motherName || '',
      parentPhone: full.parentPhone || '',
      parentEmail: full.parentEmail || '',
      parentOccupation: full.parentOccupation || '',
      parentAddress: full.parentAddress || '',
    };
    const res = await apiCall('/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
    setSavingAccount(false);
    if (res.ok) {
      localStorage.setItem('ca_user', JSON.stringify(res.data.user));
      setFull(res.data.user);
      showToast('Settings saved successfully', 'success');
    } else {
      showToast(res.error || 'Failed to save settings', 'error');
    }
  }

  async function changePassword() {
    setPwError('');
    if (!pw.cur) { setPwError('Enter your current password.'); return; }
    if (pw.nw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (pw.nw !== pw.conf) { setPwError('New passwords do not match.'); return; }
    setPwSaving(true);
    const res = await apiCall('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: pw.cur, newPassword: pw.nw }),
    });
    setPwSaving(false);
    if (res.ok) {
      setPw({ cur: '', nw: '', conf: '' });
      showToast('Password changed successfully', 'success');
    } else {
      setPwError(res.error || 'Failed to change password.');
    }
  }

  return (
    <Layout title="Settings">
      <div className="page-header">
        <div className="page-header-text">
          <h2>Settings</h2>
          <p>Manage your account details, password, and appearance</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Account Settings */}
        <div className="card">
          <div className="card-header"><div className="card-title">⚙️ Account Settings</div></div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" placeholder="Your name"
              value={account.name} onChange={e => setAccount(a => ({ ...a, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="tel" className="form-input" placeholder="+91 XXXXX XXXXX"
              value={account.phone} onChange={e => setAccount(a => ({ ...a, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Register No.</label>
            <input type="text" className="form-input" value={full.studentId || ''} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="text" className="form-input" value={full.email || ''} disabled />
          </div>
          <button className="btn btn-primary btn-full" onClick={saveAccount} disabled={savingAccount}>
            {savingAccount ? 'Saving…' : '💾 Save Changes'}
          </button>
        </div>

        {/* Password + Appearance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">🔒 Change Password</div></div>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input" placeholder="Enter current password"
                autoComplete="current-password" value={pw.cur} onChange={e => setPw(p => ({ ...p, cur: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" placeholder="At least 8 characters"
                autoComplete="new-password" value={pw.nw} onChange={e => setPw(p => ({ ...p, nw: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-input" placeholder="Repeat new password"
                autoComplete="new-password" value={pw.conf} onChange={e => setPw(p => ({ ...p, conf: e.target.value }))} />
            </div>
            {pwError && <div className="alert alert-danger mb-4" style={{ display: 'flex' }}>{pwError}</div>}
            <button className="btn btn-primary btn-full" onClick={changePassword} disabled={pwSaving}>
              {pwSaving ? 'Updating…' : 'Change Password'}
            </button>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🎨 Appearance</div></div>
            <label className="form-label">Theme</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn btn-full${theme === t.id ? ' btn-primary' : ' btn-secondary'}`}
                  onClick={() => apply(t.id)}
                  aria-label={`${t.label} theme`}
                  aria-pressed={theme === t.id}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
