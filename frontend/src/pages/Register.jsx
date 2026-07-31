import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../services/api';
import AuthThemeButton from '../components/AuthThemeButton';
import s from '../styles/Register.module.css';
import { useDepartments } from '../hooks/useDepartments';

const STRENGTH_LEVELS = [
  { w: '0%',   c: '#cbd5e1', l: 'Enter a password' },
  { w: '25%',  c: '#ef4444', l: 'Weak' },
  { w: '50%',  c: '#f59e0b', l: 'Fair' },
  { w: '75%',  c: '#3b82f6', l: 'Good' },
  { w: '100%', c: '#10b981', l: 'Strong' },
];

function strengthOf(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return STRENGTH_LEVELS[score] || STRENGTH_LEVELS[0];
}

// Departments are loaded from the server (audit finding H-1) — a hardcoded list
// here meant a new college's departments could never be picked at registration.
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

export default function Register() {
  const { codes: DEPTS } = useDepartments({ academicOnly: true });
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', studentId: '', email: '',
    dept: '', semester: '', year: '', section: '', password: '', confirmPassword: '', terms: false,
  });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState({ pw: false, cpw: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const strength = strengthOf(form.password);

  async function handleRegister() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (!form.studentId.trim()) errs.studentId = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.dept) errs.dept = 'Required';
    if (form.password.length < 8) errs.password = 'Min 8 characters required';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    if (!form.terms) { alert('Please agree to the Terms of Service.'); return; }
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          studentId: form.studentId.trim(),
          email: form.email.trim(),
          password: form.password,
          department: form.dept,
          semester: form.semester,
          year: form.year,
          section: form.section,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // H4: account is pending admin approval — do NOT log in automatically.
        setSuccess(true);
      } else {
        alert(data.errors ? data.errors[0].msg : (data.message || 'Registration failed.'));
        setLoading(false);
      }
    } catch {
      alert('Cannot connect to server. Make sure the backend is running.');
      setLoading(false);
    }
  }

  const fieldError = key => (
    <span className={`${s.formError}${errors[key] ? ` ${s.show}` : ''}`}>{errors[key] || 'Required'}</span>
  );
  const inputClass = key => `${s.formInput}${errors[key] ? ` ${s.error}` : ''}`;

  return (
    <>
      <AuthThemeButton />
      <div className={s.authLayout}>
        <div className={s.authLeft}>
          <div className={s.authLeftInner}>
            <div className={s.authBrand}>
              <div className={s.authBrandIcon}>🎓</div>
              <div><h1>Campus HelpDesk</h1><span>Student Portal</span></div>
            </div>
            <div className={s.authHeadline}>
              <h2>Join <span>Campus</span>Assist Today</h2>
              <p>Create your free student account and get instant access to all college services in one place.</p>
            </div>
            <div className={s.stepsList}>
              <div className={s.stepItem}><div className={s.stepNum}>1</div><p>Fill in your student details</p></div>
              <div className={s.stepItem}><div className={s.stepNum}>2</div><p>Set a secure password</p></div>
              <div className={s.stepItem}><div className={s.stepNum}>3</div><p>Access your dashboard instantly</p></div>
            </div>
          </div>
        </div>

        <div className={s.authRight}>
          <div className={s.authFormWrap}>
            {!success ? (
              <div>
                <div className={s.authFormHeader}>
                  <h2>Create Account</h2>
                  <p>Register with your college student credentials</p>
                </div>

                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>First Name</label>
                    <div className={s.inputWrap}>
                      <span className={s.inputIcon}>👤</span>
                      <input type="text" className={inputClass('firstName')} placeholder=""
                        autoComplete="off"
                        value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                    </div>
                    {fieldError('firstName')}
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Last Name</label>
                    <div className={s.inputWrap}>
                      <span className={s.inputIcon}>👤</span>
                      <input type="text" className={inputClass('lastName')} placeholder=""
                        autoComplete="off"
                        value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                    </div>
                    {fieldError('lastName')}
                  </div>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>Student ID / Register Number</label>
                  <div className={s.inputWrap}>
                    <span className={s.inputIcon}>🎓</span>
                    <input type="text" className={inputClass('studentId')} placeholder=""
                      autoComplete="off"
                      value={form.studentId} onChange={e => set('studentId', e.target.value)} />
                  </div>
                  {fieldError('studentId')}
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>College Email</label>
                  <div className={s.inputWrap}>
                    <span className={s.inputIcon}>📧</span>
                    <input type="email" className={inputClass('email')} placeholder=""
                      autoComplete="off"
                      value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  {fieldError('email')}
                </div>

                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Department</label>
                    <div className={s.inputWrap}>
                      <span className={s.inputIcon}>🏫</span>
                      <select className={s.formSelect} autoComplete="off" value={form.dept} onChange={e => set('dept', e.target.value)}>
                        <option value="">Select Dept</option>
                        {DEPTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    {fieldError('dept')}
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Semester</label>
                    <div className={s.inputWrap}>
                      <span className={s.inputIcon}>📚</span>
                      <select className={s.formSelect} autoComplete="off" value={form.semester} onChange={e => set('semester', e.target.value)}>
                        <option value="">Select</option>
                        {SEMESTERS.map(sm => <option key={sm}>{sm}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Year <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                    <div className={s.inputWrap}>
                      <span className={s.inputIcon}>📈</span>
                      <input type="text" className={s.formInput} placeholder=""
                        autoComplete="off"
                        value={form.year} onChange={e => set('year', e.target.value)} />
                    </div>
                  </div>
                  <div className={s.formGroup}>
                    <label className={s.formLabel}>Section <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                    <div className={s.inputWrap}>
                      <span className={s.inputIcon}>🔤</span>
                      <input type="text" className={s.formInput} placeholder=""
                        autoComplete="off"
                        value={form.section} onChange={e => set('section', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>Password</label>
                  <div className={s.inputWrap}>
                    <span className={s.inputIcon}>🔒</span>
                    <input type={showPass.pw ? 'text' : 'password'} className={`${inputClass('password')} ${s.passInput}`}
                      autoComplete="new-password"
                      placeholder="" value={form.password} onChange={e => set('password', e.target.value)} />
                    <button type="button" className={s.passToggle} onClick={() => setShowPass(v => ({ ...v, pw: !v.pw }))} aria-label={showPass.pw ? 'Hide password' : 'Show password'}>
                      {showPass.pw ? '🙈' : '👁'}
                    </button>
                  </div>
                  <div className={s.passwordStrength}>
                    <div className={s.strengthBar}>
                      <div className={s.strengthFill} style={{ width: strength.w, background: strength.c }}></div>
                    </div>
                    <span className={s.strengthLabel} style={{ color: form.password ? strength.c : undefined }}>{strength.l}</span>
                  </div>
                  {fieldError('password')}
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>Confirm Password</label>
                  <div className={s.inputWrap}>
                    <span className={s.inputIcon}>🔒</span>
                    <input type={showPass.cpw ? 'text' : 'password'} className={`${inputClass('confirmPassword')} ${s.passInput}`}
                      autoComplete="new-password"
                      placeholder="" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
                    <button type="button" className={s.passToggle} onClick={() => setShowPass(v => ({ ...v, cpw: !v.cpw }))} aria-label={showPass.cpw ? 'Hide password' : 'Show password'}>
                      {showPass.cpw ? '🙈' : '👁'}
                    </button>
                  </div>
                  {fieldError('confirmPassword')}
                </div>

                <label className={s.termsWrap}>
                  <input type="checkbox" checked={form.terms} onChange={e => set('terms', e.target.checked)} />
                  <span>I agree to the <a href="#" onClick={e => e.preventDefault()}>Terms of Service</a> and <a href="#" onClick={e => e.preventDefault()}>Privacy Policy</a></span>
                </label>

                <button className={`${s.btnSubmit}${loading ? ` ${s.loading}` : ''}`} onClick={handleRegister}>
                  {loading ? 'Creating account…' : 'Create My Account →'}
                </button>

                <div className={s.authSwitch}>
                  Already have an account? <Link to="/login">Login here</Link>
                </div>
                <div className={s.authSwitch} style={{ marginTop: 8 }}>
                  <Link to="/">← Back to Home</Link>
                </div>
              </div>
            ) : (
              <div className={s.successState}>
                <div className={s.successIcon}>⏳</div>
                <h3>Registration Submitted!</h3>
                <p>Your account is <strong>pending admin approval</strong>. You’ll be able to log in once the college office approves your registration.</p>
                <button onClick={() => navigate('/login')}>Go to Login →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
