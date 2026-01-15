const { createClient } = require('@libsql/client');

let db = null;

function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    const authToken = process.env.DATABASE_AUTH_TOKEN;

    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    db = createClient({
      url,
      authToken
    });
  }
  return db;
}

async function initializeDatabase() {
  const db = getDb();

  // Create access_requests table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      queued_at TEXT,
      activated_at TEXT,
      expires_at TEXT,
      removed_at TEXT,
      slot_number INTEGER,
      automation_attempts INTEGER DEFAULT 0,
      last_automation_error TEXT,
      expiry_warning_sent INTEGER DEFAULT 0,
      expiry_notification_sent INTEGER DEFAULT 0
    )
  `);

  // Create indexes
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_expires_at ON access_requests(expires_at)
  `);

  // Create audit_log table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      action TEXT NOT NULL,
      request_id INTEGER,
      details TEXT,
      performed_by TEXT DEFAULT 'system',
      success INTEGER DEFAULT 1,
      error_message TEXT
    )
  `);

  // Create settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default settings if not exists
  await db.execute(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('max_slots', '25'),
      ('access_duration_days', '7'),
      ('expiry_warning_days', '1'),
      ('automation_enabled', 'true')
  `);

  console.log('Database initialized successfully');
}

async function logAudit(action, requestId, details, performedBy = 'system', success = true, errorMessage = null) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO audit_log (action, request_id, details, performed_by, success, error_message)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [action, requestId, details ? JSON.stringify(details) : null, performedBy, success ? 1 : 0, errorMessage]
  });
}

module.exports = {
  getDb,
  initializeDatabase,
  logAudit
};
