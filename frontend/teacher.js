/* teacher.js - TEACHER side. One script for all four teacher pages.
 * Each page sets <body data-page="dashboard|mark|courses|reports">.
 * Uses api.js (apiJson, errorText, logout).
 */
(function () {
  "use strict";
  if (!localStorage.getItem("token")) {
    location.href = "login.html";
    return;
  }
  if (localStorage.getItem("role") !== "teacher") {
    location.href = "index.html";
    return;
  }

  const LOW = 75; // default "low attendance" threshold (%)
  const PAGES = [
    ["dashboard", "teacher.html", "Dashboard"],
    ["mark", "teacher-attendance.html", "Mark Attendance"],
    ["courses", "teacher-courses.html", "Courses & Students"],
    ["reports", "teacher-reports.html", "Reports"],
  ];
  const page = document.body.dataset.page;

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
  const pct = (a, t) => (t ? Math.round((a * 1000) / t) / 10 : 0);
  const stat = (v, l) =>
    `<div class="stat"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`;
  const courseOptions = (cs) =>
    cs
      .map(
        (c) =>
          `<option value="${c.id}">${esc(c.code)} — ${esc(c.name)}</option>`,
      )
      .join("");

  function showError(message) {
    let box = $("#load-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "load-error";
      box.className = "panel";
      box.style.cssText = "margin-bottom:18px;color:#a23b3b";
      $(".content").insertBefore(box, $(".content").firstChild);
    }
    box.textContent = message;
  }
  const err = (r) => showError(errorText(r.data));

  function chrome() {
    const name = localStorage.getItem("name") || "Teacher";
    if (window.CampusAvatar) CampusAvatar.render(name);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn small";
    b.textContent = "Log out";
    b.onclick = logout;
    $(".user").appendChild(b);
  }

  // Small dialog form (same look as the Settings dialogs). onSave returns an error string, or nothing on success.
  function ask(title, fields, values, onSave) {
    const d = document.createElement("dialog");
    d.className = "modal";
    d.innerHTML =
      `<form method="dialog"><h2>${esc(title)}</h2>` +
      fields
        .map(
          (f) =>
            `<div class="field"><label for="f_${f.k}">${esc(f.l)}</label><input id="f_${f.k}" name="${f.k}" value="${esc(values[f.k])}"${f.required ? " required" : ""}></div>`,
        )
        .join("") +
      '<div class="form-error" role="alert"></div><div class="toolbar"><button class="btn primary" value="ok">Save</button>' +
      '<button class="btn" value="cancel" formnovalidate>Cancel</button></div></form>';
    document.body.appendChild(d);
    const form = $("form", d);
    form.addEventListener("submit", (e) => {
      if (!e.submitter || e.submitter.value !== "ok") return;
      e.preventDefault();
      const out = {};
      fields.forEach((f) => {
        out[f.k] = form.elements[f.k].value.trim();
      });
      e.submitter.disabled = true;
      Promise.resolve(onSave(out)).then((msg) => {
        e.submitter.disabled = false;
        if (msg) $(".form-error", d).textContent = msg;
        else d.close();
      });
    });
    d.addEventListener("close", () => d.remove());
    d.showModal();
    $("input", d).focus();
  }

  /* ======================= DASHBOARD ======================= */
  async function dashboard() {
    $("[data-today]").textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const r = await apiJson("GET", "/courses/");
    if (!r.ok) return err(r);
    const cs = r.data;
    if (!cs.length) {
      $("#stats").innerHTML =
        stat(0, "Courses") +
        stat(0, "Students") +
        stat("—", "Marked today") +
        stat("—", "Average attendance");
      $("#today").innerHTML = $("#low").innerHTML =
        '<div class="empty">Create your first course to get started.</div>';
      $("#courses").innerHTML =
        '<div class="empty">No courses yet. <a class="link" href="teacher-courses.html">Add a course →</a></div>';
      return;
    }
    const day = today();
    const res = await Promise.all(
      cs.map((c) =>
        Promise.all([
          apiJson("GET", `/courses/${c.id}/attendance/?date=${day}`),
          apiJson("GET", `/courses/${c.id}/report/`),
        ]),
      ),
    );

    let students = 0,
      marked = 0,
      att = 0,
      tot = 0;
    const todayRows = [],
      lowRows = [],
      courseRows = [];
    cs.forEach((c, i) => {
      const a = res[i][0].ok ? res[i][0].data : { students: [], marked: false };
      const rep = res[i][1].ok ? res[i][1].data : [];
      let ca = 0,
        ct = 0;
      rep.forEach((s) => {
        ca += s.attended;
        ct += s.total;
        if (s.total && s.percentage < LOW) lowRows.push({ s, c });
      });
      students += c.student_count;
      att += ca;
      tot += ct;
      if (a.marked) marked++;
      const here = a.students.filter((s) => s.present).length;
      const sub = !a.students.length
        ? "No students enrolled"
        : a.marked
          ? `${here} / ${a.students.length} present · ${a.students.length - here} absent`
          : "Not marked yet";
      todayRows.push(`<div class="list-item"><div><div class="list-title">${esc(c.code)} — ${esc(c.name)}</div>
        <div class="list-sub">${sub}</div></div>
        <a class="btn small${a.marked ? "" : " primary"}" href="${a.students.length ? "teacher-attendance.html?course=" + c.id : "teacher-courses.html"}">${a.students.length ? (a.marked ? "Edit" : "Mark") : "Add students"}</a></div>`);
      courseRows.push(
        `<tr><td>${esc(c.code)}</td><td>${esc(c.name)}</td><td>${c.student_count}</td><td>${ct ? pct(ca, ct) + "%" : "—"}</td></tr>`,
      );
    });

    $("#stats").innerHTML =
      stat(cs.length, "Courses") +
      stat(students, "Students enrolled") +
      stat(`${marked}/${cs.length}`, "Marked today") +
      stat(tot ? pct(att, tot) + "%" : "—", "Average attendance");
    $("#today").innerHTML = todayRows.join("");
    lowRows.sort((x, y) => x.s.percentage - y.s.percentage);
    $("#low").innerHTML = lowRows.length
      ? lowRows
        .slice(0, 8)
        .map(
          (x) =>
            `<div class="list-item"><div><div class="list-title">${esc(x.s.name)}</div>
       <div class="list-sub">${esc(x.c.code)} · ${x.s.attended}/${x.s.total} classes</div></div>
       <span class="badge red">${x.s.percentage}%</span></div>`,
        )
        .join("")
      : '<div class="empty">Nobody is below the limit. 🎉</div>';
    $("#courses").innerHTML =
      "<table><thead><tr><th>Code</th><th>Course</th><th>Students</th><th>Avg attendance</th></tr></thead><tbody>" +
      courseRows.join("") +
      "</tbody></table>";
  }

  /* ======================= MARK ATTENDANCE ======================= */
  function mark() {
    const st = { cid: "", day: "", students: [], marked: false, dirty: false };
    const course = $("#course"),
      date = $("#date"),
      q = $("#q"),
      msg = $("#msg");
    const sure = () =>
      !st.dirty || confirm("You have unsaved changes. Discard them?");

    async function load() {
      const r = await apiJson(
        "GET",
        `/courses/${course.value}/attendance/?date=${date.value}`,
      );
      if (!r.ok) return err(r);
      Object.assign(st, {
        cid: course.value,
        day: date.value,
        students: r.data.students,
        marked: r.data.marked,
        dirty: false,
      });
      msg.textContent = "";
      draw();
    }

    function draw() {
      const n = st.students.length,
        p = st.students.filter((s) => s.present).length;
      const term = q.value.trim().toLowerCase();
      $("#counts").innerHTML =
        `<span class="badge green">Present ${p}</span><span class="badge red">Absent ${n - p}</span>` +
        `<span class="badge ${st.marked ? "blue" : "amber"}">${st.marked ? "Already marked" : "Not marked yet"}</span>`;
      const rows = st.students.filter(
        (s) =>
          !term || (s.name + " " + s.username).toLowerCase().includes(term),
      );
      $("#roster").innerHTML = rows.length
        ? rows
          .map(
            (s) => `
        <div class="att-row" data-id="${s.id}"><div><div class="list-title">${esc(s.name)}</div><div class="list-sub">@${esc(s.username)}</div></div>
        <div class="seg"><button type="button" data-set="1" class="${s.present ? "on p" : ""}">Present</button>
        <button type="button" data-set="0" class="${s.present ? "" : "on a"}">Absent</button></div></div>`,
          )
          .join("")
        : `<div class="empty">${n ? "No student matches your search." : "No students enrolled yet. Add them under Courses & Students."}</div>`;
      $("#save").disabled = !n;
    }

    function change() {
      if (!date.value || !sure()) {
        course.value = st.cid;
        date.value = st.day;
        return;
      }
      load();
    }
    function shift(k) {
      const d = new Date(date.value + "T00:00:00");
      d.setDate(d.getDate() + k);
      const v = d.toLocaleDateString("en-CA");
      if (v > today()) return;
      date.value = v;
      change();
    }
    function setAll(v) {
      st.students.forEach((s) => {
        s.present = v;
      });
      st.dirty = true;
      draw();
    }

    course.onchange = date.onchange = change;
    q.oninput = draw;
    $("#prev").onclick = () => shift(-1);
    $("#next").onclick = () => shift(1);
    $("#allP").onclick = () => setAll(true);
    $("#allA").onclick = () => setAll(false);
    $("#roster").onclick = (e) => {
      const b = e.target.closest("[data-set]");
      if (!b) return;
      const s = st.students.find(
        (x) => String(x.id) === b.closest("[data-id]").dataset.id,
      );
      s.present = b.dataset.set === "1";
      st.dirty = true;
      draw();
    };
    $("#save").onclick = async () => {
      const records = st.students.map((s) => ({
        student: s.id,
        present: s.present,
      }));
      const r = await apiJson("POST", `/courses/${st.cid}/attendance/`, {
        date: st.day,
        records,
      });
      if (!r.ok) {
        msg.textContent = errorText(r.data);
        msg.style.color = "#a23b3b";
        return;
      }
      st.dirty = false;
      st.marked = true;
      msg.style.color = "#267448";
      msg.textContent = `Saved ${r.data.saved} students ✓ — they see it within 5 seconds.`;
      draw();
    };
    window.addEventListener("beforeunload", (e) => {
      if (st.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    (async function init() {
      const r = await apiJson("GET", "/courses/");
      if (!r.ok) return err(r);
      if (!r.data.length) {
        $("#roster").innerHTML =
          '<div class="empty">Create a course first.</div>';
        $("#save").disabled = true;
        return;
      }
      course.innerHTML = courseOptions(r.data);
      const want = new URLSearchParams(location.search).get("course");
      if (want && r.data.some((c) => String(c.id) === want))
        course.value = want;
      date.value = today();
      date.max = today();
      load();
    })();
  }

  /* ======================= COURSES & STUDENTS ======================= */
  function courses() {
    let list = [],
      open = null;

    async function load() {
      const r = await apiJson("GET", "/courses/");
      if (!r.ok) return err(r);
      list = r.data;
      draw();
      if (open && list.some((c) => c.id === open)) roster(open);
    }
    function draw() {
      $("#course-table").innerHTML = list.length
        ? "<table><thead><tr><th>Code</th><th>Course</th><th>Students</th><th>Actions</th></tr></thead><tbody>" +
        list
          .map(
            (
              c,
            ) => `<tr><td>${esc(c.code)}</td><td>${esc(c.name)}</td><td>${c.student_count}</td><td>
          <button type="button" class="btn small" data-act="students" data-id="${c.id}">Students</button>
          <button type="button" class="btn small" data-act="edit" data-id="${c.id}">Edit</button>
          <button type="button" class="btn small danger" data-act="del" data-id="${c.id}">Delete</button></td></tr>`,
          )
          .join("") +
        "</tbody></table>"
        : '<div class="empty">No courses yet. Use “Add course”.</div>';
    }
    function edit(id) {
      const ex = id ? list.find((c) => c.id === id) : null;
      ask(
        ex ? "Edit course" : "Add course",
        [
          { k: "code", l: "Course code", required: true },
          { k: "name", l: "Course name", required: true },
        ],
        ex || {},
        async (v) => {
          const body = { code: v.code, name: v.name };
          const r = ex
            ? await apiJson("PUT", `/courses/${ex.id}/`, body)
            : await apiJson("POST", "/courses/", body);
          if (!r.ok) return errorText(r.data);
          await load();
        },
      );
    }
    async function del(id) {
      const c = list.find((x) => x.id === id);
      if (
        !confirm(
          `Delete ${c.code}? All its attendance records will be deleted too.`,
        )
      )
        return;
      const r = await apiJson("DELETE", `/courses/${id}/`);
      if (!r.ok) return alert(errorText(r.data));
      if (open === id) {
        open = null;
        $("#roster-panel").hidden = true;
      }
      load();
    }
    async function roster(id) {
      open = id;
      const c = list.find((x) => x.id === id);
      const r = await apiJson(
        "GET",
        `/courses/${id}/attendance/?date=${today()}`,
      );
      if (!r.ok) return err(r);
      $("#roster-panel").hidden = false;
      $("#roster-title").textContent = `Students in ${c.code}`;
      $("#roster").innerHTML = r.data.students.length
        ? r.data.students
          .map(
            (s) =>
              `<div class="att-row"><div><div class="list-title">${esc(s.name)}</div><div class="list-sub">@${esc(s.username)}</div></div>
         <button type="button" class="btn small danger" data-remove="${esc(s.username)}">Remove</button></div>`,
          )
          .join("")
        : '<div class="empty">No students yet. Enroll them above using their usernames.</div>';
    }
    async function enroll() {
      const names = $("#usernames")
        .value.split(/[\s,]+/)
        .filter(Boolean),
        bad = [];
      for (const u of names) {
        const r = await apiJson("POST", `/courses/${open}/enroll/`, {
          username: u,
        });
        if (!r.ok) bad.push(u);
      }
      $("#enroll-msg").textContent = bad.length
        ? `Not found (students must register first): ${bad.join(", ")}`
        : "";
      $("#usernames").value = bad.join(", ");
      load();
    }

    $("#add-course").onclick = () => edit();
    $("#enroll").onclick = enroll;
    $("#course-table").onclick = (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      ({ students: roster, edit: edit, del: del })[b.dataset.act](
        Number(b.dataset.id),
      );
    };
    $("#roster").onclick = async (e) => {
      const u = e.target.dataset.remove;
      if (!u || !confirm(`Remove @${u} from this course?`)) return;
      const r = await apiJson("POST", `/courses/${open}/unenroll/`, {
        username: u,
      });
      if (!r.ok) return alert(errorText(r.data));
      load();
    };
    load();
  }

  /* ======================= REPORTS ======================= */
  function reports() {
    let rows = [];
    const sel = $("#course"),
      thr = $("#thr"),
      lowOnly = $("#lowOnly"),
      q = $("#q");

    const limit = () => +thr.value || LOW;
    function view() {
      const term = q.value.trim().toLowerCase();
      return rows.filter(
        (s) =>
          (!term || (s.name + " " + s.username).toLowerCase().includes(term)) &&
          (!lowOnly.checked || (s.total && s.percentage < limit())),
      );
    }
    function draw() {
      const t = limit(),
        shown = view();
      let a = 0,
        n = 0,
        below = 0;
      rows.forEach((s) => {
        a += s.attended;
        n += s.total;
        if (s.total && s.percentage < t) below++;
      });
      $("#summary").innerHTML =
        `<span class="badge blue">Class average ${n ? pct(a, n) + "%" : "—"}</span>` +
        `<span class="badge ${below ? "red" : "green"}">${below} below ${t}%</span><span class="badge amber">${rows.length} students</span>`;
      $("#report").innerHTML = shown.length
        ? "<table><thead><tr><th>Student</th><th>Attended</th><th>Total</th><th>Attendance</th><th>Status</th></tr></thead><tbody>" +
        shown
          .map((s) => {
            const status = !s.total
              ? '<span class="badge amber">No data</span>'
              : s.percentage >= t
                ? '<span class="badge green">Good</span>'
                : '<span class="badge red">Low</span>';
            return `<tr><td>${esc(s.name)} <span class="muted">@${esc(s.username)}</span></td><td>${s.attended}</td><td>${s.total}</td>
            <td><div style="display:flex;gap:9px;align-items:center"><div class="progress" style="width:90px"><span class="${s.total && s.percentage < t ? "low" : ""}" style="width:${s.percentage}%"></span></div>${s.percentage}%</div></td>
            <td>${status}</td></tr>`;
          })
          .join("") +
        "</tbody></table>"
        : '<div class="empty">No students to show.</div>';
    }
    async function load() {
      const r = await apiJson("GET", `/courses/${sel.value}/report/`);
      if (!r.ok) return err(r);
      rows = r.data;
      draw();
    }
    function exportCsv() {
      const q2 = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      const lines = [
        ["Name", "Username", "Attended", "Total", "Percentage"].join(","),
      ].concat(
        view().map((s) =>
          [q2(s.name), q2(s.username), s.attended, s.total, s.percentage].join(
            ",",
          ),
        ),
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([lines.join("\n")], { type: "text/csv" }),
      );
      a.download = `attendance-course-${sel.value}-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    sel.onchange = load;
    thr.oninput = lowOnly.onchange = q.oninput = draw;
    $("#csv").onclick = exportCsv;
    (async function init() {
      const r = await apiJson("GET", "/courses/");
      if (!r.ok) return err(r);
      if (!r.data.length) {
        $("#report").innerHTML = '<div class="empty">No courses yet.</div>';
        return;
      }
      sel.innerHTML = courseOptions(r.data);
      load();
    })();
  }

  document.addEventListener("DOMContentLoaded", () => {
    chrome();
    ({ dashboard, mark, courses, reports })[page]();
  });
})();
