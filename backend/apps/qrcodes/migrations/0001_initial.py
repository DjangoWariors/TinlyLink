# Generated migration for qrcodes app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('links', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='QRCode',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('foreground_color', models.CharField(default='#000000', max_length=7)),
                ('background_color', models.CharField(default='#FFFFFF', max_length=7)),
                ('size', models.IntegerField(default=256)),
                ('error_correction', models.CharField(choices=[('L', 'Low'), ('M', 'Medium'), ('Q', 'Quartile'), ('H', 'High')], default='M', max_length=1)),
                ('include_margin', models.BooleanField(default=True)),
                ('logo_url', models.URLField(blank=True, max_length=500)),
                ('image_file', models.CharField(blank=True, max_length=500)),
                ('total_scans', models.BigIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='qr_codes', to='links.link')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='qr_codes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'qr_codes',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='qrcode',
            index=models.Index(fields=['user', '-created_at'], name='qr_codes_user_id_5b7a2c_idx'),
        ),
    ]
