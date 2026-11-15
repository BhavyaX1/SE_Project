/* Shared navigation. A single source of truth for all dashboards. */
(function () {
  'use strict';
  const student = [
    ['index.html', 'Dashboard'], ['courses.html', 'Courses'],
    ['schedule.html', 'Schedule'], ['attendance.html', 'Attendance'],
    ['settings.html', 'Settings']
  ];
  const teacher = [
    ['teacher.html', 'Dashboard'], ['teacher-courses.html', 'Courses & Students'],
    ['teacher-attendance.html', 'Mark Attendance'],
    ['teacher-reports.html', 'Reports']
  ];
  document.addEventListener('DOMContentLoaded', function () {
    const target = document.getElementById('sidebar');
    if (!target) return;
    const page = location.pathname.split('/').pop() || 'index.html';
    const isTeacher = page.startsWith('teacher');
    const brand = document.createElement('div');
    brand.className = 'brand'; brand.textContent = 'CampusHub';
    const nav = document.createElement('nav');
    nav.className = 'nav'; nav.id = 'nav';
    (isTeacher ? teacher : student).forEach(function (item) {
      const a = document.createElement('a');
      a.href = item[0]; a.textContent = item[1];
      if (item[0] === page) {
        a.className = 'active'; a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });
    target.replaceChildren(brand, nav);
  });
})();
