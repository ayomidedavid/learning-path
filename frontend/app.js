const API_BASE = window.location.origin;

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const formTitle = document.getElementById('form-title');
const formSubtitle = document.getElementById('form-subtitle');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

function showError(message) {
	errorText.textContent = message;
	errorMessage.classList.remove('hidden');
}

function clearError() {
	errorMessage.classList.add('hidden');
	errorText.textContent = '';
}

function showLogin() {
	clearError();
	document.title = 'Sign In | SSM-LPRS';
	formTitle.textContent = 'Sign In';
	formSubtitle.textContent = 'Continue to access your dashboard';
	signupForm.classList.add('hidden');
	loginForm.classList.remove('hidden');
}

function showSignup() {
	clearError();
	document.title = 'Create Account | SSM-LPRS';
	formTitle.textContent = 'Create Account';
	formSubtitle.textContent = 'Create an account to start learning';
	loginForm.classList.add('hidden');
	signupForm.classList.remove('hidden');
}

async function postJson(url, payload) {
	const response = await fetch(`${API_BASE}${url}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(data.detail || 'The request could not be completed.');
	}
	return data;
}

async function requestLogin(username, password) {
	const body = new URLSearchParams({ username, password });
	const response = await fetch(`${API_BASE}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(data.detail || 'Unable to sign in.');
	}
	return data;
}

function setLoading(button, loading, label) {
	if (loading) {
		button.dataset.originalContent = button.innerHTML;
		button.disabled = true;
		button.textContent = label;
	} else {
		button.disabled = false;
		button.innerHTML = button.dataset.originalContent;
		delete button.dataset.originalContent;
	}
}

document.getElementById('show-signup').addEventListener('click', (event) => {
	event.preventDefault();
	showSignup();
});

document.getElementById('show-login').addEventListener('click', (event) => {
	event.preventDefault();
	showLogin();
});

document.getElementById('login-btn').addEventListener('click', async () => {
	clearError();
	const username = document.getElementById('username').value.trim();
	const password = document.getElementById('password').value;
	const button = document.getElementById('login-btn');

	if (!username || !password) {
		showError('Please enter your username and password.');
		return;
	}

	setLoading(button, true, 'Signing in...');
	try {
		const data = await requestLogin(username, password);
		localStorage.setItem('token', data.access_token);
		localStorage.setItem('role', data.role);
		window.location.href = 'dashboard.html';
	} catch (error) {
		showError(error.message);
		setLoading(button, false);
	}
});

document.getElementById('register-btn').addEventListener('click', async () => {
	clearError();
	const username = document.getElementById('reg-username').value.trim();
	const password = document.getElementById('reg-password').value;
	const button = document.getElementById('register-btn');

	if (!username || !password) {
		showError('Please enter a username and password.');
		return;
	}

	setLoading(button, true, 'Creating account...');
	try {
		await postJson('/register', { username, password, role: 'student' });
		const data = await requestLogin(username, password);
		localStorage.setItem('token', data.access_token);
		localStorage.setItem('role', data.role);
		window.location.href = 'dashboard.html';
	} catch (error) {
		showError(error.message);
		setLoading(button, false);
	}
});

window.togglePasswordVisibility = (inputId) => {
	const input = document.getElementById(inputId);
	if (input) {
		input.type = input.type === 'password' ? 'text' : 'password';
	}
};
