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

const form = document.getElementById('access-form');
const submitBtn = document.getElementById('submit-btn');
const resultDiv = document.getElementById('result');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!fullName || !email) {
        showError('Please fill in all fields');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const response = await fetch('/api/access/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullName, email })
        });

        const data = await response.json();

        if (response.ok) {
            if (data.data.status === 'active') {
                showSuccess(`
                    <h3>You Already Have Access!</h3>
                    <p>Your access is active and expires in <strong>${data.data.daysRemaining} days</strong>.</p>
                    <p><a href="/" class="submit-btn" style="display: inline-block; text-decoration: none; margin-top: 16px;">Open App</a></p>
                `);
            } else {
                showSuccess(`
                    <h3>Request Submitted!</h3>
                    <p>Your position in queue:</p>
                    <p class="queue-position">#${data.data.queuePosition}</p>
                    <p>Estimated wait: ${data.data.estimatedWait}</p>
                    <p style="margin-top: 16px; font-size: 14px;">We'll email you at <strong>${email}</strong> when your access is ready.</p>
                `);
            }
            form.reset();
        } else if (response.status === 409) {
            showError(`
                <h3>Already in Queue</h3>
                <p>You're already waiting in the queue at position <strong>#${data.data.queuePosition}</strong>.</p>
                <p><a href="access-status.html?email=${encodeURIComponent(email)}" style="color: var(--primary);">Check your full status</a></p>
            `);
        } else {
            showError(data.error || 'Something went wrong. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to connect to server. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request Access';
    }
});

function showSuccess(html) {
    resultDiv.className = 'result-box success';
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
}

function showError(html) {
    resultDiv.className = 'result-box error';
    resultDiv.innerHTML = typeof html === 'string' && !html.includes('<')
        ? `<h3>Error</h3><p>${html}</p>`
        : html;
    resultDiv.classList.remove('hidden');
}
