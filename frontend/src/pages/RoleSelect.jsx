import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Users, ShieldCheck } from 'lucide-react';
import AuthThemeButton from '../components/AuthThemeButton';
import RoleCard from '../components/RoleCard';
import s from '../styles/RoleSelect.module.css';

/**
 * "Choose Your Role" entry screen — the app's public landing at "/".
 *
 * This screen ONLY routes the user to one of the three EXISTING login pages.
 * It contains no auth/JWT logic and duplicates no login form:
 *   - Student → /login?role=student   (existing Login page)
 *   - Faculty → /faculty/login        (existing FacultyLogin page)
 *   - Admin   → /login?role=admin     (existing Login page)
 */
const ROLES = [
  {
    key: 'student',
    title: 'Student',
    icon: GraduationCap,
    accent: '#4E85BF',
    accent2: '#6366f1',
    features: ['Attendance', 'Marks', 'Timetable', 'AI Assistant'],
    route: '/login?role=student',
  },
  {
    key: 'faculty',
    title: 'Faculty',
    icon: Users,
    accent: '#7c5cff',
    accent2: '#8b5cf6',
    features: ['Attendance', 'Marks', 'Assignments', 'Study Materials'],
    route: '/faculty/login',
  },
  {
    key: 'admin',
    title: 'Admin',
    icon: ShieldCheck,
    accent: '#a855f7',
    accent2: '#7c3aed',
    features: ['Student Management', 'Faculty Management', 'Analytics', 'Notices'],
    route: '/login?role=admin',
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <motion.main
      className={s.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <AuthThemeButton />

      <div className={s.orb + ' ' + s.orb1} aria-hidden="true" />
      <div className={s.orb + ' ' + s.orb2} aria-hidden="true" />

      <motion.header
        className={s.header}
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
      >
        <h1 className={s.brand}>
          <span className={s.brandName}>CampusAssist</span> 🎓
        </h1>
        <p className={s.subtitle}>AI-Powered College Operating System</p>
        <p className={s.desc}>Choose your role to continue</p>
      </motion.header>

      {/* Stagger container: each RoleCard animates in sequentially. */}
      <motion.div
        className={s.grid}
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
      >
        {ROLES.map((r, i) => (
          <RoleCard
            key={r.key}
            index={i}
            icon={r.icon}
            title={r.title}
            features={r.features}
            accent={r.accent}
            accent2={r.accent2}
            onSelect={() => navigate(r.route)}
          />
        ))}
      </motion.div>

      <motion.p
        className={s.footerLinks}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        New student? <a href="/register" onClick={e => { e.preventDefault(); navigate('/register'); }}>Create an account</a>
        <span className={s.sep} aria-hidden="true">·</span>
        <a href="/welcome" onClick={e => { e.preventDefault(); navigate('/welcome'); }}>Learn more about CampusAssist</a>
      </motion.p>
    </motion.main>
  );
}
