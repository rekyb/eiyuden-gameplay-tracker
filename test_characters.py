import os
import json
import unittest

CHARACTERS_JSON_PATH = os.path.join(os.path.dirname(__file__), "characters.json")
EXPECTED_TOTAL_CHARACTERS = 121
VALID_ROLES = {"Battle", "Support", "Attendant"}
REQUIRED_KEYS = {"id", "name", "role", "location", "howToRecruit", "missable"}


class TestCharactersDatabase(unittest.TestCase):
    def setUp(self):
        self.assertTrue(
            os.path.exists(CHARACTERS_JSON_PATH),
            f"Database file not found: {CHARACTERS_JSON_PATH}",
        )
        with open(CHARACTERS_JSON_PATH, "r", encoding="utf-8") as f:
            self.characters = json.load(f)

    def test_json_structure_and_count(self):
        """Verify the database is a list with exactly 121 entries."""
        self.assertIsInstance(self.characters, list)
        self.assertEqual(
            len(self.characters),
            EXPECTED_TOTAL_CHARACTERS,
            f"Expected {EXPECTED_TOTAL_CHARACTERS} characters, found {len(self.characters)}",
        )

    def test_no_duplicate_ids(self):
        """Verify all character IDs are unique."""
        ids = [c.get("id") for c in self.characters]
        unique_ids = set(ids)
        self.assertEqual(len(ids), len(unique_ids), "Duplicate character IDs found!")

    def test_required_keys_and_types(self):
        """Verify every entry has required keys and valid types."""
        for c in self.characters:
            char_id = c.get("id")
            char_name = c.get("name")
            self.assertTrue(
                REQUIRED_KEYS.issubset(c.keys()),
                f"Character {char_name} (ID: {char_id}) missing keys: {REQUIRED_KEYS - set(c.keys())}",
            )
            self.assertIsInstance(c["id"], int, f"ID must be int: {char_id}")
            self.assertGreater(c["id"], 0, f"ID must be positive: {char_id}")

            self.assertIsInstance(c["name"], str, f"Name must be str: {char_id}")
            self.assertTrue(c["name"].strip(), f"Name cannot be empty: {char_id}")

            self.assertIsInstance(c["role"], str, f"Role must be str: {char_id}")
            self.assertIn(
                c["role"],
                VALID_ROLES,
                f"Role for {char_name} must be one of {VALID_ROLES}, got '{c['role']}'",
            )

            self.assertIsInstance(c["location"], str, f"Location must be str: {char_id}")
            self.assertTrue(
                c["location"].strip(),
                f"Location cannot be empty for {char_name}",
            )

            self.assertIsInstance(
                c["howToRecruit"], str, f"howToRecruit must be str: {char_id}"
            )
            self.assertTrue(
                len(c["howToRecruit"].strip()) >= 10,
                f"howToRecruit must provide clear steps for {char_name}",
            )

            self.assertIsInstance(
                c["missable"], bool, f"missable must be bool for {char_name}"
            )

    def test_key_characters_present_and_accurate(self):
        """Verify presence of key characters and accurate missable flags."""
        char_map = {c["id"]: c for c in self.characters}

        # Starting protagonists
        self.assertIn(10, char_map)
        self.assertEqual(char_map[10]["name"], "Nowa")
        self.assertEqual(char_map[10]["role"], "Battle")
        self.assertFalse(char_map[10]["missable"])

        self.assertIn(20, char_map)
        self.assertEqual(char_map[20]["name"], "Seign")
        self.assertEqual(char_map[20]["role"], "Battle")

        self.assertIn(150, char_map)
        self.assertEqual(char_map[150]["name"], "Marisa")
        self.assertEqual(char_map[150]["role"], "Battle")

        # Leene (notable missable character)
        self.assertIn(1200, char_map)
        self.assertEqual(char_map[1200]["name"], "Leene")
        self.assertEqual(char_map[1200]["role"], "Battle")
        self.assertTrue(
            char_map[1200]["missable"],
            "Leene must be flagged as missable (requires all other characters before the final battle)",
        )

        # Aleior (missable griffin quest tied to Marisa)
        self.assertIn(710, char_map)
        self.assertEqual(char_map[710]["name"], "Aleior")
        self.assertTrue(
            char_map[710]["missable"],
            "Aleior must be flagged as missable (quest requires Marisa before late-game cutoff)",
        )

        # Facility / Attendant characters
        self.assertIn(130, char_map)
        self.assertEqual(char_map[130]["name"], "Iris")
        self.assertEqual(char_map[130]["role"], "Attendant")

        self.assertIn(1520, char_map)
        self.assertEqual(char_map[1520]["name"], "Goldwyn")
        self.assertEqual(char_map[1520]["role"], "Attendant")

        # DLC character
        self.assertIn(1210, char_map)
        self.assertEqual(char_map[1210]["name"], "Grace")
        self.assertEqual(char_map[1210]["role"], "Battle")


if __name__ == "__main__":
    unittest.main()
