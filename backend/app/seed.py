"""Seed a demo user so the app is usable immediately after setup."""
from .database import SessionLocal, engine, Base
from .models import User
from .security import hash_password

DEMO_EMAIL = "demo@verdict.app"
DEMO_PASSWORD = "demo12345"


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def seed_demo_user() -> None:
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == DEMO_EMAIL).first():
            db.add(
                User(
                    email=DEMO_EMAIL,
                    full_name="Demo User",
                    hashed_password=hash_password(DEMO_PASSWORD),
                    persona="individual",
                    default_jurisdiction="India",
                )
            )
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_demo_user()
    print(f"Database ready. Demo login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
