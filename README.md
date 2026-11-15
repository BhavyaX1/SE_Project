# CampusHub 🎓

**CampusHub** is a college management web application built with **Django**, **Django REST Framework**, **SQLite**, and **HTML/CSS/JavaScript**. It provides separate student and teacher experiences for managing courses, schedules, and attendance.

> **Project status:** Educational/development project. Run locally for testing; review security settings before any public deployment.

## Features

### Students
- Register and sign in to a student account.
- View enrolled courses and manage a personal weekly timetable.
- Check attendance records, percentages, and attendance-target guidance.
- Edit profile details and preferences.
- Change password and choose an appearance theme.

### Teachers
- Register with an administrator-provided teacher signup code and sign in to a teacher account.
- Create and manage courses and enroll or remove students.
- Mark attendance for enrolled students by date.
- View attendance reports and export report data as CSV.

### Shared features
- Token-based API authentication.
- Account-name initials in the user avatar.
- Light, dark, and system appearance options (stored per account **in the current browser**; the login page has its own preference).
- Separate navigation for student and teacher pages.

## Tech stack

| Layer | Technology |
| --- | --- |
| Backend | Python, Django |
| API | Django REST Framework, DRF token authentication |
| Database | SQLite (local development) |
| Frontend | HTML, CSS, vanilla JavaScript |
| Dependencies | Pipenv (`Pipfile`, `Pipfile.lock`) |

## Project structure

```text
SE_Project/
├── api/
│   ├── migrations/
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── permissions.py
│   ├── serializers.py
│   ├── signals.py
│   ├── urls.py
│   ├── utils.py
│   └── views.py
├── config/
│   ├── asgi.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── frontend/
│   ├── index.html, courses.html, schedule.html, attendance.html, settings.html
│   ├── teacher.html, teacher-courses.html, teacher-attendance.html, teacher-reports.html
│   ├── login.html
│   ├── api.js, app.js, attendance.js, teacher.js
│   ├── sidebar.js, avatar.js, theme.js
│   └── style.css, attendance.css
├── manage.py
├── Pipfile
├── Pipfile.lock
└── .gitignore
```

`db.sqlite3` is generated locally and is **not included in the repository**. A fresh clone starts with an empty database, not demo accounts or sample attendance data.

## Prerequisites

- Git
- Python compatible with the version and dependencies specified in `Pipfile` / `Pipfile.lock`
- Pipenv (installation instructions below)

> All commands below should be run in the directory containing `manage.py` and `Pipfile`.

## Installation

### 1. Clone the repository (all operating systems)

```bash
git clone https://github.com/BhavyaX1/SE_Project.git
cd SE_Project
```

### 2A. Windows 10/11 (PowerShell)

