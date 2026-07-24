import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, IdCard, Lock, Eye, EyeOff, ArrowRight, LoaderCircle, CircleAlert, Info } from 'lucide-react';
import { API_BASE } from '../services/api';
import { setSession, homePath } from '../services/auth';
import AuthThemeButton from '../components/AuthThemeButton';
import s from '../styles/UnifiedLogin.module.css';

const REMEMBER_KEY = 'ca_remember_id';

const looksLikeEmail = (v) => /^\S+@\S+\.\S+$/.test(v);

/**
 * The login endpoints to try, in order, for a given credential.
 *
 * The backend keeps its two EXISTING endpoints, untouched:
 *   - POST /auth/login          → studentId + password (students and admins)
 *   - POST /auth/faculty-login  → email + password     (faculty)
 *
 * So the *frontend* picks the endpoint from the shape of the credential: an
 * email-looking value goes to faculty-login first, anything else (roll number,
 * admin username) goes to the studentId endpoint. If the first attempt rejects
 * the credential we try the other before giving up, which keeps every credential
 * that worked before working now.
 */
function attemptsFor(identifier) {
  const faculty = { url: `${API_BASE}/auth/faculty-login`, body: { email: identifier } };
  const standard = { url: `${API_BASE}/auth/login`, body: { studentId: identifier } };
  return looksLikeEmail(identifier) ? [faculty, standard] : [standard];
}

/**
 * Single unified login for Student / Faculty / Admin — the user never picks a role.
 *
 * After a successful login the role on the returned user decides the landing page
 * via the shared homePath() helper — the same mapping the route guards use, so
 * login and the guards can never disagree.
 */
export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null); // { type: 'error' | 'info', text }
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setAlert(null);

    const id = identifier.trim();
    const errs = {};
    if (!id) errs.id = true;
    if (!password) errs.pass = true;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    let firstError = '';
    try {
      for (const attempt of attemptsFor(id)) {
        const res = await fetch(attempt.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...attempt.body, password }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          if (remember) localStorage.setItem(REMEMBER_KEY, id);
          else localStorage.removeItem(REMEMBER_KEY);
          setSession(data.user, data.token);
          navigate(homePath(), { replace: true });
          return;
        }

        const message = data.message || data.errors?.[0]?.msg || '';
        if (!firstError) firstError = message;
        // 403 = account state (deactivated / pending / rejected approval). That is a
        // definitive answer about a real account, so surface it instead of retrying.
        if (res.status === 403) {
          setAlert({ type: 'error', text: message || 'This account cannot sign in right now.' });
          setLoading(false);
          return;
        }
      }
      setAlert({ type: 'error', text: firstError || 'Invalid credentials. Please check and try again.' });
    } catch {
      setAlert({ type: 'error', text: 'Cannot connect to server. Make sure the backend is running.' });
    }
    setLoading(false);
  }

  return (
    <>
      <AuthThemeButton />
      <motion.main
        className={s.page}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className={`${s.orb} ${s.orb1}`} aria-hidden="true" />
        <div className={`${s.orb} ${s.orb2}`} aria-hidden="true" />
        <div className={`${s.orb} ${s.orb3}`} aria-hidden="true" />

        <motion.form
          className={s.card}
          onSubmit={handleLogin}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <motion.div
            className={s.brandBlock}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
          >
            <div className={s.logo}>
              <GraduationCap size={32} strokeWidth={2.1} />
            </div>
            <h1 className={s.brand}>CampusAssist</h1>
            <p className={s.subtitle}>AI-Powered College Operating System</p>
          </motion.div>

          {alert && (
            <motion.div
              className={`${s.alert} ${alert.type === 'info' ? s.alertInfo : s.alertError}`}
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {alert.type === 'info' ? <Info size={16} /> : <CircleAlert size={16} />}
              <span>{alert.text}</span>
            </motion.div>
          )}

          <div className={s.field}>
            <label className={s.label} htmlFor="ca-identifier">Username / Email</label>
            <div className={s.inputWrap}>
              <span className={s.inputIcon}><IdCard size={18} /></span>
              <input
                id="ca-identifier"
                type="text"
                className={`${s.input}${errors.id ? ` ${s.inputError}` : ''}`}
                placeholder="Roll number, email or username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
              />
            </div>
            {errors.id && <span className={s.fieldError}>Please enter your username or email</span>}
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor="ca-password">Password</label>
            <div className={s.inputWrap}>
              <span className={s.inputIcon}><Lock size={18} /></span>
              <input
                id="ca-password"
                type={showPass ? 'text' : 'password'}
                className={`${s.input} ${s.hasToggle}${errors.pass ? ` ${s.inputError}` : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={s.passToggle}
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.pass && <span className={s.fieldError}>Please enter your password</span>}
          </div>

          <div className={s.row}>
            <label className={s.remember}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => {
                  setRemember(e.target.checked);
                  if (!e.target.checked) localStorage.removeItem(REMEMBER_KEY);
                }}
              />
              Remember me
            </label>
            {/* No password-reset endpoint exists on the backend — this mirrors the
                guidance the previous login pages showed. */}
            <button
              type="button"
              className={s.forgot}
              onClick={() => setAlert({ type: 'info', text: 'Please contact the college admin office to reset your password.' })}
            >
              Forgot password?
            </button>
          </div>

          <motion.button
            type="submit"
            className={s.submit}
            disabled={loading}
            whileHover={loading ? undefined : { scale: 1.015 }}
            whileTap={loading ? undefined : { scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          >
            {loading
              ? <><LoaderCircle size={18} className={s.spinner} /> Signing in…</>
              : <>Login <ArrowRight size={18} /></>}
          </motion.button>

          <div className={s.divider}><span>or</span></div>

          <div className={s.footer}>
            New student? <Link to="/register">Create an account</Link>
            <p className={s.footerHint}>
              One login for students, faculty and admins — you'll land on your own dashboard automatically.
            </p>
          </div>
        </motion.form>
      </motion.main>
    </>
  );
}
