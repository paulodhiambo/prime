const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'primenet.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL;');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    date_received TEXT NOT NULL,
    channel TEXT NOT NULL,
    customer_type TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    account_number TEXT,
    branch TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL,
    solution TEXT,
    logged_by TEXT,
    resolution_date TEXT,
    created_at TEXT NOT NULL
  );
`);

// Password helper functions
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Seed Users if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const seedUserStmt = db.prepare(`
    INSERT INTO users (username, password_hash, salt, display_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  
  // 1. Admin
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminHash = hashPassword('admin123', adminSalt);
  seedUserStmt.run('admin', adminHash, adminSalt, 'System Admin', 'admin', now);

  // 2. Analyst
  const analystSalt = crypto.randomBytes(16).toString('hex');
  const analystHash = hashPassword('prime2026', analystSalt);
  seedUserStmt.run('analyst', analystHash, analystSalt, 'Jane Wambui (Analyst)', 'analyst', now);

  console.log('Default users seeded: admin/admin123, analyst/prime2026');
}

// Seed Initial Sample Issues if empty
const issueCount = db.prepare('SELECT COUNT(*) as count FROM issues').get().count;
if (issueCount === 0) {
  const seedIssueStmt = db.prepare(`
    INSERT INTO issues (
      id, date_received, channel, customer_type, customer_name,
      account_number, branch, category, type, details,
      status, solution, logged_by, resolution_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleIssues = [
    {
      id: 'PN-M8A101',
      date_received: '2026-07-14',
      channel: 'Branch',
      customer_type: 'Individual',
      customer_name: 'David Ochieng',
      account_number: '3000212824',
      branch: 'Riverside',
      category: 'Password Reset',
      type: 'Login & Access',
      details: 'Customer locked out after 3 incorrect attempts. Requested temporary reset link.',
      status: 'Resolved',
      solution: 'Reset link generated and SMS notification dispatched. Customer confirmed access.',
      logged_by: 'E. Kiprop',
      resolution_date: '2026-07-14',
      created_at: '2026-07-14T08:30:00Z'
    },
    {
      id: 'PN-M8A102',
      date_received: '2026-07-22',
      channel: 'Mobile App',
      customer_type: 'Collective',
      customer_name: 'Apex Logistics Ltd',
      account_number: '1100489920',
      branch: 'Westlands',
      category: 'Upload Issues (Bulk File)',
      type: 'Transactions',
      details: 'Payroll salary batch failing on row 42 with invalid character encoding error.',
      status: 'Resolved',
      solution: 'Identified non-ASCII character in employee name column. Reparsed and processed batch successfully.',
      logged_by: 'M. Mwangi',
      resolution_date: '2026-07-23',
      created_at: '2026-07-22T11:15:00Z'
    },
    {
      id: 'PN-M8A103',
      date_received: '2026-08-04',
      channel: 'Call Centre',
      customer_type: 'Individual',
      customer_name: 'Grace Muthoni',
      account_number: '3000554192',
      branch: 'Upper Hill',
      category: 'OTP Request',
      type: 'Login & Access',
      details: 'Delay in receiving OTP SMS during PrimeNet web login. Telecommunication delay reported.',
      status: 'Resolved',
      solution: 'Switched primary channel to email OTP and verified phone number gateway routing.',
      logged_by: 'J. Njeri',
      resolution_date: '2026-08-04',
      created_at: '2026-08-04T09:45:00Z'
    },
    {
      id: 'PN-M8A104',
      date_received: '2026-08-11',
      channel: 'Branch',
      customer_type: 'Collective',
      customer_name: 'Summit Engineering',
      account_number: '2000889104',
      branch: 'Industrial Area',
      category: 'T-Pin Reset',
      type: 'Login & Access',
      details: 'Signatory forgot T-Pin required for authorising EFT high-value outward transfers.',
      status: 'Resolved',
      solution: 'Mandate verified with signed company board resolution, new T-Pin token provisioned.',
      logged_by: 'S. Otieno',
      resolution_date: '2026-08-12',
      created_at: '2026-08-11T14:10:00Z'
    },
    {
      id: 'PN-M8A105',
      date_received: '2026-08-19',
      channel: 'Email',
      customer_type: 'Individual',
      customer_name: 'Patrick Koech',
      account_number: '3000918231',
      branch: 'CBD',
      category: 'Card Payment Enquiry',
      type: 'Transactions',
      details: 'Online debit card transaction debited twice at merchant portal for KES 14,500.',
      status: 'In Progress',
      solution: 'Reversal chargeback initiated with card schemes operations desk.',
      logged_by: 'A. Mutua',
      resolution_date: '',
      created_at: '2026-08-19T10:00:00Z'
    },
    {
      id: 'PN-M8A106',
      date_received: '2026-08-28',
      channel: 'Branch',
      customer_type: 'Individual',
      customer_name: 'Fatuma Hassan',
      account_number: '3000109945',
      branch: 'Mombasa',
      category: 'Account Unblocking',
      type: 'Login & Access',
      details: 'Account restricted following periodic KYC review requirement flag.',
      status: 'Resolved',
      solution: 'Updated national ID and utility bill in core banking, removed hold on digital banking profile.',
      logged_by: 'H. Ali',
      resolution_date: '2026-08-29',
      created_at: '2026-08-28T16:20:00Z'
    },
    {
      id: 'PN-M8A107',
      date_received: '2026-09-01',
      channel: 'Website',
      customer_type: 'Individual',
      customer_name: 'Brian Kiptoo',
      account_number: '3000491827',
      branch: 'Riverside',
      category: 'Login Issues',
      type: 'Login & Access',
      details: 'Browser error 502 Bad Gateway intermittently appearing on prime banking portal.',
      status: 'Resolved',
      solution: 'Infrastructure load balancer cleared and node refreshed.',
      logged_by: 'K. Chebet',
      resolution_date: '2026-09-01',
      created_at: '2026-09-01T07:10:00Z'
    },
    {
      id: 'PN-M8A108',
      date_received: '2026-09-04',
      channel: 'Phone Call',
      customer_type: 'Collective',
      customer_name: 'Highland Tea Exporters',
      account_number: '1100378190',
      branch: 'Kisumu',
      category: 'Erroneous Transaction',
      type: 'Transactions',
      details: 'Customer input wrong beneficiary SWIFT routing code on foreign currency transfer.',
      status: 'In Progress',
      solution: 'Swift MT199 query message sent to correspondent bank to hold/recall funds.',
      logged_by: 'T. Odhiambo',
      resolution_date: '',
      created_at: '2026-09-04T12:00:00Z'
    },
    {
      id: 'PN-M8A109',
      date_received: '2026-09-07',
      channel: 'Branch',
      customer_type: 'Individual',
      customer_name: 'Beatrice Ndinda',
      account_number: '3000671209',
      branch: 'Karen',
      category: 'Self Registration',
      type: 'Login & Access',
      details: 'Customer experiencing facial biometric scan timeout on digital onboarding workflow.',
      status: 'Open',
      solution: '',
      logged_by: 'L. Wanjiku',
      resolution_date: '',
      created_at: '2026-09-07T11:40:00Z'
    },
    {
      id: 'PN-M8A110',
      date_received: '2026-09-09',
      channel: 'Call Centre',
      customer_type: 'Individual',
      customer_name: 'Samuel Gichuru',
      account_number: '3000781290',
      branch: 'Westlands',
      category: 'General Enquiry',
      type: 'Enquiry',
      details: 'Enquiring on daily transaction limit increase for RTGS corporate payroll disbursements.',
      status: 'Resolved',
      solution: 'Provided limit enhancement documentation and forwarded limit change indemnity form.',
      logged_by: 'R. Kilonzo',
      resolution_date: '2026-09-09',
      created_at: '2026-09-09T14:30:00Z'
    },
    {
      id: 'PN-M8A111',
      date_received: '2026-09-11',
      channel: 'Branch',
      customer_type: 'Individual',
      customer_name: 'Mercy Cherono',
      account_number: '3000832104',
      branch: 'CBD',
      category: 'PIN Reset Request',
      type: 'Login & Access',
      details: 'User forgot login security PIN after device change.',
      status: 'Resolved',
      solution: 'PIN reset token sent to registered mobile number; customer authenticated successfully.',
      logged_by: 'P. Kamau',
      resolution_date: '2026-09-11',
      created_at: '2026-09-11T09:15:00Z'
    },
    {
      id: 'PN-M8A112',
      date_received: '2026-09-12',
      channel: 'Email',
      customer_type: 'Collective',
      customer_name: 'Savannah Agribusiness',
      account_number: '2000543210',
      branch: 'Upper Hill',
      category: 'Transaction Issues',
      type: 'Transactions',
      details: 'Scheduled standing order did not trigger at midnight 00:00.',
      status: 'Open',
      solution: '',
      logged_by: 'C. Makena',
      resolution_date: '',
      created_at: '2026-09-12T06:10:00Z'
    }
  ];

  for (const item of sampleIssues) {
    seedIssueStmt.run(
      item.id, item.date_received, item.channel, item.customer_type, item.customer_name,
      item.account_number, item.branch, item.category, item.type, item.details,
      item.status, item.solution, item.logged_by, item.resolution_date, item.created_at
    );
  }
  console.log(`Seeded ${sampleIssues.length} initial issues into SQLite.`);
}

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function requireAuth(req, res, next) {
  const token = req.cookies.primenet_session;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required to access the register & analysis desk' });
  }

  const now = Date.now();
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.username, u.display_name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now);

  if (!session) {
    res.clearCookie('primenet_session');
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.user = {
    id: session.id,
    username: session.username,
    displayName: session.display_name,
    role: session.role
  };
  next();
}

// ==================== AUTH ROUTES ====================

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.primenet_session;
  if (!token) {
    return res.json({ authenticated: false, user: null });
  }

  const now = Date.now();
  const session = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now);

  if (!session) {
    res.clearCookie('primenet_session');
    return res.json({ authenticated: false, user: null });
  }

  res.json({
    authenticated: true,
    user: {
      id: session.id,
      username: session.username,
      displayName: session.display_name,
      role: session.role
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = verifyPassword(password, user.salt, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Create session (7 days validity)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, user.id, expiresAt);

  res.cookie('primenet_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production'
  });

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.primenet_session;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('primenet_session');
  res.json({ ok: true });
});

// ==================== ISSUE ROUTES ====================

// Public endpoint: Branch staff can record issues without full register access
app.post('/api/issues', (req, res) => {
  try {
    const {
      dateReceived,
      channel,
      customerType,
      customerName,
      accountNumber,
      branch,
      category,
      type,
      details,
      status,
      solution,
      loggedBy
    } = req.body || {};

    if (!customerName || !details || !category) {
      return res.status(400).json({ error: 'Customer name, category, and issue details are required.' });
    }

    const id = 'PN-' + Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString();
    const dateVal = dateReceived || now.slice(0, 10);
    const finalStatus = status || 'Open';
    const resolutionDate = finalStatus === 'Resolved' ? (now.slice(0, 10)) : '';

    const stmt = db.prepare(`
      INSERT INTO issues (
        id, date_received, channel, customer_type, customer_name,
        account_number, branch, category, type, details,
        status, solution, logged_by, resolution_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dateVal,
      channel || 'Branch',
      customerType || 'Individual',
      customerName.trim(),
      (accountNumber || '').trim(),
      (branch || 'Not specified').trim(),
      category,
      type || 'Other',
      details.trim(),
      finalStatus,
      (solution || '').trim(),
      (loggedBy || '').trim(),
      resolutionDate,
      now
    );

    const created = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
    res.status(201).json({
      ok: true,
      issue: {
        id: created.id,
        dateReceived: created.date_received,
        channel: created.channel,
        customerType: created.customer_type,
        customerName: created.customer_name,
        accountNumber: created.account_number,
        branch: created.branch,
        category: created.category,
        type: created.type,
        details: created.details,
        status: created.status,
        solution: created.solution,
        loggedBy: created.logged_by,
        resolutionDate: created.resolution_date,
        createdAt: created.created_at
      }
    });
  } catch (err) {
    console.error('Error recording issue:', err);
    res.status(500).json({ error: 'Failed to record issue into database' });
  }
});

