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

/* ---------------- Application State ---------------- */
let currentUser = null;
let ISSUES = [];
let charts = {};
let pendingViewAfterLogin = 'dash';

let currentSort = { column: 'dateReceived', order: 'desc' };
let currentPage = 1;
let pageSize = 10;
let activeQuickFilter = 'all';
let currentSelectedIssueId = null;

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

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLoginModal();
      closeIssueModal();
    }
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

function updateCharCount(val) {
  const count = (val || '').length;
  document.getElementById('details-count').textContent = `${count} character${count === 1 ? '' : 's'}`;
}

function resetIssueForm() {
  document.getElementById('issue-form').reset();
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('resolution-row').style.display = 'none';
  updateTypePreview();
  updateCharCount('');
}

/* ---------------- Toast Notifications ---------------- */
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" title="Dismiss">×</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 200);
  });

  container.appendChild(toast);

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4500);
}

/* ---------------- API Fetch with Dual Auth (Cookie + Bearer Token) ---------------- */
function apiFetch(url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };
  const token = sessionStorage.getItem('primenet_token');
  if (token && !opts.headers['Authorization']) {
    opts.headers['Authorization'] = `Bearer ${token}`;
  }
  opts.credentials = opts.credentials || 'same-origin';
  return fetch(url, opts);
}

/* ---------------- Authentication ---------------- */
async function checkAuth() {
  try {
    const res = await apiFetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
    } else {
      currentUser = null;
      sessionStorage.removeItem('primenet_token');
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
      credentials: 'same-origin',
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

    if (data.token) {
      sessionStorage.setItem('primenet_token', data.token);
    }
    currentUser = data.user;
    updateAuthUI();
    closeLoginModal();
    submitBtn.disabled = false;
    btnText.textContent = 'Sign in to Access Register';
    showToast('Signed In', `Welcome back, ${currentUser.displayName}`);

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
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }
  sessionStorage.removeItem('primenet_token');
  currentUser = null;
  ISSUES = [];
  updateAuthUI();
  showToast('Signed Out', 'You have been signed out of the analysis desk.');
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
  }
}

