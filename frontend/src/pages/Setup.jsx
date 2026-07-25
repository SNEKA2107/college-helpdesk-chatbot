import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, User, IdCard, Mail, Lock, ArrowRight, LoaderCircle, CircleAlert, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../services/api';
import { setSession } from '../services/auth';
import AuthThemeButton from '../components/AuthThemeButton';
import s from '../styles/UnifiedLogin.module.css';

/**
 * First-run setup — creates the very first administrator (audit finding C-1).
 *
 * Before this existed a brand-new deployment had no admin and therefore no way
 * in: the only options were running backend/create-admin.js (which hardcoded
 * ADMIN01/admin@123) or editing the database by hand.
 *
 * The server hard-gates POST /api/auth/setup on there being zero admin accounts
 * and returns 410 Gone afterwards, so this page cannot be used to escalate
 * privileges once the college is live.
 */
export default function Setup() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '', confirm: '' });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/auth/setup-status`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        setAllowed(!!d.needsSetup);
        setChecking(false);
        if (!d.needsSetup) setTimeout(() => navigate('/login', { replace: true }), 2200);
      })
      .catch(() => { if (alive) { setChecking(false); setAllowed(false); } });
    return () => { alive = false; };
  }, [navigate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    if (!form.name.trim() || !form.studentId.trim() || !form.email.trim() || !form.password) {
      setAlert('All fields are required.'); return;
    }
    if (form.password !== form.confirm) { setAlert('The two passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), studentId: form.studentId.trim(),
          email: form.email.trim(), password: form.password,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.user, data.token);
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      setAlert(data.message || 'Setup failed.');
    } catch {
      setAlert('Cannot connect to the server.');
    }
    setLoading(false);
  }

  return (
    <>
      <AuthThemeButton />
      <motion.main className={s.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
        <div className={`${s.orb} ${s.orb1}`} aria-hidden="true" />
        <div className={`${s.orb} ${s.orb2}`} aria-hidden="true" />
        <div className={`${s.orb} ${s.orb3}`} aria-hidden="true" />

        <motion.form
          className={s.card} onSubmit={submit}
          initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <div className={s.brandBlock}>
            <div className={s.logo}><ShieldCheck size={32} strokeWidth={2.1} /></div>
            <h1 className={s.brand}>CampusAssist</h1>
            <p className={s.subtitle}>First-time setup · create your administrator</p>
          </div>

          {checking && <div className={`${s.alert} ${s.alertInfo}`}><LoaderCircle size={16} className={s.spinner} /><span>Checking setup status…</span></div>}

          {!checking && !allowed && (
            <div className={`${s.alert} ${s.alertInfo}`} role="alert">
              <CheckCircle2 size={16} />
              <span>This system is already set up. Taking you to the login page…</span>
            </div>
          )}

          {!checking && allowed && (
            <>
              {alert && (
                <div className={`${s.alert} ${s.alertError}`} role="alert">
                  <CircleAlert size={16} /><span>{alert}</span>
                </div>
              )}

              <div className={s.field}>
                <label className={s.label} htmlFor="su-name">Full name</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}><User size={18} /></span>
                  <input id="su-name" className={s.input} placeholder="e.g. Registrar" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label} htmlFor="su-id">Admin username</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}><IdCard size={18} /></span>
                  <input id="su-id" className={s.input} placeholder="the ID you will log in with" autoCapitalize="none"
                         value={form.studentId} onChange={e => set('studentId', e.target.value)} />
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label} htmlFor="su-email">Email</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}><Mail size={18} /></span>
                  <input id="su-email" type="email" className={s.input} placeholder="admin@yourcollege.edu" autoCapitalize="none"
                         value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label} htmlFor="su-pass">Password</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}><Lock size={18} /></span>
                  <input id="su-pass" type="password" className={s.input} placeholder="min 8 chars, a letter and a digit"
                         value={form.password} onChange={e => set('password', e.target.value)} />
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label} htmlFor="su-conf">Confirm password</label>
                <div className={s.inputWrap}>
                  <span className={s.inputIcon}><Lock size={18} /></span>
                  <input id="su-conf" type="password" className={s.input} placeholder="repeat the password"
                         value={form.confirm} onChange={e => set('confirm', e.target.value)} />
                </div>
              </div>

              <motion.button type="submit" className={s.submit} disabled={loading}
                whileHover={loading ? undefined : { scale: 1.015 }} whileTap={loading ? undefined : { scale: 0.985 }}>
                {loading
                  ? <><LoaderCircle size={18} className={s.spinner} /> Creating…</>
                  : <>Create administrator <ArrowRight size={18} /></>}
              </motion.button>

              <p className={s.footerHint} style={{ marginTop: 18 }}>
                This page works only while no administrator exists. Once you finish, it is permanently closed.
              </p>
            </>
          )}
        </motion.form>
      </motion.main>
    </>
  );
}
