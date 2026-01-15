const { Resend } = require('resend');

let resend = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const APP_NAME = 'BuyMoreMusic';
const APP_URL = process.env.APP_URL || 'https://buymoremusic.app';

async function sendAccessGrantedEmail(user) {
  const client = getResend();
  if (!client) {
    console.log('[Notification] Resend not configured, skipping email');
    return;
  }

  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@buymoremusic.app';

  try {
    await client.emails.send({
      from: `${APP_NAME} <${fromEmail}>`,
      to: user.email,
      subject: `Your ${APP_NAME} access is ready!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1DB954;">Your Access is Ready!</h1>
          <p>Hi ${user.full_name},</p>
          <p>Great news! Your access to ${APP_NAME} has been activated.</p>
          <p><strong>Your access will expire in 7 days.</strong></p>
          <p>
            <a href="${APP_URL}" style="display: inline-block; background-color: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold;">
              Open ${APP_NAME}
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            After your access expires, you'll need to request access again. We'll send you a reminder before it expires.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">
            You're receiving this because you requested access to ${APP_NAME}.
          </p>
        </div>
      `
    });
    console.log(`[Notification] Access granted email sent to ${user.email}`);
  } catch (error) {
    console.error(`[Notification] Failed to send email to ${user.email}:`, error.message);
  }
}

async function sendExpiryWarningEmail(user) {
  const client = getResend();
  if (!client) {
    console.log('[Notification] Resend not configured, skipping email');
    return;
  }

  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@buymoremusic.app';

  try {
    await client.emails.send({
      from: `${APP_NAME} <${fromEmail}>`,
      to: user.email,
      subject: `Your ${APP_NAME} access expires tomorrow`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ff9900;">Access Expiring Soon</h1>
          <p>Hi ${user.full_name},</p>
          <p>Just a heads up - your access to ${APP_NAME} will expire <strong>tomorrow</strong>.</p>
          <p>Make sure to check out your listening stats before then!</p>
          <p>
            <a href="${APP_URL}" style="display: inline-block; background-color: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold;">
              Open ${APP_NAME}
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            After your access expires, you can request access again from the homepage.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">
            You're receiving this because you have active access to ${APP_NAME}.
          </p>
        </div>
      `
    });
    console.log(`[Notification] Expiry warning email sent to ${user.email}`);
  } catch (error) {
    console.error(`[Notification] Failed to send email to ${user.email}:`, error.message);
  }
}

async function sendAccessExpiredEmail(user) {
  const client = getResend();
  if (!client) {
    console.log('[Notification] Resend not configured, skipping email');
    return;
  }

  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@buymoremusic.app';

  try {
    await client.emails.send({
      from: `${APP_NAME} <${fromEmail}>`,
      to: user.email,
      subject: `Your ${APP_NAME} access has expired`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #666;">Access Expired</h1>
          <p>Hi ${user.full_name},</p>
          <p>Your access to ${APP_NAME} has expired.</p>
          <p>If you'd like to continue using the app, you can request access again:</p>
          <p>
            <a href="${APP_URL}/access.html" style="display: inline-block; background-color: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold;">
              Request Access Again
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Thank you for using ${APP_NAME}!
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">
            You're receiving this because you previously had access to ${APP_NAME}.
          </p>
        </div>
      `
    });
    console.log(`[Notification] Access expired email sent to ${user.email}`);
  } catch (error) {
    console.error(`[Notification] Failed to send email to ${user.email}:`, error.message);
  }
}

async function notifyAdmin(notification) {
  const webhookUrl = process.env.ADMIN_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Notification] Admin webhook not configured, logging to console');
    console.log('[Admin Alert]', JSON.stringify(notification, null, 2));
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${APP_NAME} Access Manager] ${notification.message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${notification.type}*\n${notification.message}`
            }
          },
          notification.user && {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Email:*\n${notification.user.email}` },
              { type: 'mrkdwn', text: `*Name:*\n${notification.user.full_name}` }
            ]
          },
          notification.error && {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Error:*\n\`\`\`${notification.error}\`\`\``
            }
          }
        ].filter(Boolean)
      })
    });
    console.log('[Notification] Admin webhook sent');
  } catch (error) {
    console.error('[Notification] Failed to send admin webhook:', error.message);
  }
}

module.exports = {
  sendAccessGrantedEmail,
  sendExpiryWarningEmail,
  sendAccessExpiredEmail,
  notifyAdmin
};
