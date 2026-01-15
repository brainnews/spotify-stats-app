const { getDb, logAudit } = require('./db');

const MAX_SLOTS = 25;
const ACCESS_DURATION_DAYS = 7;

async function submitAccessRequest(email, fullName) {
  const db = getDb();

  // Check if email already has an active request
  const existing = await db.execute({
    sql: 'SELECT * FROM access_requests WHERE email = ?',
    args: [email]
  });

  if (existing.rows.length > 0) {
    const request = existing.rows[0];

    if (request.status === 'active') {
      const expiresAt = new Date(request.expires_at);
      const daysRemaining = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
      return {
        success: true,
        isExisting: true,
        message: 'You already have active access',
        data: {
          status: 'active',
          expiresAt: request.expires_at,
          daysRemaining: Math.max(0, daysRemaining)
        }
      };
    }

    if (request.status === 'pending') {
      const queuePosition = await getQueuePosition(request.id);
      return {
        success: false,
        error: 'Request already pending',
        data: {
          queuePosition
        }
      };
    }

    // If expired, failed, or removed, allow re-request by updating the existing record
    await db.execute({
      sql: `UPDATE access_requests
            SET full_name = ?, status = 'pending', created_at = datetime('now'),
                activated_at = NULL, expires_at = NULL, removed_at = NULL,
                automation_attempts = 0, last_automation_error = NULL,
                expiry_warning_sent = 0, expiry_notification_sent = 0
            WHERE id = ?`,
      args: [fullName, request.id]
    });

    await logAudit('request_resubmitted', request.id, { email, fullName });

    const queuePosition = await getQueuePosition(request.id);
    return {
      success: true,
      message: 'Access request submitted successfully',
      data: {
        requestId: request.id,
        email,
        status: 'pending',
        queuePosition,
        estimatedWait: estimateWaitTime(queuePosition)
      }
    };
  }

  // Create new request
  const result = await db.execute({
    sql: 'INSERT INTO access_requests (email, full_name) VALUES (?, ?)',
    args: [email, fullName]
  });

  const requestId = Number(result.lastInsertRowid);
  await logAudit('request_submitted', requestId, { email, fullName });

  const queuePosition = await getQueuePosition(requestId);

  return {
    success: true,
    message: 'Access request submitted successfully',
    data: {
      requestId,
      email,
      status: 'pending',
      queuePosition,
      estimatedWait: estimateWaitTime(queuePosition)
    }
  };
}

async function getAccessStatus(email) {
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT * FROM access_requests WHERE email = ?',
    args: [email]
  });

  if (result.rows.length === 0) {
    return null;
  }

  const request = result.rows[0];

  if (request.status === 'pending') {
    const queuePosition = await getQueuePosition(request.id);
    return {
      status: 'pending',
      queuePosition,
      estimatedWait: estimateWaitTime(queuePosition),
      createdAt: request.created_at
    };
  }

  if (request.status === 'active') {
    const expiresAt = new Date(request.expires_at);
    const daysRemaining = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
    return {
      status: 'active',
      activatedAt: request.activated_at,
      expiresAt: request.expires_at,
      daysRemaining: Math.max(0, daysRemaining),
      slotNumber: request.slot_number
    };
  }

  return {
    status: request.status,
    message: getStatusMessage(request.status)
  };
}

