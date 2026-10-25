from datetime import date

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from .models import Profile, Subject, ClassSlot
from .utils import attendance_insight


def make(username, role):
    u = User.objects.create_user(username, password='secret12')
    Profile.objects.create(user=u, name=username.title(), role=role)
    return u


class InsightTests(APITestCase):
    def test_numbers(self):
        self.assertEqual(attendance_insight(35, 40, 75)['skippable'], 6)
        self.assertEqual(attendance_insight(20, 40, 75)['needed'], 40)


class FlowTests(APITestCase):
    def setUp(self):
        self.t, self.s = make('teach', 'teacher'), make('stud', 'student')
        self.teacher, self.student = APIClient(), APIClient()
        self.teacher.force_authenticate(self.t)
        self.student.force_authenticate(self.s)

    def course(self, code='CS101'):
        r = self.teacher.post('/api/courses/', {'code': code, 'name': 'Data Structures'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()['id']

    def enroll(self, cid, who='stud'):
        return self.teacher.post(f'/api/courses/{cid}/enroll/', {'username': who}, format='json')

    def test_everyone_starts_empty(self):
        self.assertEqual(self.teacher.get('/api/courses/').json(), [])
        self.assertEqual(self.student.get('/api/subjects/').json(), [])
        self.assertEqual(self.student.get('/api/classes/').json(), [])
        self.assertEqual(self.student.get('/api/my-attendance/').json(), [])

    def test_enroll_gives_subject_and_remove_takes_it_back(self):
        cid = self.course()
        self.assertEqual(self.student.get('/api/subjects/').json(), [])      # not enrolled yet
        self.assertEqual(self.enroll(cid).status_code, 200)
        subs = self.student.get('/api/subjects/').json()
        self.assertEqual((subs[0]['code'], subs[0]['teacher']), ('CS101', 'Teach'))
        self.teacher.post(f'/api/courses/{cid}/unenroll/', {'username': 'stud'}, format='json')
        self.assertEqual(self.student.get('/api/subjects/').json(), [])

    def test_rename_course_updates_student_subject(self):
        cid = self.course(); self.enroll(cid)
        self.teacher.put(f'/api/courses/{cid}/', {'code': 'CS999', 'name': 'Algorithms'}, format='json')
        self.assertEqual(self.student.get('/api/subjects/').json()[0]['name'], 'Algorithms')

    def test_student_cannot_create_or_delete_subjects_or_courses(self):
        cid = self.course(); self.enroll(cid)
        sid = self.student.get('/api/subjects/').json()[0]['id']
        self.assertEqual(self.student.post('/api/subjects/', {'code': 'X', 'name': 'Y'}, format='json').status_code, 405)
        self.assertEqual(self.student.delete(f'/api/subjects/{sid}/').status_code, 405)
        self.assertEqual(self.student.get('/api/courses/').status_code, 403)
        r = self.student.patch(f'/api/subjects/{sid}/', {'progress': 40, 'name': 'Hacked'}, format='json')
        self.assertEqual((r.json()['progress'], r.json()['name']), (40, 'Data Structures'))

    def test_student_builds_schedule_from_enrolled_subject(self):
        cid = self.course(); self.enroll(cid)
        sid = self.student.get('/api/subjects/').json()[0]['id']
        body = {'day': 'Monday', 'start': '09:00', 'hours': 1, 'subjectId': sid, 'type': 'Lecture'}
        self.assertEqual(self.student.post('/api/classes/', body, format='json').status_code, 201)
        clash = self.student.post('/api/classes/', {**body, 'start': '09:30'}, format='json')
        self.assertEqual(clash.status_code, 400)

    def test_deleting_course_removes_subject_and_classes(self):
        cid = self.course(); self.enroll(cid)
        sid = self.student.get('/api/subjects/').json()[0]['id']
        self.student.post('/api/classes/', {'day': 'Monday', 'start': '09:00', 'hours': 1, 'subjectId': sid}, format='json')
        self.teacher.delete(f'/api/courses/{cid}/')
        self.assertEqual((Subject.objects.count(), ClassSlot.objects.count()), (0, 0))

    def test_attendance_marking_and_live_view(self):
        cid = self.course(); self.enroll(cid)
        day = str(date.today())
        r = self.teacher.post(f'/api/courses/{cid}/attendance/',
                              {'date': day, 'records': [{'student': self.s.id, 'present': False}]}, format='json')
        self.assertEqual(r.status_code, 200)
        d = self.student.get('/api/my-attendance/').json()[0]
        self.assertEqual((d['attended'], d['total'], d['recent'][0]['present']), (0, 1, False))
        self.teacher.post(f'/api/courses/{cid}/attendance/',
                          {'date': day, 'records': [{'student': self.s.id, 'present': True}]}, format='json')
        self.assertEqual(self.student.get('/api/my-attendance/').json()[0]['attended'], 1)
        report = self.teacher.get(f'/api/courses/{cid}/report/').json()
        self.assertEqual(report[0]['percentage'], 100.0)

    def test_attendance_rules(self):
        cid = self.course(); self.enroll(cid)
        bad = self.teacher.post(f'/api/courses/{cid}/attendance/', {'date': '2999-01-01', 'records': []}, format='json')
        self.assertEqual(bad.status_code, 400)
        other = make('teach2', 'teacher'); c2 = APIClient(); c2.force_authenticate(other)
        self.assertEqual(c2.get(f'/api/courses/{cid}/attendance/').status_code, 404)    # not their course
        self.assertEqual(self.student.post(f'/api/courses/{cid}/attendance/', {}, format='json').status_code, 403)

    def test_unknown_student_username(self):
        cid = self.course()
        self.assertEqual(self.enroll(cid, 'nobody').status_code, 404)
        self.assertEqual(self.enroll(cid, 'teach').status_code, 404)        # a teacher is not a student

    def test_reset_clears_timetable_but_keeps_subjects(self):
        cid = self.course(); self.enroll(cid)
        sid = self.student.get('/api/subjects/').json()[0]['id']
        self.student.post('/api/classes/', {'day': 'Monday', 'start': '09:00', 'hours': 1, 'subjectId': sid}, format='json')
        self.assertEqual(self.student.post('/api/reset/').status_code, 200)
        self.assertEqual((ClassSlot.objects.count(), Subject.objects.count()), (0, 1))


@override_settings(TEACHER_SIGNUP_CODE='letmein')
class RegisterTests(APITestCase):
    def test_register_and_login_roles(self):
        c = APIClient()
        r = c.post('/api/register/', {'username': 'a1', 'password': 'secret12', 'name': 'A'}, format='json')
        self.assertEqual((r.status_code, r.json()['role']), (201, 'student'))
        self.assertEqual(c.get('/api/subjects/').status_code, 401)
        bad = c.post('/api/register/', {'username': 't1', 'password': 'secret12', 'role': 'teacher', 'teacher_code': 'no'}, format='json')
        self.assertEqual(bad.status_code, 400)
        good = c.post('/api/register/', {'username': 't1', 'password': 'secret12', 'role': 'teacher', 'teacher_code': 'letmein'}, format='json')
        self.assertEqual(good.json()['role'], 'teacher')
        login = c.post('/api/login/', {'username': 't1', 'password': 'secret12'}, format='json')
        self.assertEqual(login.json()['role'], 'teacher')
        self.assertEqual(Subject.objects.count(), 0)          # nobody gets sample subjects