from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (RegisterView, LoginView, ProfileView, ResetView, MyAttendanceView,
                    SubjectViewSet, ClassSlotViewSet, CourseViewSet)

router = DefaultRouter()
router.register('subjects', SubjectViewSet, basename='subject')
router.register('classes', ClassSlotViewSet, basename='class')
router.register('courses', CourseViewSet, basename='course')

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('profile/', ProfileView.as_view()),
    path('reset/', ResetView.as_view()),
    path('my-attendance/', MyAttendanceView.as_view()),
    path('', include(router.urls)),
]