async function getQueueStatus() {
  const db = getDb();

  // Get counts
  const activeResult = await db.execute(
    "SELECT COUNT(*) as count FROM access_requests WHERE status = 'active'"
  );
  const activeCount = activeResult.rows[0].count;

  const pendingResult = await db.execute(
    "SELECT COUNT(*) as count FROM access_requests WHERE status = 'pending'"
  );
  const pendingCount = pendingResult.rows[0].count;

  // Get expiring today/tomorrow
  const expiringTodayResult = await db.execute(
    "SELECT COUNT(*) as count FROM access_requests WHERE status = 'active' AND expires_at < datetime('now', '+1 day')"
  );
  const expiringToday = expiringTodayResult.rows[0].count;

  const expiringTomorrowResult = await db.execute(
    "SELECT COUNT(*) as count FROM access_requests WHERE status = 'active' AND expires_at >= datetime('now', '+1 day') AND expires_at < datetime('now', '+2 days')"
  );
  const expiringTomorrow = expiringTomorrowResult.rows[0].count;

  // Get active users
  const activeUsers = await db.execute(
    "SELECT * FROM access_requests WHERE status = 'active' ORDER BY expires_at ASC"
  );

  // Get pending users
  const pendingUsers = await db.execute(
    "SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at ASC"
  );

  // Get recently expired
  const recentlyExpired = await db.execute(
    "SELECT * FROM access_requests WHERE status IN ('expired', 'removed') AND removed_at > datetime('now', '-7 days') ORDER BY removed_at DESC LIMIT 10"
  );

  return {
    summary: {
      totalSlots: MAX_SLOTS,
      activeSlots: Number(activeCount),
      availableSlots: MAX_SLOTS - Number(activeCount),
      pendingRequests: Number(pendingCount),
      expiringToday: Number(expiringToday),
      expiringTomorrow: Number(expiringTomorrow)
    },
    active: activeUsers.rows.map(formatUserForAdmin),
    pending: pendingUsers.rows.map((row, index) => ({
      ...formatUserForAdmin(row),
      queuePosition: index + 1
    })),
    recentlyExpired: recentlyExpired.rows.map(formatUserForAdmin)
  };
}

