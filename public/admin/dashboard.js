// Load saved theme
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

loadSavedTheme();

// Auth
let authToken = localStorage.getItem('admin_token');

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// Check if already logged in
if (authToken) {
    showDashboard();
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('admin_token', authToken);
            showDashboard();
        } else {
            loginError.textContent = data.error || 'Invalid password';
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        loginError.textContent = 'Failed to connect to server';
        loginError.classList.remove('hidden');
    }
});

function showDashboard() {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    loadDashboard();
}

function logout() {
    authToken = null;
    localStorage.removeItem('admin_token');
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    document.getElementById('password').value = '';
    loginError.classList.add('hidden');
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 401) {
        logout();
        throw new Error('Session expired');
    }

    return response;
}

async function loadDashboard() {
    try {
        const response = await apiRequest('/api/admin/access/queue');
        const data = await response.json();

        if (response.ok) {
            renderDashboard(data);
        } else {
            console.error('Failed to load dashboard:', data.error);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderDashboard(data) {
    const { summary, active, pending, recentlyExpired } = data;

    // Update stats
    document.getElementById('stat-active').textContent = summary.activeSlots;
    document.getElementById('stat-available').textContent = summary.availableSlots;
    document.getElementById('stat-pending').textContent = summary.pendingRequests;
    document.getElementById('stat-expiring-today').textContent = summary.expiringToday;
    document.getElementById('stat-expiring-tomorrow').textContent = summary.expiringTomorrow;

    // Update badges
    document.getElementById('active-count').textContent = active.length;
    document.getElementById('pending-count').textContent = pending.length;

    // Render active users
    const activeContainer = document.getElementById('active-users');
    if (active.length === 0) {
        activeContainer.innerHTML = '<div class="empty-state">No active users</div>';
    } else {
        activeContainer.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Slot</th>
                        <th>Activated</th>
                        <th>Expires</th>
                        <th>Days Left</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${active.map(user => `
                        <tr>
                            <td>${escapeHtml(user.email)}</td>
                            <td>${escapeHtml(user.fullName)}</td>
                            <td>#${user.slotNumber || '-'}</td>
                            <td>${formatDate(user.activatedAt)}</td>
                            <td>${formatDate(user.expiresAt)}</td>
                            <td><span class="${user.daysRemaining <= 1 ? 'status-badge failed' : ''}">${user.daysRemaining}</span></td>
                            <td>
                                <button class="action-btn danger" onclick="removeUser(${user.id})">Remove</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Render pending users
    const pendingContainer = document.getElementById('pending-users');
    if (pending.length === 0) {
        pendingContainer.innerHTML = '<div class="empty-state">No pending requests</div>';
    } else {
        pendingContainer.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Requested</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${pending.map(user => `
                        <tr>
                            <td>${user.queuePosition}</td>
                            <td>${escapeHtml(user.email)}</td>
                            <td>${escapeHtml(user.fullName)}</td>
                            <td>${formatDate(user.createdAt)}</td>
                            <td>
                                <button class="action-btn primary" onclick="markAsAdded(${user.id})" ${summary.availableSlots === 0 ? 'disabled' : ''}>
                                    Mark Added
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Render expired users
    const expiredContainer = document.getElementById('expired-users');
    if (recentlyExpired.length === 0) {
        expiredContainer.innerHTML = '<div class="empty-state">No recently expired users</div>';
    } else {
        expiredContainer.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Removed At</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentlyExpired.map(user => `
                        <tr>
                            <td>${escapeHtml(user.email)}</td>
                            <td>${escapeHtml(user.fullName)}</td>
                            <td><span class="status-badge ${user.status}">${user.status}</span></td>
                            <td>${formatDate(user.removedAt)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

async function markAsAdded(id) {
    if (!confirm('Mark this user as manually added to Spotify Dashboard?')) return;

    try {
        const response = await apiRequest(`/api/admin/access/manual/${id}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'added' })
        });

        if (response.ok) {
            loadDashboard();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to mark user as added');
        }
    } catch (error) {
        alert('Failed to connect to server');
    }
}

async function removeUser(id) {
    if (!confirm('Remove this user? Make sure to also remove them from Spotify Dashboard.')) return;

    try {
        const response = await apiRequest(`/api/admin/access/remove/${id}`, {
            method: 'POST'
        });

        if (response.ok) {
            loadDashboard();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to remove user');
        }
    } catch (error) {
        alert('Failed to connect to server');
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Auto-refresh every 5 minutes
setInterval(() => {
    if (authToken) {
        loadDashboard();
    }
}, 5 * 60 * 1000);
