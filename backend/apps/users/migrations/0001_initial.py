# Generated migration for users app

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(db_index=True, max_length=255, unique=True)),
                ('full_name', models.CharField(blank=True, max_length=100)),
                ('company', models.CharField(blank=True, max_length=100)),
                ('avatar_url', models.URLField(blank=True, max_length=500)),
                ('email_verified', models.BooleanField(default=False)),
                ('email_verified_at', models.DateTimeField(blank=True, null=True)),
                ('email_verification_token', models.CharField(blank=True, max_length=100)),
                ('email_verification_sent_at', models.DateTimeField(blank=True, null=True)),
                ('password_reset_token', models.CharField(blank=True, max_length=100)),
                ('password_reset_sent_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('last_login', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deletion_scheduled_at', models.DateTimeField(blank=True, null=True)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'db_table': 'users',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Subscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('plan', models.CharField(choices=[('free', 'Free'), ('pro', 'Pro'), ('business', 'Business')], db_index=True, default='free', max_length=20)),
                ('status', models.CharField(choices=[('active', 'Active'), ('canceled', 'Canceled'), ('past_due', 'Past Due'), ('trialing', 'Trialing')], default='active', max_length=20)),
                ('stripe_customer_id', models.CharField(blank=True, db_index=True, max_length=100)),
                ('stripe_subscription_id', models.CharField(blank=True, db_index=True, max_length=100)),
                ('current_period_start', models.DateTimeField(blank=True, null=True)),
                ('current_period_end', models.DateTimeField(blank=True, null=True)),
                ('cancel_at_period_end', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'subscriptions',
            },
        ),
        migrations.CreateModel(
            name='APIKey',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('key_prefix', models.CharField(db_index=True, max_length=12)),
                ('key_hash', models.CharField(max_length=64)),
                ('scopes', models.JSONField(default=list)),
                ('rate_limit_per_minute', models.IntegerField(default=60)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('total_requests', models.BigIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='api_keys', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_keys',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='UsageTracking',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('period_start', models.DateField(db_index=True)),
                ('period_end', models.DateField()),
                ('links_created', models.IntegerField(default=0)),
                ('qr_codes_created', models.IntegerField(default=0)),
                ('api_calls', models.IntegerField(default=0)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usage_records', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'usage_tracking',
                'ordering': ['-period_start'],
                'unique_together': {('user', 'period_start')},
            },
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['email'], name='users_email_7dfe72_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['created_at'], name='users_created_bca51c_idx'),
        ),
    ]
