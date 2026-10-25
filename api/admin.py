from django.contrib import admin
from .models import (Profile, Subject, ClassSlot,
                     Course, AttendanceSession, AttendanceRecord)

for m in (Profile, Subject, ClassSlot, Course, AttendanceSession, AttendanceRecord):
    admin.site.register(m)