import hashlib
import os
import tempfile
import unittest

from src.tracker.core.save_reader import (
    KEY,
    IV,
    decrypt_save,
    encrypt_save,
    extract_save_data,
    read_save_summary,
    validate_save_file,
)
from tests.fixtures.generator import create_synthetic_save

EXPECTED_KEY = bytes.fromhex("b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870")
EXPECTED_IV = bytes.fromhex("2f6e9693c9779505")


class TestSaveReader(unittest.TestCase):
    def setUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(suffix=".dat", delete=False)
        self.fixture_path = self.temp_file.name
        self.fixture_bytes = create_synthetic_save(
            hero_ids=[10, 20, 150],
            recipe_item_ids=[8000, 8015, 8026],
            playtime=3661.0,
            money=75000,
            town_level=3,
            population=60,
            protagonist_id=10,
            save_timestamp="2026-09-28T12:00:00",
        )
        self.temp_file.write(self.fixture_bytes)
        self.temp_file.close()

    def tearDown(self):
        if os.path.exists(self.fixture_path):
            try:
                os.remove(self.fixture_path)
            except OSError:
                pass

    def test_constants(self):
        """Verify KEY and IV match the game's static TripleDES credentials."""
        self.assertEqual(KEY, EXPECTED_KEY)
        self.assertEqual(IV, EXPECTED_IV)

    def test_decrypt_save_fixture(self):
        """Verify decrypting synthetic save returns a valid dict with recruited units."""
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
        with self.assertRaises(ValueError):
            decrypt_save(b"corrupted_invalid_data_not_3des")

    def test_roundtrip_encrypt_decrypt(self):
        """Verify payload roundtrips through encrypt_save and decrypt_save."""
        sample_payload = {
            "test_key": "test_value",
            "nested": {"count": 42, "items": [1, 2, 3]},
        }
        ciphertext = encrypt_save(sample_payload)
        decrypted = decrypt_save(ciphertext)
        self.assertEqual(decrypted, sample_payload)

    def test_extract_save_data(self):
        """Verify extract_save_data deserializes valid decrypted plaintext."""
        from src.tracker.core.crypto import decrypt_save_bytes
        plaintext = decrypt_save_bytes(self.fixture_bytes)
        parsed = extract_save_data(plaintext)
        self.assertIsInstance(parsed, dict)
        self.assertIn("_unitData", parsed)

    def test_extract_save_data_invalid_json(self):
        """Verify extract_save_data raises ValueError on malformed plaintext."""
        with self.assertRaises(ValueError):
            extract_save_data(b"not valid json {")

    def test_read_save_summary_fixture(self):
        """Verify read_save_summary extracts accurate stats from synthetic save."""
        summary = read_save_summary(self.fixture_path)
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
        _ = read_save_summary(self.fixture_path)
        with open(self.fixture_path, "rb") as f:
            sha_after = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(sha_before, sha_after)

    def test_read_save_summary_extracts_recipes(self):
        """Verify read_save_summary extracts acquired_recipe_ids from save fixture."""
        summary = read_save_summary(self.fixture_path)
        self.assertIn("acquired_recipe_ids", summary)
        self.assertIsInstance(summary["acquired_recipe_ids"], list)
        self.assertIn("acquired_recipe_count", summary)
        self.assertEqual(
            summary["acquired_recipe_count"], len(summary["acquired_recipe_ids"])
        )
        self.assertGreater(len(summary["acquired_recipe_ids"]), 0)
        # All extracted IDs must be in 3000..3092 range
        for rid in summary["acquired_recipe_ids"]:
            self.assertIsInstance(rid, int)
            self.assertTrue(3000 <= rid <= 3092)
        # Verify starter recipe (3000 Poached Egg) is present
        self.assertIn(3000, summary["acquired_recipe_ids"])

    def test_beigoma_and_trainer_extraction(self):
        """Verify extraction of usable Beigomas and defeated trainers from save."""
        save_data = {
            "_unitData": {"_units": [{"_id": 10}]},
            "_miniGameBeigoma": {
                "_usableBeigomaIDs": [6, 14, 15, 500, 604, 999],
                "_matchResult": [
                    {"_characterParamId": 1000, "_winCount": 1},
                    {"_characterParamId": 5, "_winCount": 2},
                    {"_characterParamId": 1, "_winCount": 5},  # Nowa avatar - excluded
                    {"_characterParamId": 6, "_winCount": 0},  # Not won yet - excluded
                ],
            },
        }
        raw_bytes = encrypt_save(save_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tf:
            tf.write(raw_bytes)
            tf_path = tf.name

        try:
            summary = read_save_summary(tf_path)
            self.assertEqual(summary["beigoma_collected_ids"], [6, 14, 15, 500, 999])
            self.assertEqual(summary["beigoma_collected_count"], 5)
            self.assertEqual(summary["beigoma_defeated_trainer_ids"], [5, 1000])
            self.assertEqual(summary["beigoma_defeated_trainer_count"], 2)
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)

    def test_beigoma_extraction_empty_or_missing(self):
        """Verify safe defaults when _miniGameBeigoma is missing or empty."""
        save_data = {
            "_unitData": {"_units": [{"_id": 10}]},
        }
        raw_bytes = encrypt_save(save_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tf:
            tf.write(raw_bytes)
            tf_path = tf.name

        try:
            summary = read_save_summary(tf_path)
            self.assertEqual(summary["beigoma_collected_ids"], [])
            self.assertEqual(summary["beigoma_collected_count"], 0)
            self.assertEqual(summary["beigoma_defeated_trainer_ids"], [])
            self.assertEqual(summary["beigoma_defeated_trainer_count"], 0)
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)

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
        self.assertEqual(summary.get("beigoma_collected_ids"), [])
        self.assertEqual(summary.get("beigoma_collected_count"), 0)
        self.assertEqual(summary.get("beigoma_defeated_trainer_ids"), [])
        self.assertEqual(summary.get("beigoma_defeated_trainer_count"), 0)
        self.assertEqual(summary.get("fish_caught_ids"), [])
        self.assertEqual(summary.get("fish_caught_count"), 0)
        self.assertEqual(summary.get("fish_total_count"), 52)
        self.assertEqual(summary.get("discovered_spot_ids"), [])
        self.assertEqual(summary.get("money"), 0)
        self.assertEqual(summary.get("town_level"), 0)
        self.assertEqual(summary.get("population"), 0)
        self.assertEqual(summary.get("playtime_seconds"), 0.0)

    def test_fish_and_spots_extraction_from_save(self):
        """Verify extraction of caught fish IDs and discovered fishing spot IDs."""
        save_data = {
            "_unitData": {"_units": [{"_id": 10}]},
            "_fishesRegistrations": [
                {"_fishId": 21, "_spotId": 1, "_count": 5, "_newFlag": True},
                {"_fishId": 40, "_spotId": 1, "_count": 2, "_newFlag": True},
                {"_fishId": 21, "_spotId": 4, "_count": 1, "_newFlag": False},  # duplicate fish ID
                {"_fishId": 999, "_spotId": 1, "_count": 1},  # invalid fish ID (>52)
                {"_fishId": 0, "_spotId": 1, "_count": 1},  # invalid fish ID (<1)
                {"_fishId": "not_an_int", "_spotId": 1, "_count": 1},  # malformed
                "not_a_dict",  # malformed entry
            ],
            "_fishingSpots": [
                {"_id": 1, "_resource": {"_count": 10, "_max": 10}, "_coolTime": 0.0, "_isDiscoverd": True},
                {"_id": 2, "_resource": {"_count": 10, "_max": 10}, "_coolTime": 0.0, "_isDiscoverd": False},
                {"_id": 51, "_resource": {"_count": 15, "_max": 15}, "_coolTime": 0.0, "_isDiscoverd": True},
                {"_id": 1, "_resource": {"_count": 10, "_max": 10}, "_coolTime": 0.0, "_isDiscoverd": True},  # duplicate spot ID
                {"_id": "bad_id", "_isDiscoverd": True},  # invalid ID type
                {"_id": 3},  # missing _isDiscoverd
                "invalid_spot_entry",  # malformed entry
            ],
        }
        raw_bytes = encrypt_save(save_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tf:
            tf.write(raw_bytes)
            tf_path = tf.name

        try:
            summary = read_save_summary(tf_path)
            self.assertEqual(summary["fish_caught_ids"], [21, 40])
            self.assertEqual(summary["fish_caught_count"], 2)
            self.assertEqual(summary["fish_total_count"], 52)
            self.assertEqual(summary["discovered_spot_ids"], [1, 51])
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)

    def test_fish_and_spots_extraction_empty_or_missing(self):
        """Verify safe defaults when _fishesRegistrations and _fishingSpots are missing or malformed."""
        save_data = {
            "_unitData": {"_units": [{"_id": 10}]},
            "_fishesRegistrations": "invalid_type",
            "_fishingSpots": None,
        }
        raw_bytes = encrypt_save(save_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tf:
            tf.write(raw_bytes)
            tf_path = tf.name

        try:
            summary = read_save_summary(tf_path)
            self.assertEqual(summary["fish_caught_ids"], [])
            self.assertEqual(summary["fish_caught_count"], 0)
            self.assertEqual(summary["fish_total_count"], 52)
            self.assertEqual(summary["discovered_spot_ids"], [])
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)

    def test_read_save_summary_none_and_empty_path(self):
        """Verify read_save_summary handles None and empty string paths safely."""
        summary_none = read_save_summary(None)
        self.assertIsInstance(summary_none, dict)
        self.assertFalse(summary_none.get("file_exists"))
        self.assertEqual(summary_none.get("recruited_ids"), [])

        summary_empty = read_save_summary("")
        self.assertIsInstance(summary_empty, dict)
        self.assertFalse(summary_empty.get("file_exists"))
        self.assertEqual(summary_empty.get("recruited_ids"), [])

    def test_read_save_summary_corrupted_file(self):
        """Verify read_save_summary does not crash on empty or corrupted file."""
        with tempfile.NamedTemporaryFile(suffix=".dat", delete=False) as tf:
            tf.write(b"this is completely invalid save data 12345")
            corrupt_path = tf.name

        try:
            summary = read_save_summary(corrupt_path)
            self.assertIsInstance(summary, dict)
            self.assertTrue(summary.get("file_exists"))
            self.assertTrue(summary.get("corrupted"))
            self.assertIn("error", summary)
            self.assertEqual(summary.get("recruited_ids"), [])
            self.assertEqual(summary.get("acquired_recipe_ids"), [])
            self.assertEqual(summary.get("fish_caught_ids"), [])
            self.assertEqual(summary.get("fish_caught_count"), 0)
            self.assertEqual(summary.get("fish_total_count"), 52)
            self.assertEqual(summary.get("discovered_spot_ids"), [])
        finally:
            if os.path.exists(corrupt_path):
                os.remove(corrupt_path)

    def test_validate_save_file_valid(self):
        """Verify validate_save_file returns True for valid save file."""
        self.assertTrue(validate_save_file(self.fixture_path))

    def test_validate_save_file_invalid(self):
        """Verify validate_save_file returns False for missing, empty, or corrupt files."""
        self.assertFalse(validate_save_file(None))
        self.assertFalse(validate_save_file(""))
        self.assertFalse(validate_save_file("nonexistent_save_file.dat"))

        with tempfile.NamedTemporaryFile(suffix=".dat", delete=False) as tf:
            tf.write(b"corrupted bytes not valid 3des")
            corrupt_path = tf.name
        try:
            self.assertFalse(validate_save_file(corrupt_path))
        finally:
            if os.path.exists(corrupt_path):
                os.remove(corrupt_path)

        with tempfile.NamedTemporaryFile(suffix=".dat", delete=False) as tf:
            empty_path = tf.name
        try:
            self.assertFalse(validate_save_file(empty_path))
        finally:
            if os.path.exists(empty_path):
                os.remove(empty_path)


if __name__ == "__main__":
    unittest.main()
