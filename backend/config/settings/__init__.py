from decouple import config

DJANGO_ENV = config("DJANGO_ENV", default="local")

if DJANGO_ENV == "production":
    from .production import *
else:
    from .local import *
