import { useTheme } from '../hooks/useTheme';

/** Floating theme switcher used on the public auth/landing pages. */
export default function AuthThemeButton() {
  const { current, next, cycle } = useTheme();
  return (
    <button
      onClick={cycle}
      title={`Switch to ${next.label} mode`}
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 999,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '8px 14px', fontSize: 16, cursor: 'pointer', color: 'var(--text)',
        display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'all .2s',
      }}
    >
      {current.icon} <span style={{ fontSize: 12, fontWeight: 600 }}>{current.label}</span>
    </button>
  );
}
