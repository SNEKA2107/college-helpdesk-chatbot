import { useEffect, useState } from 'react';
import FacultyShell from '../../components/FacultyShell';
import { apiCall } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { getUser, setSession } from '../../services/auth';
import { fileToDataUrl } from '../../utils/download';
import '../../styles/faculty.css';

export default function FacultyProfile() {
  const showToast = useToast();
  const [f, setF] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  function apply(faculty) {
    setF(faculty);
    // Keep the cached user (sidebar/topbar name + photo) in sync.
    const cached = getUser();
    if (cached) setSession({ ...cached, name: faculty.name, photo: faculty.photo }, localStorage.getItem('ca_token'));
  }

  useEffect(() => {
    apiCall('/faculty-portal/me').then(res => { if (res.ok) setF(res.data.faculty); });
  }, []);

  function startEdit() {
    setForm({
      name: f?.name || '', phone: f?.phone || '', email: f?.email || '',
      designation: f?.designation || '', qualification: f?.qualification || '', experience: f?.experience || '',
      photo: f?.photo || '',
    });
    setEdit(true);
  }
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const r = await fileToDataUrl(file); setForm(s => ({ ...s, photo: r.dataUrl })); }
    catch (err) { showToast(err.message, 'error'); }
  }

  async function save() {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const res = await apiCall('/faculty-portal/profile', { method: 'PUT', body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { apply(res.data.faculty); setEdit(false); showToast('Profile updated', 'success'); }
    else showToast(res.error || 'Update failed', 'error');
  }

  async function changePassword() {
    if (pw.newPassword.length < 8) { showToast('New password must be at least 8 characters', 'error'); return; }
    if (pw.newPassword !== pw.confirm) { showToast('Passwords do not match', 'error'); return; }
    setPwSaving(true);
    const res = await apiCall('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }) });
    setPwSaving(false);
    if (res.ok) { showToast('Password changed', 'success'); setPw({ currentPassword: '', newPassword: '', confirm: '' }); }
    else showToast(res.error || 'Could not change password', 'error');
  }

  const rows = [
    ['Faculty ID', f?.studentId],
    ['Department', f?.department],
    ['Designation', f?.designation || 'Faculty'],
    ['Qualification', f?.qualification || '—'],
    ['Experience', f?.experience || '—'],
    ['Email', f?.email],
    ['Phone', f?.phone || '—'],
  ];
  const subjects = f?.assignedSubjects || [];
  const classKey = s => `${s.department} · Sem ${s.semester}${s.section ? ` · Sec ${s.section}` : ''}`;
  const classes = [...new Set(subjects.map(classKey))];

  return (
    <FacultyShell title="My Profile">
      <div className="page-header">
        <div className="page-header-text"><h2>Faculty Profile</h2><p>Your account, teaching assignments and security</p></div>
        {f && !edit && <button className="btn btn-primary" onClick={startEdit}>✏️ Edit Profile</button>}
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><div className="card-title">👤 Details</div></div>
          <div className="fac-profile-head">
            {f?.photo
              ? <img src={f.photo} alt="" className="fac-avatar-lg" style={{ objectFit: 'cover' }} />
              : <div className="fac-avatar-lg">{(f?.name || 'F')[0].toUpperCase()}</div>}
            <div>
              <h3 style={{ margin: 0 }}>{f?.name || 'Faculty'}</h3>
              <p className="fac-muted" style={{ margin: '4px 0 0' }}>{f?.designation || 'Faculty'}</p>
            </div>
          </div>

          {!edit && (
            <table className="table" style={{ marginTop: 14 }}>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}><td className="fac-muted" style={{ width: 140 }}>{k}</td><td style={{ fontWeight: 600 }}>{v || (f ? '—' : '…')}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          {edit && (
            <div style={{ marginTop: 14 }}>
              <div className="form-group"><label className="form-label">Profile Picture</label>
                <input type="file" accept="image/*" onChange={onPhoto} />
                {form.photo && <div className="fac-muted" style={{ fontSize: 12, marginTop: 4 }}>Image selected ✓</div>}
              </div>
              <div className="form-group"><label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="fac-controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group"><label className="form-label">Designation</label>
                  <input className="form-input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Assistant Professor" /></div>
                <div className="form-group"><label className="form-label">Experience</label>
                  <input className="form-input" value={form.experience} onChange={e => set('experience', e.target.value)} placeholder="e.g. 8 years" /></div>
              </div>
              <div className="form-group"><label className="form-label">Qualification</label>
                <input className="form-input" value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. Ph.D. in Computer Science" /></div>
              <div className="fac-controls" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group"><label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                <button className="btn btn-outline" onClick={() => setEdit(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📚 Assigned Subjects</div></div>
          {!f && <p className="fac-muted">Loading…</p>}
          {f && !subjects.length && <p className="fac-muted">No subjects assigned.</p>}
          {subjects.map((s, i) => (
            <div key={i} className="fac-row">
              <div className="fac-row-title">{s.name}{s.code ? <span className="fac-muted"> · {s.code}</span> : ''}</div>
              <span className="badge badge-muted">{s.department} · Sem {s.semester}</span>
            </div>
          ))}
          <div className="card-header" style={{ marginTop: 16 }}><div className="card-title">🏫 Assigned Classes</div></div>
          <div className="fac-chip-row">
            {classes.map((c, i) => <span key={i} className="fac-chip">{c}</span>)}
            {f && !classes.length && <span className="fac-muted">None</span>}
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="card-header"><div className="card-title">🔒 Change Password</div></div>
        <div className="form-group"><label className="form-label">Current Password</label>
          <input className="form-input" type="password" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">New Password</label>
          <input className="form-input" type="password" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Confirm New Password</label>
          <input className="form-input" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} /></div>
        <button className="btn btn-primary" onClick={changePassword} disabled={pwSaving || !pw.currentPassword || !pw.newPassword}>{pwSaving ? 'Updating…' : 'Change Password'}</button>
      </div>
    </FacultyShell>
  );
}
