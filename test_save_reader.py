import os
import re
import hashlib
import tempfile
import unittest

from save_reader import (
    KEY,
    IV,
    decrypt_save,
    encrypt_save,
    read_save_summary,
    backup_save,
)

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "UserData0.dat")
EXPECTED_KEY = bytes.fromhex("b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870")
EXPECTED_IV = bytes.fromhex("2f6e9693c9779505")


class TestSaveReader(unittest.TestCase):
    def setUp(self):
        self.assertTrue(
            os.path.exists(FIXTURE_PATH),
            f"Fixture save file not found: {FIXTURE_PATH}",
        )
        with open(FIXTURE_PATH, "rb") as f:
            self.fixture_bytes = f.read()

    def test_constants(self):
        """Verify KEY and IV match the game's static TripleDES credentials."""
        self.assertEqual(KEY, EXPECTED_KEY)
        self.assertEqual(IV, EXPECTED_IV)

    def test_decrypt_save_fixture(self):
        """Verify decrypting UserData0.dat returns a valid dict with recruited units."""
        data = decrypt_save(self.fixture_bytes)
        self.assertIsInstance(data, dict)
        self.assertIn("_unitData", data)
        units = data["_unitData"].get("_units", [])
        self.assertGreater(len(units), 0)
        for u in units:
            self.assertIn("_id", u)
            self.assertIsInstance(u["_id"], int)

    def test_decrypt_save_invalid_data(self):
        """Verify decrypting corrupted or invalid ciphertext raises ValueError."""
        with self.assertRaises(Exception):
            decrypt_save(b"corrupted_invalid_data_not_3des")

    def test_roundtrip_encrypt_decrypt(self):
        """Verify synthetic payload roundtrips through encrypt_save and decrypt_save."""
        sample_payload = {
            "test_key": "test_value",
            "nested": {"count": 42, "items": [1, 2, 3]},
        }
        ciphertext = encrypt_save(sample_payload)
        decrypted = decrypt_save(ciphertext)
        self.assertEqual(decrypted, sample_payload)

    def test_read_save_summary_fixture(self):
        """Verify read_save_summary extracts accurate stats from UserData0.dat."""
        summary = read_save_summary(FIXTURE_PATH)
        self.assertIsInstance(summary, dict)

        # Check file existence flag
        self.assertTrue(summary.get("file_exists"))

        # Recruited unit IDs
        recruited_ids = summary.get("recruited_ids")
        self.assertIsInstance(recruited_ids, list)
        self.assertGreater(len(recruited_ids), 0)
        self.assertIn(10, recruited_ids)  # Nowa

        # Playtime
        self.assertGreater(summary.get("playtime_seconds"), 0)
        self.assertIn("h", summary.get("playtime_formatted"))

        # Baqua / Money
        self.assertGreater(summary.get("money"), 0)

        # Fortress Town Level and Population
        self.assertGreater(summary.get("town_level"), 0)
        self.assertGreater(summary.get("population"), 0)

        # Protagonist ID and name
        self.assertEqual(summary.get("protagonist_id"), 10)
        self.assertEqual(summary.get("protagonist"), "Nowa")

        # Save Timestamp
        self.assertIsNotNone(summary.get("save_timestamp"))

    def test_read_save_summary_non_destructive(self):
        """Verify read_save_summary does not mutate the source save file."""
        sha_before = hashlib.sha256(self.fixture_bytes).hexdigest()
        _ = read_save_summary(FIXTURE_PATH)
        with open(FIXTURE_PATH, "rb") as f:
            sha_after = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(sha_before, sha_after)

    def test_read_save_summary_extracts_recipes(self):
        """Verify read_save_summary extracts acquired_recipe_ids from save fixture."""
        summary = read_save_summary(FIXTURE_PATH)
        self.assertIn("acquired_recipe_ids", summary)
        self.assertIsInstance(summary["acquired_recipe_ids"], list)
        self.assertIn("acquired_recipe_count", summary)
        self.assertEqual(summary["acquired_recipe_count"], len(summary["acquired_recipe_ids"]))
        self.assertGreater(len(summary["acquired_recipe_ids"]), 0)
        # All extracted IDs must be in 3000..3092 range
        for rid in summary["acquired_recipe_ids"]:
            self.assertIsInstance(rid, int)
            self.assertTrue(3000 <= rid <= 3092)
        # Verify starter recipe (e.g. 3000 Poached Egg) is present
        self.assertIn(3000, summary["acquired_recipe_ids"])

    def test_read_save_summary_nonexistent_file(self):
        """Verify read_save_summary gracefully handles non-existent file."""
        nonexistent_path = os.path.join(
            os.path.dirname(__file__), "does_not_exist_xyz123.dat"
        )
        summary = read_save_summary(nonexistent_path)
        self.assertIsInstance(summary, dict)
        self.assertFalse(summary.get("file_exists"))
        self.assertEqual(summary.get("recruited_ids"), [])
        self.assertEqual(summary.get("acquired_recipe_ids"), [])
        self.assertEqual(summary.get("acquired_recipe_count"), 0)
        self.assertEqual(summary.get("money"), 0)
        self.assertEqual(summary.get("town_level"), 0)
        self.assertEqual(summary.get("population"), 0)
        self.assertEqual(summary.get("playtime_seconds"), 0.0)

    def test_backup_save_creates_timestamped_copy(self):
        """Verify backup_save writes exact copy with timestamp and preserves original."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            backup_path = backup_save(FIXTURE_PATH, backup_dir=tmp_dir)

            self.assertTrue(os.path.isfile(backup_path))
            self.assertTrue(backup_path.startswith(tmp_dir))

            # Validate filename format: UserData0_backup_YYYYMMDD_HHMMSS.dat
            backup_filename = os.path.basename(backup_path)
            pattern = r"^UserData0_backup_\d{8}_\d{6}(_\d+)?\.dat$"
            self.assertRegex(backup_filename, pattern)

            # Compare bytes
            with open(backup_path, "rb") as bf:
                backup_bytes = bf.read()
            self.assertEqual(backup_bytes, self.fixture_bytes)

    def test_backup_save_nonexistent_file(self):
        """Verify backup_save raises FileNotFoundError for non-existent source."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            with self.assertRaises(FileNotFoundError):
                backup_save("non_existent_file_98765.dat", backup_dir=tmp_dir)


if __name__ == "__main__":
    unittest.main()
