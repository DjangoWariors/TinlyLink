# Generated migration for analytics app

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('links', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ClickEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('ip_hash', models.CharField(blank=True, db_index=True, max_length=64)),
                ('user_agent', models.TextField(blank=True)),
                ('referer', models.URLField(blank=True, max_length=2048)),
                ('country_code', models.CharField(blank=True, db_index=True, max_length=2)),
                ('country_name', models.CharField(blank=True, max_length=100)),
                ('region', models.CharField(blank=True, max_length=100)),
                ('city', models.CharField(blank=True, max_length=100)),
                ('latitude', models.FloatField(blank=True, null=True)),
                ('longitude', models.FloatField(blank=True, null=True)),
                ('device_type', models.CharField(blank=True, db_index=True, max_length=20)),
                ('browser', models.CharField(blank=True, db_index=True, max_length=50)),
                ('browser_version', models.CharField(blank=True, max_length=20)),
                ('os', models.CharField(blank=True, db_index=True, max_length=50)),
                ('os_version', models.CharField(blank=True, max_length=20)),
                ('is_bot', models.BooleanField(default=False)),
                ('is_unique', models.BooleanField(default=True, db_index=True)),
                ('clicked_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='click_events', to='links.link')),
            ],
            options={
                'db_table': 'click_events',
                'ordering': ['-clicked_at'],
            },
        ),
        migrations.CreateModel(
            name='DailyStats',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date', models.DateField(db_index=True)),
                ('total_clicks', models.BigIntegerField(default=0)),
                ('unique_clicks', models.BigIntegerField(default=0)),
                ('countries', models.JSONField(default=dict)),
                ('devices', models.JSONField(default=dict)),
                ('browsers', models.JSONField(default=dict)),
                ('referrers', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_stats', to='links.link')),
            ],
            options={
                'db_table': 'daily_stats',
                'ordering': ['-date'],
                'unique_together': {('link', 'date')},
            },
        ),
        migrations.AddIndex(
            model_name='clickevent',
            index=models.Index(fields=['link', '-clicked_at'], name='click_event_link_id_dd3412_idx'),
        ),
        migrations.AddIndex(
            model_name='clickevent',
            index=models.Index(fields=['clicked_at'], name='click_event_clicked_81f3c1_idx'),
        ),
    ]
