# Generated migration for campaigns app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Campaign',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('utm_source', models.CharField(blank=True, max_length=100)),
                ('utm_medium', models.CharField(blank=True, max_length=100)),
                ('utm_campaign', models.CharField(blank=True, max_length=100)),
                ('utm_term', models.CharField(blank=True, max_length=100)),
                ('utm_content', models.CharField(blank=True, max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('starts_at', models.DateTimeField(blank=True, null=True)),
                ('ends_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='campaigns', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'campaigns',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='campaign',
            index=models.Index(fields=['user', '-created_at'], name='campaigns_user_id_f18c21_idx'),
        ),
    ]
