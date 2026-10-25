/* attendance.js - STUDENT side. Loaded on attendance.html and index.html (after app.js).
 * Polls /api/my-attendance/ every 5 seconds so the numbers update live.
 */
(function () {
  'use strict';
  if (!localStorage.getItem('token') || localStorage.getItem('role') === 'teacher') return;

  var list = document.getElementById('att-list');
  var stat = document.querySelector('[data-attendance-stat]');
  if (!list && !stat) return;

  var req = document.getElementById('req');
  var live = document.getElementById('live');
  var prev = {}, lastKey = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function card(c, required) {
    var ok = c.percentage >= required;
    var dots = c.recent.map(function (r) {
      return '<span class="dot ' + (r.present ? '' : 'a') + '" title="' + esc(r.date) + ' — ' + (r.present ? 'Present' : 'Absent') + '"></span>';
    }).join('') || '<span class="muted">No classes marked yet</span>';
    return '<article class="panel course-card" id="c' + c.course_id + '">' +
      '<div class="course-top"><span class="course-code">' + esc(c.code) + '</span>' +
      '<span class="badge ' + (ok ? 'green' : 'red') + '">' + (ok ? 'On track' : 'Low') + '</span></div>' +
      '<div class="course-title">' + esc(c.name) + '</div>' +
      '<div class="course-meta">' + esc(c.teacher) + '<br>' + c.attended + ' / ' + c.total + ' classes attended</div>' +
      '<div class="course-bottom"><span class="muted">Attendance</span><strong>' + c.percentage + '%</strong></div>' +
      '<div class="progress"><span class="' + (ok ? '' : 'low') + '" style="width:' + c.percentage + '%"></span></div>' +
      '<div class="list-sub">' + esc(c.message) + '</div>' +
      '<div class="dots">' + dots + '</div></article>';
  }

  async function load() {
    if (document.hidden) return;
    var required = req ? (+req.value || 75) : 75;
    var res = await apiJson('GET', '/my-attendance/?required=' + required);
    if (!res.ok) { if (live) live.textContent = 'offline — retrying'; return; }
    var data = res.data;

    if (stat) {                                   // dashboard tile: overall percentage
      var a = 0, t = 0;
      data.forEach(function (c) { a += c.attended; t += c.total; });
      stat.textContent = t ? Math.round(a * 100 / t) + '%' : '—';
    }
    if (list) {
      var key = JSON.stringify(data) + required;
      if (key !== lastKey) {                      // redraw only when something changed
        lastKey = key;
        list.innerHTML = data.length ? data.map(function (c) { return card(c, required); }).join('')
          : '<div class="panel empty">You are not enrolled in any course yet. Ask your teacher to enroll your username.</div>';
        data.forEach(function (c) {
          var now = JSON.stringify(c);
          if (prev[c.course_id] && prev[c.course_id] !== now) document.getElementById('c' + c.course_id).classList.add('flash');
          prev[c.course_id] = now;
        });
      }
    }
    if (live) live.textContent = 'Live · updated ' + new Date().toLocaleTimeString();
  }

  if (req) req.addEventListener('input', load);
  document.addEventListener('visibilitychange', load);   // refresh instantly when the tab is shown again
  setInterval(load, 5000);
  load();
})();
