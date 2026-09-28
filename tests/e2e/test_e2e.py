"""End-to-end integration tests for Eiyuden Save Tracker application."""

import json
import os
import shutil
import tempfile
import threading
import unittest
import urllib.request

from src.tracker.server import create_server
from tests.fixtures.generator import create_synthetic_save


class TestEndToEndSaveTracker(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp(prefix="eiyuden_e2e_")
        cls.save_fixture = os.path.join(cls.temp_dir, "UserData0.dat")
        save_bytes = create_synthetic_save(
            hero_ids=[10, 20, 150],
            recipe_item_ids=[8000, 8001, 8026],
            playtime=3661.0,
            money=50000,
            town_level=2,
            population=45,
            protagonist_id=10,
        )
        with open(cls.save_fixture, "wb") as f:
            f.write(save_bytes)

        cls.config_file = os.path.join(cls.temp_dir, "config.json")
        with open(cls.config_file, "w", encoding="utf-8") as f:
            json.dump({"save_path": cls.save_fixture}, f)

        cls.http_server = create_server(
            host="127.0.0.1",
            port=0,
            config_path=cls.config_file,
        )
        cls.port = cls.http_server.server_address[1]

        cls.server_thread = threading.Thread(target=cls.http_server.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http_server.shutdown()
        cls.http_server.server_close()
        shutil.rmtree(cls.temp_dir, ignore_errors=True)
        from src.tracker.server import PROJECT_ROOT
        uploaded_file = PROJECT_ROOT / "uploads" / "UserData0.dat"
        if uploaded_file.exists():
            try:
                uploaded_file.unlink()
            except OSError:
                pass

    def _url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.port}{path}"

    def test_e2e_frontend_assets(self):
        # Index HTML
        with urllib.request.urlopen(self._url("/")) as resp:
            self.assertEqual(resp.status, 200)
            html = resp.read().decode("utf-8")
            self.assertIn("Eiyuden Chronicle", html)
            self.assertIn("characters-tbody", html)

        # Style CSS directly from root
        with urllib.request.urlopen(self._url("/style.css")) as resp:
            self.assertEqual(resp.status, 200)
            css = resp.read().decode("utf-8")
            self.assertIn(".status-recruited", css)

        # App JS directly from root
        with urllib.request.urlopen(self._url("/app.js")) as resp:
            self.assertEqual(resp.status, 200)
            js = resp.read().decode("utf-8")
            self.assertIn("syncSave", js)

    def test_e2e_characters_and_save_sync(self):
        # 121 characters
        with urllib.request.urlopen(self._url("/api/characters")) as resp:
            self.assertEqual(resp.status, 200)
            chars = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(len(chars), 121)

        # Live save status
        with urllib.request.urlopen(self._url("/api/save/status")) as resp:
            self.assertEqual(resp.status, 200)
            status = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(status["file_exists"])
            self.assertGreater(len(status["recruited_ids"]), 0)
            self.assertEqual(status["protagonist"], "Nowa")
            self.assertGreater(status["money"], 0)
            self.assertGreater(status["town_level"], 0)
            self.assertGreater(status["population"], 0)

    def test_e2e_recipes_api_and_assets(self):
        """93 recipes served, HTML has recipes view and navigation, footer attribution."""
        # 93 recipes served
        with urllib.request.urlopen(self._url("/api/recipes")) as resp:
            self.assertEqual(resp.status, 200)
            recipes = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(len(recipes), 93)

        # HTML has recipes view and navigation
        with urllib.request.urlopen(self._url("/")) as resp:
            html = resp.read().decode("utf-8")
            self.assertIn("tab-nav-heroes", html)
            self.assertIn("tab-nav-recipes", html)
            self.assertIn("recipes-tbody", html)
            self.assertIn("Made with love by Reky", html)

        # app.js has recipe-related logic
        with urllib.request.urlopen(self._url("/app.js")) as resp:
            js = resp.read().decode("utf-8")
            self.assertIn("switchView", js)
            self.assertIn("renderRecipesTable", js)
            self.assertIn("cookedRecipeIds", js)

    def test_e2e_beigoma_html_elements(self):
        """HTML contains Beigoma navigation, subnavigation, and table containers."""
        with urllib.request.urlopen(self._url("/")) as resp:
            html = resp.read().decode("utf-8")
            self.assertIn("tab-nav-beigoma", html)
            self.assertIn("view-beigoma", html)
            self.assertIn("beigoma-subnav", html)
            self.assertIn("subtab-beigoma-collection", html)
            self.assertIn("subtab-beigoma-trainers", html)
            self.assertIn("beigoma-table", html)
            self.assertIn("beigoma-list", html)
            self.assertIn("trainer-table", html)
            self.assertIn("trainer-list", html)

    def test_e2e_save_upload_project_root(self):
        """POST /api/save/upload saves file under project root uploads/ directory."""
        from src.tracker.server import PROJECT_ROOT
        raw_bytes = create_synthetic_save(hero_ids=[10, 20])
        req = urllib.request.Request(
            self._url("/api/save/upload"),
            data=raw_bytes,
            headers={"Content-Type": "application/octet-stream"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            expected_uploads_dir = os.path.normpath(str(PROJECT_ROOT / "uploads"))
            self.assertEqual(os.path.normpath(os.path.dirname(data["save_path"])), expected_uploads_dir)
            self.assertTrue(os.path.isfile(data["save_path"]))


if __name__ == "__main__":
    unittest.main()
