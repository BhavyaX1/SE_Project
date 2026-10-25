from rest_framework.permissions import BasePermission


def role_of(user):
    profile = getattr(user, 'profile', None)
    return profile.role if profile else None


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and role_of(request.user) == 'teacher'


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and role_of(request.user) == 'student'