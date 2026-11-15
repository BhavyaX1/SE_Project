
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RegisterView,
    LoginView,
    ProfileView,
    ChangePasswordView,
    ResetView,
    MyAttendanceView,
    SubjectViewSet,
    ClassSlotViewSet,
    CourseViewSet,
)

# Automatic API routes for ViewSets
router = DefaultRouter()

router.register(
    "subjects",
    SubjectViewSet,
    basename="subject"
)

router.register(
    "classes",
    ClassSlotViewSet,
    basename="class"
)

router.register(
    "courses",
    CourseViewSet,
    basename="course"
)

urlpatterns = [
    # Authentication
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),

    # User profile
    path("profile/", ProfileView.as_view()),

    # Password management
    path(
        "change-password/",
        ChangePasswordView.as_view()
    ),

    # Student planner
    path("reset/", ResetView.as_view()),

    # Student attendance
    path(
        "my-attendance/",
        MyAttendanceView.as_view()
    ),

    # Subjects, timetable, teacher courses
    path("", include(router.urls)),
]