Install [Python](https://www.python.org/downloads/) and [Git](https://git-scm.com/downloads/win) if needed, then open PowerShell in the repository folder.

```powershell
py --version
git --version
py -m pip install --user pipenv
py -m pipenv install
```

If the project requires a particular Python version, install that version and use it with Pipenv, for example `py -m pipenv --python 3.12` (replace `3.12` with the version your `Pipfile` specifies) before installing dependencies.

### 2B. Ubuntu / Debian-based Linux

```bash
sudo apt update
sudo apt install -y git python3 python3-venv pipx
pipx ensurepath
```

Open a new terminal (to refresh `PATH`) and navigate back to the repository folder, then run:

```bash
pipx install pipenv
pipenv install
```

### 2C. Fedora Linux

```bash
sudo dnf install -y git python3 python3-pip pipx
pipx ensurepath
```

Open a new terminal, return to the repository folder, then run:

```bash
pipx install pipenv
pipenv install
```

### 2D. CachyOS / Arch-based Linux

```bash
sudo pacman -Syu
sudo pacman -S --needed git python python-pipx
pipx ensurepath
```

Open a new terminal, return to the repository folder, then run:

```bash
pipx install pipenv
pipenv install
```

**Fish shell users:** `pipx ensurepath` may ask you to restart your terminal; if `pipenv` is not found, check the path shown by `pipx ensurepath` and restart Fish.

**Alternative:** If Pipenv is already installed, skip installing it and just run `pipenv install`.

## Configuration

Before registering a teacher, set a **private** `TEACHER_SIGNUP_CODE` environment variable. Do not commit your signup code or Django secret key to Git.

For a local development setup, you can also supply a Django secret key if your `config/settings.py` reads `DJANGO_SECRET_KEY`. The exact environment variable names must match your local settings.

**Windows PowerShell (current terminal only):**

```powershell
$env:TEACHER_SIGNUP_CODE = "replace-with-a-private-code"
$env:DJANGO_SECRET_KEY = "replace-with-a-long-random-secret-key"
```

**Ubuntu / Fedora / CachyOS (Bash or Zsh, current terminal only):**

```bash
export TEACHER_SIGNUP_CODE='replace-with-a-private-code'
export DJANGO_SECRET_KEY='replace-with-a-long-random-secret-key'
```

**CachyOS with Fish shell:**

```fish
set -x TEACHER_SIGNUP_CODE 'replace-with-a-private-code'
set -x DJANGO_SECRET_KEY 'replace-with-a-long-random-secret-key'
```

Keep the terminal session open for the commands below, or configure private environment variables through your preferred local method. Existing teachers **do not** enter this code when logging in; it is used only for new teacher registration.

## Initialize the database and run

On Linux, use:

```bash
pipenv run python manage.py migrate
pipenv run python manage.py check
pipenv run python manage.py runserver
```

On Windows PowerShell, use:

```powershell
py -m pipenv run python manage.py migrate
py -m pipenv run python manage.py check
py -m pipenv run python manage.py runserver
```

Open **http://127.0.0.1:8000/login.html** in your browser.

For the Django admin interface, you can optionally create a superuser:

```bash
pipenv run python manage.py createsuperuser
```

On Windows, use `py -m pipenv run python manage.py createsuperuser`.

## How to use

1. Open the login page and choose **Student** or **Teacher**.
2. Select **Register** to create an account. A new teacher must enter the private teacher signup code.
3. Sign in with your username and password.
4. **Teacher:** create a course, enroll students, mark attendance, and open reports.
5. **Student:** view enrolled courses, build your timetable, and check recorded attendance.

New installations have no preloaded users, courses, or attendance records. Create your own accounts and courses after migration.

## API overview

| Endpoint | Purpose |
| --- | --- |
| `POST /api/register/` | Create a student or teacher account |
| `POST /api/login/` | Get an authentication token |
| `GET/PATCH /api/profile/` | Read/update profile |
| `/api/subjects/` | Student enrolled subjects and progress |
| `/api/classes/` | Student timetable |
| `/api/courses/` | Teacher-managed courses |
| `POST /api/courses/<id>/enroll/` | Enroll a student |
| `POST /api/courses/<id>/unenroll/` | Remove a student |
| `GET/POST /api/courses/<id>/attendance/` | View or mark attendance |
| `GET /api/courses/<id>/report/` | Course attendance report |
| `GET /api/my-attendance/` | Student attendance overview |
| `POST /api/reset/` | Reset student planner/preferences |

Authenticated requests use the HTTP header `Authorization: Token <your-token>`.

## Troubleshooting

**`pipenv` not found:** Restart the terminal after `pipx ensurepath`, or check that pipx's binary directory is on your `PATH`.

**Python version mismatch:** Check the Python version in `Pipfile` and install a compatible interpreter. Then tell Pipenv which interpreter to use (`pipenv --python <version>`).

**Teacher registration fails:** Confirm `TEACHER_SIGNUP_CODE` is set in the same terminal session that starts Django, then verify you entered the matching code on **Register → Teacher**.

**`attempt to write a readonly database`:** Ensure the project directory and `db.sqlite3` are writable by the account running Django. On mounted Linux drives, also check filesystem mount options. Don't run Django with `sudo` to work around the problem.

**Appearance or navigation looks outdated:** Hard-refresh the page (`Ctrl+Shift+R`) and check that Django is serving the updated `frontend/` directory.

**Port 8000 already in use:** Stop the existing server or run on another port:

```bash
pipenv run python manage.py runserver 8001
```

## Repository

**Source code:** [BhavyaX1/SE_Project](https://github.com/BhavyaX1/SE_Project)

---

*CampusHub — a Django-based college course, timetable, and attendance management project.*
