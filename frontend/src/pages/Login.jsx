import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../services/api';
import { setSession } from '../services/auth';
import AuthThemeButton from '../components/AuthThemeButton';
import s from '../styles/Login.module.css';

const FEATURES = [
  { icon: '📘', text: 'Exam schedules & hall ticket downloads' },
  { icon: '💳', text: 'Fee payment status and breakdowns' },
  { icon: '💬', text: '24/7 AI chatbot support' },
  { icon: '📝', text: 'Leave applications & request tracking' },
];

export default function Login() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setAlert('');
    const errs = {};
    if (!studentId.trim()) errs.id = true;
    if (!password) errs.pass = true;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.user, data.token);
        navigate(data.user.role === 'admin' ? '/admin' : '/home');
      } else {
        setAlert(data.message || 'Invalid Student ID or password.');
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
                <h1>CampusAssist</h1>
                <span>Smart College Helpdesk</span>
              </div>
            </div>
            <div className={s.authHeadline}>
              <h2>Welcome <em>Back!</em></h2>
              <p>Log in to access your personalized student dashboard with all your academic services.</p>
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
              <h2>Student Login</h2>
              <p>Enter your credentials to access your account</p>
            </div>

            <div className={`${s.alertBox}${alert ? ` ${s.show}` : ''}`}>{alert}</div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Student ID</label>
              <div className={s.inputWrap}>
                <span className={s.inputIcon}>🎓</span>
                <input
                  type="text"
                  className={`${s.formInput}${errors.id ? ` ${s.error}` : ''}`}
                  placeholder="e.g. 22IT101"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                />
              </div>
              <span className={`${s.formError}${errors.id ? ` ${s.show}` : ''}`}>Please enter your Student ID</span>
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
                <button type="button" className={s.passToggle} onClick={() => setShowPass(v => !v)}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
              <span className={`${s.formError}${errors.pass ? ` ${s.show}` : ''}`}>Please enter your password</span>
            </div>

            <div className={s.formFooterRow}>
              <label className={s.rememberWrap}>
                <input type="checkbox" /> Remember me
              </label>
              <div className={s.forgotLink}>
                <a href="#" onClick={e => e.preventDefault()}>Forgot password?</a>
              </div>
            </div>

            <button type="submit" className={`${s.btnSubmit}${loading ? ` ${s.loading}` : ''}`}>
              {loading ? 'Logging in…' : 'Login to Dashboard'}
            </button>

            <div className={s.authDivider}><span>or</span></div>

            <div className={s.authSwitch}>
              Don't have an account? <Link to="/register">Register here</Link>
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
