"""Limiter compartido para proteger el backend de fuerza bruta / DoS por
volumen de requests. Vive en su propio módulo (en vez de definirse en
main.py) para que los routers puedan importarlo y aplicar límites más
estrictos a endpoints puntuales sin crear un import circular con main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
