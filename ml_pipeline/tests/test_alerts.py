"""
test_alerts.py
──────────────
Unit and integration tests for Phase 5:
- AlertRule CRUD and ownership validation
- AlertEvent in-app notification center
- Alert evaluation engine with threshold crossing, recovery, and idempotency deduplication
"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Create isolated test database
test_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
test_db_path = test_db_file.name
test_db_file.close()

os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-alerts-testing-32-chars"
os.environ["ENVIRONMENT"] = "development"

from ml_pipeline.auth.database import Base, get_db
from ml_pipeline.auth.models import AlertEvent, AlertRule, User
from ml_pipeline.auth.security import create_access_token, hash_password
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


class TestAlertsAndNotifications(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

        # Seed two distinct users to verify user isolation
        cls.user1_id = "u1-uuid-1111-2222-333344445555"
        cls.user1_email = "user1_alerts@example.com"
        cls.user2_id = "u2-uuid-2222-3333-444455556666"
        cls.user2_email = "user2_alerts@example.com"

        db = TestSessionLocal()
        user1 = User(
            id=cls.user1_id,
            email=cls.user1_email,
            name="User One",
            password_hash=hash_password("Password123!"),
        )
        user2 = User(
            id=cls.user2_id,
            email=cls.user2_email,
            name="User Two",
            password_hash=hash_password("Password123!"),
        )
        db.add_all([user1, user2])
        db.commit()
        db.close()

        cls.token1, _, _ = create_access_token(cls.user1_id, cls.user1_email)
        cls.token2, _, _ = create_access_token(cls.user2_id, cls.user2_email)
        cls.headers1 = {"Authorization": f"Bearer {cls.token1}"}
        cls.headers2 = {"Authorization": f"Bearer {cls.token2}"}

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=test_engine)
        try:
            if os.path.exists(test_db_path):
                os.remove(test_db_path)
        except Exception:
            pass

    def setUp(self):
        app.dependency_overrides[get_db] = override_get_db

    def test_01_create_alert_rule(self):
        """User can create an alert rule with valid threshold and condition."""
        payload = {
            "location_id": "delhi",
            "location_name": "Delhi",
            "condition_type": "above_threshold",
            "threshold_value": 200,
            "severity_category": "poor",
            "enabled": True,
            "channel_in_app": True,
            "channel_browser": True,
        }
        res = self.client.post("/alerts/rules", json=payload, headers=self.headers1)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["location_id"], "delhi")
        self.assertEqual(data["threshold_value"], 200)
        self.assertTrue(data["enabled"])
        self.rule1_id = data["id"]

    def test_02_threshold_validation(self):
        """Reject invalid threshold values outside CPCB NAQI 0-500 bounds."""
        payload = {
            "location_id": "delhi",
            "location_name": "Delhi",
            "condition_type": "above_threshold",
            "threshold_value": 600,  # Invalid: > 500
        }
        res = self.client.post("/alerts/rules", json=payload, headers=self.headers1)
        self.assertEqual(res.status_code, 422)

    def test_03_user_isolation_for_rules(self):
        """User 2 cannot see or modify User 1's alert rules."""
        # User 1 creates a rule
        p1 = {
            "location_id": "ghaziabad",
            "location_name": "Ghaziabad",
            "condition_type": "above_threshold",
            "threshold_value": 250,
        }
        r1 = self.client.post("/alerts/rules", json=p1, headers=self.headers1).json()

        # User 2 list rules: should NOT include User 1's rule
        r2_list = self.client.get("/alerts/rules", headers=self.headers2).json()
        self.assertFalse(any(r["id"] == r1["id"] for r in r2_list))

        # User 2 tries to update or delete User 1's rule: should be 404
        up_res = self.client.put(
            f"/alerts/rules/{r1['id']}",
            json={"threshold_value": 300},
            headers=self.headers2,
        )
        self.assertEqual(up_res.status_code, 404)

        del_res = self.client.delete(f"/alerts/rules/{r1['id']}", headers=self.headers2)
        self.assertEqual(del_res.status_code, 404)

    def test_04_alert_evaluation_and_idempotency(self):
        """
        Evaluate real AQI against enabled rules.
        Verifies:
        1. Crossing triggers an AlertEvent
        2. Repeated evaluation of identical timestamp does NOT duplicate the event (idempotency)
        """
        # Create rule for user 2: AQI above 150
        p = {
            "location_id": "noida",
            "location_name": "Noida",
            "condition_type": "above_threshold",
            "threshold_value": 150,
            "enabled": True,
        }
        rule = self.client.post("/alerts/rules", json=p, headers=self.headers2).json()

        obs_time = datetime(2026, 10, 23, 14, 0, 0, tzinfo=timezone.utc).isoformat()
        eval_payload = {
            "location_id": "noida",
            "location_name": "Noida",
            "current_aqi": 185,
            "category": "poor",
            "observation_timestamp": obs_time,
        }

        # First evaluation: crosses 150 threshold -> triggers event
        res1 = self.client.post("/alerts/evaluate", json=eval_payload, headers=self.headers2)
        self.assertEqual(res1.status_code, 200)
        events1 = res1.json()
        self.assertEqual(len(events1), 1)
        self.assertEqual(events1[0]["aqi"], 185)
        self.assertIn("exceeding your alert threshold of 150", events1[0]["message"])

        # Second evaluation with SAME observation_timestamp: idempotency must prevent duplicate!
        res2 = self.client.post("/alerts/evaluate", json=eval_payload, headers=self.headers2)
        self.assertEqual(res2.status_code, 200)
        events2 = res2.json()
        self.assertEqual(len(events2), 0)  # No duplicate event created!

        # Check in-app notification events list
        ev_list = self.client.get("/alerts/events", headers=self.headers2).json()
        self.assertEqual(len(ev_list), 1)
        self.assertEqual(ev_list[0]["id"], events1[0]["id"])
        self.assertFalse(ev_list[0]["is_read"])

    def test_05_mark_read_and_dismiss_notifications(self):
        """User can mark events read and dismiss them from history."""
        ev_list = self.client.get("/alerts/events", headers=self.headers2).json()
        self.assertTrue(len(ev_list) >= 1)
        event_id = ev_list[0]["id"]

        # Mark single event read
        patch_res = self.client.patch(f"/alerts/events/{event_id}/read", headers=self.headers2)
        self.assertEqual(patch_res.status_code, 200)
        self.assertTrue(patch_res.json()["is_read"])

        # Mark all read
        all_res = self.client.patch("/alerts/events/read-all", headers=self.headers2)
        self.assertEqual(all_res.status_code, 200)

        # Dismiss event
        del_res = self.client.delete(f"/alerts/events/{event_id}", headers=self.headers2)
        self.assertEqual(del_res.status_code, 204)

        # Confirm dismissed event is excluded from active events list
        after_list = self.client.get("/alerts/events", headers=self.headers2).json()
        self.assertFalse(any(e["id"] == event_id for e in after_list))

    def test_06_recovery_improvement_alert(self):
        """Alert triggers when air quality recovers below threshold."""
        # Create improvement rule: AQI improves below 100
        p = {
            "location_id": "mumbai",
            "location_name": "Mumbai",
            "condition_type": "below_threshold_improvement",
            "threshold_value": 100,
            "enabled": True,
        }
        rule = self.client.post("/alerts/rules", json=p, headers=self.headers1).json()

        # First observation: AQI is high (140) -> establishes last_seen_aqi >= 100
        t1 = datetime(2026, 10, 23, 10, 0, 0, tzinfo=timezone.utc).isoformat()
        res1 = self.client.post(
            "/alerts/evaluate",
            json={
                "location_id": "mumbai",
                "location_name": "Mumbai",
                "current_aqi": 140,
                "category": "poor",
                "observation_timestamp": t1,
            },
            headers=self.headers1,
        )
        self.assertEqual(len(res1.json()), 0)  # Not an improvement yet

        # Second observation: AQI drops to 75 (Satisfactory / Good) -> triggers improvement alert!
        t2 = datetime(2026, 10, 23, 11, 0, 0, tzinfo=timezone.utc).isoformat()
        res2 = self.client.post(
            "/alerts/evaluate",
            json={
                "location_id": "mumbai",
                "location_name": "Mumbai",
                "current_aqi": 75,
                "category": "moderate",
                "observation_timestamp": t2,
            },
            headers=self.headers1,
        )
        events = res2.json()
        self.assertEqual(len(events), 1)
        self.assertIn("improved to AQI 75", events[0]["message"])


if __name__ == "__main__":
    unittest.main()
