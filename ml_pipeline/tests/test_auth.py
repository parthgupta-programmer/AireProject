"""
test_auth.py
────────────
Comprehensive test suite for Phase 3: Secure Backend Authentication & Persistent User Data.
Uses an isolated SQLite test database for reproducibility.
"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Create an isolated temporary test database
test_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
test_db_path = test_db_file.name
test_db_file.close()

os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-unit-testing-32-chars"
os.environ["ENVIRONMENT"] = "development"

from ml_pipeline.auth.database import Base, get_db
from ml_pipeline.auth.models import RevokedToken, User, UserPreference
from ml_pipeline.auth.security import create_access_token, hash_password, verify_password
from ml_pipeline.serve import app

test_engine = create_engine(
    f"sqlite:///{test_db_path}",
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


class TestAuthAndUserPersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        if os.path.exists(test_db_path):
            try:
                os.remove(test_db_path)
            except OSError:
                pass

    def setUp(self):
        # Clear tables between tests
        db = TestSessionLocal()
        db.query(RevokedToken).delete()
        db.query(UserPreference).delete()
        db.query(User).delete()
        db.commit()
        db.close()

    # ── 1. Registration Tests ──────────────────────────────────────────────────

    def test_successful_registration(self):
        resp = self.client.post("/auth/signup", json={
            "name": "Aarav Sharma",
            "email": "Aarav.Sharma@Example.COM ",
            "password": "Password123!",
        })
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")
        self.assertEqual(data["user"]["name"], "Aarav Sharma")
        # Email must be normalized
        self.assertEqual(data["user"]["email"], "aarav.sharma@example.com")
        self.assertIn("preferences", data["user"])
        self.assertIsNotNone(data["user"]["preferences"])

        # Check HTTP-only cookie was set
        self.assertIn("aire_access_token", resp.cookies)

        # Check DB state and verify password hash is bcrypt ($2b$)
        db = TestSessionLocal()
        user = db.query(User).filter(User.email == "aarav.sharma@example.com").first()
        self.assertIsNotNone(user)
        self.assertTrue(user.password_hash.startswith("$2b$"))
        self.assertNotEqual(user.password_hash, "Password123!")
        self.assertTrue(verify_password("Password123!", user.password_hash))
        db.close()

    def test_duplicate_registration_rejected(self):
        self.client.post("/auth/signup", json={
            "name": "User One",
            "email": "user@example.com",
            "password": "Password123!",
        })
        resp = self.client.post("/auth/signup", json={
            "name": "User Two",
            "email": "USER@example.com",  # same email, different case
            "password": "DifferentPassword123!",
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("already exists", resp.json()["detail"].lower())

    def test_registration_validation_rules(self):
        # Invalid email
        r1 = self.client.post("/auth/signup", json={"name": "Test", "email": "invalid-email", "password": "Password123!"})
        self.assertEqual(r1.status_code, 422)

        # Short password (< 8 chars)
        r2 = self.client.post("/auth/signup", json={"name": "Test", "email": "valid@example.com", "password": "short"})
        self.assertEqual(r2.status_code, 422)

        # Blank name
        r3 = self.client.post("/auth/signup", json={"name": "   ", "email": "valid@example.com", "password": "Password123!"})
        self.assertEqual(r3.status_code, 422)

    # ── 2. Login Tests ─────────────────────────────────────────────────────────

    def test_successful_login(self):
        self.client.post("/auth/signup", json={
            "name": "Diya Patel",
            "email": "diya@example.com",
            "password": "SecurePassword99",
        })
        resp = self.client.post("/auth/login", json={
            "email": "DIYA@example.com",
            "password": "SecurePassword99",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["email"], "diya@example.com")
        self.assertIn("aire_access_token", resp.cookies)

    def test_login_invalid_password(self):
        self.client.post("/auth/signup", json={
            "name": "Diya Patel",
            "email": "diya@example.com",
            "password": "SecurePassword99",
        })
        resp = self.client.post("/auth/login", json={
            "email": "diya@example.com",
            "password": "WrongPassword!",
        })
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Incorrect email or password", resp.json()["detail"])

    def test_login_nonexistent_user(self):
        resp = self.client.post("/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "SomePassword123",
        })
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Incorrect email or password", resp.json()["detail"])

    # ── 3. Session & Token Verification (/auth/me) ─────────────────────────────

    def test_auth_me_with_bearer_token(self):
        signup = self.client.post("/auth/signup", json={
            "name": "Kabir Verma",
            "email": "kabir@example.com",
            "password": "Password123!",
        }).json()
        token = signup["access_token"]

        # Call /auth/me with Bearer token header
        resp = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["email"], "kabir@example.com")
        self.assertEqual(data["name"], "Kabir Verma")

    def test_auth_me_with_cookie(self):
        signup = self.client.post("/auth/signup", json={
            "name": "Maya Sen",
            "email": "maya@example.com",
            "password": "Password123!",
        })
        cookie = signup.cookies.get("aire_access_token")

        # Call /auth/me with Cookie
        resp = self.client.get("/auth/me", cookies={"aire_access_token": cookie})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["email"], "maya@example.com")

    def test_auth_me_unauthenticated(self):
        resp = self.client.get("/auth/me")
        self.assertEqual(resp.status_code, 401)

    def test_auth_me_expired_token(self):
        # Create an expired token (expired 10 minutes ago)
        expired_token, _, _ = create_access_token(
            user_id="test-id",
            email="test@example.com",
            expires_delta=timedelta(minutes=-10),
        )
        resp = self.client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        self.assertEqual(resp.status_code, 401)
        self.assertIn("expired", resp.json()["detail"].lower())

    # ── 4. Logout and Session Invalidation ─────────────────────────────────────

    def test_logout_revokes_token_and_clears_cookie(self):
        signup = self.client.post("/auth/signup", json={
            "name": "Rohan Das",
            "email": "rohan@example.com",
            "password": "Password123!",
        })
        token = signup.json()["access_token"]

        # User is authenticated
        self.assertEqual(self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code, 200)

        # Logout
        logout_resp = self.client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(logout_resp.status_code, 200)

        # Subsequent request with revoked token must be rejected
        revoked_resp = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(revoked_resp.status_code, 401)
        self.assertIn("terminated", revoked_resp.json()["detail"].lower())

    # ── 5. User Preferences & Data Isolation ───────────────────────────────────

    def test_user_preferences_persistence_and_isolation(self):
        # Create User A
        res_a = self.client.post("/auth/signup", json={
            "name": "User Alpha",
            "email": "alpha@example.com",
            "password": "Password123!",
        }).json()
        token_a = res_a["access_token"]

        # Create User B
        res_b = self.client.post("/auth/signup", json={
            "name": "User Beta",
            "email": "beta@example.com",
            "password": "Password123!",
        }).json()
        token_b = res_b["access_token"]

        # User A updates preferences
        updated_prefs_a = {
            "preferred_location_id": "mumbai",
            "saved_locations": ["mumbai", "pune", "delhi"],
            "health_guidance": {"hasAsthma": True, "elderly": False},
            "alert_thresholds": {"aqi": 250, "pm25": 90, "enabled": True},
            "notification_channels": {"email": True, "push": True},
            "theme": "dark",
        }
        put_a = self.client.put("/user/preferences", json=updated_prefs_a, headers={"Authorization": f"Bearer {token_a}"})
        self.assertEqual(put_a.status_code, 200)

        # Fetch User A preferences
        get_a = self.client.get("/user/preferences", headers={"Authorization": f"Bearer {token_a}"}).json()
        self.assertEqual(get_a["preferred_location_id"], "mumbai")
        self.assertEqual(get_a["saved_locations"], ["mumbai", "pune", "delhi"])
        self.assertTrue(get_a["health_guidance"]["hasAsthma"])
        self.assertEqual(get_a["theme"], "dark")

        # Verify User B sees only their OWN default preferences (ISOLATION)
        get_b = self.client.get("/user/preferences", headers={"Authorization": f"Bearer {token_b}"}).json()
        self.assertEqual(get_b["preferred_location_id"], "ghaziabad")
        self.assertEqual(get_b["saved_locations"], ["ghaziabad", "delhi"])
        self.assertEqual(get_b["health_guidance"], {})
        self.assertEqual(get_b["theme"], "system")

    # ── 6. Password Change ─────────────────────────────────────────────────────

    def test_password_change(self):
        res = self.client.post("/auth/signup", json={
            "name": "Sanya Malhotra",
            "email": "sanya@example.com",
            "password": "OldPassword123!",
        }).json()
        token = res["access_token"]

        # Change password with wrong old password
        bad_change = self.client.put("/user/password", json={
            "current_password": "WrongOldPassword!",
            "new_password": "BrandNewPassword123!",
        }, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(bad_change.status_code, 400)

        # Change password successfully
        good_change = self.client.put("/user/password", json={
            "current_password": "OldPassword123!",
            "new_password": "BrandNewPassword123!",
        }, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(good_change.status_code, 200)

        # Old password no longer works
        old_login = self.client.post("/auth/login", json={"email": "sanya@example.com", "password": "OldPassword123!"})
        self.assertEqual(old_login.status_code, 401)

        # New password works
        new_login = self.client.post("/auth/login", json={"email": "sanya@example.com", "password": "BrandNewPassword123!"})
        self.assertEqual(new_login.status_code, 200)


if __name__ == "__main__":
    unittest.main()
