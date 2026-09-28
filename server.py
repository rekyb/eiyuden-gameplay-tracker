"""Eiyuden Chronicle Save Tracker HTTP API Server.

Provides a REST API for loading, decrypting, and backing up Eiyuden Chronicle
save files, serving character definitions, and hosting frontend static assets.
"""

import os
import sys
import glob
import json
import email
import shutil
import argparse
import mimetypes
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, Optional

import save_reader


def detect_save_path() -> Optional[str]:
    """Auto-detect the save file path for Eiyuden Chronicle across platforms.

    Searches standard directories for Steam, GOG, and PC Game Pass / Xbox app
    for save files matching UserData*.dat (e.g. UserData0.dat, UserData1.dat, etc.)
    and returns the path to the most recently modified save file.

    Returns:
        The full path to the latest save file, or None if not found.
    """
    patterns = []

    # Windows LocalLow path (Steam & GOG standard Unity paths)
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        locallow = os.path.join(os.path.dirname(local_app_data), "LocalLow")
        # Steam & profile-based stores
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "UserData*.dat",
            )
        )
        # GOG / direct without user-ID subfolder
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                locallow,
                "505 Games S_p_A",
                "EiyudenChronicle",
                "UserData*.dat",
            )
        )
        # Windows Xbox / PC Game Pass Packages folder
        packages_dir = os.path.join(local_app_data, "Packages")
        if os.path.isdir(packages_dir):
            patterns.append(
                os.path.join(
                    packages_dir,
                    "*EiyudenChronicle*",
                    "**",
                    "UserData*.dat",
                )
            )

    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        # Steam & GOG in user profile AppData/LocalLow
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "*",
                "SaveData",
                "UserData*.dat",
            )
        )
        patterns.append(
            os.path.join(
                user_profile,
                "AppData",
                "LocalLow",
                "505 Games S_p_A",
                "EiyudenChronicle",
                "SaveData",
                "UserData*.dat",
            )
        )
        # Saved Games directory (GOG / DRM-free)
        patterns.append(
            os.path.join(
                user_profile,
                "Saved Games",
                "EiyudenChronicle",
                "**",
                "UserData*.dat",
            )
        )

    # Linux Proton / Steam Deck path
    home = os.path.expanduser("~")
    patterns.append(
        os.path.join(
            home,
            ".steam",
            "steam",
            "steamapps",
            "compatdata",
            "1658280",
            "pfx",
            "drive_c",
            "users",
            "steamuser",
            "AppData",
            "LocalLow",
            "505 Games S_p_A",
            "EiyudenChronicle",
            "*",
            "SaveData",
            "UserData*.dat",
        )
    )
    # GOG / Heroic / Lutris on Linux
    patterns.append(
        os.path.join(
            home,
            "Games",
            "*",
            "drive_c",
            "users",
            "*",
            "AppData",
            "LocalLow",
            "505 Games S_p_A",
            "EiyudenChronicle",
            "**",
            "UserData*.dat",
        )
    )

    found_files = []
    for pat in patterns:
        try:
            matches = glob.glob(pat, recursive=True)
        except (OSError, Exception):
            continue
        for match in matches:
            try:
                if os.path.isfile(match):
                    base_lower = os.path.basename(match).lower()
                    # Exclude metadata/system files that are not player saves
                    if base_lower in ("userdatainfo.dat", "systemdata.dat"):
                        continue
                    found_files.append(os.path.abspath(match))
            except (OSError, Exception):
                continue

    if found_files:
        def _safe_mtime(f: str) -> float:
            try:
                return os.path.getmtime(f)
            except OSError:
                return 0.0

        # Return the most recently modified save file across slots
        return max(found_files, key=_safe_mtime)

    return None


# Alias for backward compatibility
detect_steam_save_path = detect_save_path