/* ---------------- Data Fetching ---------------- */
async function loadRecentIssues() {
  if (!currentUser) return;
  try {
    const res = await apiFetch('/api/issues/recent');
    if (res.status === 401) return;
    if (!res.ok) throw new Error('Failed to fetch recent issues');
    const data = await res.json();

    const list = document.getElementById('recent-list');
    if (!list) return;
    document.getElementById('recent-count').textContent = data.total ? `(${data.total} total)` : '';
    
    if (!data.issues || data.issues.length === 0) {
      list.innerHTML = '<div class="empty-note">No issues logged yet. Newly logged incidents will appear here.</div>';
      return;
    }

    list.innerHTML = data.issues.map(i => `
      <div class="recent-item" onclick="openIssueModal('${i.id}')" style="cursor:pointer;" title="Click to view details">
        <div class="top">
          <span class="cust">${escapeHtml(i.customerName)}</span>
          <span class="chip ${i.status.replace(/\s+/g, '-')}">${escapeHtml(i.status)}</span>
        </div>
        <div class="cat">${escapeHtml(i.category)} · ${escapeHtml(i.branch)} · ${escapeHtml(i.dateReceived)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Recent issues error:', err);
  }
}

async function loadDashboardData() {
  try {
    // Load recent issues ticker inside the protected dashboard
    await loadRecentIssues();

    // Fetch full issues register
    const issuesRes = await apiFetch('/api/issues');
    if (issuesRes.status === 401) {
      currentUser = null;
      sessionStorage.removeItem('primenet_token');
      updateAuthUI();
      openLoginModal('dash');
      return;
    }
    const issuesData = await issuesRes.json();
    ISSUES = issuesData.issues || [];

    // Fetch aggregate statistics
    const statsRes = await apiFetch('/api/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const total = stats.total || 0;
      const open = stats.open || 0;
      const resolved = stats.resolved || 0;

      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-open').textContent = open;
      document.getElementById('stat-resolved').textContent = resolved;
      document.getElementById('stat-topcat').textContent = stats.topCategory || '—';

      // Percentages badges
      const openPct = total > 0 ? Math.round((open / total) * 100) : 0;
      const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
      document.getElementById('stat-open-pct').textContent = `${openPct}%`;
      document.getElementById('stat-resolved-pct').textContent = `${resolvedPct}%`;

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
    showToast('Missing Fields', 'Please fill in customer name and issue details.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving to SQLite...';

  try {
    const res = await apiFetch('/api/issues', {
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

    const data = await res.json();
    if (!res.ok || !data.ok) {
      showToast('Error', data.error || 'Failed to save issue.', 'error');
      return;
    }

    const createdId = data.issue ? data.issue.id : 'PN-RECORD';

    // Reset Form
    resetIssueForm();

    // Show Confirmation Message & Toast
    const msg = document.getElementById('confirm-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3500);

    showToast('Issue Recorded', `Incident ${createdId} recorded into central SQLite database.`, 'success');

    // Refresh protected dashboard data if authenticated and on dashboard
    if (currentUser && document.getElementById('view-dash').classList.contains('active')) {
      await loadDashboardData();
    }
  } catch (err) {
    console.error('Submit issue error:', err);
    showToast('Connection Error', 'Failed to connect to server to record issue.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Record issue';
  }
}

/* ---------------- Table, Sorting & Pagination ---------------- */
function onSearchInput() {
  currentPage = 1;
  renderTable();
}

function onFilterChange() {
  currentPage = 1;
  renderTable();
}

function setQuickFilter(type) {
  activeQuickFilter = type;
  document.querySelectorAll('.pill-filter').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(`filter-pill-${type}`);
  if (btn) btn.classList.add('active');
  currentPage = 1;
  renderTable();
}

function toggleSort(column) {
  if (currentSort.column === column) {
    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.column = column;
    currentSort.order = 'asc';
  }
  updateSortIndicators();
  renderTable();
}

function updateSortIndicators() {
  ['id', 'dateReceived', 'customerName', 'branch', 'category', 'status'].forEach(col => {
    const icon = document.getElementById(`sort-${col}`);
    const th = icon ? icon.closest('th') : null;
    if (icon && th) {
      if (currentSort.column === col) {
        th.classList.add('active');
        icon.textContent = currentSort.order === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('active');
        icon.textContent = '⇅';
      }
    }
  });
}

function changePage(delta) {
  currentPage += delta;
  renderTable();
}

function changePageSize(val) {
  pageSize = val === 'all' ? 999999 : parseInt(val, 10);
  currentPage = 1;
  renderTable();
}

function renderTable() {
  const search = document.getElementById('filt-search').value.toLowerCase().trim();
  const catF = document.getElementById('filt-category').value;
  const statF = document.getElementById('filt-status').value;

  // Filter rows
  let rows = ISSUES.filter(i => {
    // Dropdown filters
    if (catF && i.category !== catF) return false;
    if (statF && i.status !== statF) return false;

    // Quick filter pills
    if (activeQuickFilter === 'open' && i.status === 'Resolved') return false;
    if (activeQuickFilter === 'resolved' && i.status !== 'Resolved') return false;

    // Search query
    if (search) {
      const haystack = `${i.id} ${i.customerName} ${i.branch} ${i.details} ${i.category} ${i.accountNumber || ''} ${i.loggedBy || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  // Sort rows
  rows.sort((a, b) => {
    let valA = a[currentSort.column] || '';
    let valB = b[currentSort.column] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
    if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
    return 0;
  });

  const totalFiltered = rows.length;
  const body = document.getElementById('table-body');
  const emptyNote = document.getElementById('table-empty');

  if (totalFiltered === 0) {
    body.innerHTML = '';
    emptyNote.style.display = 'block';
    document.getElementById('pagination-info').textContent = 'Showing 0 of 0 records';
    document.getElementById('btn-prev-page').disabled = true;
    document.getElementById('btn-next-page').disabled = true;
    document.getElementById('pagination-pages').innerHTML = '';
    return;
  }

  emptyNote.style.display = 'none';

  // Pagination calculation
  const totalPages = Math.ceil(totalFiltered / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalFiltered);
  const pagedRows = rows.slice(startIdx, endIdx);

  // Render rows
  body.innerHTML = pagedRows.map(i => `
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
      <td class="details-cell" title="${escapeHtml(i.details)}">${escapeHtml(truncate(i.details, 75))}</td>
      <td>
        <select class="status-select" onchange="updateStatus('${i.id}', this.value)">
          ${['Open', 'In Progress', 'Not Confirmed', 'Resolved'].map(s => `
            <option value="${s}" ${s === i.status ? 'selected' : ''}>${s}</option>
          `).join('')}
        </select>
      </td>
      <td class="details-cell" title="${escapeHtml(i.solution || 'None recorded')}">
        ${escapeHtml(truncate(i.solution || '—', 65))}
      </td>
      <td style="text-align:center;">
        <button class="btn-view" onclick="openIssueModal('${i.id}')" title="View details and update resolution">View / Edit</button>
      </td>
    </tr>
  `).join('');

  // Update Pagination Controls
  document.getElementById('pagination-info').textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalFiltered} records`;
  document.getElementById('btn-prev-page').disabled = currentPage <= 1;
  document.getElementById('btn-next-page').disabled = currentPage >= totalPages;

  // Page Numbers
  const pagesContainer = document.getElementById('pagination-pages');
  if (totalPages <= 6) {
    pagesContainer.innerHTML = Array.from({ length: totalPages }, (_, idx) => {
      const p = idx + 1;
      return `<button class="page-num ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }).join('');
  } else {
    pagesContainer.innerHTML = `
      <button class="page-num ${currentPage === 1 ? 'active' : ''}" onclick="goToPage(1)">1</button>
      ${currentPage > 3 ? '<span style="padding:4px 2px;">…</span>' : ''}
      ${currentPage > 2 && currentPage < totalPages ? `<button class="page-num active">${currentPage}</button>` : ''}
      ${currentPage < totalPages - 2 ? '<span style="padding:4px 2px;">…</span>' : ''}
      <button class="page-num ${currentPage === totalPages ? 'active' : ''}" onclick="goToPage(${totalPages})">${totalPages}</button>
    `;
  }
}

function goToPage(page) {
  currentPage = page;
  renderTable();
}

/* ---------------- Issue Status Update ---------------- */
async function updateStatus(id, newStatus) {
  try {
    const res = await apiFetch(`/api/issues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast('Error', err.error || 'Server error updating status.', 'error');
      return;
    }

    const item = ISSUES.find(i => i.id === id);
    if (item) {
      item.status = newStatus;
      if (newStatus === 'Resolved' && !item.resolutionDate) {
        item.resolutionDate = new Date().toISOString().slice(0, 10);
      }
    }

    showToast('Status Updated', `Issue ${id} set to ${newStatus}.`, 'success');
    await loadDashboardData();
  } catch (err) {
    console.error('Status update error:', err);
    showToast('Network Error', 'Failed to communicate with server.', 'error');
  }
}

/* ---------------- Issue Detail Modal ---------------- */
function openIssueModal(id) {
  const issue = ISSUES.find(i => i.id === id);
  if (!issue) return;

  currentSelectedIssueId = id;
  document.getElementById('modal-issue-id').textContent = issue.id;
  
  const statusBadge = document.getElementById('modal-status-badge');
  statusBadge.className = `chip ${issue.status.replace(/\s+/g, '-')}`;
  statusBadge.textContent = issue.status;

  document.getElementById('modal-meta-line').textContent = `Received on ${issue.dateReceived} via ${issue.channel}`;
  document.getElementById('modal-cust-name').textContent = issue.customerName;
  document.getElementById('modal-acc-num').textContent = issue.accountNumber || 'Not specified';
  document.getElementById('modal-cust-type').textContent = issue.customerType;
  document.getElementById('modal-branch').textContent = issue.branch;
  document.getElementById('modal-channel').textContent = issue.channel;
  document.getElementById('modal-logged-by').textContent = issue.loggedBy || 'Not recorded';

  document.getElementById('modal-category').textContent = issue.category;
  document.getElementById('modal-type-pill').textContent = issue.type;
  document.getElementById('modal-details-text').textContent = issue.details;

  document.getElementById('modal-status-select').value = issue.status;
  document.getElementById('modal-res-date').value = issue.resolutionDate || '';
  document.getElementById('modal-solution-text').value = issue.solution || '';

  document.getElementById('issue-detail-modal').classList.add('active');
}

function closeIssueModal() {
  document.getElementById('issue-detail-modal').classList.remove('active');
  currentSelectedIssueId = null;
}

async function saveModalResolution() {
  if (!currentSelectedIssueId) return;

  const btn = document.getElementById('btn-save-modal');
  const status = document.getElementById('modal-status-select').value;
  const solution = document.getElementById('modal-solution-text').value.trim();
  const resolutionDate = document.getElementById('modal-res-date').value;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await apiFetch(`/api/issues/${currentSelectedIssueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, solution, resolutionDate })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      showToast('Save Failed', data.error || 'Could not update issue.', 'error');
      return;
    }

    const item = ISSUES.find(i => i.id === currentSelectedIssueId);
    if (item) {
      item.status = status;
      item.solution = solution;
      item.resolutionDate = resolutionDate;
    }

    showToast('Updated', `Incident ${currentSelectedIssueId} resolution saved.`, 'success');
    closeIssueModal();
    await loadDashboardData();
  } catch (err) {
    console.error('Modal update error:', err);
    showToast('Error', 'Failed to communicate with server.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

/* ---------------- CSV Export ---------------- */
function exportCsv() {
  if (!ISSUES.length) {
    showToast('Notice', 'No issues available to export.', 'error');
    return;
  }

  const search = document.getElementById('filt-search').value.toLowerCase().trim();
  const catF = document.getElementById('filt-category').value;
  const statF = document.getElementById('filt-status').value;

  const filtered = ISSUES.filter(i => {
    if (catF && i.category !== catF) return false;
    if (statF && i.status !== statF) return false;
    if (activeQuickFilter === 'open' && i.status === 'Resolved') return false;
    if (activeQuickFilter === 'resolved' && i.status !== 'Resolved') return false;
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

  // UTF-8 BOM (\uFEFF) ensures Excel displays international/African names correctly
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  a.href = url;
  a.download = `primenet-register-${dateStr}-${timeStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Export Complete', `Exported ${filtered.length} records to CSV.`, 'success');
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
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#122338',
          titleFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          bodyFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          padding: 8,
          cornerRadius: 6
        }
      },
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
        },
        tooltip: {
          backgroundColor: '#122338',
          titleFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          bodyFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          padding: 8,
          cornerRadius: 6
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
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#122338',
          titleFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          bodyFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          padding: 8,
          cornerRadius: 6
        }
      },
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
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#122338',
          titleFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          bodyFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          padding: 8,
          cornerRadius: 6
        }
      },
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
