import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../services/api';
import { setSession } from '../services/auth';
import AuthThemeButton from '../components/AuthThemeButton';
import s from '../styles/Login.module.css';

// Faculty-facing highlights for the left panel (mirrors the student Login layout).
const FEATURES = [
  { icon: '✅', text: 'Mark and edit class attendance' },
  { icon: '📝', text: 'Enter, edit and publish student marks' },
  { icon: '📩', text: 'Approve leave & OD requests' },
  { icon: '🔔', text: 'Post notices and share notes' },
];

export default function FacultyLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setAlert('');
    const errs = {};
    if (!email.trim()) errs.email = true;
    if (!password) errs.pass = true;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/faculty-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.user, data.token);
        navigate('/faculty/dashboard');
      } else {
        setAlert(data.message || (data.errors?.[0]?.msg) || 'Invalid faculty email or password.');
        setLoading(false);
      }
    } catch {
      setAlert('Cannot connect to server. Make sure the backend is running.');
      setLoading(false);
    }
  }

  return (
    <>
      <AuthThemeButton />
      <div className={s.authLayout}>
        <div className={s.authLeft}>
          <div className={s.authLeftInner}>
            <div className={s.authBrand}>
              <div className={s.authBrandIcon}>🎓</div>
              <div>
                <h1>Campus HelpDesk</h1>
                <span>Faculty Portal</span>
              </div>
            </div>
            <div className={s.authHeadline}>
              <h2>Faculty <em>Portal</em></h2>
              <p>Sign in with your Faculty Account to manage your classes, attendance, marks and more.</p>
            </div>
            <div className={s.authFeatures}>
              {FEATURES.map(f => (
                <div key={f.text} className={s.afItem}>
                  <div className={s.afIcon}>{f.icon}</div>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={s.authRight}>
          <form className={s.authFormWrap} onSubmit={handleLogin}>
            <div className={s.authFormHeader}>
              <h2>Faculty Portal</h2>
              <p>Sign in with your Faculty Account</p>
            </div>

            <div className={`${s.alertBox}${alert ? ` ${s.show}` : ''}`}>{alert}</div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Email</label>
              <div className={s.inputWrap}>
                <span className={s.inputIcon}>📧</span>
                <input
                  type="email"
                  className={`${s.formInput}${errors.email ? ` ${s.error}` : ''}`}
                  placeholder="e.g. john@campushelpdesk.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <span className={`${s.formError}${errors.email ? ` ${s.show}` : ''}`}>Please enter your faculty email</span>
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Password</label>
              <div className={`${s.inputWrap} ${s.passWrap}`}>
                <span className={s.inputIcon}>🔒</span>
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`${s.formInput}${errors.pass ? ` ${s.error}` : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className={s.passToggle} onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
              <span className={`${s.formError}${errors.pass ? ` ${s.show}` : ''}`}>Please enter your password</span>
            </div>

            <div className={s.formFooterRow}>
              <label className={s.rememberWrap}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me
              </label>
              <div className={s.forgotLink}>
                <a href="#" onClick={e => { e.preventDefault(); setAlert('Please contact the admin office to reset your faculty password.'); }}>Forgot password?</a>
              </div>
            </div>

            <button type="submit" className={`${s.btnSubmit}${loading ? ` ${s.loading}` : ''}`}>
              {loading ? 'Signing in…' : 'Login to Faculty Portal'}
            </button>

            <div className={s.authDivider}><span>or</span></div>

            <div className={s.authSwitch}>
              Not a faculty member? <Link to="/login">Student / Admin login</Link>
            </div>
            <div className={s.authSwitch} style={{ marginTop: 10 }}>
              <Link to="/">← Back to Home</Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
