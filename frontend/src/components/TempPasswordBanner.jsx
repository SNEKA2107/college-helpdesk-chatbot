import { Link } from 'react-router-dom';
import { getUser } from '../services/auth';

/**
 * Prompt to replace a system-issued temporary password.
 *
 * Audit finding C-2: an admin provisioning a faculty member hands over a
 * generated password and the server records `mustChangePassword` — but nothing
 * ever surfaced it, so the temporary credential stayed in use indefinitely.
 *
 * Renders nothing unless the flag is set, so it is inert for every other account.
 */
export default function TempPasswordBanner({ to = '/faculty/profile' }) {
  const user = getUser();
  if (!user?.mustChangePassword) return null;

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 16px', marginBottom: 16, borderRadius: 10,
        background: 'var(--warning-bg, #fff7ed)',
        border: '1px solid var(--warning, #f59e0b)',
        color: 'var(--text, inherit)', fontSize: 14,
      }}
    >
      <span style={{ fontSize: 18 }}>🔐</span>
      <span style={{ flex: 1, minWidth: 220 }}>
        You are signed in with a temporary password issued by the administrator.
        Please set your own password.
      </span>
      <Link className="btn btn-primary btn-sm" to={to} style={{ padding: '6px 14px' }}>
        Change password
      </Link>
    </div>
  );
}
