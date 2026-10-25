from datetime import date as date_cls

from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (Profile, Subject, ClassSlot, Course,
                     AttendanceSession, AttendanceRecord)
from .permissions import IsTeacher, IsStudent
from .serializers import (ProfileSerializer, SubjectSerializer,
                          ClassSlotSerializer, CourseSerializer)
from .utils import attendance_insight


def get_profile(user):
    """Every user needs a Profile. Create one if it's missing (e.g. the admin account)."""
    profile, _ = Profile.objects.get_or_create(user=user, defaults={'name': user.username})
    return profile


def parse_day(value):
    """'2026-10-24' -> date, or None if invalid."""
    try:
        return date_cls.fromisoformat(value or str(date_cls.today()))
    except (TypeError, ValueError):
        return None


# ---------------- login / register ----------------
class RegisterView(APIView):
    """POST /api/register/  {username, password, name, role, teacher_code}
    New accounts start EMPTY: no subjects, no courses, no schedule."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        name = (request.data.get('name') or '').strip() or username
        role = request.data.get('role', 'student')
        if role not in ('student', 'teacher'):
            role = 'student'

        if not username or not password:
            return Response({'detail': 'Username and password are required.'}, status=400)
        if len(password) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=400)
        if role == 'teacher' and request.data.get('teacher_code') != settings.TEACHER_SIGNUP_CODE:
            return Response({'detail': 'Wrong teacher signup code.'}, status=400)
        if User.objects.filter(username__iexact=username).exists():
            return Response({'detail': 'That username is already taken.'}, status=400)

        user = User.objects.create_user(username=username, password=password)
        Profile.objects.create(user=user, name=name, role=role)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'name': name, 'role': role},
                        status=status.HTTP_201_CREATED)


class LoginView(ObtainAuthToken):
    """POST /api/login/  ->  {token, name, role}"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        profile = get_profile(user)
        return Response({'token': token.key, 'name': profile.name, 'role': profile.role})


class ProfileView(RetrieveUpdateAPIView):
    """GET / PUT / PATCH  /api/profile/"""
    serializer_class = ProfileSerializer

    def get_object(self):
        return get_profile(self.request.user)


# ---------------- STUDENT: subjects (from enrollment) + own timetable ----------------
class SubjectViewSet(viewsets.ModelViewSet):
    """/api/subjects/ - a student's enrolled subjects. Read + update progress only:
    subjects are created/removed automatically when the teacher enrolls/removes the student."""
    serializer_class = SubjectSerializer
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        return Subject.objects.filter(owner=self.request.user)


class ClassSlotViewSet(viewsets.ModelViewSet):
    """/api/classes/ - the student builds their own weekly timetable from their subjects."""
    serializer_class = ClassSlotSerializer

    def get_queryset(self):
        return ClassSlot.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ResetView(APIView):
    """POST /api/reset/ -> clears the student's timetable and resets preferences."""

    def post(self, request):
        profile = get_profile(request.user)
        if profile.role != 'student':
            return Response({'detail': 'Only students can reset the planner.'}, status=400)
        ClassSlot.objects.filter(owner=request.user).delete()
        profile.time24 = False
        profile.notify_a = profile.notify_g = profile.notify_c = True
        profile.save()
        return Response({'detail': 'Reset done.'})


# ---------------- TEACHER: courses, enrollment, attendance ----------------
class CourseViewSet(viewsets.ModelViewSet):
    """/api/courses/ ... a teacher's own courses only"""
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsTeacher]

    def get_queryset(self):
        return Course.objects.filter(teacher=self.request.user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

    def _student(self, request):
        name = (request.data.get('username') or '').strip()
        return User.objects.filter(username__iexact=name, profile__role='student').first()

    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        course, student = self.get_object(), self._student(request)
        if not student:
            return Response({'detail': 'No student with that username.'}, status=404)
        course.students.add(student)          # signal gives the student this subject
        return Response({'detail': 'Enrolled.'})

    @action(detail=True, methods=['post'])
    def unenroll(self, request, pk=None):
        course, student = self.get_object(), self._student(request)
        if not student:
            return Response({'detail': 'No student with that username.'}, status=404)
        course.students.remove(student)
        return Response({'detail': 'Removed.'})

    @action(detail=True, methods=['get', 'post'])
    def attendance(self, request, pk=None):
        """GET ?date=YYYY-MM-DD -> roster | POST {date, records:[{student, present}]} -> save"""
        course = self.get_object()

        if request.method == 'GET':
            day = parse_day(request.query_params.get('date'))
            if not day:
                return Response({'detail': 'Invalid date.'}, status=400)
            session = AttendanceSession.objects.filter(course=course, date=day).first()
            marked = {r.student_id: r.present for r in session.records.all()} if session else {}
            roster = [{'id': s.id, 'username': s.username, 'name': get_profile(s).name,
                       'present': marked.get(s.id, True)} for s in course.students.all()]
            return Response({'date': str(day), 'marked': session is not None, 'students': roster})

        day = parse_day(request.data.get('date'))
        if not day:
            return Response({'detail': 'A valid date (YYYY-MM-DD) is required.'}, status=400)
        if day > date_cls.today():
            return Response({'detail': "You can't mark attendance for a future date."}, status=400)

        session, _ = AttendanceSession.objects.get_or_create(course=course, date=day)
        enrolled = set(course.students.values_list('id', flat=True))
        saved = 0
        for r in request.data.get('records', []):
            if r.get('student') in enrolled:
                AttendanceRecord.objects.update_or_create(
                    session=session, student_id=r['student'],
                    defaults={'present': bool(r.get('present'))})
                saved += 1
        return Response({'saved': saved, 'date': str(day)})

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        course, rows = self.get_object(), []
        for s in course.students.all():
            recs = AttendanceRecord.objects.filter(session__course=course, student=s)
            total, attended = recs.count(), recs.filter(present=True).count()
            rows.append({'name': get_profile(s).name, 'username': s.username,
                         'attended': attended, 'total': total,
                         'percentage': round(attended * 100 / total, 1) if total else 0})
        return Response(rows)


# ---------------- STUDENT: own attendance ----------------
class MyAttendanceView(APIView):
    """GET /api/my-attendance/?required=75"""
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        try:
            required = max(1, min(100, int(request.query_params.get('required', 75))))
        except ValueError:
            required = 75
        out = []
        for c in request.user.enrolled_courses.select_related('teacher'):
            recs = AttendanceRecord.objects.filter(session__course=c, student=request.user)
            total, attended = recs.count(), recs.filter(present=True).count()
            recent = recs.select_related('session').order_by('-session__date')[:10]
            out.append({
                'course_id': c.id, 'code': c.code, 'name': c.name,
                'teacher': get_profile(c.teacher).name,
                'attended': attended, 'total': total,
                **attendance_insight(attended, total, required),
                'recent': [{'date': str(r.session.date), 'present': r.present} for r in recent],
            })
        return Response(out)