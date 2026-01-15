/**
 * Spotify Access Manager - Automation Job Runner
 *
 * This script processes expired users and pending requests by:
 * 1. Removing expired users from the Spotify Dashboard
 * 2. Adding pending users to fill available slots
 * 3. Sending notifications and updating the database
 *
 * Run this via GitHub Actions (scheduled) or manually.
 */

require('dotenv').config();

const { createClient } = require('@libsql/client');
const SpotifyDashboardAutomation = require('./spotify-dashboard');

// Configuration
const config = {
    SPOTIFY_DASHBOARD_EMAIL: process.env.SPOTIFY_DASHBOARD_EMAIL,
    SPOTIFY_DASHBOARD_PASSWORD: process.env.SPOTIFY_DASHBOARD_PASSWORD,
    SPOTIFY_APP_ID: process.env.SPOTIFY_APP_ID,
    SPOTIFY_APP_NAME: process.env.SPOTIFY_APP_NAME || 'BuyMoreMusic',
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
    APP_WEBHOOK_URL: process.env.APP_WEBHOOK_URL,
    AUTOMATION_WEBHOOK_SECRET: process.env.AUTOMATION_WEBHOOK_SECRET,
    MAX_SLOTS: 25,
    ACCESS_DURATION_DAYS: 7
};

// Database connection
const db = createClient({
    url: config.DATABASE_URL,
    authToken: config.DATABASE_AUTH_TOKEN
});

// Notify the main app of results
async function notifyApp(results) {
    if (!config.APP_WEBHOOK_URL || !config.AUTOMATION_WEBHOOK_SECRET) {
        console.log('[Webhook] App webhook not configured, skipping notification');
        return;
    }

    try {
        await fetch(config.APP_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.AUTOMATION_WEBHOOK_SECRET}`
            },
            body: JSON.stringify({ results })
        });
        console.log('[Webhook] Successfully notified app');
    } catch (error) {
        console.error('[Webhook] Failed to notify app:', error.message);
    }
}

// Get expired users from database
async function getExpiredUsers() {
    const result = await db.execute(
        "SELECT * FROM access_requests WHERE status = 'active' AND expires_at < datetime('now')"
    );
    return result.rows;
}

// Get pending users from database
async function getPendingUsers(limit) {
    const result = await db.execute({
        sql: "SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
        args: [limit]
    });
    return result.rows;
}

// Get count of active users
async function getActiveCount() {
    const result = await db.execute(
        "SELECT COUNT(*) as count FROM access_requests WHERE status = 'active'"
    );
    return Number(result.rows[0].count);
}

// Main job function
async function runJob() {
    console.log('========================================');
    console.log('Spotify Access Manager - Automation Job');
    console.log('Started:', new Date().toISOString());
    console.log('========================================');

    const automation = new SpotifyDashboardAutomation(config);
    const results = [];

    try {
        // Validate configuration
        if (!config.SPOTIFY_DASHBOARD_EMAIL || !config.SPOTIFY_DASHBOARD_PASSWORD) {
            throw new Error('Missing Spotify Dashboard credentials');
        }
        if (!config.SPOTIFY_APP_ID) {
            throw new Error('Missing SPOTIFY_APP_ID');
        }
        if (!config.DATABASE_URL) {
            throw new Error('Missing DATABASE_URL');
        }

        // Initialize browser
        await automation.initialize();

        // Login to Spotify Dashboard
        await automation.login();

        // Navigate to User Management
        await automation.navigateToUserManagement();

        // Phase 1: Remove expired users
        console.log('\n--- Phase 1: Processing Expired Users ---');
        const expiredUsers = await getExpiredUsers();
        console.log(`Found ${expiredUsers.length} expired users`);

        for (const user of expiredUsers) {
            const result = await automation.removeUser(user.email);

            results.push({
                action: 'removed',
                requestId: user.id,
                email: user.email,
                fullName: user.full_name,
                success: result.success,
                error: result.error
            });

            // Small delay between operations
            await new Promise(r => setTimeout(r, 2000));
        }

        // Phase 2: Add pending users to fill available slots
        console.log('\n--- Phase 2: Processing Pending Users ---');
        const activeCount = await getActiveCount();
        const expiredCount = expiredUsers.filter(r => results.find(
            res => res.email === r.email && res.success
        )).length;
        const availableSlots = config.MAX_SLOTS - activeCount + expiredCount;

        console.log(`Active users: ${activeCount}`);
        console.log(`Expired users removed: ${expiredCount}`);
        console.log(`Available slots: ${availableSlots}`);

        if (availableSlots > 0) {
            const pendingUsers = await getPendingUsers(availableSlots);
            console.log(`Found ${pendingUsers.length} pending users to process`);

            for (let i = 0; i < pendingUsers.length; i++) {
                const user = pendingUsers[i];
                const slotNumber = activeCount - expiredCount + i + 1;

                const result = await automation.addUser(user.full_name, user.email);

                results.push({
                    action: 'added',
                    requestId: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    slotNumber,
                    success: result.success,
                    error: result.error
                });

                // Small delay between operations
                await new Promise(r => setTimeout(r, 2000));
            }
        } else {
            console.log('No available slots');
        }

        console.log('\n--- Results Summary ---');
        console.log(`Total operations: ${results.length}`);
        console.log(`Successful: ${results.filter(r => r.success).length}`);
        console.log(`Failed: ${results.filter(r => !r.success).length}`);

    } catch (error) {
        console.error('\n[ERROR] Job failed:', error.message);

        // Log the error but still try to notify about any partial results
        results.push({
            action: 'job_error',
            success: false,
            error: error.message
        });
    } finally {
        // Close browser
        await automation.close();

        // Notify the app about results
        if (results.length > 0) {
            await notifyApp(results);
        }
    }

    console.log('\n========================================');
    console.log('Job completed:', new Date().toISOString());
    console.log('========================================');

    return results;
}

// Run if called directly
if (require.main === module) {
    runJob()
        .then(results => {
            const failures = results.filter(r => !r.success);
            process.exit(failures.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runJob };
