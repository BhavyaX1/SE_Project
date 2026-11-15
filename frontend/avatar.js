/* User initials shown in the topbar; never hard-code a person's name. */
(function () {
  'use strict';
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function render(name) {
    const display = String(name || '').trim() || 'Account';
    document.querySelectorAll('.user > span').forEach(el => el.textContent = display);
    document.querySelectorAll('.user .avatar').forEach(function (el) {
      el.textContent = initials(display);
      el.title = display;
      el.setAttribute('aria-label', display + ' profile');
    });
  }
  window.CampusAvatar = { render: render };
  document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('token')) render(localStorage.getItem('name'));
  });
})();
