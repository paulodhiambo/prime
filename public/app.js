/* ---------------- Category taxonomy & constants ---------------- */
const CATEGORIES = [
  { name: 'Login Issues', type: 'Login & Access' },
  { name: 'Password Reset', type: 'Login & Access' },
  { name: 'PIN Reset Request', type: 'Login & Access' },
  { name: 'T-Pin Reset', type: 'Login & Access' },
  { name: 'Account Unblocking', type: 'Login & Access' },
  { name: 'OTP Request', type: 'Login & Access' },
  { name: 'Enabling Request', type: 'Login & Access' },
  { name: 'Self Registration', type: 'Login & Access' },
  { name: 'Account Set Up', type: 'Login & Access' },
  { name: 'Transaction Issues', type: 'Transactions' },
  { name: 'Upload Issues (Bulk File)', type: 'Transactions' },
  { name: 'Erroneous Transaction', type: 'Transactions' },
  { name: 'Card Payment Enquiry', type: 'Transactions' },
  { name: 'System Downtime', type: 'System Issue' },
  { name: 'General Enquiry', type: 'Enquiry' },
  { name: 'Navigation Enquiry', type: 'Enquiry' },
  { name: 'Formal Complaint', type: 'Complaint' },
  { name: 'Other', type: 'Other' }
];

const STATUS_COLORS = {
  'Open': '#A4443C',
  'In Progress': '#B8863B',
  'Resolved': '#3F6B4F',
  'Not Confirmed': '#5B6B7A'
};

let currentUser = null;
let ISSUES = [];
let charts = {};
let pendingViewAfterLogin = 'dash';

/* ---------------- App Initialization ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  populateCategorySelect();
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  
  // Status resolution row toggle
  document.getElementById('f-status').addEventListener('change', (e) => {
    document.getElementById('resolution-row').style.display = e.target.value === 'Resolved' ? 'grid' : 'none';
  });

  // Check login state first
  await checkAuth();

  // Load recent issues for logger
  await loadRecentIssues();

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLoginModal();
  });
});

function populateCategorySelect() {
  const sel = document.getElementById('f-category');
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  
  const filtCat = document.getElementById('filt-category');
  filtCat.innerHTML = '<option value="">All categories</option>' + CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  
  updateTypePreview();
}

function updateTypePreview() {
  const cat = document.getElementById('f-category').value;
  const found = CATEGORIES.find(c => c.name === cat);
  document.getElementById('type-pill').textContent = found ? found.type : '—';
}

/* ---------------- Authentication ---------------- */
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
    } else {
      currentUser = null;
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const container = document.getElementById('auth-status-container');
  const textElem = document.getElementById('auth-status-text');
  const actionBtn = document.getElementById('auth-action-btn');
  const lockBadge = document.getElementById('nav-lock-badge');

  if (currentUser) {
    container.classList.add('logged-in');
    textElem.innerHTML = `<span class="auth-user-name">${escapeHtml(currentUser.displayName)}</span> <span class="auth-role-pill">${escapeHtml(currentUser.role)}</span>`;
    actionBtn.textContent = 'Sign out';
    actionBtn.onclick = submitLogout;
    lockBadge.style.display = 'none';
  } else {
    container.classList.remove('logged-in');
    textElem.textContent = 'Staff Login Required';
    actionBtn.textContent = 'Sign in';
    actionBtn.onclick = () => openLoginModal('dash');
    lockBadge.style.display = 'inline';
  }
}

function openLoginModal(targetView = 'dash') {
  pendingViewAfterLogin = targetView;
  const modal = document.getElementById('login-modal');
  const errorBox = document.getElementById('login-error');
  errorBox.style.display = 'none';
  errorBox.textContent = '';
  modal.classList.add('active');
  setTimeout(() => {
    document.getElementById('login-username').focus();
  }, 50);
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.remove('active');
}

async function submitLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');
  const btnText = document.getElementById('login-btn-text');

  if (!username || !password) {
    errorBox.textContent = 'Please enter both username and password.';
    errorBox.style.display = 'block';
    return;
  }

  errorBox.style.display = 'none';
  submitBtn.disabled = true;
  btnText.textContent = 'Signing in...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      errorBox.textContent = data.error || 'Authentication failed. Please check your credentials.';
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      btnText.textContent = 'Sign in to Access Register';
      return;
    }

    currentUser = data.user;
    updateAuthUI();
    closeLoginModal();
    submitBtn.disabled = false;
    btnText.textContent = 'Sign in to Access Register';

    // Switch to target view
    if (pendingViewAfterLogin === 'dash') {
      await switchView('dash');
    }
  } catch (err) {
    console.error('Login error:', err);
    errorBox.textContent = 'Unable to connect to login server. Please try again.';
    errorBox.style.display = 'block';
    submitBtn.disabled = false;
    btnText.textContent = 'Sign in to Access Register';
  }
}

async function submitLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }
  currentUser = null;
  ISSUES = [];
  updateAuthUI();
  switchView('log');
}

