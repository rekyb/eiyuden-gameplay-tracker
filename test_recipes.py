import json
import os
import unittest

RECIPES_JSON_PATH = os.path.join(os.path.dirname(__file__), "recipes.json")
EXPECTED_TOTAL_RECIPES = 93
VALID_CATEGORIES = {"Appetizer", "Main", "Dessert"}
REQUIRED_KEYS = {"id", "name", "category", "location", "howToObtain", "recipeItemId"}
STARTER_IDS = set(range(3000, 3008))


class TestRecipesDatabase(unittest.TestCase):
    def setUp(self):
        self.assertTrue(
            os.path.exists(RECIPES_JSON_PATH),
            f"Database file not found: {RECIPES_JSON_PATH}",
        )
        with open(RECIPES_JSON_PATH, "r", encoding="utf-8") as f:
            self.recipes = json.load(f)

    def test_json_structure_and_count(self):
        """Verify the database is a list with exactly 93 entries."""
        self.assertIsInstance(self.recipes, list)
        self.assertEqual(
            len(self.recipes),
            EXPECTED_TOTAL_RECIPES,
            f"Expected {EXPECTED_TOTAL_RECIPES} recipes, found {len(self.recipes)}",
        )

    def test_no_duplicate_ids(self):
        """Verify all recipe IDs are unique."""
        ids = [r.get("id") for r in self.recipes]
        unique_ids = set(ids)
        self.assertEqual(len(ids), len(unique_ids), "Duplicate recipe IDs found!")

    def test_id_range_contiguous(self):
        """Verify recipe IDs span exactly 3000 through 3092."""
        ids = sorted([r.get("id") for r in self.recipes])
        expected_ids = list(range(3000, 3093))
        self.assertEqual(ids, expected_ids, "Recipe IDs do not match 3000..3092 range!")

    def test_required_keys_and_types(self):
        """Verify every entry has required keys and valid types."""
        for r in self.recipes:
            recipe_id = r.get("id")
            recipe_name = r.get("name")
            self.assertTrue(
                REQUIRED_KEYS.issubset(r.keys()),
                f"Recipe {recipe_name} (ID: {recipe_id}) missing keys: {REQUIRED_KEYS - set(r.keys())}",
            )
            self.assertIsInstance(r["id"], int, f"ID must be int: {recipe_id}")
            self.assertGreaterEqual(r["id"], 3000, f"ID must be >= 3000: {recipe_id}")
            self.assertLessEqual(r["id"], 3092, f"ID must be <= 3092: {recipe_id}")

            self.assertIsInstance(r["name"], str, f"Name must be str: {recipe_id}")
            self.assertTrue(r["name"].strip(), f"Name cannot be empty: {recipe_id}")

            self.assertIsInstance(r["category"], str, f"Category must be str: {recipe_id}")
            self.assertIn(
                r["category"],
                VALID_CATEGORIES,
                f"Category for {recipe_name} must be in {VALID_CATEGORIES}, got '{r['category']}'",
            )

            self.assertIsInstance(r["location"], str, f"Location must be str: {recipe_id}")
            self.assertTrue(
                r["location"].strip(),
                f"Location cannot be empty for {recipe_name}",
            )

            self.assertIsInstance(
                r["howToObtain"], str, f"howToObtain must be str: {recipe_id}"
            )
            self.assertTrue(
                len(r["howToObtain"].strip()) >= 10,
                f"howToObtain must provide clear instructions for {recipe_name}",
            )

            self.assertIsInstance(
                r["recipeItemId"], int, f"recipeItemId must be int: {recipe_id}"
            )

    def test_starter_recipes(self):
        """Verify Kurtz starter recipes (IDs 3000-3007) have recipeItemId 0 and proper metadata."""
        recipe_map = {r["id"]: r for r in self.recipes}
        for starter_id in STARTER_IDS:
            r = recipe_map.get(starter_id)
            self.assertIsNotNone(r, f"Starter recipe {starter_id} missing")
            self.assertEqual(
                r["recipeItemId"], 0, f"Starter recipe {starter_id} recipeItemId must be 0"
            )
            self.assertEqual(
                r["location"], "HQ Restaurant (Kurtz Starter)"
            )
            self.assertEqual(
                r["howToObtain"], "Unlocked automatically when Kurtz opens the Restaurant."
            )

    def test_non_starter_recipe_item_ids(self):
        """Verify non-starter recipes have recipeItemId matching 8000 + (id % 1000)."""
        for r in self.recipes:
            if r["id"] not in STARTER_IDS:
                expected_item_id = 8000 + (r["id"] % 1000)
                self.assertEqual(
                    r["recipeItemId"],
                    expected_item_id,
                    f"Recipe {r['id']} ({r['name']}) recipeItemId mismatch: expected {expected_item_id}, got {r['recipeItemId']}",
                )

    def test_category_distribution(self):
        """Verify reasonable category distribution across 93 dishes."""
        counts = {"Appetizer": 0, "Main": 0, "Dessert": 0}
        for r in self.recipes:
            counts[r["category"]] += 1
        self.assertEqual(counts["Appetizer"], 15, "Expected 15 Appetizers")
        self.assertEqual(counts["Main"], 49, "Expected 49 Main dishes")
        self.assertEqual(counts["Dessert"], 29, "Expected 29 Desserts")

    def test_key_recipes_present_and_accurate(self):
        """Verify presence and metadata of representative recipes."""
        recipe_map = {r["id"]: r for r in self.recipes}

        # 3000: Poached Egg (Starter Appetizer)
        self.assertIn(3000, recipe_map)
        self.assertEqual(recipe_map[3000]["name"], "Poached Egg")
        self.assertEqual(recipe_map[3000]["category"], "Appetizer")
        self.assertEqual(recipe_map[3000]["recipeItemId"], 0)

        # 3015: Ramen (Cooking Battle 1)
        self.assertIn(3015, recipe_map)
        self.assertEqual(recipe_map[3015]["name"], "Ramen")
        self.assertEqual(recipe_map[3015]["category"], "Main")
        self.assertEqual(recipe_map[3015]["recipeItemId"], 8015)
        self.assertIn("Cooking Battle 1", recipe_map[3015]["location"])

        # 3026: Pancakes (Altverden Village)
        self.assertIn(3026, recipe_map)
        self.assertEqual(recipe_map[3026]["name"], "Pancakes")
        self.assertEqual(recipe_map[3026]["category"], "Dessert")
        self.assertEqual(recipe_map[3026]["recipeItemId"], 8026)
        self.assertIn("Altverden Village", recipe_map[3026]["location"])

        # 3040: Vegetable Milk Soup (Dappled Forest)
        self.assertIn(3040, recipe_map)
        self.assertEqual(recipe_map[3040]["name"], "Vegetable Milk Soup")
        self.assertEqual(recipe_map[3040]["category"], "Appetizer")
        self.assertEqual(recipe_map[3040]["recipeItemId"], 8040)
        self.assertIn("Dappled Forest", recipe_map[3040]["location"])

        # 3071: Grilled Tutuva (Treefolk Village - Kurtz recruit dish)
        self.assertIn(3071, recipe_map)
        self.assertEqual(recipe_map[3071]["name"], "Grilled Tutuva")
        self.assertEqual(recipe_map[3071]["category"], "Main")
        self.assertEqual(recipe_map[3071]["recipeItemId"], 8071)
        self.assertIn("Treefolk Village", recipe_map[3071]["location"])

        # 3092: Golden Zucotto (Cooking Battle 16)
        self.assertIn(3092, recipe_map)
        self.assertEqual(recipe_map[3092]["name"], "Golden Zucotto")
        self.assertEqual(recipe_map[3092]["category"], "Dessert")
        self.assertEqual(recipe_map[3092]["recipeItemId"], 8092)
        self.assertIn("Cooking Battle 16", recipe_map[3092]["location"])


if __name__ == "__main__":
    unittest.main()
