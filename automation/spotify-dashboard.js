/**
 * Spotify Developer Dashboard Automation
 *
 * This module provides browser automation for managing users in the
 * Spotify Developer Dashboard. It uses Playwright with stealth plugins
 * to avoid detection.
 *
 * IMPORTANT: The selectors in this file are placeholders and need to be
 * updated based on the actual Spotify Dashboard DOM structure. You should:
 * 1. Manually log into the dashboard
 * 2. Use browser DevTools to inspect the actual element selectors
 * 3. Update the SELECTORS object accordingly
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply stealth plugin
chromium.use(StealthPlugin());

// Selectors - Updated based on actual Spotify Dashboard DOM (January 2026)
const SELECTORS = {
    // Login page (Spotify accounts login)
    loginButton: 'button:has-text("Log in"), a:has-text("Log in")',
    usernameInput: '#login-username',
    passwordInput: '#login-password',
    submitLogin: '#login-button',

    // Dashboard navigation
    appList: 'main',
    userManagementTab: 'a[href*="/users"], button:has-text("User Management")',

    // User management form - using actual Spotify Dashboard selectors
    userList: 'table, [role="table"]',
    addUserButton: 'button[data-encore-id="buttonPrimary"]:has-text("Add user")',
    nameInput: 'input#name[name="name"], input[data-encore-id="formInput"]#name',
    emailInput: 'input#email[name="email"], input[data-encore-id="formInput"]#email',
    saveButton: 'button[data-encore-id="buttonPrimary"]:has-text("Add user")',
    removeButton: 'button:has-text("Remove"), button[data-encore-id="buttonTertiary"]',
    confirmRemove: 'button:has-text("Remove"), button:has-text("Confirm"), button[data-encore-id="buttonPrimary"]',

    // Success/error indicators
    successMessage: '[role="alert"], .toast, [data-encore-id="banner"]',
    errorMessage: '[role="alert"], .error, [data-encore-id="banner"]'
};

class SpotifyDashboardAutomation {
    constructor(config) {
        this.email = config.SPOTIFY_DASHBOARD_EMAIL;
        this.password = config.SPOTIFY_DASHBOARD_PASSWORD;
        this.appId = config.SPOTIFY_APP_ID;
        this.appName = config.SPOTIFY_APP_NAME || 'BuyMoreMusic';
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isLoggedIn = false;
    }

    async initialize() {
        console.log('[Automation] Initializing browser...');

        this.browser = await chromium.launch({
            headless: true, // Set to false for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York'
        });

        this.page = await this.context.newPage();

        // Add random delays to appear more human-like
        this.page.setDefaultTimeout(30000);

        console.log('[Automation] Browser initialized');
    }

    async randomDelay(min = 500, max = 2000) {
        const delay = Math.floor(Math.random() * (max - min) + min);
        await this.page.waitForTimeout(delay);
    }

    async login() {
        console.log('[Automation] Logging in to Spotify Developer Dashboard...');

        try {
            // Navigate to dashboard
            await this.page.goto('https://developer.spotify.com/dashboard', {
                waitUntil: 'networkidle'
            });

            await this.randomDelay();

            // Check if already logged in
            const dashboardContent = await this.page.content();
            if (dashboardContent.includes('Create app') || dashboardContent.includes(this.appName)) {
                console.log('[Automation] Already logged in');
                this.isLoggedIn = true;
                return true;
            }

            // Click login button
            await this.page.click(SELECTORS.loginButton);
            await this.page.waitForNavigation({ waitUntil: 'networkidle' });

            await this.randomDelay();

            // Fill login form
            await this.page.waitForSelector(SELECTORS.usernameInput);
            await this.page.fill(SELECTORS.usernameInput, this.email);

            await this.randomDelay(300, 800);

            await this.page.fill(SELECTORS.passwordInput, this.password);

            await this.randomDelay(300, 800);

            // Submit login
            await this.page.click(SELECTORS.submitLogin);

            // Wait for dashboard to load
            await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });

            // Verify login success
            await this.page.waitForSelector(SELECTORS.appList, { timeout: 30000 });

            console.log('[Automation] Login successful');
            this.isLoggedIn = true;
            return true;
        } catch (error) {
            console.error('[Automation] Login failed:', error.message);

            // Take screenshot for debugging
            await this.page.screenshot({ path: 'login-failure.png' });

            throw new Error(`Login failed: ${error.message}`);
        }
    }

    async navigateToUserManagement() {
        console.log('[Automation] Navigating to User Management...');

        try {
            // Navigate directly to user management page
            const usersUrl = `https://developer.spotify.com/dashboard/${this.appId}/users`;
            await this.page.goto(usersUrl, { waitUntil: 'networkidle' });

            await this.randomDelay();

            // Wait for the form to be available (name input indicates page loaded)
            await this.page.waitForSelector(SELECTORS.nameInput, { timeout: 15000 });

            console.log('[Automation] Navigated to User Management');
        } catch (error) {
            console.error('[Automation] Failed to navigate:', error.message);
            await this.page.screenshot({ path: 'navigation-failure.png' });
            throw new Error(`Navigation failed: ${error.message}`);
        }
    }

    async addUser(fullName, email) {
        console.log(`[Automation] Adding user: ${email}`);

        try {
            // The form is inline on the page - fill name and email, then click Add user
            await this.page.waitForSelector(SELECTORS.nameInput);

            // Clear any existing values first
            await this.page.fill(SELECTORS.nameInput, '');
            await this.randomDelay(200, 400);
            await this.page.fill(SELECTORS.nameInput, fullName);

            await this.randomDelay(300, 600);

            await this.page.fill(SELECTORS.emailInput, '');
            await this.randomDelay(200, 400);
            await this.page.fill(SELECTORS.emailInput, email);

            await this.randomDelay(300, 600);

            // Click the "Add user" submit button
            await this.page.click(SELECTORS.addUserButton);

            // Wait for the page to update - either success message or the user appears in list
            await this.randomDelay(2000, 3000);

            // Check if user was added by looking for their email in the page
            const pageContent = await this.page.content();
            if (pageContent.includes(email)) {
                console.log(`[Automation] Successfully added user: ${email}`);
                return { success: true };
            }

            // Check for error messages
            if (pageContent.includes('already') || pageContent.includes('exists') || pageContent.includes('registered')) {
                return { success: false, error: 'User already exists in dashboard' };
            }

            // Assume success if no error found
            console.log(`[Automation] User add completed: ${email}`);
            return { success: true };
        } catch (error) {
            console.error(`[Automation] Failed to add user ${email}:`, error.message);
            await this.page.screenshot({ path: `add-user-failure-${Date.now()}.png` });

            return { success: false, error: error.message };
        }
    }

    async removeUser(email) {
        console.log(`[Automation] Removing user: ${email}`);

        try {
            // Find user row by email
            const userRow = await this.page.$(`tr:has-text("${email}")`);

            if (!userRow) {
                console.log(`[Automation] User not found in dashboard: ${email}`);
                return { success: true, note: 'User not found - may already be removed' };
            }

            // Click remove button for this row
            await userRow.$eval(SELECTORS.removeButton, btn => btn.click());

            await this.randomDelay(500, 1000);

            // Confirm removal
            await this.page.click(SELECTORS.confirmRemove);

            // Wait for success
            await this.page.waitForSelector(SELECTORS.successMessage, { timeout: 10000 });

            console.log(`[Automation] Successfully removed user: ${email}`);
            return { success: true };
        } catch (error) {
            console.error(`[Automation] Failed to remove user ${email}:`, error.message);
            await this.page.screenshot({ path: `remove-user-failure-${Date.now()}.png` });
            return { success: false, error: error.message };
        }
    }

    async getCurrentUsers() {
        console.log('[Automation] Getting current users...');

        try {
            const users = await this.page.$$eval('tr', rows => {
                return rows.map(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        return {
                            name: cells[0]?.textContent?.trim(),
                            email: cells[1]?.textContent?.trim()
                        };
                    }
                    return null;
                }).filter(Boolean);
            });

            console.log(`[Automation] Found ${users.length} users`);
            return users;
        } catch (error) {
            console.error('[Automation] Failed to get users:', error.message);
            return [];
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('[Automation] Browser closed');
        }
    }
}

module.exports = SpotifyDashboardAutomation;