/* ---------------- Navigation / View Switching ---------------- */
async function switchView(viewName) {
  if (viewName === 'dash') {
    // If not authenticated, require login first
    if (!currentUser) {
      openLoginModal('dash');
      return;
    }
    document.getElementById('view-log').classList.remove('active');
    document.getElementById('view-dash').classList.add('active');
    document.getElementById('nav-log').classList.remove('active');
    document.getElementById('nav-dash').classList.add('active');
    await loadDashboardData();
  } else {
    document.getElementById('view-log').classList.add('active');
    document.getElementById('view-dash').classList.remove('active');
    document.getElementById('nav-log').classList.add('active');
    document.getElementById('nav-dash').classList.remove('active');
    await loadRecentIssues();
  }
}

/* ---------------- Data Fetching ---------------- */
async function loadRecentIssues() {
  try {
    const res = await fetch('/api/issues/recent');
    if (!res.ok) throw new Error('Failed to fetch recent issues');
    const data = await res.json();

    const list = document.getElementById('recent-list');
    document.getElementById('recent-count').textContent = data.total ? `(${data.total} total)` : '';
    
    if (!data.issues || data.issues.length === 0) {
      list.innerHTML = '<div class="empty-note">No issues logged yet. The first one you record will show here.</div>';
      return;
    }

    list.innerHTML = data.issues.map(i => `
      <div class="recent-item">
        <div class="top">
          <span class="cust">${escapeHtml(i.customerName)}</span>
          <span class="chip ${i.status.replace(/\s+/g, '-')}">${escapeHtml(i.status)}</span>
        </div>
        <div class="cat">${escapeHtml(i.category)} · ${escapeHtml(i.branch)} · ${escapeHtml(i.dateReceived)}</div>
      </div>
    `).join('');

    // Update branch suggestions
    const branchList = document.getElementById('branch-list');
    const branches = [...new Set(data.issues.map(i => i.branch).filter(Boolean))].sort();
    branchList.innerHTML = branches.map(b => `<option value="${escapeHtml(b)}">`).join('');
  } catch (err) {
    console.error('Recent issues error:', err);
  }
}

async function loadDashboardData() {
  try {
    // Fetch full issues register
    const issuesRes = await fetch('/api/issues');
    if (issuesRes.status === 401) {
      currentUser = null;
      updateAuthUI();
      openLoginModal('dash');
      return;
    }
    const issuesData = await issuesRes.json();
    ISSUES = issuesData.issues || [];

    // Fetch aggregate statistics
    const statsRes = await fetch('/api/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById('stat-total').textContent = stats.total;
      document.getElementById('stat-open').textContent = stats.open;
      document.getElementById('stat-resolved').textContent = stats.resolved;
      document.getElementById('stat-topcat').textContent = stats.topCategory || '—';

      drawCategoryChart(stats.categories || {});
      drawStatusChart(stats.statuses || {});
      drawTrendChart(stats.monthly || {});
      drawBranchChart(stats.branches || {});
    }

    renderTable();
  } catch (err) {
    console.error('Dashboard data load error:', err);
  }
}

