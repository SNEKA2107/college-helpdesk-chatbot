import { useEffect, useState } from 'react';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { getUser, setSession } from '../../services/auth';

// CRIT-03: Admin self-service account management.
// Reuses the existing role-agnostic auth endpoints — no backend changes.
//   GET  /api/auth/me              → current account
//   PUT  /api/auth/profile         → update name/phone
//   PUT  /api/auth/change-password → rotate password
export default function AccountTab() {
  const showToast = useToast();
  const [me, setMe] = useState(getUser());
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    apiCall('/auth/me').then(res => {
      if (res.ok) {
        setMe(res.data.user);
        setProfile({ name: res.data.user.name || '', phone: res.data.user.phone || '' });
      }
    });
  }, []);

  async function saveProfile() {
    const name = profile.name.trim();
    if (!name) { showToast('Name is required', 'error'); return; }
    setSavingProfile(true);
    const res = await apiCall('/auth/profile', { method: 'PUT', body: JSON.stringify({ name, phone: profile.phone.trim() }) });
    setSavingProfile(false);
    if (res.ok) {
      setMe(res.data.user);
      // Keep the cached session in sync so the name updates across the panel.
      setSession(res.data.user, localStorage.getItem('ca_token'));
      showToast('Profile updated successfully', 'success');
    } else {
      showToast(res.error || 'Failed to update profile', 'error');
    }
  }

  async function changePassword() {
    if (!pw.currentPassword) { showToast('Current password is required', 'error'); return; }
    if (pw.newPassword.length < 8) { showToast('New password must be at least 8 characters', 'error'); return; }
    if (pw.newPassword !== pw.confirm) { showToast('New password and confirmation do not match', 'error'); return; }
    setSavingPw(true);
    const res = await apiCall('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    });
    setSavingPw(false);
    if (res.ok) {
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      showToast('Password changed successfully', 'success');
    } else {
      showToast(res.error || 'Failed to change password', 'error');
    }
  }

  return (
    <div>
      <div className="page-header mb-6">
        <div className="page-header-text"><h2>My Account</h2><p>Update your administrator profile and password</p></div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">👤 Profile</div></div>

          <div className="form-group">
            <label className="form-label">Name *</label>
            <input type="text" className="form-input" placeholder="Your name"
              value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="text" className="form-input" placeholder="Phone number"
              value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Login ID</label>
              <input type="text" className="form-input" value={me?.studentId || ''} disabled readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <input type="text" className="form-input" value={me?.role || 'admin'} disabled readOnly />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="text" className="form-input" value={me?.email || ''} disabled readOnly />
          </div>

          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🔒 Change Password</div></div>
          <div className="form-group">
            <label className="form-label">Current Password *</label>
            <input type="password" className="form-input" placeholder="Current password" autoComplete="current-password"
              value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input type="password" className="form-input" placeholder="At least 8 characters" autoComplete="new-password"
              value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <input type="password" className="form-input" placeholder="Re-enter new password" autoComplete="new-password"
              value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
          </div>
          <button className="btn btn-primary btn-full" onClick={changePassword} disabled={savingPw}>
            {savingPw ? 'Updating…' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
