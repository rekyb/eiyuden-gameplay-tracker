import unittest
import json
from src.tracker.core.crypto import (
    KEY,
    IV,
    decrypt_save_bytes,
    encrypt_save_dict,
    is_valid_magic,
)
from tests.fixtures.generator import create_synthetic_save


class TestCryptoAndGenerator(unittest.TestCase):
    def test_constants(self):
        """Verify KEY and IV are expected TripleDES parameters."""
        expected_key = bytes.fromhex("b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870")
        expected_iv = bytes.fromhex("2f6e9693c9779505")
        self.assertEqual(KEY, expected_key)
        self.assertEqual(IV, expected_iv)
        self.assertEqual(len(KEY), 24)
        self.assertEqual(len(IV), 8)

    def test_encrypt_and_decrypt_roundtrip(self):
        """Verify encrypting dict and decrypting bytes returns valid magic and exact data."""
        sample = {"hero_id": 100, "money": 99999, "playtime": 3600.0}
        encrypted = encrypt_save_dict(sample)
        self.assertIsInstance(encrypted, bytes)
        decrypted = decrypt_save_bytes(encrypted)
        self.assertTrue(is_valid_magic(decrypted))
        payload = json.loads(decrypted.decode("utf-8"))
        self.assertEqual(payload["money"], 99999)
        self.assertEqual(payload["hero_id"], 100)
        self.assertEqual(payload["playtime"], 3600.0)

    def test_synthetic_save_generator(self):
        """Verify synthetic save fixture generator creates valid encrypted save data."""
        enc = create_synthetic_save(hero_ids=[1, 2, 3], recipe_item_ids=[8001, 8002])
        dec = decrypt_save_bytes(enc)
        self.assertTrue(is_valid_magic(dec))
        payload = json.loads(dec.decode("utf-8"))
        self.assertIn("UserData", payload)
        self.assertEqual(payload["UserData"]["Money"], 50000)
        self.assertEqual(payload["UserData"]["TownLevel"], 2)
        self.assertEqual(payload["UserData"]["Population"], 45)
        self.assertEqual(len(payload["UserData"]["UnitData"]), 3)
        self.assertEqual(len(payload["UserData"]["Inventory"]), 2)

    def test_synthetic_save_generator_custom_params(self):
        """Verify synthetic save fixture generator respects custom progress parameters."""
        enc = create_synthetic_save(
            hero_ids=[10, 20],
            recipe_item_ids=[8010],
            playtime=7200.5,
            money=123456,
            town_level=4,
            population=120,
        )
        dec = decrypt_save_bytes(enc)
        payload = json.loads(dec.decode("utf-8"))
        self.assertEqual(payload["UserData"]["PlayTime"], 7200.5)
        self.assertEqual(payload["UserData"]["Money"], 123456)
        self.assertEqual(payload["UserData"]["TownLevel"], 4)
        self.assertEqual(payload["UserData"]["Population"], 120)

    def test_decrypt_invalid_length(self):
        """Verify decrypting data not multiple of 8 bytes raises ValueError."""
        with self.assertRaises(ValueError):
            decrypt_save_bytes(b"1234567")

    def test_decrypt_invalid_ciphertext(self):
        """Verify decrypting invalid ciphertext raises ValueError due to bad padding."""
        with self.assertRaises(ValueError):
            decrypt_save_bytes(b"1234567812345678")

    def test_is_valid_magic_false_for_garbage(self):
        """Verify is_valid_magic returns False for garbage data."""
        self.assertFalse(is_valid_magic(b"random binary \x00\xff garbage"))
        self.assertFalse(is_valid_magic(b""))
        self.assertFalse(is_valid_magic(b"not json at all"))


if __name__ == "__main__":
    unittest.main()
