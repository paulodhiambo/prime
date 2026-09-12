const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function api(path, options = {}) {
  const url = `${BASE}${path}`;
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };
  if (opts.body && typeof opts.body === 'object') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

test('PrimeNet Issue Desk: Reports, Items & Incident Creation', async (t) => {
  let authToken = '';

  await t.test('1. Unauthenticated requests to reports and items return 401', async () => {
    const statsRes = await api('/api/stats');
    assert.equal(statsRes.status, 401, 'Unauth /api/stats must return 401');

    const issuesRes = await api('/api/issues');
    assert.equal(issuesRes.status, 401, 'Unauth /api/issues must return 401');

    const recentRes = await api('/api/issues/recent');
    assert.equal(recentRes.status, 401, 'Unauth /api/issues/recent must return 401');
  });

  await t.test('2. User login produces active session token', async () => {
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { username: 'analyst', password: 'prime2026' }
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.ok, true);
    assert.ok(loginRes.data.token, 'Token must be present in response');
    assert.equal(loginRes.data.user.username, 'analyst');
    authToken = loginRes.data.token;
  });

  let initialTotal = 0;
  let initialOpen = 0;

  await t.test('3. Logged-in user can view reports and aggregate statistics', async () => {
    const statsRes = await api('/api/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(statsRes.status, 200);
    const stats = statsRes.data;
    assert.ok(typeof stats.total === 'number');
    assert.ok(typeof stats.open === 'number');
    assert.ok(typeof stats.resolved === 'number');
    assert.ok(stats.categories && typeof stats.categories === 'object');
    assert.ok(stats.statuses && typeof stats.statuses === 'object');
    assert.ok(stats.branches && typeof stats.branches === 'object');
    assert.ok(stats.monthly && typeof stats.monthly === 'object');

    initialTotal = stats.total;
    initialOpen = stats.open;
  });

  await t.test('4. Logged-in user can view register items list', async () => {
    const issuesRes = await api('/api/issues', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(issuesRes.status, 200);
    const issues = issuesRes.data.issues;
    assert.ok(Array.isArray(issues));
    assert.ok(issues.length > 0);

    const first = issues[0];
    assert.ok(first.id, 'Issue should have id');
    assert.ok(first.customerName, 'Issue should have customerName');
    assert.ok(first.category, 'Issue should have category');
    assert.ok(first.status, 'Issue should have status');
  });

  let createdIssueId = '';

  await t.test('5. Issue can be recorded successfully', async () => {
    const newIssue = {
      dateReceived: new Date().toISOString().slice(0, 10),
      channel: 'Mobile App',
      customerType: 'Individual',
      customerName: 'Kipchoge Keino',
      accountNumber: '5000129844',
      branch: 'Eldoret',
      category: 'System Downtime',
      type: 'System Issue',
      details: 'Automated notification failed during scheduled branch server migration.',
      status: 'Open',
      solution: '',
      loggedBy: 'Jane Wambui (Analyst)'
    };

    const createRes = await api('/api/issues', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: newIssue
    });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.ok, true);
    assert.ok(createRes.data.issue);
    assert.ok(createRes.data.issue.id.startsWith('PN-'));
    createdIssueId = createRes.data.issue.id;
  });

  await t.test('6. Newly recorded issue appears in reports, recent activity, and register', async () => {
    // 6a. Single item lookup
    const singleRes = await api(`/api/issues/${createdIssueId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(singleRes.status, 200);
    assert.equal(singleRes.data.issue.id, createdIssueId);
    assert.equal(singleRes.data.issue.customerName, 'Kipchoge Keino');

    // 6b. Recent activity list
    const recentRes = await api('/api/issues/recent', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(recentRes.status, 200);
    const recentIds = recentRes.data.issues.map(i => i.id);
    assert.ok(recentIds.includes(createdIssueId), 'New issue must appear in recent activity');

    // 6c. Reports updated
    const statsRes = await api('/api/stats', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.data.total, initialTotal + 1, 'Total count must increment');
    assert.equal(statsRes.data.open, initialOpen + 1, 'Open count must increment');
  });

  await t.test('7. Recorded issue can be resolved with notes', async () => {
    const patchRes = await api(`/api/issues/${createdIssueId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        status: 'Resolved',
        solution: 'Server migration completed; notification queue drained successfully.',
        resolutionDate: new Date().toISOString().slice(0, 10)
      }
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.ok, true);

    // Verify status changed on issue
    const verifyRes = await api(`/api/issues/${createdIssueId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(verifyRes.data.issue.status, 'Resolved');
    assert.ok(verifyRes.data.issue.solution.includes('queue drained'));
  });

  await t.test('8. Front-desk branch intake can record issues without login, visible to logged-in analyst', async () => {
    const publicIncident = {
      dateReceived: new Date().toISOString().slice(0, 10),
      channel: 'Branch',
      customerType: 'Individual',
      customerName: 'Amina Mohamed',
      accountNumber: '1000762143',
      branch: 'Mombasa',
      category: 'PIN Reset Request',
      type: 'Login & Access',
      details: 'Customer requested ATM card PIN change following PIN compromise alert.',
      status: 'Open',
      solution: '',
      loggedBy: 'Branch Teller 04'
    };

    // Public POST without Authorization header
    const intakeRes = await api('/api/issues', {
      method: 'POST',
      body: publicIncident
    });

    assert.equal(intakeRes.status, 201);
    assert.equal(intakeRes.data.ok, true);
    const pubId = intakeRes.data.issue.id;

    // Logged in analyst immediately sees it in register
    const analystViewRes = await api(`/api/issues/${pubId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.equal(analystViewRes.status, 200);
    assert.equal(analystViewRes.data.issue.customerName, 'Amina Mohamed');
    assert.equal(analystViewRes.data.issue.branch, 'Mombasa');
  });
});

