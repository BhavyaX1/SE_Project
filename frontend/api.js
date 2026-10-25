/* api.js - talks to the Django backend. Loaded before app.js on every page. */

var API_URL = '/api';   // same server as the pages, so no address needed

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// apiJson('GET', '/subjects/')
// apiJson('POST', '/subjects/', { code: 'X1', name: 'Maths' })
// Always returns { ok, status, data } and never throws.
async function apiJson(method, path, body) {
  var headers = {};
  var token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Token ' + token;

  var options = { method: method, headers: headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  var response;
  try {
    response = await fetch(API_URL + path, options);
  } catch (e) {
    return { ok: false, status: 0, data: { detail: 'Cannot reach the server. Is Django running?' } };
  }

  if (response.status === 401 && token) { logout(); }   // token missing/expired

  var data = null;
  try { data = await response.json(); } catch (e) { /* DELETE returns no body */ }
  return { ok: response.ok, status: response.status, data: data };
}

// Turns Django's error JSON into one readable sentence.
function errorText(data) {
  if (!data) return 'Something went wrong.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  var key = Object.keys(data)[0];
  var msg = data[key];
  if (Array.isArray(msg)) msg = msg[0];
  return (key === 'non_field_errors' ? '' : key + ': ') + msg;
}