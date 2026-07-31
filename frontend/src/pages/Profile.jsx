import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiCall } from '../services/api';
import { getUser } from '../services/auth';
import { useLogout } from '../hooks/useLogout';
import { useToast } from '../hooks/useToast';
import '../styles/profile.css';

const detailRowStyle = { display: 'flex', justifyContent: 'space-between', padding: 10, background: 'var(--bg2)', borderRadius: 8 };
const detailLabelStyle = { fontSize: 13, color: 'var(--text-muted)' };
const detailValueStyle = { fontSize: 13, fontWeight: 600 };

const SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function DetailRow({ label, value, valueStyle }) {
  return (
    <div style={detailRowStyle}>
      <span style={detailLabelStyle}>{label}</span>
      <span style={{ ...detailValueStyle, ...valueStyle }}>{value}</span>
    </div>
  );
}

export default function Profile() {
  const showToast = useToast();
  const logout = useLogout();
  const photoInputRef = useRef(null);
  const [user, setUser] = useState(() => getUser());
  const [stats, setStats] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', semester: '' });
  const [parentForm, setParentForm] = useState({
    parentName: '', motherName: '', parentPhone: '', parentEmail: '', parentOccupation: '', parentAddress: '',
  });
  const [pw, setPw] = useState({ cur: '', nw: '', conf: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  function applyUser(u) {
    localStorage.setItem('ca_user', JSON.stringify(u));
    setUser(u);
  }

  async function loadProfile() {
    const [meRes, statsRes] = await Promise.all([apiCall('/auth/me'), apiCall('/requests/stats')]);
    if (meRes.ok) {
      const u = meRes.data.user;
      applyUser(u);
      setProfileForm({ name: u.name || '', phone: u.phone || '', semester: u.semester || '' });
      setParentForm({
        parentName: u.parentName || '',
        motherName: u.motherName || '',
        parentPhone: u.parentPhone || '',
        parentEmail: u.parentEmail || '',
        parentOccupation: u.parentOccupation || '',
        parentAddress: u.parentAddress || '',
      });
    }
    if (statsRes.ok) setStats(statsRes.data.stats);
  }

  useEffect(() => { loadProfile(); }, []);

  function handlePhotoUpload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Photo must be under 5 MB', 'warning'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.82);

        const name = profileForm.name.trim() || user?.name || '';
        const res = await apiCall('/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name, photo: base64 }),
        });
        if (res.ok) {
          applyUser(res.data.user);
          showToast('Photo saved successfully', 'success');
        } else {
          showToast(res.error || 'Failed to save photo', 'error');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    const name = profileForm.name.trim();
    if (!name) { showToast('Name is required', 'warning'); return; }
    const res = await apiCall('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, phone: profileForm.phone.trim(), semester: profileForm.semester }),
    });
    if (res.ok) {
      applyUser(res.data.user);
      showToast('Profile updated successfully', 'success');
      loadProfile();
    } else {
      showToast(res.error || 'Update failed', 'error');
    }
  }

  async function saveParentDetails() {
    const name = profileForm.name.trim() || user?.name || '';
    const body = {
      name,
      parentName: parentForm.parentName.trim(),
      motherName: parentForm.motherName.trim(),
      parentPhone: parentForm.parentPhone.trim(),
      parentEmail: parentForm.parentEmail.trim(),
      parentOccupation: parentForm.parentOccupation.trim(),
      parentAddress: parentForm.parentAddress.trim(),
    };
    const res = await apiCall('/auth/profile', { method: 'PUT', body: JSON.stringify(body) });
    if (res.ok) {
      applyUser(res.data.user);
      showToast('Parent details saved successfully', 'success');
      loadProfile();
    } else {
      showToast(res.error || 'Update failed', 'error');
    }
  }

  async function changePassword() {
    setPwError('');
    setPwSuccess(false);
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
      setPwSuccess(true);
      setPw({ cur: '', nw: '', conf: '' });
      showToast('Password changed successfully', 'success');
    } else {
      setPwError(res.error || 'Failed to change password.');
    }
  }

  return (
    <Layout title="My Profile">
      <div className="page-header">
        <div className="page-header-text">
          <h2>My Profile</h2>
          <p>View your account details and change your password</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Profile Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <input type="file" ref={photoInputRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            <div className="photo-wrap" onClick={() => photoInputRef.current.click()} title="Click to change photo">
              {user?.photo ? (
                <img src={user.photo} alt="Profile" />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 800 }}>
                  {(user?.name || 'S')[0].toUpperCase()}
                </div>
              )}
              <div className="photo-overlay">📷</div>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--dark)', marginBottom: 4 }}>{user?.name || '—'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{user?.studentId || '—'}</p>
            <span className="badge badge-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
              {user?.role === 'admin' ? 'Administrator' : 'Student'}
            </span>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Click photo to upload</p>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📋 Account Details</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DetailRow label="Full Name" value={user?.name || '—'} />
              <DetailRow label="Register No." value={user?.studentId || '—'} />
              <DetailRow label="Email" value={user?.email || '—'} />
              <DetailRow label="Department" value={user?.department || '—'} />
              <DetailRow label="Semester" value={user?.semester || '—'} />
              <DetailRow label="Phone" value={user?.phone || 'Not set'} />
            </div>
          </div>

          {/* Parent Details */}
          <div className="card">
            <div className="card-header"><div className="card-title">👨‍👩‍👧 Parent / Guardian Details</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DetailRow label="Father's Name" value={user?.parentName || '—'} />
              <DetailRow label="Mother's Name" value={user?.motherName || '—'} />
              <DetailRow label="Parent Phone" value={user?.parentPhone || '—'} />
              <DetailRow label="Parent Email" value={user?.parentEmail || '—'} />
              <DetailRow label="Occupation" value={user?.parentOccupation || '—'} />
              <DetailRow label="Address" value={user?.parentAddress || '—'} valueStyle={{ textAlign: 'right', maxWidth: '60%' }} />
            </div>
          </div>

          {/* My Stats */}
          <div className="card">
            <div className="card-header"><div className="card-title">📊 My Activity</div></div>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card">
                <div className="stat-icon si-blue">📋</div>
                <div className="stat-info"><h3>{stats ? stats.total : '—'}</h3><p>Requests</p></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon si-green">✅</div>
                <div className="stat-info"><h3>{stats ? stats.completed : '—'}</h3><p>Completed</p></div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit forms + Change Password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Edit Profile */}
          <div className="card">
            <div className="card-header"><div className="card-title">✏ Edit Profile</div></div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-name">Full Name</label>
              <input id="pf-name" type="text" className="form-input" placeholder="Your name"
                value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-phone">Phone Number</label>
              <input id="pf-phone" type="tel" className="form-input" placeholder="+91 XXXXX XXXXX"
                value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-semester">Semester</label>
              <select id="pf-semester" className="form-input" value={profileForm.semester}
                onChange={e => setProfileForm(f => ({ ...f, semester: e.target.value }))}>
                <option value="">Select semester</option>
                {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-full" onClick={saveProfile}>💾 Save Changes</button>
          </div>

          {/* Edit Parent Details */}
          <div className="card">
            <div className="card-header"><div className="card-title">👨‍👩‍👧 Edit Parent Details</div></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="pf-father">Father's Name</label>
                <input id="pf-father" type="text" className="form-input" placeholder="Father's full name"
                  value={parentForm.parentName} onChange={e => setParentForm(f => ({ ...f, parentName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-mother">Mother's Name</label>
                <input id="pf-mother" type="text" className="form-input" placeholder="Mother's full name"
                  value={parentForm.motherName} onChange={e => setParentForm(f => ({ ...f, motherName: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="pf-parent-phone">Parent Phone</label>
                <input id="pf-parent-phone" type="tel" className="form-input" placeholder="+91 XXXXX XXXXX"
                  value={parentForm.parentPhone} onChange={e => setParentForm(f => ({ ...f, parentPhone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-parent-email">Parent Email</label>
                <input id="pf-parent-email" type="email" className="form-input" placeholder="parent@email.com"
                  value={parentForm.parentEmail} onChange={e => setParentForm(f => ({ ...f, parentEmail: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-parent-occupation">Parent Occupation</label>
              <input id="pf-parent-occupation" type="text" className="form-input" placeholder="e.g. Business, Government Employee"
                value={parentForm.parentOccupation} onChange={e => setParentForm(f => ({ ...f, parentOccupation: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-parent-address">Parent Address</label>
              <textarea id="pf-parent-address" className="form-textarea" rows={2} placeholder="Home address"
                value={parentForm.parentAddress} onChange={e => setParentForm(f => ({ ...f, parentAddress: e.target.value }))} />
            </div>
            <button className="btn btn-primary btn-full" onClick={saveParentDetails}>💾 Save Parent Details</button>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🔒 Change Password</div></div>
            <div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-pw-current">Current Password</label>
                <input id="pf-pw-current" type="password" className="form-input" placeholder="Enter current password"
                  value={pw.cur} onChange={e => setPw(p => ({ ...p, cur: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-pw-new">New Password</label>
                <input id="pf-pw-new" type="password" className="form-input" placeholder="At least 8 characters"
                  value={pw.nw} onChange={e => setPw(p => ({ ...p, nw: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pf-pw-confirm">Confirm New Password</label>
                <input id="pf-pw-confirm" type="password" className="form-input" placeholder="Repeat new password"
                  value={pw.conf} onChange={e => setPw(p => ({ ...p, conf: e.target.value }))} />
              </div>
              {pwError && <div className="alert alert-danger mb-4" style={{ display: 'flex' }}>{pwError}</div>}
              {pwSuccess && (
                <div className="alert alert-success mb-4" style={{ display: 'flex' }}>
                  <span>✅</span><div>Password changed successfully!</div>
                </div>
              )}
              <button className="btn btn-primary btn-full" onClick={changePassword} disabled={pwSaving}>
                {pwSaving ? 'Updating…' : 'Change Password'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">ℹ️ Password Requirements</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Minimum 8 characters', 'Use a mix of letters and numbers for strength', 'Do not reuse your previous password', 'Keep your password confidential'].map(t => (
                <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--secondary)' }}>✔</span> {t}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🔗 Quick Links</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/requests" className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 10 }}>📋 My Document Requests</Link>
              <Link to="/leave" className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 10 }}>📝 My Leave Applications</Link>
              <Link to="/notices" className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 10 }}>🔔 View Notices</Link>
              <Link to="/contact" className="btn btn-secondary btn-full" style={{ justifyContent: 'flex-start', gap: 10 }}>✉️ Contact Office</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Logout button (visible on mobile via profile tab) */}
      <div style={{ marginTop: 8, paddingBottom: 8 }}>
        <button onClick={logout} className="btn btn-full" style={{ background: '#ef4444', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          🚪 Logout
        </button>
      </div>
    </Layout>
  );
}