async function getQueuePosition(requestId) {
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT COUNT(*) as position FROM access_requests
          WHERE status = 'pending' AND created_at < (
            SELECT created_at FROM access_requests WHERE id = ?
          )`,
    args: [requestId]
  });

  return Number(result.rows[0].position) + 1;
}

async function getExpiredUsers() {
  const db = getDb();

  const result = await db.execute(
    "SELECT * FROM access_requests WHERE status = 'active' AND expires_at < datetime('now')"
  );

  return result.rows;
}

async function getPendingUsers(limit) {
  const db = getDb();

  const result = await db.execute({
    sql: "SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    args: [limit]
  });

  return result.rows;
}

async function getActiveCount() {
  const db = getDb();

  const result = await db.execute(
    "SELECT COUNT(*) as count FROM access_requests WHERE status = 'active'"
  );

  return Number(result.rows[0].count);
}

async function activateUser(requestId, slotNumber) {
  const db = getDb();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ACCESS_DURATION_DAYS);

  await db.execute({
    sql: `UPDATE access_requests
          SET status = 'active', activated_at = datetime('now'), expires_at = ?, slot_number = ?
          WHERE id = ?`,
    args: [expiresAt.toISOString(), slotNumber, requestId]
  });

  await logAudit('user_activated', requestId, { slotNumber, expiresAt: expiresAt.toISOString() });
}

async function markUserExpired(requestId) {
  const db = getDb();

  await db.execute({
    sql: `UPDATE access_requests
          SET status = 'expired', removed_at = datetime('now')
          WHERE id = ?`,
    args: [requestId]
  });

  await logAudit('user_expired', requestId, { reason: 'time_limit' });
}

async function markUserRemoved(requestId, reason = 'manual') {
  const db = getDb();

  await db.execute({
    sql: `UPDATE access_requests
          SET status = 'removed', removed_at = datetime('now')
          WHERE id = ?`,
    args: [requestId]
  });

  await logAudit('user_removed', requestId, { reason });
}

async function markAutomationFailed(requestId, error) {
  const db = getDb();

  await db.execute({
    sql: `UPDATE access_requests
          SET automation_attempts = automation_attempts + 1, last_automation_error = ?
          WHERE id = ?`,
    args: [error, requestId]
  });

  // Check if max attempts reached
  const result = await db.execute({
    sql: 'SELECT automation_attempts FROM access_requests WHERE id = ?',
    args: [requestId]
  });

  const attempts = result.rows[0]?.automation_attempts || 0;

  if (attempts >= 3) {
    await db.execute({
      sql: "UPDATE access_requests SET status = 'failed' WHERE id = ?",
      args: [requestId]
    });
    await logAudit('automation_max_failures', requestId, { attempts, lastError: error });
    return true; // Needs manual intervention
  }

  await logAudit('automation_failed', requestId, { attempts, error });
  return false;
}

async function markManuallyProcessed(requestId, action) {
  const db = getDb();

  if (action === 'added') {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ACCESS_DURATION_DAYS);

    const activeCount = await getActiveCount();

    await db.execute({
      sql: `UPDATE access_requests
            SET status = 'active', activated_at = datetime('now'), expires_at = ?, slot_number = ?
            WHERE id = ?`,
      args: [expiresAt.toISOString(), activeCount + 1, requestId]
    });
  } else if (action === 'removed') {
    await db.execute({
      sql: `UPDATE access_requests
            SET status = 'removed', removed_at = datetime('now')
            WHERE id = ?`,
      args: [requestId]
    });
  }

  await logAudit('manual_intervention', requestId, { action }, 'admin');
}

async function getUsersNeedingExpiryWarning() {
  const db = getDb();

  const result = await db.execute(
    `SELECT * FROM access_requests
     WHERE status = 'active'
     AND expires_at < datetime('now', '+1 day')
     AND expiry_warning_sent = 0`
  );

  return result.rows;
}

async function markExpiryWarningSent(requestId) {
  const db = getDb();

  await db.execute({
    sql: 'UPDATE access_requests SET expiry_warning_sent = 1 WHERE id = ?',
    args: [requestId]
  });
}

async function getAuditLog(limit = 50, offset = 0, action = null) {
  const db = getDb();

  let sql = 'SELECT * FROM audit_log';
  const args = [];

  if (action) {
    sql += ' WHERE action = ?';
    args.push(action);
  }

  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const result = await db.execute({ sql, args });
  return result.rows;
}

function estimateWaitTime(queuePosition) {
  // Rough estimate: assume 3-4 slots free up per week
  const weeksWait = Math.ceil(queuePosition / 3.5);
  if (weeksWait <= 1) {
    return '~1 week or less';
  }
  return `~${weeksWait} weeks`;
}

function getStatusMessage(status) {
  const messages = {
    expired: 'Your access has expired. You can request access again.',
    removed: 'Your access was removed. You can request access again.',
    failed: 'There was an issue processing your request. Please try again or contact support.'
  };
  return messages[status] || 'Unknown status';
}

function formatUserForAdmin(row) {
  const data = {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    createdAt: row.created_at
  };

  if (row.activated_at) {
    data.activatedAt = row.activated_at;
  }
  if (row.expires_at) {
    data.expiresAt = row.expires_at;
    const expiresAt = new Date(row.expires_at);
    data.daysRemaining = Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
  }
  if (row.removed_at) {
    data.removedAt = row.removed_at;
  }
  if (row.slot_number) {
    data.slotNumber = row.slot_number;
  }
  if (row.automation_attempts > 0) {
    data.automationAttempts = row.automation_attempts;
    data.lastAutomationError = row.last_automation_error;
  }

  return data;
}

module.exports = {
  submitAccessRequest,
  getAccessStatus,
  getQueueStatus,
  getQueuePosition,
  getExpiredUsers,
  getPendingUsers,
  getActiveCount,
  activateUser,
  markUserExpired,
  markUserRemoved,
  markAutomationFailed,
  markManuallyProcessed,
  getUsersNeedingExpiryWarning,
  markExpiryWarningSent,
  getAuditLog,
  MAX_SLOTS,
  ACCESS_DURATION_DAYS
};
