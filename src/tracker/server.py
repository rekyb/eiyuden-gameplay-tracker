"""Eiyuden Chronicle Save Tracker HTTP API Server.

Provides a REST API for loading, decrypting, and backing up Eiyuden Chronicle
save files, serving character definitions, and hosting frontend static assets.
"""

import argparse
import email
import glob
import json
import mimetypes
import os
from pathlib import Path
import shutil
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional, Union

from src.tracker.config.detector import (
    detect_gamepass_save_path,
    detect_gog_save_path,
    detect_steam_save_path as detector_detect_steam,
    find_any_save_file,
)
from src.tracker.config.manager import ConfigManager
from src.tracker.core.models import load_characters, load_recipes
from src.tracker.core.save_reader import (
    decrypt_save,
    read_save_summary,
    validate_save_file as core_validate_save_file,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STATIC_DIR = PROJECT_ROOT / "static"
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"


def detect_save_path() -> Optional[str]:
    """Auto-detect the save file path for Eiyuden Chronicle across platforms.

    Searches standard directories for Steam, GOG, and PC Game Pass / Xbox app
    for save files matching UserData*.dat and returns the newest file path.

    Returns:
        The full path to the latest save file, or None if not found.
    """
    return find_any_save_file()


# Alias for backward compatibility
detect_steam_save_path = detector_detect_steam


def load_config(config_path: Optional[Union[str, Path]] = "config.json") -> Dict[str, Any]:
    """Load configuration from disk, falling back to defaults if not found.

    Args:
        config_path: Path to config JSON file.

    Returns:
        Configuration dictionary containing 'save_path'.
    """
    cm = ConfigManager(config_path)
    cfg = cm.get_config()
    if not cfg.get("save_path"):
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

            cfg["save_path"] = max(local_candidates, key=_safe_mtime_local)
        else:
            auto_path = find_any_save_file()
            if auto_path and os.path.isfile(auto_path):
                cfg["save_path"] = auto_path
            else:
                cfg["save_path"] = "UserData0.dat"
    return cfg


def save_config(config_data: Dict[str, Any], config_path: Optional[Union[str, Path]] = "config.json") -> None:
    """Save configuration dictionary to JSON file.

    Args:
        config_data: Dictionary containing configuration settings.
        config_path: Destination path for config.json.
    """
    cm = ConfigManager(config_path)
    cm.save_config(config_data)


def validate_save_file(filepath: Optional[Union[str, Path]]) -> Dict[str, Any]:
    """Validate whether the given path points to a valid Eiyuden Chronicle save file.

    Checks:
    1. Path is specified and file exists on disk.
    2. File can be decrypted using Eiyuden TripleDES key and IV.
    3. Decrypted data contains expected Eiyuden Chronicle structures (_unitData or UserData).

    Returns:
        dict: {
            "valid": bool,
            "exists": bool,
            "error": str | None,
            "summary": dict | None,
        }
    """
    if not filepath or not isinstance(filepath, (str, Path, os.PathLike)):
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
        save_data = decrypt_save(ciphertext)
    except Exception as exc:
        return {"valid": False, "exists": True, "error": "Not a valid Eiyuden Chronicle save file (decryption failed).", "summary": None}

    if not isinstance(save_data, dict) or ("_unitData" not in save_data and "UserData" not in save_data):
        return {"valid": False, "exists": True, "error": "File decrypted, but does not contain Eiyuden Chronicle save data.", "summary": None}

    summary = read_save_summary(clean_path)
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
        root.attributes("-topmost", True)
        filepath = filedialog.askopenfilename(
            parent=root,
            title="Select Eiyuden Chronicle Save File",
            initialdir=initial_dir if initial_dir and os.path.isdir(initial_dir) else os.getcwd(),
            filetypes=[("Save Files (*.dat)", "*.dat"), ("All Files (*.*)", "*.*")],
        )
        root.destroy()
        return filepath or ""
    except Exception as exc:
        print(f"Tkinter file picker error, attempting Windows fallback: {exc}")

    # 2. Windows fallback via PowerShell OpenFileDialog
    if sys.platform == "win32":
        try:
            import subprocess
            target_dir = initial_dir if initial_dir and os.path.isdir(initial_dir) else os.getcwd()
            safe_dir = target_dir.replace("'", "''")
            ps_script = (
                "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; "
                "$dialog = New-Object System.Windows.Forms.OpenFileDialog; "
                "$dialog.Title = 'Select Eiyuden Chronicle Save File'; "
                "$dialog.Filter = 'Save Files (*.dat)|*.dat|All Files (*.*)|*.*'; "
                f"$dialog.InitialDirectory = '{safe_dir}'; "
                "$dialog.TopMost = $true; "
                "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName }"
            )
            res = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
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
            cfg = self.server.config_manager.get_config()
            save_path = cfg.get("save_path", "")
            detected = find_any_save_file()
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
                "detected_steam_path": detector_detect_steam(),
            })
            return

        if path == "/api/characters":
            if self.server.characters_path is not None:
                if os.path.isfile(self.server.characters_path):
                    try:
                        with open(self.server.characters_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        self.send_json(data)
                        return
                    except Exception as exc:
                        self.send_json({"error": f"Failed reading characters: {exc}"}, status=500)
                        return
                else:
                    self.send_json([], status=200)
                    return
            try:
                data = load_characters()
                self.send_json(data)
                return
            except Exception as exc:
                self.send_json({"error": f"Failed reading characters: {exc}"}, status=500)
                return

        if path == "/api/recipes":
            if self.server.recipes_path is not None:
                if os.path.isfile(self.server.recipes_path):
                    try:
                        with open(self.server.recipes_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        self.send_json(data)
                        return
                    except Exception as exc:
                        self.send_json({"error": f"Failed reading recipes: {exc}"}, status=500)
                        return
                else:
                    self.send_json([], status=200)
                    return
            try:
                data = load_recipes()
                self.send_json(data)
                return
            except Exception as exc:
                self.send_json({"error": f"Failed reading recipes: {exc}"}, status=500)
                return

        if path == "/api/recipes/cooked":
            cooked = self.server.config_manager.get_cooked_recipe_ids()
            self.send_json({"cooked_ids": cooked})
            return

        if path == "/api/save/status":
            cfg = self.server.config_manager.get_config()
            save_path = cfg.get("save_path", "")
            if not save_path:
                detected = find_any_save_file()
                save_path = detected or "UserData0.dat"

            try:
                summary = read_save_summary(save_path)
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

            self.server.config_manager.update_save_path(new_save_path)

            detected = find_any_save_file()
            response_data = {
                "success": True,
                "config": {
                    "save_path": new_save_path,
                    "file_exists": val_result["exists"],
                    "valid_save": val_result["valid"],
                    "detected_save_path": detected,
                    "detected_steam_path": detector_detect_steam(),
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

            unique_sorted = sorted(list(set(cooked_ids)))
            self.server.config_manager.set_cooked_recipe_ids(unique_sorted)

            self.send_json({"success": True, "cooked_ids": unique_sorted})
            return

        if path == "/api/save/browse":
            cfg = self.server.config_manager.get_config()
            current_path = cfg.get("save_path", "")
            initial_dir = ""
            if current_path and os.path.isdir(os.path.dirname(current_path)):
                initial_dir = os.path.dirname(os.path.abspath(current_path))
            else:
                auto_path = find_any_save_file()
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

            self.server.config_manager.update_save_path(normalized)

            summary = read_save_summary(normalized)
            self.send_json({
                "success": True,
                "path": normalized,
                "summary": summary,
            })
            return

        if path == "/api/save/upload":
            content_type = self.headers.get("Content-Type", "")
            file_bytes = self.extract_file_bytes(content_type, body)

            if not file_bytes:
                self.send_json({"error": "Empty upload payload"}, status=400)
                return

            # Verify that uploaded data can be decrypted
            try:
                decrypt_save(file_bytes)
            except Exception as exc:
                self.send_json(
                    {"error": f"Invalid or unreadable save file data: {exc}"},
                    status=400,
                )
                return

            base_dir = os.path.dirname(os.path.abspath(str(self.server.config_manager.config_path)))
            uploads_dir = os.path.join(base_dir, "uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            saved_path = os.path.join(uploads_dir, "UserData0.dat")

            try:
                with open(saved_path, "wb") as f:
                    f.write(file_bytes)
            except Exception as exc:
                self.send_json({"error": f"Failed to save upload: {exc}"}, status=500)
                return

            self.server.config_manager.update_save_path(saved_path)

            summary = read_save_summary(saved_path)
            self.send_json({
                "success": True,
                "save_path": saved_path,
                "summary": summary,
            })
            return

        self.send_json({"error": "Not Found"}, status=404)


class SaveTrackerServer(ThreadingHTTPServer):
    """Threading HTTP Server holding application paths and configuration."""

    def __init__(
        self,
        server_address,
        RequestHandlerClass,
        static_dir: Optional[Union[str, Path]] = None,
        config_manager: Optional[ConfigManager] = None,
        config_path: Optional[Union[str, Path]] = None,
        characters_path: Optional[Union[str, Path]] = None,
        recipes_path: Optional[Union[str, Path]] = None,
    ):
        super().__init__(server_address, RequestHandlerClass)
        if config_manager is not None:
            self.config_manager = config_manager
        elif config_path is not None:
            self.config_manager = ConfigManager(config_path)
        else:
            self.config_manager = ConfigManager()

        self.config_path = str(self.config_manager.config_path)
        self.static_dir = str(static_dir) if static_dir is not None else str(DEFAULT_STATIC_DIR)
        self.characters_path = str(characters_path) if characters_path is not None else None
        self.recipes_path = str(recipes_path) if recipes_path is not None else None


def create_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    static_dir: Optional[Union[str, Path]] = None,
    config_manager: Optional[ConfigManager] = None,
    config_path: Optional[Union[str, Path]] = None,
    characters_path: Optional[Union[str, Path]] = None,
    recipes_path: Optional[Union[str, Path]] = None,
) -> SaveTrackerServer:
    """Create a configured SaveTrackerServer instance.

    Args:
        host: Host IP or hostname to bind.
        port: Port number (0 for OS-assigned dynamic port).
        static_dir: Directory containing frontend static assets.
        config_manager: ConfigManager instance.
        config_path: Optional path to config JSON file (legacy/convenience).
        characters_path: Optional path to characters JSON file (legacy/convenience).
        recipes_path: Optional path to recipes JSON file (legacy/convenience).

    Returns:
        SaveTrackerServer instance.
    """
    return SaveTrackerServer(
        (host, port),
        SaveTrackerRequestHandler,
        static_dir=static_dir,
        config_manager=config_manager,
        config_path=config_path,
        characters_path=characters_path,
        recipes_path=recipes_path,
    )


def run_server(
    host: str = "127.0.0.1",
    port: int = 8000,
    open_browser: bool = False,
    static_dir: Optional[Union[str, Path]] = None,
    config_manager: Optional[ConfigManager] = None,
) -> None:
    """Run the Save Tracker HTTP API server until interrupted.

    Args:
        host: Host to bind.
        port: Port to listen on.
        open_browser: Whether to open default browser on start.
        static_dir: Optional path to frontend static directory.
        config_manager: Optional ConfigManager instance.
    """
    server = create_server(
        host=host,
        port=port,
        static_dir=static_dir,
        config_manager=config_manager,
    )

    actual_port = server.server_address[1]
    url = f"http://{host}:{actual_port}"
    print(f"Eiyuden Save Tracker server running at {url}")
    print(f"Loaded config: {server.config_manager.config_path}")

    if open_browser:
        import webbrowser
        import threading
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.shutdown()
        server.server_close()


def main() -> None:
    """Main CLI entrypoint for running the server."""
    parser = argparse.ArgumentParser(description="Eiyuden Chronicle Save Tracker API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--config", default=None, help="Path to config.json (default: config/config.json)")
    parser.add_argument("--characters", default=None, help="Path to characters.json (default: data/characters.json)")
    parser.add_argument("--recipes", default=None, help="Path to recipes.json (default: data/recipes.json)")
    parser.add_argument("--static", default=None, help="Path to static assets directory (default: static)")
    parser.add_argument("--open", action="store_true", help="Automatically open browser on launch")

    args = parser.parse_args()
    cm = ConfigManager(args.config) if args.config else None
    run_server(
        host=args.host,
        port=args.port,
        open_browser=args.open,
        static_dir=args.static,
        config_manager=cm,
    )


if __name__ == "__main__":
    main()
