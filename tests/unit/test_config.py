"""Unit tests for configuration manager and platform save detector."""

import json
import os
import shutil
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from src.tracker.config import (
    ConfigManager,
    detect_steam_save_path,
    detect_gog_save_path,
    detect_gamepass_save_path,
    find_any_save_file,
)


class TestConfigManager(unittest.TestCase):
    """Test suite for ConfigManager configuration handling and atomic updates."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = Path(self.temp_dir) / "config.json"

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_default_config_resolution(self):
        """Verify ConfigManager defaults to config/config.json relative to project root."""
        manager = ConfigManager()
        expected_suffix = Path("config") / "config.json"
        self.assertTrue(
            str(manager.config_path).endswith(str(expected_suffix)),
            f"Expected config_path to end with {expected_suffix}, got {manager.config_path}",
        )
        cfg = manager.get_config()
        self.assertIsInstance(cfg, dict)
        self.assertIn("save_path", cfg)
        self.assertIn("cooked_recipe_ids", cfg)

    def test_custom_config_path_nonexistent_file(self):
        """Verify get_config returns default structure when custom config file does not exist."""
        manager = ConfigManager(self.config_file)
        self.assertEqual(manager.config_path, self.config_file)
        cfg = manager.get_config()
        self.assertEqual(cfg, {"save_path": "", "cooked_recipe_ids": []})

    def test_custom_config_path_existing_file(self):
        """Verify get_config loads existing configuration correctly."""
        initial_data = {
            "save_path": "C:/Games/Eiyuden/UserData0.dat",
            "cooked_recipe_ids": [3001, 3005],
        }
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        manager = ConfigManager(self.config_file)
        cfg = manager.get_config()
        self.assertEqual(cfg["save_path"], "C:/Games/Eiyuden/UserData0.dat")
        self.assertEqual(cfg["cooked_recipe_ids"], [3001, 3005])

    def test_update_save_path_atomic(self):
        """Verify update_save_path atomically updates save_path on disk."""
        manager = ConfigManager(self.config_file)
        new_path = "C:/saves/UserData0.dat"
        manager.update_save_path(new_path)

        # In-memory check
        self.assertEqual(manager.get_config()["save_path"], new_path)

        # On-disk check
        with open(self.config_file, "r", encoding="utf-8") as f:
            saved_data = json.load(f)
        self.assertEqual(saved_data["save_path"], new_path)
        self.assertEqual(saved_data["cooked_recipe_ids"], [])

    def test_update_save_path_preserves_cooked_recipe_ids(self):
        """Verify updating save path preserves existing cooked_recipe_ids."""
        initial_data = {
            "save_path": "old_path.dat",
            "cooked_recipe_ids": [3002, 3003],
        }
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        manager = ConfigManager(self.config_file)
        manager.update_save_path("new_path.dat")

        cfg = manager.get_config()
        self.assertEqual(cfg["save_path"], "new_path.dat")
        self.assertEqual(cfg["cooked_recipe_ids"], [3002, 3003])

    def test_get_and_set_cooked_recipe_ids(self):
        """Verify get_cooked_recipe_ids and set_cooked_recipe_ids CRUD functionality."""
        manager = ConfigManager(self.config_file)
        self.assertEqual(manager.get_cooked_recipe_ids(), [])

        recipe_ids = [3000, 3001, 3010]
        manager.set_cooked_recipe_ids(recipe_ids)

        self.assertEqual(manager.get_cooked_recipe_ids(), recipe_ids)

        # Verify disk
        with open(self.config_file, "r", encoding="utf-8") as f:
            saved = json.load(f)
        self.assertEqual(saved["cooked_recipe_ids"], recipe_ids)

    def test_set_cooked_recipe_ids_preserves_save_path(self):
        """Verify setting cooked recipe IDs preserves existing save_path."""
        initial_data = {
            "save_path": "my_save.dat",
            "cooked_recipe_ids": [],
        }
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        manager = ConfigManager(self.config_file)
        manager.set_cooked_recipe_ids([3005])

        cfg = manager.get_config()
        self.assertEqual(cfg["save_path"], "my_save.dat")
        self.assertEqual(cfg["cooked_recipe_ids"], [3005])

    def test_atomic_write_creates_parent_directories_if_missing(self):
        """Verify atomic writing creates nested directories if they do not exist."""
        nested_config = Path(self.temp_dir) / "sub" / "dir" / "config.json"
        manager = ConfigManager(nested_config)
        manager.update_save_path("nested.dat")

        self.assertTrue(nested_config.exists())
        self.assertEqual(manager.get_config()["save_path"], "nested.dat")


class TestPlatformSaveDetector(unittest.TestCase):
    """Test suite for platform save detection routines."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.local_appdata = Path(self.temp_dir) / "AppData" / "Local"
        self.user_profile = Path(self.temp_dir)
        self.local_appdata.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_fallback_when_no_saves_exist(self):
        """Verify all detectors return None when no save files are found."""
        with patch.dict(
            os.environ,
            {
                "LOCALAPPDATA": str(self.local_appdata),
                "USERPROFILE": str(self.user_profile),
                "HOME": str(self.user_profile),
            },
            clear=True,
        ):
            self.assertIsNone(detect_steam_save_path())
            self.assertIsNone(detect_gog_save_path())
            self.assertIsNone(detect_gamepass_save_path())
            self.assertIsNone(find_any_save_file())

    def test_detect_steam_save_path_finds_newest_save(self):
        """Verify detect_steam_save_path finds the newest UserData*.dat and ignores metadata files."""
        steam_save_dir = (
            self.user_profile
            / "AppData"
            / "LocalLow"
            / "505 Games S_p_A"
            / "EiyudenChronicle"
            / "76561198000000000"
            / "SaveData"
        )
        steam_save_dir.mkdir(parents=True, exist_ok=True)

        save1 = steam_save_dir / "UserData0.dat"
        save2 = steam_save_dir / "UserData1.dat"
        meta1 = steam_save_dir / "userdatainfo.dat"
        meta2 = steam_save_dir / "systemdata.dat"

        save1.write_bytes(b"save_0_data")
        time.sleep(0.02)
        save2.write_bytes(b"save_1_data")
        time.sleep(0.02)
        meta1.write_bytes(b"metadata")
        meta2.write_bytes(b"systemdata")

        # Set older mtime on save1, newer on save2
        os.utime(save1, (1000, 1000))
        os.utime(save2, (2000, 2000))
        os.utime(meta1, (3000, 3000))
        os.utime(meta2, (4000, 4000))

        with patch.dict(
            os.environ,
            {
                "LOCALAPPDATA": str(self.local_appdata),
                "USERPROFILE": str(self.user_profile),
                "HOME": str(self.user_profile),
            },
            clear=True,
        ):
            detected = detect_steam_save_path()
            self.assertIsNotNone(detected)
            self.assertEqual(Path(detected).resolve(), save2.resolve())

    def test_detect_gog_save_path_saved_games(self):
        """Verify detect_gog_save_path finds save in Saved Games directory."""
        gog_save_dir = self.user_profile / "Saved Games" / "EiyudenChronicle"
        gog_save_dir.mkdir(parents=True, exist_ok=True)

        gog_save = gog_save_dir / "UserData0.dat"
        gog_save.write_bytes(b"gog_save_data")

        with patch.dict(
            os.environ,
            {
                "LOCALAPPDATA": str(self.local_appdata),
                "USERPROFILE": str(self.user_profile),
                "HOME": str(self.user_profile),
            },
            clear=True,
        ):
            detected = detect_gog_save_path()
            self.assertIsNotNone(detected)
            self.assertEqual(Path(detected).resolve(), gog_save.resolve())

    def test_detect_gog_save_path_locallow_direct(self):
        """Verify detect_gog_save_path finds save in LocalLow direct directory."""
        gog_dir = (
            self.user_profile
            / "AppData"
            / "LocalLow"
            / "505 Games S_p_A"
            / "EiyudenChronicle"
            / "SaveData"
        )
        gog_dir.mkdir(parents=True, exist_ok=True)

        gog_save = gog_dir / "UserData0.dat"
        gog_save.write_bytes(b"gog_locallow_save")

        with patch.dict(
            os.environ,
            {
                "LOCALAPPDATA": str(self.local_appdata),
                "USERPROFILE": str(self.user_profile),
                "HOME": str(self.user_profile),
            },
            clear=True,
        ):
            detected = detect_gog_save_path()
            self.assertIsNotNone(detected)
            self.assertEqual(Path(detected).resolve(), gog_save.resolve())

    def test_detect_gamepass_save_path(self):
        """Verify detect_gamepass_save_path finds save in Windows Packages directory."""
        pkg_dir = (
            self.local_appdata
            / "Packages"
            / "505GamesS.p.A.EiyudenChronicleHundredHeroes_8zh72qepkm2q0"
            / "SystemAppData"
            / "wgs"
        )
        pkg_dir.mkdir(parents=True, exist_ok=True)

        wgs_save = pkg_dir / "UserData0.dat"
        wgs_save.write_bytes(b"gamepass_save")

        with patch.dict(
            os.environ,
            {
                "LOCALAPPDATA": str(self.local_appdata),
                "USERPROFILE": str(self.user_profile),
                "HOME": str(self.user_profile),
            },
            clear=True,
        ):
            detected = detect_gamepass_save_path()
            self.assertIsNotNone(detected)
            self.assertEqual(Path(detected).resolve(), wgs_save.resolve())

    def test_find_any_save_file_precedence(self):
        """Verify find_any_save_file prioritizes Steam, then GOG, then GamePass."""
        steam_dir = (
            self.user_profile
            / "AppData"
            / "LocalLow"
            / "505 Games S_p_A"
            / "EiyudenChronicle"
            / "12345"
            / "SaveData"
        )
        steam_dir.mkdir(parents=True, exist_ok=True)
        steam_save = steam_dir / "UserData0.dat"
        steam_save.write_bytes(b"steam")

        gog_dir = self.user_profile / "Saved Games" / "EiyudenChronicle"
        gog_dir.mkdir(parents=True, exist_ok=True)
        gog_save = gog_dir / "UserData0.dat"
        gog_save.write_bytes(b"gog")

        gamepass_dir = self.local_appdata / "Packages" / "EiyudenChronicle"
        gamepass_dir.mkdir(parents=True, exist_ok=True)
        gamepass_save = gamepass_dir / "UserData0.dat"
        gamepass_save.write_bytes(b"gamepass")

        env = {
            "LOCALAPPDATA": str(self.local_appdata),
            "USERPROFILE": str(self.user_profile),
            "HOME": str(self.user_profile),
        }

        with patch.dict(os.environ, env, clear=True):
            # All 3 exist -> returns Steam
            self.assertEqual(Path(find_any_save_file()).resolve(), steam_save.resolve())

            # Remove Steam -> returns GOG
            steam_save.unlink()
            self.assertEqual(Path(find_any_save_file()).resolve(), gog_save.resolve())

            # Remove GOG -> returns GamePass
            gog_save.unlink()
            self.assertEqual(Path(find_any_save_file()).resolve(), gamepass_save.resolve())

            # Remove GamePass -> returns None
            gamepass_save.unlink()
            self.assertIsNone(find_any_save_file())


if __name__ == "__main__":
    unittest.main()
