
from datetime import date as date_cls

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from rest_framework import viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Profile,
    Subject,
    ClassSlot,
    Course,
    AttendanceSession,
    AttendanceRecord,
)

from .permissions import IsTeacher, IsStudent

from .serializers import (
    ProfileSerializer,
    SubjectSerializer,
    ClassSlotSerializer,
    CourseSerializer,
)

from .utils import attendance_insight


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_profile(user):
    """Get or create a user's profile."""
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={"name": user.username}
    )
    return profile


def parse_day(value):
    """Convert a YYYY-MM-DD string into a date."""
    try:
        return date_cls.fromisoformat(
            value or str(date_cls.today())
        )
    except (TypeError, ValueError):
        return None


# ==========================================
# REGISTRATION
# ==========================================

class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = (
            request.data.get("username") or ""
        ).strip()

        password = request.data.get("password") or ""

        name = (
            request.data.get("name") or ""
        ).strip() or username

        role = request.data.get("role", "student")

        # Validate role
        if role not in ("student", "teacher"):
            return Response(
                {"detail": "Invalid account type."},
                status=400
            )

        # Required fields
        if not username or not password:
            return Response(
                {
                    "detail":
                    "Username and password are required."
                },
                status=400
            )

        # Check teacher signup code
        if role == "teacher":
            configured_code = settings.TEACHER_SIGNUP_CODE

            if not configured_code:
                return Response(
                    {
                        "detail":
                        "Teacher registration is not configured."
                    },
                    status=503
                )

            if (
                request.data.get("teacher_code")
                != configured_code
            ):
                return Response(
                    {
                        "detail":
                        "Incorrect teacher signup code."
                    },
                    status=400
                )

        # Check username availability
        if User.objects.filter(
            username__iexact=username
        ).exists():
            return Response(
                {
                    "detail":
                    "That username is already taken."
                },
                status=400
            )

        # Check password strength
        temporary_user = User(username=username)

        try:
            validate_password(password, temporary_user)
        except ValidationError as error:
            return Response(
                {"detail": " ".join(error.messages)},
                status=400
            )

        # Create account and profile together
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password
            )

            Profile.objects.create(
                user=user,
                name=name,
                role=role
            )

            token, _ = Token.objects.get_or_create(
                user=user
            )

        return Response(
            {
                "token": token.key,
                "name": name,
                "role": role,
                "username": user.username,
            },
            status=status.HTTP_201_CREATED
        )


# ==========================================
# LOGIN
# ==========================================

class LoginView(ObtainAuthToken):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data,
            context={"request": request}
        )

        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        token, _ = Token.objects.get_or_create(
            user=user
        )

        profile = get_profile(user)

        return Response(
            {
                "token": token.key,
                "name": profile.name,
                "role": profile.role,
                "username": user.username,
            }
        )


# ==========================================
# USER PROFILE
# ==========================================

