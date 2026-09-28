import json
import os
import unittest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


class TestBeigomaDatasets(unittest.TestCase):
    def test_beigoma_json_exists_and_valid(self):
        filepath = os.path.join(DATA_DIR, "beigoma.json")
        self.assertTrue(os.path.isfile(filepath), "data/beigoma.json must exist")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 60, "Must contain exactly 60 collectible tops")

        ids = set()
        for item in data:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("whereToObtain", item)
            self.assertIsInstance(item["id"], int)
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["whereToObtain"].strip())
            self.assertNotIn(item["id"], ids, f"Duplicate Beigoma ID: {item['id']}")
            ids.add(item["id"])

    def test_beigoma_trainers_json_exists_and_valid(self):
        filepath = os.path.join(DATA_DIR, "beigoma_trainers.json")
        self.assertTrue(
            os.path.isfile(filepath), "data/beigoma_trainers.json must exist"
        )
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 44, "Must contain exactly 44 opponent trainers")

        ids = set()
        for item in data:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("location", item)
            self.assertIsInstance(item["id"], int)
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["location"].strip())
            self.assertNotIn(item["id"], ids, f"Duplicate Trainer ID: {item['id']}")
            ids.add(item["id"])


if __name__ == "__main__":
    unittest.main()
