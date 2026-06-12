// Independent runtime audit — hits the live server on :5000
const BASE = 'http://localhost:5000';
const results = [];
function log(name, pass, detail) { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} ${detail ? '— ' + detail : ''}`); }

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data, headers: res.headers };
}

(async () => {
  // ---- AUTH ----
  const sLogin = await req('POST', '/api/auth/login', { body: { studentId: '22IT101', password: 'student123' } });
  log('Student login', sLogin.status === 200 && !!sLogin.data?.token, `status ${sLogin.status}`);
  const sTok = sLogin.data?.token;

  const aLogin = await req('POST', '/api/auth/login', { body: { studentId: 'ADMIN01', password: 'admin@123' } });
  log('Admin login', aLogin.status === 200 && aLogin.data?.user?.role === 'admin', `status ${aLogin.status}`);
  const aTok = aLogin.data?.token;

  log('Login leaks no password', sLogin.data?.user && sLogin.data.user.password === undefined, '');
  const badLogin = await req('POST', '/api/auth/login', { body: { studentId: '22IT101', password: 'wrong' } });
  log('Wrong password rejected', badLogin.status === 401, `status ${badLogin.status}`);

  // ---- UNAUTH ACCESS (should 401) ----
  const noTok = await req('GET', '/api/requests');
  log('Unauthenticated /requests blocked', noTok.status === 401, `status ${noTok.status}`);
  const badTok = await req('GET', '/api/requests', { token: 'garbage.token.here' });
  log('Invalid token blocked', badTok.status === 401, `status ${badTok.status}`);

  // ---- RBAC: student hitting admin endpoints ----
  const stuAllStudents = await req('GET', '/api/students', { token: sTok });
  log('Student blocked from /students (admin only)', stuAllStudents.status === 403, `status ${stuAllStudents.status}`);
  const stuFeesAll = await req('GET', '/api/fees/all', { token: sTok });
  log('Student blocked from /fees/all', stuFeesAll.status === 403, `status ${stuFeesAll.status}`);
  const stuContacts = await req('GET', '/api/contact', { token: sTok });
  log('Student blocked from /contact list', stuContacts.status === 403, `status ${stuContacts.status}`);

  // ---- Admin can reach admin endpoints ----
  const admStudents = await req('GET', '/api/students', { token: aTok });
  log('Admin can list students', admStudents.status === 200, `count ${admStudents.data?.count}`);

  // ---- IDOR: student fetching another student by id ----
  const someOtherId = admStudents.data?.students?.find(s => s.studentId !== '22IT101')?._id;
  if (someOtherId) {
    const idor = await req('GET', '/api/students/' + someOtherId, { token: sTok });
    log('IDOR: student cannot read another student record', idor.status === 403, `status ${idor.status}`);
    // PUT another student's profile
    const idorPut = await req('PUT', '/api/students/' + someOtherId, { token: sTok, body: { name: 'HACKED' } });
    log('IDOR: student cannot edit another student', idorPut.status === 403, `status ${idorPut.status}`);
  }

  // ---- Privilege escalation: student self-promote to admin ----
  const meId = sLogin.data?.user?._id;
  const escalate = await req('PUT', '/api/students/' + meId, { token: sTok, body: { role: 'admin', isActive: true } });
  const meAfter = await req('GET', '/api/auth/me', { token: sTok });
  log('Privilege escalation blocked (role unchanged)', meAfter.data?.user?.role === 'student', `role now ${meAfter.data?.user?.role}`);

  // ---- Student data isolation: /requests returns only own ----
  const myReq = await req('GET', '/api/requests', { token: sTok });
  const allOwned = (myReq.data?.requests || []).every(r => r.studentId === '22IT101' || r.student?.studentId === '22IT101');
  log('Student /requests shows only own data', myReq.status === 200 && allOwned, `count ${myReq.data?.count}`);

  // ---- Core reads ----
  for (const [name, path] of [['exam','/api/exam'],['fees','/api/fees'],['library','/api/library'],['timetable','/api/timetable'],['notices','/api/notices'],['events','/api/events'],['attendance summary','/api/attendance/summary']]) {
    const r = await req('GET', path, { token: sTok });
    log(`Read ${name}`, r.status === 200, `status ${r.status}`);
  }

  // ---- WRITE: create a request, check refNumber ----
  const created = await req('POST', '/api/requests', { token: sTok, body: { type: 'Bonafide Certificate', purpose: 'Audit test', urgency: 'Normal' } });
  log('Create request (write)', created.status === 201 && !!created.data?.request?.refNumber, `ref ${created.data?.request?.refNumber}`);
  const newId = created.data?.request?._id;
  if (newId) {
    const del = await req('DELETE', '/api/requests/' + newId, { token: sTok });
    log('Delete own request', del.status === 200, `status ${del.status}`);
  }

  // ---- BUSINESS LOGIC: student self-records fee payment ----
  const pay = await req('POST', '/api/fees/payment', { token: sTok, body: { amount: 999999, mode: 'Online', txn: 'FAKE' } });
  log('Fee payment amount cap enforced (>5L rejected)', pay.status === 400, `status ${pay.status}`);
  const paySmall = await req('POST', '/api/fees/payment', { token: sTok, body: { amount: 1, mode: 'Online' } });
  log('NOTE: student CAN self-record a fee payment', paySmall.status === 200, `status ${paySmall.status} (business-logic concern)`);

  // ---- XSS: notice stripHtml (admin posts script) ----
  const xss = await req('POST', '/api/notices', { token: aTok, body: { title: '<script>alert(1)</script>Hi', content: '<img src=x onerror=alert(1)>body', category: 'general' } });
  const stored = xss.data?.notice;
  log('Stored XSS stripped from notice', stored && !/<script|onerror|<img/i.test(stored.title + stored.content), `title="${stored?.title}"`);
  if (stored?._id) await req('DELETE', '/api/notices/' + stored._id, { token: aTok });

  // ---- 404 handling ----
  const notFound = await req('GET', '/api/nonexistent', { token: sTok });
  log('Unknown API route returns JSON 404', notFound.status === 404 && notFound.data?.success === false, `status ${notFound.status}`);

  // ---- Security headers ----
  const headRes = await fetch(BASE + '/login.html');
  const csp = headRes.headers.get('content-security-policy');
  const xcto = headRes.headers.get('x-content-type-options');
  log('CSP header present', !!csp, '');
  log('X-Content-Type-Options present', xcto === 'nosniff', `${xcto}`);

  // ---- Summary ----
  const passed = results.filter(r => r.pass).length;
  console.log(`\n===== ${passed}/${results.length} checks passed =====`);
})();
