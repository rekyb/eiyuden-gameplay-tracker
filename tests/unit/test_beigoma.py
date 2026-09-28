import json
import os
import unittest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


class TestBeigomaDatasets(unittest.TestCase):
    def setUp(self):
        filepath = os.path.join(DATA_DIR, "beigoma.json")
        with open(filepath, "r", encoding="utf-8") as f:
            self.beigoma = json.load(f)

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

    def test_beigoma_rarity_field_and_distribution(self):
        star_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for item in self.beigoma:
            self.assertIn("rarity", item, f"Item {item.get('name')} missing rarity")
            rarity = item["rarity"]
            self.assertIsInstance(rarity, int)
            self.assertIn(rarity, [1, 2, 3, 4])
            star_counts[rarity] += 1

        self.assertEqual(star_counts[1], 16)
        self.assertEqual(star_counts[2], 27)
        self.assertEqual(star_counts[3], 12)
        self.assertEqual(star_counts[4], 5)

    def test_canonical_beigoma_rarities(self):
        """Verify canonical rarities based on RPG Site guide."""
        by_name = {b["name"]: b["rarity"] for b in self.beigoma}
        # 4 Stars (Rainbow)
        self.assertEqual(by_name["Devil of Destruction"], 4)
        self.assertEqual(by_name["Neo Absolute Zero"], 4)
        self.assertEqual(by_name["Infinity Force"], 4)
        self.assertEqual(by_name["Elder Dragon"], 4)
        self.assertEqual(by_name["Fenrir"], 4)

        # 3 Stars (Gold)
        self.assertEqual(by_name["Earthsmack"], 3)
        self.assertEqual(by_name["Trinity Cyclone"], 3)
        self.assertEqual(by_name["Azure Dragon"], 3)
        self.assertEqual(by_name["Galactic Flame"], 3)
        self.assertEqual(by_name["Seed Conqueror"], 3)
        self.assertEqual(by_name["Corpse Rider"], 3)
        self.assertEqual(by_name["Earth Dragon"], 3)
        self.assertEqual(by_name["Azhdahag"], 3)

        # 2 Stars (Silver)
        self.assertEqual(by_name["Dragon Fang"], 2)
        self.assertEqual(by_name["Gigas Fist"], 2)
        self.assertEqual(by_name["Cheetalita"], 2)
        self.assertEqual(by_name["Snakebite"], 2)
        self.assertEqual(by_name["Hraesvelgr"], 2)
        self.assertEqual(by_name["Rabbit Mage"], 2)
        self.assertEqual(by_name["Titan Slug"], 2)
        self.assertEqual(by_name["Xibalba"], 2)

        # 1 Star (Bronze)
        self.assertEqual(by_name["Plantvine"], 1)
        self.assertEqual(by_name["Killer Fungus"], 1)
        self.assertEqual(by_name["Sea Ghost"], 1)
        self.assertEqual(by_name["Remora"], 1)

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
