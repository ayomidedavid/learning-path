const API_BASE = 'http://localhost:8000';
let token = localStorage.getItem('token');

if (!token || localStorage.getItem('role') !== 'admin') {
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', fetchUsers);

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}

async function fetchUsers() {
    try {
        const res = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Unauthorized or failed to load");
        const data = await res.json();
        
        const tbody = document.querySelector('#users-table tbody');
        data.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td><span class="badge">${u.role}</span></td>
                <td>${u.completed_count}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        logout();
    }
}
