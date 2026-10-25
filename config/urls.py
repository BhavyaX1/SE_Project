from django.conf import settings
from django.contrib import admin
from django.urls import path, re_path, include
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),          # /admin/        -> Django admin
    path('api/', include('api.urls')),        # /api/...       -> the data (JSON)

    # /  -> your dashboard page
    path('', serve, {'path': 'index.html', 'document_root': settings.FRONTEND_DIR}),

    # /login.html, /courses.html, /app.js, /style.css ...  -> files from the frontend folder
    re_path(r'^(?P<path>.+\.(?:html|css|js))$', serve, {'document_root': settings.FRONTEND_DIR}),
]