class ProfileView(RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return get_profile(self.request.user)


# ==========================================
# CHANGE PASSWORD
# ==========================================

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get(
            "old_password", ""
        )

        new_password = request.data.get(
            "new_password", ""
        )

        user = request.user

        # Verify existing password
        if not user.check_password(old_password):
            return Response(
                {
                    "detail":
                    "Current password is incorrect."
                },
                status=400
            )

        # Prevent reusing password
        if old_password == new_password:
            return Response(
                {
                    "detail":
                    "Choose a different password."
                },
                status=400
            )

        # Validate new password
        try:
            validate_password(new_password, user)
        except ValidationError as error:
            return Response(
                {"detail": " ".join(error.messages)},
                status=400
            )

        # Save securely
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Existing token remains valid so the
        # current frontend session continues.
        return Response(
            {
                "detail":
                "Password changed successfully."
            }
        )


# ==========================================
# STUDENT SUBJECTS
# ==========================================

class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer

    permission_classes = [
        IsAuthenticated,
        IsStudent,
    ]

    # Students can view or update progress.
    # Creation and deletion are handled by
    # teacher enrollment signals.
    http_method_names = [
        "get",
        "put",
        "patch",
        "head",
        "options",
    ]

    def get_queryset(self):
        return Subject.objects.filter(
            owner=self.request.user
        )


# ==========================================
# STUDENT TIMETABLE
# ==========================================

class ClassSlotViewSet(viewsets.ModelViewSet):
    serializer_class = ClassSlotSerializer

    permission_classes = [
        IsAuthenticated,
        IsStudent,
    ]

    def get_queryset(self):
        return ClassSlot.objects.filter(
            owner=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(
            owner=self.request.user
        )


# ==========================================
# RESET STUDENT PLANNER
# ==========================================

class ResetView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsStudent,
    ]

    def post(self, request):
        profile = get_profile(request.user)

        # Delete student's timetable
        ClassSlot.objects.filter(
            owner=request.user
        ).delete()

        # Reset preferences
        profile.time24 = False
        profile.notify_a = True
        profile.notify_g = True
        profile.notify_c = True

        profile.save()

        return Response(
            {"detail": "Reset done."}
        )


# ==========================================
# TEACHER COURSES AND ENROLLMENT
# ==========================================

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer

    permission_classes = [
        IsAuthenticated,
        IsTeacher,
    ]

    def get_queryset(self):
        return Course.objects.filter(
            teacher=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(
            teacher=self.request.user
        )

    def _student(self, request):
        username = (
            request.data.get("username") or ""
        ).strip()

        return User.objects.filter(
            username__iexact=username,
            profile__role="student"
        ).first()

    # --------------------------------------
    # ENROLL STUDENT
    # --------------------------------------

    @action(detail=True, methods=["post"])
    def enroll(self, request, pk=None):
        course = self.get_object()
        student = self._student(request)

        if not student:
            return Response(
                {
                    "detail":
                    "No student with that username."
                },
                status=404
            )

        # Django signal creates student's Subject
        course.students.add(student)

        return Response(
            {"detail": "Enrolled."}
        )

    # --------------------------------------
    # REMOVE STUDENT
    # --------------------------------------

    @action(detail=True, methods=["post"])
    def unenroll(self, request, pk=None):
        course = self.get_object()
        student = self._student(request)

        if not student:
            return Response(
                {
                    "detail":
                    "No student with that username."
                },
                status=404
            )

        # Signal removes corresponding Subject
        course.students.remove(student)

        return Response(
            {"detail": "Removed."}
        )

    # --------------------------------------
    # MARK / VIEW ATTENDANCE
    # --------------------------------------

    @action(
        detail=True,
        methods=["get", "post"]
    )
    def attendance(self, request, pk=None):
        course = self.get_object()

        # GET: Read attendance for selected date
        if request.method == "GET":
            day = parse_day(
                request.query_params.get("date")
            )

            if not day:
                return Response(
                    {"detail": "Invalid date."},
                    status=400
                )

            session = AttendanceSession.objects.filter(
                course=course,
                date=day
            ).first()

            marked = {}

            if session:
                marked = {
                    record.student_id: record.present
                    for record in session.records.all()
                }

            roster = []

            for student in course.students.all():
                roster.append(
                    {
                        "id": student.id,
                        "username": student.username,
                        "name": get_profile(student).name,
                        "present": marked.get(
                            student.id, True
                        ),
                    }
                )

            return Response(
                {
                    "date": str(day),
                    "marked": session is not None,
                    "students": roster,
                }
            )

        # POST: Save attendance
        day = parse_day(
            request.data.get("date")
        )

        if not day:
            return Response(
                {
                    "detail":
                    "A valid date is required."
                },
                status=400
            )

        if day > date_cls.today():
            return Response(
                {
                    "detail":
                    "Cannot mark attendance for a future date."
                },
                status=400
            )

        records = request.data.get(
            "records", []
        )

        if not isinstance(records, list):
            return Response(
                {
                    "detail":
                    "Attendance records must be a list."
                },
                status=400
            )

        enrolled = set(
            course.students.values_list(
                "id",
                flat=True
            )
        )

        validated = []

        # Validate all records before saving
        for record in records:
            if not isinstance(record, dict):
                return Response(
                    {
                        "detail":
                        "Invalid attendance record."
                    },
                    status=400
                )

            student_id = record.get("student")
            present = record.get("present")

            if (
                type(student_id) is not int
                or type(present) is not bool
            ):
                return Response(
                    {
                        "detail":
                        "Invalid student ID or attendance value."
                    },
                    status=400
                )

            if student_id not in enrolled:
                return Response(
                    {
                        "detail":
                        "Student is not enrolled."
                    },
                    status=400
                )

            validated.append(
                (student_id, present)
            )

        with transaction.atomic():
            session, _ = (
                AttendanceSession.objects.get_or_create(
                    course=course,
                    date=day
                )
            )

            for student_id, present in validated:
                AttendanceRecord.objects.update_or_create(
                    session=session,
                    student_id=student_id,
                    defaults={
                        "present": present
                    }
                )

        return Response(
            {
                "saved": len(validated),
                "date": str(day),
            }
        )

    # --------------------------------------
    # TEACHER ATTENDANCE REPORT
    # --------------------------------------

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        course = self.get_object()

        rows = []

        for student in course.students.all():
            records = AttendanceRecord.objects.filter(
                session__course=course,
                student=student
            )

            total = records.count()

            attended = records.filter(
                present=True
            ).count()

            percentage = (
                round(attended * 100 / total, 1)
                if total
                else 0
            )

            rows.append(
                {
                    "name": get_profile(student).name,
                    "username": student.username,
                    "attended": attended,
                    "total": total,
                    "percentage": percentage,
                }
            )

        return Response(rows)


# ==========================================
# STUDENT ATTENDANCE
# ==========================================

class MyAttendanceView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsStudent,
    ]

    def get(self, request):
        try:
            required = max(
                1,
                min(
                    100,
                    int(
                        request.query_params.get(
                            "required", 75
                        )
                    )
                )
            )
        except (ValueError, TypeError):
            required = 75

        result = []

        courses = (
            request.user.enrolled_courses
            .select_related("teacher")
        )

        for course in courses:
            records = AttendanceRecord.objects.filter(
                session__course=course,
                student=request.user
            )

            total = records.count()

            attended = records.filter(
                present=True
            ).count()

            recent = (
                records
                .select_related("session")
                .order_by("-session__date")[:10]
            )

            result.append(
                {
                    "course_id": course.id,
                    "code": course.code,
                    "name": course.name,
                    "teacher": get_profile(
                        course.teacher
                    ).name,
                    "attended": attended,
                    "total": total,
                    **attendance_insight(
                        attended,
                        total,
                        required
                    ),
                    "recent": [
                        {
                            "date": str(record.session.date),
                            "present": record.present,
                        }
                        for record in recent
                    ],
                }
            )

        return Response(result)