/* ---------------- Submit Issue ---------------- */
async function submitIssue() {
  const submitBtn = document.getElementById('btn-submit-issue');
  const dateVal = document.getElementById('f-date').value || new Date().toISOString().slice(0, 10);
  const custname = document.getElementById('f-custname').value.trim();
  const details = document.getElementById('f-details').value.trim();
  const branch = document.getElementById('f-branch').value.trim() || 'Not specified';
  const category = document.getElementById('f-category').value;
  const type = (CATEGORIES.find(c => c.name === category) || {}).type || 'Other';
  const status = document.getElementById('f-status').value;
  const solution = document.getElementById('f-solution').value.trim();
  const loggedBy = document.getElementById('f-loggedby').value.trim();

  if (!custname || !details) {
    alert('Please fill in customer name and issue details.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving to SQLite...';

  try {
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateReceived: dateVal,
        channel: document.getElementById('f-channel').value,
        customerType: document.getElementById('f-custtype').value,
        customerName: custname,
        accountNumber: document.getElementById('f-account').value.trim(),
        branch,
        category,
        type,
        details,
        status,
        solution,
        loggedBy
      })
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Error saving issue: ' + (err.error || 'Unknown error'));
      return;
    }

    // Reset Form
    document.getElementById('issue-form').reset();
    document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('resolution-row').style.display = 'none';
    updateTypePreview();

    // Show Confirmation Message
    const msg = document.getElementById('confirm-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3500);

    // Refresh Recent list
    await loadRecentIssues();

    // If currently on dashboard, refresh dashboard
    if (document.getElementById('view-dash').classList.contains('active')) {
      await loadDashboardData();
    }
  } catch (err) {
    console.error('Submit issue error:', err);
    alert('Failed to connect to server to record issue.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Record issue';
  }
}

/* ---------------- Table & Filters ---------------- */
function renderTable() {
  const search = document.getElementById('filt-search').value.toLowerCase().trim();
  const catF = document.getElementById('filt-category').value;
  const statF = document.getElementById('filt-status').value;

  const rows = ISSUES.filter(i => {
    if (catF && i.category !== catF) return false;
    if (statF && i.status !== statF) return false;
    if (search) {
      const haystack = `${i.id} ${i.customerName} ${i.branch} ${i.details} ${i.category} ${i.accountNumber || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const body = document.getElementById('table-body');
  const emptyNote = document.getElementById('table-empty');

  if (rows.length === 0) {
    body.innerHTML = '';
    emptyNote.style.display = 'block';
    return;
  }

  emptyNote.style.display = 'none';
  body.innerHTML = rows.map(i => `
    <tr>
      <td class="id-cell">${escapeHtml(i.id)}</td>
      <td>${escapeHtml(i.dateReceived)}</td>
      <td>
        <strong>${escapeHtml(i.customerName)}</strong>
        <br><span class="small muted">${escapeHtml(i.customerType)} · ${escapeHtml(i.branch)}</span>
      </td>
      <td>${escapeHtml(i.branch)}</td>
      <td>
        <span>${escapeHtml(i.category)}</span>
        <br><span class="type-pill" style="margin-top:2px;">${escapeHtml(i.type)}</span>
      </td>
      <td class="details-cell" title="${escapeHtml(i.details)}">${escapeHtml(truncate(i.details, 90))}</td>
      <td>
        <select class="status-select" onchange="updateStatus('${i.id}', this.value)">
          ${['Open', 'In Progress', 'Not Confirmed', 'Resolved'].map(s => `
            <option value="${s}" ${s === i.status ? 'selected' : ''}>${s}</option>
          `).join('')}
        </select>
      </td>
      <td class="details-cell" title="${escapeHtml(i.solution || 'None recorded')}">
        ${escapeHtml(truncate(i.solution || '—', 70))}
      </td>
    </tr>
  `).join('');
}

async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/issues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Failed to update status: ' + (err.error || 'Server error'));
      return;
    }

    const item = ISSUES.find(i => i.id === id);
    if (item) {
      item.status = newStatus;
      if (newStatus === 'Resolved' && !item.resolutionDate) {
        item.resolutionDate = new Date().toISOString().slice(0, 10);
      }
    }

    // Refresh charts and counts
    await loadDashboardData();
  } catch (err) {
    console.error('Status update error:', err);
    alert('Failed to communicate with server.');
  }
}

/* ---------------- CSV Export ---------------- */
function exportCsv() {
  if (!ISSUES.length) {
    alert('No issues available to export.');
    return;
  }

  const search = document.getElementById('filt-search').value.toLowerCase().trim();
  const catF = document.getElementById('filt-category').value;
  const statF = document.getElementById('filt-status').value;

  const filtered = ISSUES.filter(i => {
    if (catF && i.category !== catF) return false;
    if (statF && i.status !== statF) return false;
    if (search) {
      const haystack = `${i.id} ${i.customerName} ${i.branch} ${i.details} ${i.category}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const headers = [
    'ID', 'Date Received', 'Customer Type', 'Customer Name', 'Account Number',
    'Branch', 'Channel', 'Category', 'Type', 'Details', 'Status',
    'Resolution', 'Resolution Date', 'Logged By', 'Created At'
  ];

  const rows = filtered.map(i => [
    i.id, i.dateReceived, i.customerType, i.customerName, i.accountNumber || '',
    i.branch, i.channel, i.category, i.type, i.details, i.status,
    i.solution || '', i.resolutionDate || '', i.loggedBy || '', i.createdAt || ''
  ]);

  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `primenet-register-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  v = (v === undefined || v === null) ? '' : String(v);
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

/* ---------------- Chart Drawing ---------------- */
function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function drawCategoryChart(counts) {
  destroyChart('cat');
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const ctx = document.getElementById('chart-category');
  if (!ctx) return;

  charts.cat = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: '#17304A',
        borderRadius: 4,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } }
      },
      maintainAspectRatio: false
    }
  });
}

function drawStatusChart(counts) {
  destroyChart('status');
  const labels = Object.keys(counts);
  const ctx = document.getElementById('chart-status');
  if (!ctx) return;

  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: Object.values(counts),
        backgroundColor: labels.map(l => STATUS_COLORS[l] || '#8C7A5B'),
        borderWidth: 2,
        borderColor: '#FFFEFB'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } }
        }
      },
      maintainAspectRatio: false,
      cutout: '62%'
    }
  });
}

function drawTrendChart(monthlyCounts) {
  destroyChart('trend');
  const months = Object.keys(monthlyCounts).sort();
  const ctx = document.getElementById('chart-trend');
  if (!ctx) return;

  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        data: months.map(m => monthlyCounts[m]),
        borderColor: '#AD7F35',
        backgroundColor: 'rgba(173, 127, 53, 0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#AD7F35'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { ticks: { font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } }
      },
      maintainAspectRatio: false
    }
  });
}

function drawBranchChart(branchCounts) {
  destroyChart('branch');
  const entries = Object.entries(branchCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const ctx = document.getElementById('chart-branch');
  if (!ctx) return;

  charts.branch = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: '#3F6B4F',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { ticks: { font: { size: 10.5, family: "'IBM Plex Sans', sans-serif" } } }
      },
      maintainAspectRatio: false
    }
  });
}

/* ---------------- Helpers ---------------- */
function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '…' : (s || '');
}