def load_config(config_path: str = "config.json") -> Dict[str, Any]:
    """Load configuration from disk, falling back to defaults if not found.

    Args:
        config_path: Path to config JSON file.

    Returns:
        Configuration dictionary containing 'save_path'.
    """
    if os.path.isfile(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "save_path" in data and data["save_path"]:
                    return data
        except Exception:
            pass

    # Fallback: check current directory for any UserData*.dat (newest first)
    local_candidates = []
    try:
        for f in glob.glob("UserData*.dat"):
            if os.path.basename(f).lower() not in ("userdatainfo.dat", "systemdata.dat"):
                local_candidates.append(f)
    except (OSError, Exception):
        pass

    if local_candidates:
        def _safe_mtime_local(f: str) -> float:
            try:
                return os.path.getmtime(f)
            except OSError:
                return 0.0

        return {"save_path": max(local_candidates, key=_safe_mtime_local)}

    # Next check auto-detected platform save path
    auto_path = detect_save_path()
    if auto_path and os.path.isfile(auto_path):
        return {"save_path": auto_path}

    return {"save_path": "UserData0.dat"}


def save_config(config_data: Dict[str, Any], config_path: str = "config.json") -> None:
    """Save configuration dictionary to JSON file.

    Args:
        config_data: Dictionary containing configuration settings.
        config_path: Destination path for config.json.
    """
    dest_dir = os.path.dirname(os.path.abspath(config_path))
    if dest_dir:
        os.makedirs(dest_dir, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)


def validate_save_file(filepath: Optional[str]) -> Dict[str, Any]:
    """Validate whether the given path points to a valid Eiyuden Chronicle save file.

    Checks:
    1. Path is specified and file exists on disk.
    2. File can be decrypted using Eiyuden TripleDES key and IV.
    3. Decrypted data contains expected Eiyuden Chronicle structures (_unitData).

    Returns:
        dict: {
            "valid": bool,
            "exists": bool,
            "error": str | None,
            "summary": dict | None,
        }
    """
    if not filepath or not isinstance(filepath, (str, os.PathLike)):
        return {"valid": False, "exists": False, "error": "No save file path provided.", "summary": None}

    clean_path = str(filepath).strip()
    if not clean_path:
        return {"valid": False, "exists": False, "error": "Save file path is empty.", "summary": None}

    try:
        if not os.path.isfile(clean_path):
            return {"valid": False, "exists": False, "error": f"File does not exist: {clean_path}", "summary": None}
    except Exception as exc:
        return {"valid": False, "exists": False, "error": f"Invalid path: {exc}", "summary": None}

    try:
        with open(clean_path, "rb") as f:
            ciphertext = f.read()
    except OSError as exc:
        return {"valid": False, "exists": True, "error": f"Cannot read file: {exc}", "summary": None}

    if len(ciphertext) == 0:
        return {"valid": False, "exists": True, "error": "Save file is empty (0 bytes).", "summary": None}

    try:
        save_data = save_reader.decrypt_save(ciphertext)
    except Exception as exc:
        return {"valid": False, "exists": True, "error": "Not a valid Eiyuden Chronicle save file (decryption failed).", "summary": None}

    if not isinstance(save_data, dict) or "_unitData" not in save_data:
        return {"valid": False, "exists": True, "error": "File decrypted, but does not contain Eiyuden Chronicle save data.", "summary": None}

    summary = save_reader.read_save_summary(clean_path)
    return {
        "valid": True,
        "exists": True,
        "error": None,
        "summary": summary,
    }



def open_native_file_browser(initial_dir: str = "") -> str:
    """Open native OS file picker and return selected file path, or empty string if cancelled."""
    # 1. Try tkinter
    try:
        import tkinter
        from tkinter import filedialog
        root = tkinter.Tk()
        root.withdraw()
        root.lift()
        root.attributes("-topmost", True)
        root.focus_force()
        filepath = filedialog.askopenfilename(
            parent=root,
            title="Select Eiyuden Chronicle Save File",
            initialdir=initial_dir if initial_dir and os.path.isdir(initial_dir) else os.getcwd(),
            filetypes=[("Save Files (*.dat)", "*.dat"), ("All Files (*.*)", "*.*")],
        )
        root.destroy()
        if filepath:
            return filepath
    except Exception as exc:
        print(f"Tkinter file picker error, attempting Windows fallback: {exc}")

    # 2. Windows fallback via PowerShell OpenFileDialog
    if sys.platform == "win32":
        try:
            import subprocess
            target_dir = initial_dir if initial_dir and os.path.isdir(initial_dir) else os.getcwd()
            safe_dir = target_dir.replace("'", "''")
            ps_script = (
                "Add-Type -AssemblyName System.Windows.Forms; "
                "$form = New-Object System.Windows.Forms.Form; "
                "$form.TopMost = $true; "
                "$dialog = New-Object System.Windows.Forms.OpenFileDialog; "
                "$dialog.Title = 'Select Eiyuden Chronicle Save File'; "
                "$dialog.Filter = 'Save Files (*.dat)|*.dat|All Files (*.*)|*.*'; "
                f"$dialog.InitialDirectory = '{safe_dir}'; "
                "if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($dialog.FileName) }"
            )
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=120,
            )
            return res.stdout.strip()
        except Exception as exc:
            print(f"PowerShell file picker error: {exc}")

    return ""


class SaveTrackerRequestHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for Eiyuden Save Tracker API and static assets."""

    server: "SaveTrackerServer"

    def end_headers(self) -> None:
        """Inject standard CORS headers into all HTTP responses."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.end_headers()

    def send_json(self, data: Any, status: int = 200) -> None:
        """Send JSON response with UTF-8 encoding."""
        encoded = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def extract_file_bytes(self, content_type: str, body: bytes) -> bytes:
        """Extract binary file data from multipart/form-data or raw request body."""
        if "multipart/form-data" in content_type:
            header_prefix = f"Content-Type: {content_type}\r\n\r\n".encode("utf-8")
            msg = email.message_from_bytes(header_prefix + body)
            for part in msg.walk():
                if part.get_filename() or part.get_content_disposition() == "form-data":
                    payload = part.get_payload(decode=True)
                    if payload:
                        return payload
                elif part.get_content_type() == "application/octet-stream":
                    payload = part.get_payload(decode=True)
                    if payload:
                        return payload
            for part in msg.walk():
                payload = part.get_payload(decode=True)
                if payload:
                    return payload
        return body

    def serve_static(self, rel_path: str) -> None:
        """Serve a static file from static_dir, with directory traversal protection."""
        if not rel_path or rel_path == "/":
            rel_path = "index.html"
        elif rel_path.startswith("/"):
            rel_path = rel_path.lstrip("/")

        static_root = os.path.abspath(self.server.static_dir)
        target_path = os.path.abspath(os.path.join(static_root, rel_path))

        try:
            common = os.path.commonpath([static_root, target_path])
            if common != static_root:
                self.send_json({"error": "Forbidden"}, status=403)
                return
        except Exception:
            self.send_json({"error": "Forbidden"}, status=403)
            return

        if os.path.isfile(target_path):
            mime, _ = mimetypes.guess_type(target_path)
            if mime is None:
                mime = "application/octet-stream"
            with open(target_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        elif rel_path == "index.html":
            # Fallback stub HTML if static directory is empty/missing
            stub = (
                "<!DOCTYPE html>\n"
                "<html>\n"
                "<head><meta charset='utf-8'><title>Eiyuden Save Tracker</title></head>\n"
                "<body><h1>Eiyuden Save Tracker</h1><p>API server is running.</p></body>\n"
                "</html>"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(stub)))
            self.end_headers()
            self.wfile.write(stub)
        else:
            self.send_json({"error": "Not Found"}, status=404)

    def do_GET(self) -> None:
        """Handle GET requests for API endpoints and static assets."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/config":
            cfg = load_config(self.server.config_path)
            save_path = cfg.get("save_path", "UserData0.dat")
            detected = detect_save_path()
            file_exists = False
            try:
                if save_path and os.path.isfile(save_path):
                    file_exists = True
            except Exception:
                file_exists = False

            self.send_json({
                "save_path": save_path or "UserData0.dat",
                "file_exists": file_exists,
                "detected_save_path": detected,
                "detected_steam_path": detected,
            })
            return

        if path == "/api/characters":
            if os.path.isfile(self.server.characters_path):
                try:
                    with open(self.server.characters_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.send_json(data)
                    return
                except Exception as exc:
                    self.send_json({"error": f"Failed reading characters.json: {exc}"}, status=500)
                    return
            self.send_json([], status=200)
            return

        if path == "/api/recipes":
            if os.path.isfile(self.server.recipes_path):
                try:
                    with open(self.server.recipes_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.send_json(data)
                    return
                except Exception as exc:
                    self.send_json({"error": f"Failed reading recipes.json: {exc}"}, status=500)
                    return
            self.send_json([], status=200)
            return

        if path == "/api/recipes/cooked":
            cfg = load_config(self.server.config_path)
            cooked = cfg.get("cooked_recipe_ids", [])
            self.send_json({"cooked_ids": cooked if isinstance(cooked, list) else []})
            return

        if path == "/api/save/status":
            cfg = load_config(self.server.config_path)
            save_path = cfg.get("save_path", "UserData0.dat")
            try:
                summary = save_reader.read_save_summary(save_path)
                self.send_json(summary, status=200)
            except Exception as exc:
                self.send_json({
                    "file_exists": False,
                    "error": str(exc),
                    "recruited_ids": [],
                    "acquired_recipe_ids": [],
                    "acquired_recipe_count": 0,
                    "playtime_seconds": 0.0,
                    "playtime_formatted": "0h 0m 0s",
                    "money": 0,
                    "town_level": 0,
                    "population": 0,
                    "protagonist_id": 0,
                    "protagonist": "",
                    "save_timestamp": None,
                }, status=200)
            return

        if path in ("/", "/index.html"):
            self.serve_static("index.html")
            return

        if path.startswith("/static/"):
            rel = path[len("/static/"):]
            self.serve_static(rel)
            return

        # Check if requested path directly matches a file in static_dir (e.g. /style.css, /app.js)
        clean_rel = path.lstrip("/")
        candidate = os.path.join(self.server.static_dir, clean_rel)
        if clean_rel and os.path.isfile(candidate):
            self.serve_static(clean_rel)
            return

        self.send_json({"error": "Not Found"}, status=404)

    def do_POST(self) -> None:
        """Handle POST requests for API endpoints."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len > 0 else b""

        if path == "/api/save/validate":
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_json({"error": "Invalid JSON body", "valid": False, "exists": False}, status=400)
                return

            if not isinstance(payload, dict) or not payload.get("save_path"):
                self.send_json({"error": "Missing 'save_path' in payload", "valid": False, "exists": False}, status=400)
                return

            result = validate_save_file(payload["save_path"])
            self.send_json(result, status=200)
            return

        if path == "/api/config":
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_json({"error": "Invalid JSON body"}, status=400)
                return

            if not isinstance(payload, dict) or not payload.get("save_path") or not isinstance(payload["save_path"], str):
                self.send_json({"error": "Missing or invalid 'save_path'"}, status=400)
                return

            new_save_path = payload["save_path"].strip()
            if not new_save_path:
                self.send_json({"error": "Missing or invalid 'save_path'"}, status=400)
                return

            val_result = validate_save_file(new_save_path)
            # If file exists on disk but is NOT a valid Eiyuden save file, reject unless force is true
            if val_result["exists"] and not val_result["valid"] and not payload.get("force"):
                self.send_json({
                    "error": val_result["error"] or "Not a valid Eiyuden Chronicle save file",
                    "valid": False,
                    "exists": True,
                }, status=400)
                return

            cfg = load_config(self.server.config_path)
            cfg["save_path"] = new_save_path
            save_config(cfg, self.server.config_path)

            detected = detect_save_path()
            response_data = {
                "success": True,
                "config": {
                    "save_path": new_save_path,
                    "file_exists": val_result["exists"],
                    "valid_save": val_result["valid"],
                    "detected_save_path": detected,
                    "detected_steam_path": detected,
                },
            }
            if not val_result["exists"]:
                response_data["warning"] = f"Save file not found at: {new_save_path}"
            self.send_json(response_data)
            return

        if path == "/api/recipes/cooked":
            try:
                payload = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_json({"error": "Invalid JSON body"}, status=400)
                return

            if not isinstance(payload, dict) or "cooked_ids" not in payload:
                self.send_json({"error": "Missing 'cooked_ids' in payload"}, status=400)
                return

            cooked_ids = payload["cooked_ids"]
            if not isinstance(cooked_ids, list) or not all(isinstance(x, int) for x in cooked_ids):
                self.send_json({"error": "'cooked_ids' must be a list of integers"}, status=400)
                return

            cfg = load_config(self.server.config_path)
            cfg["cooked_recipe_ids"] = sorted(list(set(cooked_ids)))
            save_config(cfg, self.server.config_path)

            self.send_json({"success": True, "cooked_ids": cfg["cooked_recipe_ids"]})
            return

        if path == "/api/save/browse":
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                payload = {}

            current_path = payload.get("current_path", "").strip() if isinstance(payload, dict) else ""
            if not current_path:
                cfg = load_config(self.server.config_path)
                current_path = cfg.get("save_path", "")

            initial_dir = ""
            if current_path and os.path.isdir(os.path.dirname(current_path)):
                initial_dir = os.path.dirname(os.path.abspath(current_path))
            else:
                auto_path = detect_save_path()
                if auto_path and os.path.isfile(auto_path):
                    initial_dir = os.path.dirname(auto_path)

            selected_path = open_native_file_browser(initial_dir)
            if not selected_path:
                self.send_json({"success": False, "cancelled": True})
                return

            normalized = os.path.normpath(selected_path)
            val_result = validate_save_file(normalized)
            if not val_result["valid"]:
                self.send_json({
                    "success": False,
                    "error": val_result["error"] or "Selected file is not a valid Eiyuden Chronicle save file",
                    "path": normalized,
                }, status=400)
                return

            cfg["save_path"] = normalized
            save_config(cfg, self.server.config_path)

            summary = save_reader.read_save_summary(normalized)
            self.send_json({
                "success": True,
                "path": normalized,
                "summary": summary,
            })
            return

        if path == "/api/save/backup":
            cfg = load_config(self.server.config_path)
            save_path = cfg.get("save_path", "UserData0.dat")

            file_exists = False
            try:
                if save_path and os.path.isfile(save_path):
                    file_exists = True
            except Exception:
                file_exists = False

            if not file_exists:
                self.send_json(
                    {"error": f"Save file does not exist at '{save_path}'"},
                    status=404,
                )
                return

            try:
                base_dir = os.path.dirname(os.path.abspath(self.server.config_path))
                backup_dir = os.path.join(base_dir, "backups")
                dest = save_reader.backup_save(save_path, backup_dir=backup_dir)
                self.send_json({"success": True, "backup_file": dest})
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=500)
            return

        if path == "/api/save/upload":
            content_type = self.headers.get("Content-Type", "")
            file_bytes = self.extract_file_bytes(content_type, body)

            if not file_bytes:
                self.send_json({"error": "Empty upload payload"}, status=400)
                return

            # Verify that uploaded data can be decrypted
            try:
                save_reader.decrypt_save(file_bytes)
            except Exception as exc:
                self.send_json(
                    {"error": f"Invalid or unreadable save file data: {exc}"},
                    status=400,
                )
                return

            base_dir = os.path.dirname(os.path.abspath(self.server.config_path))
            uploads_dir = os.path.join(base_dir, "uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            saved_path = os.path.join(uploads_dir, "UserData0.dat")

            try:
                with open(saved_path, "wb") as f:
                    f.write(file_bytes)
            except Exception as exc:
                self.send_json({"error": f"Failed to save upload: {exc}"}, status=500)
                return

            cfg = load_config(self.server.config_path)
            cfg["save_path"] = saved_path
            save_config(cfg, self.server.config_path)

            summary = save_reader.read_save_summary(saved_path)
            self.send_json({
                "success": True,
                "save_path": saved_path,
                "summary": summary,
            })
            return

        self.send_json({"error": "Not Found"}, status=404)


class SaveTrackerServer(ThreadingHTTPServer):
    """Threading HTTP Server holding application paths."""

    def __init__(
        self,
        server_address,
        RequestHandlerClass,
        config_path: str = "config.json",
        characters_path: str = "characters.json",
        recipes_path: str = "recipes.json",
        static_dir: str = "static",
    ):
        super().__init__(server_address, RequestHandlerClass)
        self.config_path = config_path
        self.characters_path = characters_path
        self.recipes_path = recipes_path
        self.static_dir = static_dir


def create_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    config_path: str = "config.json",
    characters_path: str = "characters.json",
    recipes_path: str = "recipes.json",
    static_dir: str = "static",
) -> SaveTrackerServer:
    """Create a configured SaveTrackerServer instance."""
    return SaveTrackerServer(
        (host, port),
        SaveTrackerRequestHandler,
        config_path=config_path,
        characters_path=characters_path,
        recipes_path=recipes_path,
        static_dir=static_dir,
    )


def main() -> None:
    """Main CLI entrypoint for running the server."""
    parser = argparse.ArgumentParser(description="Eiyuden Chronicle Save Tracker API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--config", default="config.json", help="Path to config.json (default: config.json)")
    parser.add_argument("--characters", default="characters.json", help="Path to characters.json (default: characters.json)")
    parser.add_argument("--recipes", default="recipes.json", help="Path to recipes.json (default: recipes.json)")
    parser.add_argument("--static", default="static", help="Path to static assets directory (default: static)")
    parser.add_argument("--open", action="store_true", help="Automatically open browser on launch")

    args = parser.parse_args()
    server = create_server(
        host=args.host,
        port=args.port,
        config_path=args.config,
        characters_path=args.characters,
        recipes_path=args.recipes,
        static_dir=args.static,
    )

    actual_port = server.server_address[1]
    url = f"http://{args.host}:{actual_port}"
    print(f"Eiyuden Save Tracker server running at {url}")
    print(f"Loaded config: {args.config}")

    if args.open:
        import webbrowser, threading
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
