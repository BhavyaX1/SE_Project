from rest_framework import serializers
from .models import Profile, Subject, ClassSlot, Course


def to_minutes(t):
    return t.hour * 60 + t.minute


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='student_id', required=False, allow_blank=True)
    role = serializers.CharField(read_only=True)          # nobody can promote themselves

    class Meta:
        model = Profile
        fields = ['name', 'email', 'id', 'program', 'role',
                  'time24', 'notify_a', 'notify_g', 'notify_c']


class SubjectSerializer(serializers.ModelSerializer):
    """Subjects come from the teacher's enrollment; a student may only update their own progress."""
    class Meta:
        model = Subject
        fields = ['id', 'code', 'name', 'teacher', 'credits', 'progress']
        read_only_fields = ['code', 'name', 'teacher', 'credits']


class ClassSlotSerializer(serializers.ModelSerializer):
    subjectId = serializers.PrimaryKeyRelatedField(source='subject', queryset=Subject.objects.all())
    start = serializers.TimeField(format='%H:%M', input_formats=['%H:%M', '%H:%M:%S'])

    class Meta:
        model = ClassSlot
        fields = ['id', 'day', 'start', 'hours', 'subjectId', 'room', 'type']

    def validate_subjectId(self, subject):
        if subject.owner != self.context['request'].user:
            raise serializers.ValidationError('Choose one of your own subjects.')
        return subject

    def validate(self, attrs):
        """Block two classes that overlap on the same day."""
        old = self.instance
        day = attrs.get('day', old.day if old else None)
        start = attrs.get('start', old.start if old else None)
        hours = attrs.get('hours', old.hours if old else None)

        new_start = to_minutes(start)
        new_end = new_start + hours * 60

        others = ClassSlot.objects.filter(
            owner=self.context['request'].user, day=day).select_related('subject')
        if old:
            others = others.exclude(pk=old.pk)

        for other in others:
            other_start = to_minutes(other.start)
            other_end = other_start + other.hours * 60
            if new_start < other_end and other_start < new_end:
                raise serializers.ValidationError(
                    f'Clashes with {other.subject.name} ({other.start.strftime("%H:%M")}) on {day}.')
        return attrs


class CourseSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField(source='students.count', read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'code', 'name', 'student_count']

    def validate_code(self, value):
        same = Course.objects.filter(teacher=self.context['request'].user, code__iexact=value)
        if self.instance:
            same = same.exclude(pk=self.instance.pk)
        if same.exists():
            raise serializers.ValidationError(f'You already have a course with the code {value}.')
        return value