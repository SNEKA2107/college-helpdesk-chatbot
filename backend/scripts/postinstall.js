#!/usr/bin/env node
/**
 * Build the React frontend after `npm install` — but only when this install is
 * actually producing a single-origin deployment that serves the UI.
 *
 * Why this needs a guard:
 *   The backend used to build the frontend unconditionally on postinstall. That
 *   is correct for a host like Render, where one service serves both the API and
 *   frontend/dist. It is wrong for an API-only deployment (Vercel, Fly, a
 *   container), where the frontend is deployed separately: the build burns
 *   several minutes of build time producing a dist/ that is never served, and
 *   fails the whole deploy if the frontend's devDependencies cannot install.
 *
 * Skips when:
 *   VERCEL is set             — serverless/API-only deploy, frontend hosted apart
 *   SKIP_FRONTEND_BUILD=1     — explicit opt-out for containers and CI
 *   ../frontend is missing    — backend checked out on its own
 *
 * Exit code is always 0 for a skip: a skipped optional build is not an install
 * failure, and returning non-zero here would abort an otherwise fine deploy.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..', '..', 'frontend');

function skip(reason) {
  console.log(`[postinstall] Skipping frontend build — ${reason}.`);
  process.exit(0);
}

if (process.env.VERCEL) skip('running on Vercel (API-only deployment)');
if (process.env.SKIP_FRONTEND_BUILD === '1') skip('SKIP_FRONTEND_BUILD=1');
if (!fs.existsSync(frontendDir)) skip(`no frontend directory at ${frontendDir}`);

console.log('[postinstall] Building frontend for single-origin deployment…');
try {
  execSync('npm install --include=dev && npm run build', {
    cwd: frontendDir,
    stdio: 'inherit',
  });
  console.log('[postinstall] Frontend build complete.');
} catch (err) {
  console.error('[postinstall] Frontend build failed:', err.message);
  // This one *is* fatal: a single-origin deploy with no dist/ would boot and
  // then serve 404s for every page, which is worse than failing the deploy.
  process.exit(1);
}
