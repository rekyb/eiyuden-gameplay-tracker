# Project Structure Refactoring Design Specification

- **Date**: 2026-09-28
- **Branch**: `refactor/project-structure`
- **Status**: Approved (Draft Spec)

---

## 1. Objective

Refactor and modularize the **Eiyuden Chronicle Gameplay Tracker** repository into a clean, modern Python package structure. This reorganization isolates core domain logic (crypto, save parsing, character/recipe models) and configuration management (settings persistence, platform detector), moves static database files into a dedicated `data/` directory, establishes a clean `tests/` hierarchy with synthetic fixtures, and removes all personal/real save files (`UserData0.dat`) from source control.

---

## 2. Directory Architecture

```text
eiyuden-gameplay-tracker/
├── config/
│   └── config.json                  # Runtime user settings (save_path, cooked_recipe_ids)
├── data/
│   ├── characters.json              # 121 recruitable heroes database
│   └── recipes.json                 # 93 restaurant recipes database
├── static/
│   ├── app.js                       # Frontend tracker application logic
│   ├── index.html                   # High-readability semantic HTML layout
│   └── style.css                    # Distraction-free CSS styles
├── src/
│   └── tracker/
│       ├── __init__.py              # Package root
│       ├── __main__.py              # Allows running `python -m src.tracker`
│       ├── server.py                # HTTP API routing & server lifecycle
│       ├── core/
│       │   ├── __init__.py          # Core package exports
│       │   ├── crypto.py            # TripleDES-CBC decryption & padding utilities
│       │   ├── save_reader.py       # Binary save parser & game state extractor
│       │   └── models.py            # JSON catalog loaders & lookup helpers
│       └── config/
│           ├── __init__.py          # Config package exports
│           ├── manager.py           # ConfigManager (reads/writes config/config.json)
│           └── detector.py          # Platform save auto-detector (Steam, GOG, Game Pass)
├── tests/
│   ├── __init__.py
│   ├── fixtures/
│   │   ├── __init__.py
│   │   └── generator.py             # In-memory synthetic encrypted save builder for tests
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── test_characters.py       # characters.json schema & integrity tests
│   │   ├── test_recipes.py          # recipes.json schema & integrity tests
│   │   ├── test_save_reader.py      # Core parser, crypto, and models unit tests
│   │   └── test_config.py           # ConfigManager & platform detector unit tests
│   ├── e2e/
│   │   ├── __init__.py
│   │   ├── test_server.py           # API server endpoints integration tests
│   │   ├── test_e2e.py              # Full save sync workflow tests
│   │   └── test_style.py            # CSS classes & static asset contract tests
│   └── frontend/
│       └── test_app.js              # Headless Node.js frontend tests
├── main.py                          # Primary Python CLI entry point (`python main.py --open`)
├── start_tracker.bat                # Windows one-click launcher
├── requirements.txt                 # Dependencies (`cryptography>=41.0.0`)
├── README.md                        # Documentation with updated paths & commands
└── .gitignore                       # Updated to exclude UserData*.dat, *.dat, config/*.local.json
```

---

## 3. Module Specifications & Responsibilities

### 3.1 `src/tracker/core/`
- **`crypto.py`**:
  - `decrypt_save_bytes(raw_bytes: bytes) -> bytes`: Decrypts TripleDES-CBC encrypted save data using PKCS7 unpadding.
  - `encrypt_save_dict(data_dict: dict) -> bytes`: Encrypts a JSON dictionary into TripleDES-CBC bytes (used by test fixtures and generator).
  - `is_valid_magic(decrypted_bytes: bytes) -> bool`: Verifies `UserData` / JSON formatting.
- **`save_reader.py`**:
  - `read_save_summary(save_path: str) -> dict`: Reads and decrypts file at `save_path` and extracts game summary (protagonist, playtime, gold, town level, recruited IDs, acquired recipe IDs).
  - `extract_save_data(decrypted_bytes: bytes) -> dict`: Parses decrypted payload.
- **`models.py`**:
  - `load_characters(data_dir: Path | None = None) -> list[dict]`: Loads `data/characters.json`.
  - `load_recipes(data_dir: Path | None = None) -> list[dict]`: Loads `data/recipes.json`.

### 3.2 `src/tracker/config/`
- **`manager.py`**:
  - `ConfigManager`: Class wrapping `config/config.json`.
  - Default config: `{"save_path": "", "cooked_recipe_ids": []}`.
  - Atomic writing via temporary file replacement to prevent corruptions.
  - Path normalization (resolving relative paths against the project root).
- **`detector.py`**:
  - `detect_steam_save_path() -> str | None`: Looks up `%LOCALAPPDATA%..\LocalLow\505 Games S_p_A\EiyudenChronicle\*\SaveData\UserData*.dat`.
  - `detect_gog_save_path() -> str | None`.
  - `detect_gamepass_save_path() -> str | None`.
  - `find_any_save_file() -> str | None`: Returns the first existing save found across supported platforms.

### 3.3 `src/tracker/server.py` & `main.py`
- **`server.py`**:
  - `TrackerHTTPRequestHandler`: Serves static assets from `static/`, handles API routes:
    - `GET /api/config`
    - `POST /api/config`
    - `GET /api/characters`
    - `GET /api/recipes`
    - `GET /api/recipes/cooked`
    - `POST /api/recipes/cooked`
    - `GET /api/save/status`
    - `POST /api/save/validate`
    - `POST /api/save/browse`
    - `POST /api/save/upload`
  - Runs with `ThreadingHTTPServer`.
- **`main.py`**:
  - CLI parser (`--port`, `--host`, `--open`, `--no-open`).
  - Calls `run_server(host, port, open_browser)`.

### 3.4 Test Fixture Strategy (No `UserData0.dat` in git)
- **`tests/fixtures/generator.py`**:
  - Utility function `create_synthetic_save(hero_ids: list[int] = None, recipe_item_ids: list[int] = None, **kwargs) -> bytes` that creates an authentic encrypted Eiyuden save buffer on the fly.
  - Eliminates dependence on real user saves in the repository root.
  - Any test needing a save file writes this synthetic buffer to a temporary file via `tempfile.NamedTemporaryFile`.

---

## 4. Migration & Cleanliness Checklist

1. Move `characters.json` and `recipes.json` into `data/`.
2. Move `config.json` into `config/` with empty default `"save_path": ""`.
3. Create `src/tracker/` with `core/` and `config/` submodules.
4. Create `main.py` at root; update `start_tracker.bat` to `python main.py --open`.
5. Remove root `server.py`, `save_reader.py`, and `UserData0.dat`.
6. Add `UserData*.dat` and `*.dat` to `.gitignore`.
7. Move and organize tests into `tests/unit/`, `tests/e2e/`, and `tests/frontend/`.
8. Update all import paths across Python code and test suites.
9. Verify all 59+ Python tests and 12 Node.js tests pass without errors.
10. Update `README.md` to reflect new layout and `main.py` entry point.
