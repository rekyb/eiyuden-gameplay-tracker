"""Integration and unit tests for Eiyuden Save Tracker HTTP Server."""

import io
import os
import json
import shutil
import tempfile
import threading
import urllib.request
import urllib.error
import unittest

import server


class TestServerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a temp directory for isolated testing
        cls.temp_dir = tempfile.mkdtemp(prefix="eiyuden_server_test_")
        cls.config_path = os.path.join(cls.temp_dir, "config.json")
        cls.static_dir = os.path.join(cls.temp_dir, "static")
        os.makedirs(cls.static_dir, exist_ok=True)
        with open(os.path.join(cls.static_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write("<!DOCTYPE html><html><body>Eiyuden Tracker Test</body></html>")

        # Copy characters.json and UserData0.dat to temp_dir for test fixtures
        cls.characters_path = os.path.abspath("characters.json")
        cls.real_save_path = os.path.abspath("UserData0.dat")
        cls.test_save_copy = os.path.join(cls.temp_dir, "UserData0.dat")
        shutil.copy2(cls.real_save_path, cls.test_save_copy)

        # Write initial test config
        with open(cls.config_path, "w", encoding="utf-8") as f:
            json.dump({"save_path": cls.test_save_copy}, f)

        # Start test server on dynamic port (port 0)
        cls.httpd = server.create_server(
            host="127.0.0.1",
            port=0,
            config_path=cls.config_path,
            characters_path=cls.characters_path,
            static_dir=cls.static_dir,
        )
        cls.server_port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def _url(self, path: str) -> str:
        return f"http://127.0.0.1:{self.server_port}{path}"

    def test_get_config(self):
        """GET /api/config returns 200 with save_path, file_exists, and detected_steam_path."""
        req = urllib.request.Request(self._url("/api/config"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("application/json", resp.headers.get("Content-Type", ""))
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("save_path", data)
            self.assertIn("file_exists", data)
            self.assertIn("detected_steam_path", data)
            self.assertTrue(data["file_exists"])
            self.assertEqual(data["save_path"], self.test_save_copy)

    def test_post_config_valid(self):
        """POST /api/config updates the save_path and persists to config.json."""
        new_path = os.path.join(self.temp_dir, "custom_save.dat")
        payload = json.dumps({"save_path": new_path}).encode("utf-8")
        req = urllib.request.Request(
            self._url("/api/config"),
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            self.assertEqual(data["config"]["save_path"], new_path)

        # Verify persisted on disk
        with open(self.config_path, "r", encoding="utf-8") as f:
            saved = json.load(f)
            self.assertEqual(saved["save_path"], new_path)

        # Restore config back to test_save_copy
        restore_payload = json.dumps({"save_path": self.test_save_copy}).encode("utf-8")
        restore_req = urllib.request.Request(
            self._url("/api/config"),
            data=restore_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(restore_req) as resp:
            self.assertEqual(resp.status, 200)

    def test_post_config_invalid_body(self):
        """POST /api/config rejects malformed or invalid body."""
        # Non-JSON body
        req = urllib.request.Request(
            self._url("/api/config"),
            data=b"not a json",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 400)
        ctx.exception.close()

        # Missing save_path
        req2 = urllib.request.Request(
            self._url("/api/config"),
            data=b'{"other_key": 123}',
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx2:
            urllib.request.urlopen(req2)
        self.assertEqual(ctx2.exception.code, 400)
        ctx2.exception.close()

    def test_get_characters(self):
        """GET /api/characters returns 121 character records."""
        req = urllib.request.Request(self._url("/api/characters"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIsInstance(data, list)
            self.assertEqual(len(data), 121)
            # Verify structure of first character (Nowa)
            nowa = next((c for c in data if c["id"] == 10), None)
            self.assertIsNotNone(nowa)
            self.assertEqual(nowa["name"], "Nowa")
            self.assertEqual(nowa["role"], "Battle")

    def test_get_save_status_valid(self):
        """GET /api/save/status parses configured save and returns summary."""
        req = urllib.request.Request(self._url("/api/save/status"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("file_exists"))
            self.assertIn("recruited_ids", data)
            self.assertGreater(len(data["recruited_ids"]), 0)
            self.assertEqual(data["protagonist"], "Nowa")
            self.assertGreater(data["money"], 0)
            self.assertIn("playtime_formatted", data)

    def test_get_save_status_missing_file(self):
        """GET /api/save/status returns file_exists=False when file does not exist."""
        # Point to missing file
        missing_file = os.path.join(self.temp_dir, "nonexistent.dat")
        req_post = urllib.request.Request(
            self._url("/api/config"),
            data=json.dumps({"save_path": missing_file}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req_post) as resp:
            self.assertEqual(resp.status, 200)

        req_status = urllib.request.Request(self._url("/api/save/status"), method="GET")
        with urllib.request.urlopen(req_status) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertFalse(data.get("file_exists"))
            self.assertEqual(data.get("recruited_ids"), [])

        # Reset config back
        with urllib.request.urlopen(
            urllib.request.Request(
                self._url("/api/config"),
                data=json.dumps({"save_path": self.test_save_copy}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
        ) as resp:
            self.assertEqual(resp.status, 200)

    def test_post_save_backup(self):
        """POST /api/save/backup creates backup file and returns path."""
        req = urllib.request.Request(
            self._url("/api/save/backup"),
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            self.assertIn("backup_file", data)
            backup_file = data["backup_file"]
            self.assertTrue(os.path.isfile(backup_file))

    def test_post_save_backup_missing_file(self):
        """POST /api/save/backup returns 404 if save file does not exist."""
        missing_file = os.path.join(self.temp_dir, "nonexistent_backup.dat")
        with urllib.request.urlopen(
            urllib.request.Request(
                self._url("/api/config"),
                data=json.dumps({"save_path": missing_file}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
        ) as resp:
            self.assertEqual(resp.status, 200)

        req = urllib.request.Request(
            self._url("/api/save/backup"),
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 404)
        ctx.exception.close()

        # Reset config
        with urllib.request.urlopen(
            urllib.request.Request(
                self._url("/api/config"),
                data=json.dumps({"save_path": self.test_save_copy}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
        ) as resp:
            self.assertEqual(resp.status, 200)

    def test_post_save_browse_selected(self):
        """POST /api/save/browse updates config and returns summary when file selected."""
        from unittest import mock
        with mock.patch("server.open_native_file_browser", return_value=self.test_save_copy):
            req = urllib.request.Request(
                self._url("/api/save/browse"),
                data=b"{}",
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertTrue(data.get("success"))
                self.assertEqual(data.get("path"), os.path.normpath(self.test_save_copy))
                self.assertIn("summary", data)
                self.assertGreater(len(data["summary"]["recruited_ids"]), 0)

    def test_post_save_browse_cancelled(self):
        """POST /api/save/browse returns cancelled=True when dialog dismissed."""
        from unittest import mock
        with mock.patch("server.open_native_file_browser", return_value=""):
            req = urllib.request.Request(
                self._url("/api/save/browse"),
                data=b"{}",
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode("utf-8"))
                self.assertFalse(data.get("success"))
                self.assertTrue(data.get("cancelled"))

    def test_post_save_upload_raw_bytes(self):
        """POST /api/save/upload accepts raw binary data, saves, and returns summary."""
        with open(self.real_save_path, "rb") as f:
            raw_bytes = f.read()

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
            self.assertIn("summary", data)
            self.assertGreater(len(data["summary"]["recruited_ids"]), 0)

    def test_post_save_upload_multipart(self):
        """POST /api/save/upload accepts multipart/form-data upload."""
        with open(self.real_save_path, "rb") as f:
            raw_bytes = f.read()

        boundary = "---------------------------BoundaryTest123"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="UserData0.dat"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8") + raw_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

        req = urllib.request.Request(
            self._url("/api/save/upload"),
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            self.assertGreater(len(data["summary"]["recruited_ids"]), 0)

    def test_post_save_upload_invalid(self):
        """POST /api/save/upload rejects invalid/corrupted save bytes."""
        req = urllib.request.Request(
            self._url("/api/save/upload"),
            data=b"invalid save data random bytes",
            headers={"Content-Type": "application/octet-stream"},
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 400)
        ctx.exception.close()

    def test_get_root_static(self):
        """GET / serves index.html."""
        req = urllib.request.Request(self._url("/"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            content = resp.read().decode("utf-8")
            self.assertIn("Eiyuden Tracker Test", content)

    def test_get_static_subpath(self):
        """GET /static/sample.txt serves static asset."""
        subfile = os.path.join(self.static_dir, "sample.txt")
        with open(subfile, "w", encoding="utf-8") as f:
            f.write("sample static file")

        req = urllib.request.Request(self._url("/static/sample.txt"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            content = resp.read().decode("utf-8")
            self.assertEqual(content, "sample static file")

    def test_get_static_root_direct(self):
        """GET /style.css or /app.js directly from root serves from static_dir."""
        subfile = os.path.join(self.static_dir, "root_sample.css")
        with open(subfile, "w", encoding="utf-8") as f:
            f.write("body { color: red; }")

        req = urllib.request.Request(self._url("/root_sample.css"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            content = resp.read().decode("utf-8")
            self.assertEqual(content, "body { color: red; }")

    def test_get_not_found(self):
        """GET /api/nonexistent returns 404."""
        req = urllib.request.Request(self._url("/api/nonexistent"), method="GET")
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 404)
        ctx.exception.close()

    def test_options_cors(self):
        """OPTIONS request returns 200/204 with CORS headers."""
        req = urllib.request.Request(self._url("/api/config"), method="OPTIONS")
        with urllib.request.urlopen(req) as resp:
            self.assertIn(resp.status, (200, 204))
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")


class TestConfigHelpers(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, "config.json")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_config_default_when_missing(self):
        cfg = server.load_config(self.config_path)
        self.assertEqual(cfg, {"save_path": "UserData0.dat"})

    def test_save_and_load_config(self):
        server.save_config({"save_path": "custom/path.dat"}, self.config_path)
        cfg = server.load_config(self.config_path)
        self.assertEqual(cfg["save_path"], "custom/path.dat")

    def test_detect_steam_save_path(self):
        # Should return str if path exists or None if not, without raising
        result = server.detect_steam_save_path()
        self.assertTrue(result is None or isinstance(result, str))

    def test_detect_steam_save_path_picks_newest_slot_and_ignores_metadata(self):
        """detect_steam_save_path should find UserData1.dat, UserData999.dat, and ignore UserDataInfo.dat."""
        from unittest import mock
        mock_files = [
            os.path.join(self.temp_dir, "UserData1.dat"),
            os.path.join(self.temp_dir, "UserData2.dat"),
            os.path.join(self.temp_dir, "UserDataInfo.dat"),
            os.path.join(self.temp_dir, "SystemData.dat"),
        ]
        for idx, f in enumerate(mock_files):
            with open(f, "w") as fp:
                fp.write("test")
            # Set increasing mtime
            os.utime(f, (1000 + idx * 10, 1000 + idx * 10))

        with mock.patch("glob.glob", return_value=mock_files):
            detected = server.detect_steam_save_path()
            # UserData2.dat has higher mtime than UserData1.dat, while UserDataInfo is ignored
            self.assertEqual(detected, os.path.abspath(mock_files[1]))

    def test_load_config_picks_latest_slot(self):
        """load_config selects newest UserData*.dat when config.json is absent."""
        orig_cwd = os.getcwd()
        try:
            os.chdir(self.temp_dir)
            f0 = os.path.join(self.temp_dir, "UserData0.dat")
            f3 = os.path.join(self.temp_dir, "UserData3.dat")
            with open(f0, "w") as fp:
                fp.write("0")
            with open(f3, "w") as fp:
                fp.write("3")
            os.utime(f0, (1000, 1000))
            os.utime(f3, (2000, 2000))

            cfg = server.load_config("nonexistent_config.json")
            self.assertEqual(cfg.get("save_path"), "UserData3.dat")
        finally:
            os.chdir(orig_cwd)


if __name__ == "__main__":
    unittest.main()
