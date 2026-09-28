import json
import os
import unittest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


class TestFishDatasets(unittest.TestCase):
    def setUp(self):
        fish_path = os.path.join(DATA_DIR, "fish.json")
        spots_path = os.path.join(DATA_DIR, "fishing_spots.json")
        with open(fish_path, "r", encoding="utf-8") as f:
            self.fish = json.load(f)
        with open(spots_path, "r", encoding="utf-8") as f:
            self.spots = json.load(f)

    def test_fish_json_exists_and_valid(self):
        self.assertIsInstance(self.fish, list)
        self.assertEqual(len(self.fish), 52, "Must contain exactly 52 canonical fish")

        ids = set()
        for item in self.fish:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("rarity", item)
            self.assertIn("spot_ids", item)
            self.assertIn("location", item)
            self.assertIsInstance(item["id"], int)
            self.assertIsInstance(item["name"], str)
            self.assertIsInstance(item["rarity"], int)
            self.assertIn(item["rarity"], [1, 2, 3, 4, 5])
            self.assertIsInstance(item["spot_ids"], list)
            self.assertTrue(len(item["spot_ids"]) > 0, f"Fish {item['name']} must have spot_ids")
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["location"].strip())
            self.assertNotIn(item["id"], ids, f"Duplicate fish ID: {item['id']}")
            ids.add(item["id"])

        self.assertEqual(min(ids), 1)
        self.assertEqual(max(ids), 52)

    def test_fishing_spots_json_exists_and_valid(self):
        self.assertIsInstance(self.spots, list)
        self.assertEqual(len(self.spots), 19, "Must contain exactly 19 fishing spots")

        spot_ids = set()
        for s in self.spots:
            self.assertIn("id", s)
            self.assertIn("name", s)
            self.assertIn("region", s)
            self.assertIsInstance(s["id"], int)
            self.assertTrue(s["name"].strip())
            self.assertTrue(s["region"].strip())
            self.assertNotIn(s["id"], spot_ids, f"Duplicate spot ID: {s['id']}")
            spot_ids.add(s["id"])

    def test_fish_spot_references_valid(self):
        valid_spot_ids = {s["id"] for s in self.spots}
        for item in self.fish:
            for sid in item["spot_ids"]:
                self.assertIn(
                    sid,
                    valid_spot_ids,
                    f"Fish {item['name']} references unknown spot ID {sid}",
                )


if __name__ == "__main__":
    unittest.main()
