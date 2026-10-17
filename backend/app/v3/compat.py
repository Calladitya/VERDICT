"""
Adapter between the new v3 code and your existing app.

This is the ONLY v3 file that depends on your old code. If the server fails to
start with an ImportError mentioning this file, open your app/database.py and
app/deps.py and change the names in the CANDIDATES lists below.
"""
import importlib

# (module, [possible names]) -> first one found wins
_DB_MODULES = ["app.database", "app.db"]
_USER_MODULES = ["app.deps", "app.security", "app.routers.auth"]


def _find(modules, names, what):
    for mod in modules:
        try:
            m = importlib.import_module(mod)
        except Exception:
            continue
        for n in names:
            if hasattr(m, n):
                return getattr(m, n)
    raise ImportError(
        f"[v3/compat.py] Could not find {what}. Looked for {names} in {modules}. "
        f"Open your backend/app files and add the right name to compat.py."
    )


Base = _find(_DB_MODULES, ["Base"], "SQLAlchemy Base")
engine = _find(_DB_MODULES, ["engine"], "SQLAlchemy engine")

try:
    get_db = _find(_DB_MODULES, ["get_db", "get_session"], "get_db")
except ImportError:
    SessionLocal = _find(_DB_MODULES, ["SessionLocal"], "SessionLocal")

    def get_db():  # fallback
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()


get_current_user = _find(
    _USER_MODULES,
    ["get_current_user", "current_user", "get_current_active_user", "require_user"],
    "the logged-in-user dependency (get_current_user)",
)


def user_id(user) -> str:
    """Return the logged-in user's id as a string (works for int/uuid/dict)."""
    if isinstance(user, dict):
        return str(user.get("id") or user.get("sub") or user.get("user_id"))
    for attr in ("id", "user_id", "pk"):
        if hasattr(user, attr):
            return str(getattr(user, attr))
    raise RuntimeError("[v3/compat.py] Cannot read user id from current user object")
