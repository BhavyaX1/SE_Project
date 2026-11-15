/* CampusHub shared script
 * - Loads subjects, weekly schedule, profile and preferences from the Django API
 * - Renders dashboard, courses and schedule pages from that data
 * - Powers the editors on the Settings page (every change is saved to Django)
 */
(function () {
  'use strict';

  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  var TYPES = ['Lecture', 'Lab', 'Tutorial'];

  /* ---------- Data (filled from Django when the page loads) ---------- */
  var state = {
    profile: { name: '', email: '', id: '', program: '' },
    prefs: { time24: false, notify: { a: true, g: true, c: true } },
    subjects: [],
    schedule: []
  };

  // Django sends flat profile fields. Put them where the page code expects them.
  function applyProfile(p) {
    state.profile = { name: p.name, email: p.email, id: p.id, program: p.program };
    state.prefs = { time24: p.time24, notify: { a: p.notify_a, g: p.notify_g, c: p.notify_c } };
  }

  function showError(message) {
    var box = $('#load-error');
    if (!box) {
      box = document.createElement('div');
      box.id = 'load-error';
      box.className = 'panel';
      box.style.cssText = 'margin-bottom:18px;color:#a23b3b';
      var content = $('.content');
      if (content) content.insertBefore(box, content.firstChild);
    }
    box.textContent = message;
  }

  async function loadAll() {
    var r = await Promise.all([
      apiJson('GET', '/profile/'),
      apiJson('GET', '/subjects/'),
      apiJson('GET', '/classes/')
    ]);
    var failed = r.filter(function (x) { return !x.ok; })[0];
    if (failed) { showError(errorText(failed.data)); return false; }
    applyProfile(r[0].data);
    state.subjects = r[1].data;
    state.schedule = r[2].data;
    return true;
  }

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function subject(id) {
    return state.subjects.filter(function (s) { return s.id === id; })[0];
  }
  function minutes(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function fmt(t) {
    var p = t.split(':'), h = +p[0], m = p[1];
    if (state.prefs.time24) return (h < 10 ? '0' : '') + h + ':' + m;
    var h12 = h % 12 || 12;
    return (h12 < 10 ? '0' : '') + h12 + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function hoursLabel(h) { return h + (h === 1 ? ' hour' : ' hours'); }
  function sortedSchedule(list) {
    return list.slice().sort(function (a, b) {
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || minutes(a.start) - minutes(b.start);
    });
  }
  function typeBar(type) { return type === 'Lab' ? 'green' : type === 'Tutorial' ? 'amber' : ''; }
  function todayName() {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  }

  /* ---------- Page renderers ---------- */
  function renderToday(el) {
    var full = el.getAttribute('data-variant') === 'full';
    var rows = sortedSchedule(state.schedule.filter(function (x) { return x.day === todayName(); }));
    if (!rows.length) {
      el.innerHTML = '<div class="list-sub">No classes today. Add one in Settings.</div>';
      return;
    }
    el.innerHTML = rows.map(function (x) {
      var s = subject(x.subjectId) || { name: 'Unknown subject', teacher: '' };
      if (!full) {
        return '<div class="list-item"><span class="time">' + fmt(x.start) + '</span><span>' +
          esc(s.name) + ' — ' + esc(x.room) + '</span></div>';
      }
      return '<div class="event"><span class="time">' + fmt(x.start) + '</span>' +
        '<span class="event-bar ' + typeBar(x.type) + '"></span><div class="event-body">' +
        '<div class="list-title">' + esc(s.name) + '</div><div class="list-sub">' +
        esc(x.room) + ' · ' + esc(s.teacher) + ' · ' + hoursLabel(x.hours) + '</div></div></div>';
    }).join('');
  }

  function renderWeek(el) {
    var times = [];
    state.schedule.forEach(function (x) { if (times.indexOf(x.start) < 0) times.push(x.start); });
    times.sort(function (a, b) { return minutes(a) - minutes(b); });
    var html = '<table><thead><tr><th>Time</th>' + DAYS.map(function (d) { return '<th>' + d + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    times.forEach(function (t) {
      html += '<tr><td>' + fmt(t) + '</td>' + DAYS.map(function (d) {
        var cell = state.schedule.filter(function (x) { return x.day === d && x.start === t; }).map(function (x) {
          var s = subject(x.subjectId);
          return esc(s ? s.name : 'Unknown') + (x.type === 'Lecture' ? '' : ' (' + esc(x.type) + ')');
        }).join('<br>');
        return '<td>' + (cell || '<span class="muted">—</span>') + '</td>';
      }).join('') + '</tr>';
    });
    if (!times.length) html += '<tr><td colspan="6" class="muted">No classes yet. Add them in Settings.</td></tr>';
    el.innerHTML = html + '</tbody></table>';
  }

  function daysFor(id) {
    var days = [];
    DAYS.forEach(function (d) {
      if (state.schedule.some(function (x) { return x.subjectId === id && x.day === d; })) days.push(d.slice(0, 3));
    });
    return days.join(', ') || 'Not scheduled';
  }

  function renderCourses(el) {
    if (!state.subjects.length) {
      el.innerHTML = '<div class="panel empty">No courses yet. They appear here once a teacher enrolls you.</div>';
      return;
    }
    el.innerHTML = state.subjects.map(function (s) {
      return '<article class="panel course-card"><div class="course-top"><span class="course-code">' + esc(s.code) +
        '</span><span class="badge green">Enrolled</span></div><div class="course-title">' + esc(s.name) +
        '</div><div class="course-meta">' + esc(s.teacher) + '<br>' + s.credits + ' credits · ' + daysFor(s.id) +
        '</div><div class="course-bottom"><span class="muted">Course progress</span><strong>' + s.progress +
        '%</strong></div><div class="progress"><span style="width:' + s.progress +
        '%"></span></div></article>';
    }).join('');
  }

  function renderStats() {
    var hours = state.schedule.reduce(function (n, x) { return n + (+x.hours || 0); }, 0);
    $$('[data-stat="classes"]').forEach(function (e) { e.textContent = state.schedule.length; });
    $$('[data-stat="hours"]').forEach(function (e) { e.textContent = hours + ' hrs'; });
  }

  function renderChrome() {
    var p = state.profile;
    localStorage.setItem('name', p.name || '');
    if (window.CampusAvatar) CampusAvatar.render(p.name);
    $$('[data-today-title]').forEach(function (e) {
      e.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    });
  }

  function renderPages() {
    renderChrome();
    $$('[data-render="today"]').forEach(renderToday);
    $$('[data-render="week"]').forEach(renderWeek);
    $$('[data-render="courses"]').forEach(renderCourses);
    renderStats();
    renderEditors();
  }

  /* ---------- Dialog form ---------- */
  // fields: [{k, l, type, options:[[value,label]], min, max, step, required}]
  function ask(title, fields, values, onSave) {
    var d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = '<form method="dialog"><h2>' + esc(title) + '</h2>' + fields.map(function (f) {
      var id = 'f_' + f.k, v = values[f.k] == null ? '' : values[f.k], ctl;
      if (f.options) {
        ctl = '<select id="' + id + '" name="' + f.k + '">' + f.options.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select>';
      } else {
        ctl = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
          (f.step ? ' step="' + f.step + '"' : '') + (f.required ? ' required' : '') + '>';
      }
      return '<div class="field"><label for="' + id + '">' + esc(f.l) + '</label>' + ctl + '</div>';
    }).join('') + '<div class="form-error" role="alert"></div><div class="toolbar">' +
      '<button class="btn primary" value="ok">Save</button>' +
      '<button class="btn" value="cancel" formnovalidate>Cancel</button></div></form>';
    document.body.appendChild(d);
    var form = $('form', d);
    form.addEventListener('submit', function (e) {
      if (!e.submitter || e.submitter.value !== 'ok') return; // Cancel closes the dialog by default
      e.preventDefault();
      var out = {};
      fields.forEach(function (f) { out[f.k] = form.elements[f.k].value.trim(); });
      var saveBtn = e.submitter;
      saveBtn.disabled = true;                       // stop double-clicks while saving
      Promise.resolve(onSave(out)).then(function (err) {
        saveBtn.disabled = false;
        if (err) { $('.form-error', d).textContent = err; } else { d.close(); }
      }).catch(function () {
        saveBtn.disabled = false;
        $('.form-error', d).textContent = 'Something went wrong. Please try again.';
      });
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    var first = $('input,select', d);
    if (first) first.focus();
  }

  /* ---------- Settings editors ---------- */
  function subjectFields() {
    return [
      { k: 'code', l: 'Course code', required: true },
      { k: 'name', l: 'Subject name', required: true },
      { k: 'teacher', l: 'Teacher' },
      { k: 'credits', l: 'Credits', type: 'number', min: 1, max: 10, required: true },
      { k: 'progress', l: 'Course progress (%)', type: 'number', min: 0, max: 100, required: true }
    ];
  }

  function editSubject(id) {
    var existing = subject(id);
    if (!existing) return;
    ask('Update progress - ' + existing.name, [subjectFields()[4]], existing, async function (v) {
      var res = await apiJson('PATCH', '/subjects/' + existing.id + '/', { progress: +v.progress });
      if (!res.ok) return errorText(res.data);
      Object.assign(existing, res.data);
      renderPages();
    });
  }

  async function deleteSubject(id) {
    var s = subject(id), n = state.schedule.filter(function (x) { return x.subjectId === id; }).length;
    var msg = 'Delete ' + s.name + '?' + (n ? ' Its ' + n + ' scheduled class' + (n > 1 ? 'es' : '') + ' will also be removed.' : '');
    if (!confirm(msg)) return;
    var res = await apiJson('DELETE', '/subjects/' + id + '/');
    if (!res.ok) { alert(errorText(res.data)); return; }
    state.subjects = state.subjects.filter(function (x) { return x.id !== id; });
    state.schedule = state.schedule.filter(function (x) { return x.subjectId !== id; });
    renderPages();
  }

  function editClass(id) {
    if (!state.subjects.length) { alert('You have no subjects yet. Ask your teacher to enroll you in a course first.'); return; }
    var existing = id ? state.schedule.filter(function (x) { return x.id === id; })[0] : null;
    var fields = [
      { k: 'day', l: 'Day', options: DAYS.map(function (d) { return [d, d]; }) },
      { k: 'start', l: 'Start time', type: 'time', required: true },
      { k: 'hours', l: 'Duration (hours)', type: 'number', min: 0.5, max: 6, step: 0.5, required: true },
      { k: 'subjectId', l: 'Subject', options: state.subjects.map(function (s) { return [s.id, s.name]; }) },
      { k: 'room', l: 'Room' },
      { k: 'type', l: 'Type', options: TYPES.map(function (t) { return [t, t]; }) }
    ];
    var t = todayName();
    ask(existing ? 'Edit class' : 'Add class', fields,
      existing || { day: (t === 'Saturday' || t === 'Sunday') ? 'Monday' : t, start: '09:00', hours: 1, type: 'Lecture' },
      async function (v) {
        if (!v.start) return 'Choose a start time.';
        var body = { day: v.day, start: v.start, hours: +v.hours, subjectId: +v.subjectId, room: v.room, type: v.type };
        var res = existing
          ? await apiJson('PUT', '/classes/' + existing.id + '/', body)
          : await apiJson('POST', '/classes/', body);
        if (!res.ok) return errorText(res.data);        // e.g. the clash message from Django
        if (existing) Object.assign(existing, res.data); else state.schedule.push(res.data);
        renderPages();
      });
  }

  async function deleteClass(id) {
    if (!confirm('Remove this class from your timetable?')) return;
    var res = await apiJson('DELETE', '/classes/' + id + '/');
    if (!res.ok) { alert(errorText(res.data)); return; }
    state.schedule = state.schedule.filter(function (x) { return x.id !== id; });
    renderPages();
  }

  function rowButtons(kind, id) {
    return '<button type="button" class="btn small" data-act="edit-' + kind + '" data-id="' + id + '">Edit</button> ' +
      '<button type="button" class="btn small danger" data-act="del-' + kind + '" data-id="' + id + '">Delete</button>';
  }

  function renderEditors() {
    var sub = $('#subjects-editor'), sch = $('#schedule-editor');
    if (sub) {
      sub.innerHTML = state.subjects.length ? '<table><thead><tr><th>Code</th><th>Subject</th><th>Teacher</th>' +
        '<th>Credits</th><th>Progress</th><th>Actions</th></tr></thead><tbody>' + state.subjects.map(function (s) {
          return '<tr><td>' + esc(s.code) + '</td><td>' + esc(s.name) + '</td><td>' + esc(s.teacher) + '</td><td>' +
            s.credits + '</td><td>' + s.progress + '%</td><td>' + '<button type="button" class="btn small" data-act="edit-subject" data-id="' + s.id + '">Update progress</button>' + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No subjects yet. They appear here once a teacher enrolls you in a course.</div>';
    }
    if (sch) {
      sch.innerHTML = state.schedule.length ? '<table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th>' +
        '<th>Type</th><th>Actions</th></tr></thead><tbody>' + sortedSchedule(state.schedule).map(function (x) {
          var s = subject(x.subjectId);
          return '<tr><td>' + x.day + '</td><td>' + fmt(x.start) + ' · ' + x.hours + 'h</td><td>' + esc(s ? s.name : 'Unknown') +
            '</td><td>' + esc(x.room) + '</td><td>' + esc(x.type) + '</td><td>' + rowButtons('class', x.id) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No classes yet. Use “Add class” to build your timetable.</div>';
    }
  }

  function initSettings() {
    if (!$('#profile')) return;

    // Change password (Django checks the old password and validates the new one).
    var passwordForm = $('#password-form');
    if (passwordForm) passwordForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      var message = $('#password-message');
      var button = passwordForm.querySelector('[type="submit"]');
      var oldPassword = $('#old-password').value;
      var newPassword = $('#new-password').value;
      var confirmPassword = $('#confirm-password').value;
      message.textContent = '';
      if (!oldPassword || !newPassword || !confirmPassword) {
        message.textContent = 'Fill in all password fields.'; return;
      }
      if (newPassword !== confirmPassword) {
        message.textContent = 'New passwords do not match.'; return;
      }
      button.disabled = true;
      try {
        var res = await apiJson('POST', '/change-password/', {
          old_password: oldPassword, new_password: newPassword
        });
        if (!res.ok) { message.textContent = errorText(res.data); return; }
        passwordForm.reset();
        message.textContent = 'Password changed successfully.';
      } catch (error) {
        message.textContent = 'Unable to change password. Try again.';
      } finally {
        button.disabled = false;
      }
    });

    // Profile
    var saveBtn = $('#save-profile');
    saveBtn.addEventListener('click', async function () {
      var body = {};
      $$('[data-profile]').forEach(function (i) {
        if (i.value.trim()) body[i.getAttribute('data-profile')] = i.value.trim();
      });
      var res = await apiJson('PATCH', '/profile/', body);
      if (!res.ok) { alert(errorText(res.data)); return; }
      applyProfile(res.data); renderChrome();
      saveBtn.textContent = 'Saved';
      setTimeout(function () { saveBtn.textContent = 'Save changes'; }, 1600);
    });

    // Time format
    var tf = $('[data-pref="time"]');
    tf.addEventListener('change', async function () {
      var res = await apiJson('PATCH', '/profile/', { time24: tf.value === '24-hour' });
      if (!res.ok) { alert(errorText(res.data)); initSettingsValues(); return; }
      applyProfile(res.data); renderPages();
    });

    // Editors
    $('#add-class').addEventListener('click', function () { editClass(); });
    $('#reset-data').addEventListener('click', async function () {
      if (!confirm('Clear your timetable and reset preferences? Your enrolled subjects stay. This cannot be undone.')) return;
      var res = await apiJson('POST', '/reset/');
      if (!res.ok) { alert(errorText(res.data)); return; }
      await loadAll(); initSettingsValues(); renderPages();
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var id = Number(b.getAttribute('data-id'));      // ids are numbers in the database
      ({ 'edit-subject': editSubject, 'del-subject': deleteSubject, 'edit-class': editClass, 'del-class': deleteClass })[b.getAttribute('data-act')](id);
    });

    // Settings side nav highlight
    $$('.settings-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        $$('.settings-nav a').forEach(function (x) { x.classList.remove('active'); });
        a.classList.add('active');
      });
    });
    initSettingsValues();
  }

  function initSettingsValues() {
    $$('[data-profile]').forEach(function (i) { i.value = state.profile[i.getAttribute('data-profile')] || ''; });
    var tf = $('[data-pref="time"]');
    if (tf) tf.value = state.prefs.time24 ? '24-hour' : '12-hour';
  }

  /* ---------- Course search ---------- */
  function initSearch() {
    $$('input.search[data-filter]').forEach(function (input) {
      input.addEventListener('input', function () {
        var q = input.value.toLowerCase();
        $$(input.getAttribute('data-filter')).forEach(function (card) {
          card.style.display = card.textContent.toLowerCase().indexOf(q) < 0 ? 'none' : '';
        });
      });
    });
  }

  function addLogoutButton() {
    $$('.user').forEach(function (u) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small';
      b.textContent = 'Log out';
      b.addEventListener('click', logout);
      u.appendChild(b);
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!localStorage.getItem('token')) { window.location.href = 'login.html'; return; }
    if (localStorage.getItem('role') === 'teacher') { window.location.href = 'teacher.html'; return; }
    addLogoutButton();
    initSearch();
    if (await loadAll()) {
      renderPages();
      initSettings();
    }
  });
})();