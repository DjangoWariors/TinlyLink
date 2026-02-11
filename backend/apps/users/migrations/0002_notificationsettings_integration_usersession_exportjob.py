# Generated migration for new account features

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='NotificationSettings',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('weekly_report', models.BooleanField(default=True)),
                ('usage_warning', models.BooleanField(default=True)),
                ('link_alerts', models.BooleanField(default=True)),
                ('security_alerts', models.BooleanField(default=True)),
                ('marketing', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='notification_settings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'notification_settings',
            },
        ),
        migrations.CreateModel(
            name='Integration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('provider', models.CharField(choices=[('zapier', 'Zapier'), ('slack', 'Slack'), ('google_analytics', 'Google Analytics'), ('webhook', 'Webhook')], max_length=50)),
                ('status', models.CharField(choices=[('connected', 'Connected'), ('disconnected', 'Disconnected'), ('error', 'Error')], default='disconnected', max_length=20)),
                ('access_token', models.TextField(blank=True)),
                ('refresh_token', models.TextField(blank=True)),
                ('webhook_url', models.URLField(blank=True, max_length=500)),
                ('settings', models.JSONField(default=dict)),
                ('connected_at', models.DateTimeField(blank=True, null=True)),
                ('last_sync_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='integrations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'integrations',
                'unique_together': {('user', 'provider')},
            },
        ),
        migrations.CreateModel(
            name='UserSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('session_key', models.CharField(max_length=100, unique=True)),
                ('device_type', models.CharField(blank=True, max_length=50)),
                ('browser', models.CharField(blank=True, max_length=100)),
                ('os', models.CharField(blank=True, max_length=100)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('location', models.CharField(blank=True, max_length=100)),
                ('is_current', models.BooleanField(default=False)),
                ('last_active', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_sessions',
                'ordering': ['-last_active'],
            },
        ),
        migrations.CreateModel(
            name='ExportJob',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('export_type', models.CharField(choices=[('links', 'Links'), ('analytics', 'Analytics'), ('all', 'All Data')], max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('file_url', models.URLField(blank=True, max_length=500)),
                ('file_size', models.BigIntegerField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='export_jobs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'export_jobs',
                'ordering': ['-created_at'],
            },
        ),
    ]