// Recent issues ticker for logging view
app.get('/api/issues/recent', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, date_received, customer_name, branch, category, status, created_at
      FROM issues
      ORDER BY created_at DESC
      LIMIT 8
    `).all();

    const total = db.prepare('SELECT COUNT(*) as count FROM issues').get().count;

    res.json({
      total,
      issues: rows.map(r => ({
        id: r.id,
        dateReceived: r.date_received,
        customerName: r.customer_name,
        branch: r.branch,
        category: r.category,
        status: r.status,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error('Error fetching recent issues:', err);
    res.status(500).json({ error: 'Failed to fetch recent issues' });
  }
});

// Protected: Full issue register for analysis
app.get('/api/issues', requireAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM issues
      ORDER BY date_received DESC, created_at DESC
    `).all();

    const issues = rows.map(r => ({
      id: r.id,
      dateReceived: r.date_received,
      channel: r.channel,
      customerType: r.customer_type,
      customerName: r.customer_name,
      accountNumber: r.account_number,
      branch: r.branch,
      category: r.category,
      type: r.type,
      details: r.details,
      status: r.status,
      solution: r.solution,
      loggedBy: r.logged_by,
      resolutionDate: r.resolution_date,
      createdAt: r.created_at
    }));

    res.json({ issues });
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// Protected: Update status and resolution
app.patch('/api/issues/:id/status', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status, solution } = req.body || {};

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const existing = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const resolutionDate = status === 'Resolved' ? (existing.resolution_date || new Date().toISOString().slice(0, 10)) : '';
    const newSolution = solution !== undefined ? solution : existing.solution;

    db.prepare(`
      UPDATE issues
      SET status = ?, solution = ?, resolution_date = ?
      WHERE id = ?
    `).run(status, newSolution, resolutionDate, id);

    const updated = db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
    res.json({
      ok: true,
      issue: {
        id: updated.id,
        status: updated.status,
        solution: updated.solution,
        resolutionDate: updated.resolution_date
      }
    });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update issue status' });
  }
});

