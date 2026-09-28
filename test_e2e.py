import unittest
import urllib.request
import json
import os
import shutil
import tempfile
import server

class TestEndToEndSaveTracker(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp()
        cls.save_fixture = os.path.join(cls.temp_dir, "UserData0.dat")
        shutil.copy2("UserData0.dat", cls.save_fixture)

        cls.config_file = os.path.join(cls.temp_dir, "config.json")
        with open(cls.config_file, "w", encoding="utf-8") as f:
            json.dump({"save_path": cls.save_fixture}, f)

        cls.http_server = server.create_server(
            host="127.0.0.1",
            port=0,
            config_path=cls.config_file,
            characters_path="characters.json",
            recipes_path="recipes.json",
            static_dir="static",
        )
        cls.port = cls.http_server.server_address[1]

        import threading
        cls.server_thread = threading.Thread(target=cls.http_server.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http_server.shutdown()
        cls.http_server.server_close()
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

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

    def test_e2e_backup_creation(self):
        req = urllib.request.Request(
            self._url("/api/save/backup"),
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            backup_file = data["backup_file"]
            self.assertTrue(os.path.isfile(backup_file))
            # Verify exact byte equality
            with open(self.save_fixture, "rb") as f1, open(backup_file, "rb") as f2:
                self.assertEqual(f1.read(), f2.read())
            # Clean up backup
            try:
                os.remove(backup_file)
            except OSError:
                pass

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


if __name__ == "__main__":
    unittest.main()
