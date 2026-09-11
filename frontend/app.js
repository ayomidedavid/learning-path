const API_BASE = 'http://localhost:8000';

document.getElementById('login-btn').addEventListener('click', () => auth('login'));
document.getElementById('register-btn').addEventListener('click', () => register('student'));

document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
});

async function auth(action) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if(!username || !password) {
        showError("Please enter credentials");
        return;
    }

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await res.json();
        
        if(!res.ok) throw new Error(data.detail);

        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        
        if(data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } catch (e) {
        showError(e.message);
    }
}

async function register(role) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if(!username || !password) {
        showError("Please enter credentials to register");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.detail);
        
        alert(`Registered successfully as ${role}. You can now login.`);
        document.getElementById('show-login').click();
    } catch (e) {
        showError(e.message);
    }
}

function showError(msg) {
    const err = document.getElementById('error-message');
    err.textContent = msg;
    err.classList.remove('hidden');
}
