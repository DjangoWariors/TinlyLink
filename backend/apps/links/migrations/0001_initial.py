# Generated migration for links app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('campaigns', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomDomain',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('domain', models.CharField(db_index=True, max_length=255, unique=True)),
                ('is_verified', models.BooleanField(default=False)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('dns_txt_record', models.CharField(blank=True, max_length=100)),
                ('ssl_status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='custom_domains', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'custom_domains',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Link',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('short_code', models.CharField(db_index=True, max_length=50)),
                ('original_url', models.URLField(max_length=2048)),
                ('title', models.CharField(blank=True, max_length=255)),
                ('utm_source', models.CharField(blank=True, max_length=100)),
                ('utm_medium', models.CharField(blank=True, max_length=100)),
                ('utm_campaign', models.CharField(blank=True, max_length=100)),
                ('utm_term', models.CharField(blank=True, max_length=100)),
                ('utm_content', models.CharField(blank=True, max_length=100)),
                ('password_hash', models.CharField(blank=True, max_length=255)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('total_clicks', models.BigIntegerField(default=0)),
                ('unique_clicks', models.BigIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('campaign', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='links', to='campaigns.campaign')),
                ('domain', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='links', to='links.customdomain')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='links', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'links',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='link',
            constraint=models.UniqueConstraint(fields=('domain', 'short_code'), name='unique_domain_short_code'),
        ),
        migrations.AddIndex(
            model_name='link',
            index=models.Index(fields=['short_code'], name='links_short_c_5baf86_idx'),
        ),
        migrations.AddIndex(
            model_name='link',
            index=models.Index(fields=['user', '-created_at'], name='links_user_id_e91af3_idx'),
        ),
        migrations.AddIndex(
            model_name='link',
            index=models.Index(fields=['is_active', 'domain', 'short_code'], name='links_is_acti_5a94c1_idx'),
        ),
    ]
