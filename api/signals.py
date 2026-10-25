"""Keeps each student's Subject list in step with the teacher's enrollments."""
from django.contrib.auth.models import User
from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver

from .models import Course, Subject


def teacher_label(course):
    profile = getattr(course.teacher, 'profile', None)
    return profile.name if profile else course.teacher.username


@receiver(m2m_changed, sender=Course.students.through)
def sync_student_subjects(sender, instance, action, reverse, pk_set, **kwargs):
    """Teacher enrolls a student -> student gets a Subject. Teacher removes them -> it disappears."""
    if action not in ('post_add', 'post_remove') or not pk_set:
        return
    if reverse:      # student.enrolled_courses.add(course)
        pairs = [(instance, c) for c in Course.objects.filter(pk__in=pk_set)]
    else:            # course.students.add(student)
        pairs = [(u, instance) for u in User.objects.filter(pk__in=pk_set)]
    for student, course in pairs:
        if action == 'post_add':
            Subject.objects.get_or_create(owner=student, course=course, defaults={
                'code': course.code, 'name': course.name, 'teacher': teacher_label(course)})
        else:
            Subject.objects.filter(owner=student, course=course).delete()   # its timetable classes go too


@receiver(post_save, sender=Course)
def refresh_student_subjects(sender, instance, created, **kwargs):
    """Teacher renames a course -> every enrolled student's subject is renamed."""
    if not created:
        instance.student_subjects.update(code=instance.code, name=instance.name,
                                         teacher=teacher_label(instance))