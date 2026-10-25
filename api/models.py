from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
CLASS_TYPES = ['Lecture', 'Lab', 'Tutorial']


class Profile(models.Model):
    """Extra info for one user: role (student/teacher), details and preferences."""
    ROLES = [('student', 'Student'), ('teacher', 'Teacher')]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLES, default='student')
    name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    student_id = models.CharField(max_length=30, blank=True)
    program = models.CharField(max_length=100, blank=True)
    # preferences
    time24 = models.BooleanField(default=False)
    notify_a = models.BooleanField(default=True)
    notify_g = models.BooleanField(default=True)
    notify_c = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Course(models.Model):
    """Created by a TEACHER. Students are enrolled by the teacher. Attendance is marked per course."""
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses_taught')
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    students = models.ManyToManyField(User, related_name='enrolled_courses', blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Subject(models.Model):
    """A student's own copy of a course. Created AUTOMATICALLY when a teacher enrolls the student
    (see signals.py), so students can never invent subjects. Classes in the timetable point at this."""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='subjects')
    course = models.ForeignKey(Course, null=True, blank=True, on_delete=models.CASCADE,
                               related_name='student_subjects')
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    teacher = models.CharField(max_length=100, blank=True)
    credits = models.PositiveSmallIntegerField(
        default=4, validators=[MinValueValidator(1), MaxValueValidator(10)])
    progress = models.PositiveSmallIntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])

    class Meta:
        ordering = ['id']
        unique_together = ('owner', 'course')

    def __str__(self):
        return f"{self.code} - {self.name}"


class ClassSlot(models.Model):
    """One class in a student's weekly timetable (the student builds this)."""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='class_slots')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='classes')
    day = models.CharField(max_length=10, choices=[(d, d) for d in DAYS])
    start = models.TimeField()
    hours = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(6)])
    room = models.CharField(max_length=50, blank=True)
    type = models.CharField(max_length=10, choices=[(t, t) for t in CLASS_TYPES], default='Lecture')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.subject.code} {self.day} {self.start}"


class AttendanceSession(models.Model):
    """One class day for one course."""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sessions')
    date = models.DateField()

    class Meta:
        unique_together = ('course', 'date')
        ordering = ['-date']


class AttendanceRecord(models.Model):
    """Was this student present in this session?"""
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    present = models.BooleanField(default=True)

    class Meta:
        unique_together = ('session', 'student')