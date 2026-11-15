/* Shared Django API helper. Load before app.js, teacher.js or login inline scripts. */
var API_URL = '/api';

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    window.location.href = 'login.html';
}

async function apiJson(method, path, body) {
    var headers = {};
    var token = localStorage.getItem('token');
    var isPublic = path === '/login/' || path === '/register/';
    if (token && !isPublic) headers['Authorization'] = 'Token ' + token;
    var options = { method: method, headers: headers };
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    var response;
    try {
        response = await fetch(API_URL + path, options);
    } catch (error) {
        return { ok: false, status: 0, data: { detail: 'Cannot reach Django server.' } };
    }
    // Never redirect on login/register errors: display the form error instead.
    if (response.status === 401 && token && !isPublic) {
        logout();
        return { ok: false, status: 401, data: { detail: 'Session expired.' } };
    }
    var data = null;
    try { data = await response.json(); } catch (error) { /* e.g. 204 */ }
    return { ok: response.ok, status: response.status, data: data };
}

function errorText(data) {
    if (!data) return 'Something went wrong.';
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    var key = Object.keys(data)[0];
    if (!key) return 'Something went wrong.';
    var msg = data[key];
    if (Array.isArray(msg)) msg = msg.join(' ');
    return (key === 'non_field_errors' ? '' : key + ': ') + msg;
}
