# Generated migration to add enterprise plan choice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_rename_users_email_7dfe72_idx_users_email_4b85f2_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='subscription',
            name='plan',
            field=models.CharField(
                choices=[
                    ('free', 'Free'),
                    ('pro', 'Pro'),
                    ('business', 'Business'),
                    ('enterprise', 'Enterprise'),
                ],
                db_index=True,
                default='free',
                max_length=20,
            ),
        ),
    ]
