
import unittest
from datetime import datetime, timedelta
from pydantic import ValidationError
from db.models import (
    ContactBase, SessionBase, TaskBase, 
    ContactStatus, SessionType, TaskStatus,
    CompanyBase
)

class TestModelsSOTA(unittest.TestCase):

    def test_literal_validation(self):
        print("\n[TEST] Literal Validation...")
        # Valid Contact Status
        c = ContactBase(name="Valid", status="active")
        self.assertEqual(c.status, "active")

        # Invalid Contact Status
        with self.assertRaises(ValidationError) as cm:
            ContactBase(name="Invalid", status="invalid_status")
        print(f"Caught expected error: {cm.exception.errors()[0]['msg']}")
        
        # Valid Session Type
        s = SessionBase(thread_id="t1", type="prep_meeting")
        self.assertEqual(s.type, "prep_meeting")

        # Invalid Session Type
        with self.assertRaises(ValidationError):
            SessionBase(thread_id="t1", type="random_chat") # Not in Enum

        print("[PASS] Literals enforced.")

    def test_computed_fields(self):
        print("\n[TEST] Computed Fields...")
        start = datetime.now()
        end = start + timedelta(seconds=120)
        
        # Session with duration
        s = SessionBase(
            thread_id="t1", 
            type="main_meeting", 
            started_at=start, 
            ended_at=end
        )
        
        # Check computed field
        # Computed fields are included in model_dump() usually, or accessed attribute?
        # Pydantic v2 consumes computed_field as property?
        self.assertEqual(s.duration_seconds, 120.0)
        
        # Session without duration
        s_open = SessionBase(thread_id="t2", type="focus_block", started_at=start)
        self.assertIsNone(s_open.duration_seconds)
        
        print("[PASS] Computed fields working.")

    def test_config_dict(self):
        print("\n[TEST] ConfigDict (Whitespace Strip)...")
        # should strip whitespace
        c = CompanyBase(name="  Google  ") 
        self.assertEqual(c.name, "Google") # standard logic might not strip unless sanitizer does it?
        # ConfigDict(str_strip_whitespace=True)
        
        t = TaskBase(description="  Fix Bug  ")
        self.assertEqual(t.description, "Fix Bug")
        
        print("[PASS] ConfigDict applied.")

    def test_biometric_fields(self):
        print("\n[TEST] Biometric Fields...")
        c = ContactBase(name="Bio Test")
        # Defaults
        self.assertFalse(c.has_voice_profile)
        self.assertEqual(c.voice_profile_version, 0)
        
        # Set values
        c2 = ContactBase(name="Bio 2", has_voice_profile=True, voice_profile_version=5)
        self.assertTrue(c2.has_voice_profile)
        self.assertEqual(c2.voice_profile_version, 5)
        
        print("[PASS] Biometrics supported.")

if __name__ == "__main__":
    unittest.main()
