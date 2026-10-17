"""
VERDICT 3.0 add-on package.

Everything new lives inside app/v3/ so your existing code is untouched.
Only app/main.py needs 3 extra lines (see STEPS.md).
"""
import logging

log = logging.getLogger("verdict.v3")


def init_v3() -> None:
    """Create the new v3_* tables (existing tables are never modified)."""
    from .compat import Base, engine
    from . import models  # noqa: F401  (registers the tables)

    Base.metadata.create_all(bind=engine)
    log.info("VERDICT v3 tables ready")


def get_routers():
    from .routes_everyday import router as everyday
    from .routes_cases import router as cases, public_router as shared

    return [everyday, cases, shared]
