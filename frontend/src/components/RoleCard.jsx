import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import s from '../styles/RoleSelect.module.css';

/**
 * A single selectable role tile on the role-selection screen.
 *
 * Presentational + reusable: it renders an icon, title and feature list and
 * calls `onSelect` when activated. It intentionally owns NO auth logic — it
 * only navigates (via its parent) to an existing login route.
 *
 * Rendered as a real <button> (via motion.button) so it is keyboard accessible
 * out of the box (Enter / Space activate it) with visible focus states.
 *
 * @param {object}   props
 * @param {React.ElementType} props.icon      Lucide icon component.
 * @param {string}   props.title              Role name.
 * @param {string[]} props.features           Short feature bullets.
 * @param {string}   props.accent             Accent colour (gradient start).
 * @param {string}   props.accent2            Accent colour (gradient end).
 * @param {number}   props.index              Position, used to stagger entrance.
 * @param {function} props.onSelect           Called on click / keyboard activate.
 */
export default function RoleCard({ icon: Icon, title, features, accent, accent2, index = 0, onSelect }) {
  return (
    <motion.button
      type="button"
      className={s.card}
      style={{ '--accent': accent, '--accent-2': accent2 }}
      onClick={onSelect}
      aria-label={`Continue as ${title}`}
      variants={{
        hidden: { opacity: 0, y: 28 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: index * 0.12 } },
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className={s.cardTop}>
        <span className={s.iconBadge}>
          <Icon size={28} strokeWidth={2} aria-hidden="true" />
        </span>
        <ArrowRight className={s.arrow} size={22} aria-hidden="true" />
      </div>

      <h3 className={s.cardTitle}>{title}</h3>

      <ul className={s.features}>
        {features.map(f => (
          <li key={f}><span className={s.dot} aria-hidden="true" />{f}</li>
        ))}
      </ul>

      <span className={s.cardCta}>Continue as {title} →</span>
    </motion.button>
  );
}
