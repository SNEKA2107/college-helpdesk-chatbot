/**
 * Password source for seed and provisioning scripts.
 *
 * The seed scripts used to hardcode admin@123 / student123 / faculty123, and
 * those values were also published in the project documentation and defaulted to
 * by the production smoke test. Any seed run against a real database therefore
 * left accounts whose passwords were public knowledge.
 *
 * Now: a password must come from the environment. If none is set, a strong one
 * is generated, printed ONCE, and the account is flagged mustChangePassword so
 * it cannot stay on a system-issued secret.
 */
const crypto = require('crypto');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%-_';

/** Cryptographically random password that satisfies the app's policy. */
function generatePassword(length = 16) {
  const pick = set => set[crypto.randomInt(0, set.length)];
  const chars = [pick('ABCDEFGHJKLMNPQRSTUVWXYZ'), pick('abcdefghijkmnpqrstuvwxyz'),
                 pick('23456789'), pick('@#%-_')];
  while (chars.length < length) chars.push(pick(CHARS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const announced = new Set();

/**
 * Resolve the password for a seeded role.
 * @param {string} role   'admin' | 'student' | 'faculty' — selects the env var
 * @returns {{password: string, generated: boolean}}
 */
function seedPassword(role) {
  const envVar = `SEED_${role.toUpperCase()}_PASSWORD`;
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.trim()) return { password: fromEnv.trim(), generated: false };

  const password = generatePassword();
  if (!announced.has(role)) {
    announced.add(role);
    console.log(`\n  🔑 Generated ${role} password: ${password}`);
    console.log(`     Shown once. Set ${envVar} to choose your own.`);
    console.log('     The account is flagged to require a password change at first login.\n');
  }
  return { password, generated: true };
}

module.exports = { seedPassword, generatePassword };
