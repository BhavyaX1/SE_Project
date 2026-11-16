
/*
 * CampusHub - Shared Sidebar
 *
 * Handles navigation for:
 * - Student Dashboard
 * - Teacher Dashboard
 *
 * Automatically highlights the active page.
 */

(function () {
    "use strict";

    // =========================================
    // STUDENT NAVIGATION
    // =========================================

    const studentLinks = [
        {
            name: "Dashboard",
            url: "index.html"
        },
        {
            name: "Courses",
            url: "courses.html"
        },
        {
            name: "Schedule",
            url: "schedule.html"
        },
        {
            name: "Attendance",
            url: "attendance.html"
        },
        {
            name: "Settings",
            url: "settings.html"
        }
    ];

    // =========================================
    // TEACHER NAVIGATION
    // =========================================

    const teacherLinks = [
        {
            name: "Dashboard",
            url: "teacher.html"
        },
        {
            name: "Courses & Students",
            url: "teacher-courses.html"
        },
        {
            name: "Mark Attendance",
            url: "teacher-attendance.html"
        },
        {
            name: "Reports",
            url: "teacher-reports.html"
        },
        {
            name: "Settings",
            url: "teacher-settings.html"
        }
    ];

    // =========================================
    // GET CURRENT PAGE
    // =========================================

    function getCurrentPage() {
        const path = window.location.pathname;

        return path.split("/").pop() || "index.html";
    }

    // =========================================
    // CREATE SIDEBAR
    // =========================================

    function createSidebar() {

        const sidebar =
            document.getElementById("sidebar");

        if (!sidebar) {
            return;
        }

        const currentPage = getCurrentPage();

        // Determine whether this is a
        // student page or teacher page.
        const isTeacherPage =
            currentPage === "teacher.html" ||
            currentPage.startsWith("teacher-");

        const links = isTeacherPage
            ? teacherLinks
            : studentLinks;

        // Clear existing sidebar
        sidebar.innerHTML = "";

        // =====================================
        // BRAND
        // =====================================

        const brand = document.createElement("div");

        brand.className = "brand";
        brand.textContent = "CampusHub";

        sidebar.appendChild(brand);

        // =====================================
        // NAVIGATION
        // =====================================

        const nav = document.createElement("nav");

        nav.className = "nav";
        nav.id = "nav";

        links.forEach(function (item) {

            const link = document.createElement("a");

            link.href = item.url;
            link.textContent = item.name;

            // Highlight currently opened page
            if (currentPage === item.url) {

                link.classList.add("active");

                link.setAttribute(
                    "aria-current",
                    "page"
                );
            }

            nav.appendChild(link);
        });

        sidebar.appendChild(nav);

    }

    // =========================================
    // INITIALIZE
    // =========================================

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            createSidebar
        );

    } else {

        createSidebar();

    }

})();