// Protected: Aggregate statistics for charts
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM issues').get().count;
    const openCount = db.prepare(`
      SELECT COUNT(*) as count FROM issues WHERE status IN ('Open', 'In Progress', 'Not Confirmed')
    `).get().count;
    const resolvedCount = db.prepare(`
      SELECT COUNT(*) as count FROM issues WHERE status = 'Resolved'
    `).get().count;

    // By category
    const catRows = db.prepare(`
      SELECT category, COUNT(*) as count FROM issues GROUP BY category ORDER BY count DESC
    `).all();
    const categories = {};
    for (const r of catRows) categories[r.category] = r.count;

    // By status
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as count FROM issues GROUP BY status
    `).all();
    const statuses = {};
    for (const r of statusRows) statuses[r.status] = r.count;

    // By branch (top 10)
    const branchRows = db.prepare(`
      SELECT branch, COUNT(*) as count FROM issues GROUP BY branch ORDER BY count DESC LIMIT 10
    `).all();
    const branches = {};
    for (const r of branchRows) branches[r.branch] = r.count;

    // Monthly trend
    const monthRows = db.prepare(`
      SELECT SUBSTR(date_received, 1, 7) as month, COUNT(*) as count
      FROM issues
      WHERE month IS NOT NULL AND month != ''
      GROUP BY month
      ORDER BY month ASC
    `).all();
    const monthly = {};
    for (const r of monthRows) monthly[r.month] = r.count;

    const topCategory = catRows.length > 0 ? catRows[0].category : '—';

    res.json({
      total,
      open: openCount,
      resolved: resolvedCount,
      topCategory,
      categories,
      statuses,
      branches,
      monthly
    });
  } catch (err) {
    console.error('Error generating stats:', err);
    res.status(500).json({ error: 'Failed to generate statistics' });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PrimeNet Issue Desk running at http://localhost:${PORT}`);
});
