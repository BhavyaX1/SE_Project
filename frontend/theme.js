/* Independent login-page and per-account browser theme preferences. */
(function () {
    "use strict";
    const loginKey = "campushub-theme-login";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const page = window.location.pathname.split("/").pop();

    function key() {
        if (page === "login.html") return loginKey;
        const username = localStorage.getItem("username");
        const role = localStorage.getItem("role");
        if (username && role) {
            return "campushub-theme-" + role.toLowerCase() + "-" + username.toLowerCase();
        }
        return loginKey;
    }
    function get() {
        const saved = localStorage.getItem(key());
        return ["light", "dark", "system"].includes(saved) ? saved : "system";
    }
    function apply() {
        const setting = get();
        const dark = setting === "dark" || (setting === "system" && media.matches);
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        const select = document.getElementById("theme-select");
        if (select) select.value = setting;
    }
    function save(value) {
        if (!["light", "dark", "system"].includes(value)) return;
        localStorage.setItem(key(), value);
        apply();
    }
    apply();
    if (media.addEventListener) media.addEventListener("change", apply);
    else if (media.addListener) media.addListener(apply);
    document.addEventListener("DOMContentLoaded", function () {
        const input = document.getElementById("theme-select");
        if (input) {
            input.value = get();
            input.addEventListener("change", function () { save(input.value); });
        }
    });
    window.CampusTheme = { get, save, apply };
})();
