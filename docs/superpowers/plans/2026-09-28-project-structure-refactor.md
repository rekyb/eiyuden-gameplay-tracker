# Project Structure Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularize and tidy up the Eiyuden Chronicle Save Tracker codebase into a modern `src/` layout with isolated `core` and `config` packages, move static databases to `data/`, reorganize tests into `tests/unit/` and `tests/e2e/`, remove `UserData0.dat` with synthetic test fixtures, and provide a single root launcher `main.py`.

**Architecture:** Split functionality across `src/tracker/core/` (crypto, models, save reader) and `src/tracker/config/` (ConfigManager, platform detector). Data files reside in `data/`, configuration in `config/`, and all server handlers in `src/tracker/server.py`. Tests use an in-memory synthetic encrypted save builder fixture to eliminate reliance on committed game saves.

**Tech Stack:** Python 3.8+ (http.server, cryptography, json, pathlib, tempfile, unittest), Node.js (test runner for frontend logic).

## Global Constraints

- Python dependencies limited strictly to `cryptography>=41.0.0` and Python standard library.
- Zero breaking changes to API endpoints: `/api/config`, `/api/characters`, `/api/recipes`, `/api/recipes/cooked`, `/api/save/status`, `/api/save/validate`, `/api/save/browse`, `/api/save/upload`.
- Do NOT track or commit any user game save files (`UserData*.dat`, `*.dat`).
- `start_tracker.bat` must remain at the root level and run `python main.py --open`.
- All tests must pass cleanly at every task gate.

---

### Task 1: Scaffolding, Data Move & Save File Removal

**Files:**
- Create: `config/config.json`
- Create: `src/tracker/__init__.py`
- Create: `src/tracker/core/__init__.py`
- Create: `src/tracker/config/__init__.py`
- Move: `characters.json` -> `data/characters.json`
- Move: `recipes.json` -> `data/recipes.json`
- Modify: `.gitignore`
- Delete: `UserData0.dat`

**Interfaces:**
- Produces: `data/characters.json`, `data/recipes.json`, `config/config.json` with `{"save_path": "", "cooked_recipe_ids": []}`.

- [ ] **Step 1: Create directories and move data files**

Run commands in powershell:
```powershell
New-Item -ItemType Directory -Force -Path src/tracker/core, src/tracker/config, data, config, tests/fixtures, tests/unit, tests/e2e, tests/frontend
git mv characters.json data/characters.json
git mv recipes.json data/recipes.json
```

- [ ] **Step 2: Create default config/config.json**

Write `config/config.json`:
```json
{
  "save_path": "",
  "cooked_recipe_ids": []
}
```
Remove old root `config.json` from git:
```powershell
git rm config.json
```

- [ ] **Step 3: Untrack and remove UserData0.dat & update .gitignore**

Append to `.gitignore`:
```
UserData*.dat
*.dat
config/*.local.json
```
Untrack UserData0.dat:
```powershell
git rm -f UserData0.dat
```

- [ ] **Step 4: Create package init files**

Create empty `__init__.py` in:
- `src/tracker/__init__.py`
- `src/tracker/core/__init__.py`
- `src/tracker/config/__init__.py`
- `tests/__init__.py`
- `tests/fixtures/__init__.py`
- `tests/unit/__init__.py`
- `tests/e2e/__init__.py`

- [ ] **Step 5: Verify git status and commit**

```powershell
git add .gitignore config/config.json data/ src/ tests/
git commit -m "refactor: scaffold directory structure and move data catalogs"
```

---

### Task 2: Core Crypto & Synthetic Save Fixture Generator

**Files:**
- Create: `src/tracker/core/crypto.py`
- Create: `tests/fixtures/generator.py`
- Create: `tests/unit/test_crypto.py`

**Interfaces:**
- Produces:
  - `crypto.decrypt_save_bytes(encrypted_bytes: bytes) -> bytes`
  - `crypto.encrypt_save_dict(data: dict) -> bytes`
  - `crypto.is_valid_magic(decrypted_bytes: bytes) -> bool`
  - `generator.create_synthetic_save(hero_ids: list[int] = None, recipe_item_ids: list[int] = None, **kwargs) -> bytes`

- [ ] **Step 1: Write failing crypto & fixture test**

Create `tests/unit/test_crypto.py`:
```python
import unittest
from src.tracker.core.crypto import decrypt_save_bytes, encrypt_save_dict, is_valid_magic
from tests.fixtures.generator import create_synthetic_save

class TestCryptoAndGenerator(unittest.TestCase):
    def test_encrypt_and_decrypt_roundtrip(self):
        sample = {"hero_id": 100, "money": 99999, "playtime": 3600.0}
        encrypted = encrypt_save_dict(sample)
        self.assertIsInstance(encrypted, bytes)
        decrypted = decrypt_save_bytes(encrypted)
        self.assertTrue(is_valid_magic(decrypted))
        import json
        payload = json.loads(decrypted.decode("utf-8"))
        self.assertEqual(payload["money"], 99999)

    def test_synthetic_save_generator(self):
        enc = create_synthetic_save(hero_ids=[1, 2, 3], recipe_item_ids=[8001, 8002])
        dec = decrypt_save_bytes(enc)
        self.assertTrue(is_valid_magic(dec))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_crypto.py`
Expected: FAIL (ModuleNotFoundError: No module named 'src.tracker.core.crypto')

- [ ] **Step 3: Implement core crypto and synthetic fixture generator**

Create `src/tracker/core/crypto.py`:
```python
import json
from cryptography.hazmat.primitives.ciphers import Cipher, modes
from cryptography.hazmat.primitives import padding

try:
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
except ImportError:
    from cryptography.hazmat.primitives.ciphers.algorithms import TripleDES

KEY = bytes.fromhex("b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870")
IV = bytes.fromhex("2f6e9693c9779505")

def decrypt_save_bytes(data: bytes) -> bytes:
    if len(data) % 8 != 0:
        raise ValueError("Encrypted data length must be a multiple of 8 bytes")
    cipher = Cipher(TripleDES(KEY), modes.CBC(IV))
    decryptor = cipher.decryptor()
    padded = decryptor.update(data) + decryptor.finalize()
    unpadder = padding.PKCS7(64).unpadder()
    return unpadder.update(padded) + unpadder.finalize()

def encrypt_save_dict(data: dict) -> bytes:
    raw_json = json.dumps(data).encode("utf-8")
    padder = padding.PKCS7(64).padder()
    padded = padder.update(raw_json) + padder.finalize()
    cipher = Cipher(TripleDES(KEY), modes.CBC(IV))
    encryptor = cipher.encryptor()
    return encryptor.update(padded) + encryptor.finalize()

def is_valid_magic(data: bytes) -> bool:
    try:
        head = data[:300].decode("utf-8", errors="replace")
        return "UserData" in head or ('"id"' in head and '"name"' in head)
    except Exception:
        return False
```

Create `tests/fixtures/generator.py`:
```python
from src.tracker.core.crypto import encrypt_save_dict

def create_synthetic_save(hero_ids=None, recipe_item_ids=None, playtime=12345.0, money=50000, town_level=2, population=45):
    if hero_ids is None:
        hero_ids = [1, 2, 3, 4, 5]
    if recipe_item_ids is None:
        recipe_item_ids = [8001, 8002, 8003]

    unit_data_list = [{"UnitId": uid, "Level": 20, "Exp": 1000} for uid in hero_ids]
    inventory_items = [{"ItemId": iid, "Count": 1} for iid in recipe_item_ids]

    payload = {
        "UserData": {
            "PlayTime": playtime,
            "Money": money,
            "TownLevel": town_level,
            "Population": population,
            "Protagonist": 1,
            "UnitData": unit_data_list,
            "Inventory": inventory_items,
            "Restaurant": {
                "MenuList": [3000, 3001]
            }
        }
    }
    return encrypt_save_dict(payload)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_crypto.py`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/tracker/core/crypto.py tests/fixtures/generator.py tests/unit/test_crypto.py
git commit -m "feat: implement core crypto and synthetic save fixture generator"
```

---

### Task 3: Core Models, Save Reader & Domain Unit Tests

**Files:**
- Create: `src/tracker/core/models.py`
- Create: `src/tracker/core/save_reader.py`
- Move & update: `test_characters.py` -> `tests/unit/test_characters.py`
- Move & update: `test_recipes.py` -> `tests/unit/test_recipes.py`
- Move & update: `test_save_reader.py` -> `tests/unit/test_save_reader.py`

**Interfaces:**
- Produces:
  - `models.load_characters(data_dir=None) -> list[dict]`
  - `models.load_recipes(data_dir=None) -> list[dict]`
  - `save_reader.read_save_summary(save_path: str) -> dict`
  - `save_reader.validate_save_file(save_path: str) -> bool`

- [ ] **Step 1: Implement `src/tracker/core/models.py`**

```python
import json
from pathlib import Path
from typing import List, Dict, Any

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

def load_characters(data_dir: Path = None) -> List[Dict[str, Any]]:
    path = (data_dir or DATA_DIR) / "characters.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_recipes(data_dir: Path = None) -> List[Dict[str, Any]]:
    path = (data_dir or DATA_DIR) / "recipes.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
```

- [ ] **Step 2: Implement `src/tracker/core/save_reader.py`**

Refactor `save_reader.py` using `crypto.py`:
- Use `decrypt_save_bytes`
- Parse summary: `protagonist`, `playtime`, `money`, `town_level`, `population`, `recruited_ids`, `acquired_recipe_ids`.
- Provide `validate_save_file(save_path: str) -> bool`.

- [ ] **Step 3: Move unit tests and update paths to use `tests/fixtures/generator.py` and `data/`**

- Move `test_characters.py` -> `tests/unit/test_characters.py`: points to `data/characters.json` or `load_characters()`.
- Move `test_recipes.py` -> `tests/unit/test_recipes.py`: points to `data/recipes.json` or `load_recipes()`.
- Move `test_save_reader.py` -> `tests/unit/test_save_reader.py`: uses `create_synthetic_save()` written to a `tempfile` instead of root `UserData0.dat`.
- Remove old root `save_reader.py` and `test_characters.py`, `test_recipes.py`, `test_save_reader.py`.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `python -m unittest discover -s tests/unit -p "test_*.py" -v`
Expected: All unit tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/tracker/core/ tests/unit/
git commit -m "feat: migrate core models, save reader, and unit test suites"
```

---

### Task 4: Configuration Manager & Platform Save Detector

**Files:**
- Create: `src/tracker/config/manager.py`
- Create: `src/tracker/config/detector.py`
- Create: `tests/unit/test_config.py`

**Interfaces:**
- Produces:
  - `ConfigManager.get_config() -> dict`
  - `ConfigManager.update_save_path(new_path: str)`
  - `ConfigManager.get_cooked_recipe_ids() -> list[int]`
  - `ConfigManager.set_cooked_recipe_ids(ids: list[int])`
  - `detector.detect_steam_save_path() -> str | None`
  - `detector.detect_gog_save_path() -> str | None`
  - `detector.detect_gamepass_save_path() -> str | None`
  - `detector.find_any_save_file() -> str | None`

- [ ] **Step 1: Write test for ConfigManager and detector**

Create `tests/unit/test_config.py`:
- Test loading default config from `config/config.json`.
- Test atomic updates of save path and cooked recipe IDs.
- Test detector fallback behavior when Steam/GOG dirs are not present.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_config.py`
Expected: FAIL

- [ ] **Step 3: Implement `manager.py` and `detector.py`**

- `manager.py`: Atomic write using temp file + `os.replace`, resolves `config/config.json` relative to project root.
- `detector.py`: Scans `%USERPROFILE%\AppData\LocalLow\505 Games S_p_A\EiyudenChronicle\*\SaveData\UserData*.dat`, GOG, Game Pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_config.py`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/tracker/config/ tests/unit/test_config.py
git commit -m "feat: implement config manager and multi-platform detector"
```

---

### Task 5: HTTP API Server & Integration Tests Migration

**Files:**
- Create: `src/tracker/server.py`
- Create: `src/tracker/__main__.py`
- Move & update: `test_server.py` -> `tests/e2e/test_server.py`
- Move & update: `test_e2e.py` -> `tests/e2e/test_e2e.py`
- Delete: root `server.py`

**Interfaces:**
- Produces:
  - `server.create_server(host, port, static_dir, config_manager)`
  - `server.run_server(host, port, open_browser)`
  - `python -m src.tracker` runs the server

- [ ] **Step 1: Move and adapt `server.py` to `src/tracker/server.py`**

- Wire imports to `src.tracker.core.models`, `src.tracker.core.save_reader`, `src.tracker.config.manager`, `src.tracker.config.detector`.
- Static files served from `static/` at project root.
- Create `src/tracker/__main__.py`:
  ```python
  from src.tracker.server import main
  if __name__ == "__main__":
      main()
  ```

- [ ] **Step 2: Update integration tests in `tests/e2e/`**

- Move `test_server.py` -> `tests/e2e/test_server.py` and `test_e2e.py` -> `tests/e2e/test_e2e.py`.
- Update tests to use `create_synthetic_save()` instead of `UserData0.dat`.
- Remove old root `server.py`, `test_server.py`, `test_e2e.py`.

- [ ] **Step 3: Run integration tests to verify they pass**

Run: `python -m unittest discover -s tests/e2e -p "test_*.py" -v`
Expected: All server and E2E tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src/tracker/server.py src/tracker/__main__.py tests/e2e/
git commit -m "feat: migrate HTTP API server to src.tracker package with updated tests"
```

---

### Task 6: Root Entry Point, Bat Launcher & Frontend Test Migration

**Files:**
- Create: `main.py`
- Modify: `start_tracker.bat`
- Move & update: `test_style.py` -> `tests/e2e/test_style.py`
- Move & update: `test_app.js` -> `tests/frontend/test_app.js`
- Delete: root `test_style.py`, `test_app.js`

- [ ] **Step 1: Create `main.py`**

```python
"""
Eiyuden Chronicle Save Tracker - Main Launcher
"""
from src.tracker.server import main

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Update `start_tracker.bat`**

Ensure `start_tracker.bat` launches `python main.py --open`.

- [ ] **Step 3: Move `test_style.py` and `test_app.js`**

- Move `test_style.py` -> `tests/e2e/test_style.py` (adjust static path lookup to root `static/style.css`).
- Move `test_app.js` -> `tests/frontend/test_app.js` (adjust import to `../../static/app.js`).

- [ ] **Step 4: Run Python and Node tests to verify**

Run:
```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/frontend/test_app.js
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```powershell
git add main.py start_tracker.bat tests/
git commit -m "feat: add main.py launcher and reorganize frontend & style tests"
```

---

### Task 7: Documentation, Cleanup & Full Verification

**Files:**
- Modify: `README.md`
- Verify: full git status, no leftover untracked root files

- [ ] **Step 1: Update README.md**

Update all commands and architecture notes:
- Running: `python main.py --open` or `start_tracker.bat`
- Running tests:
  - `python -m unittest discover -s tests -p "test_*.py" -v`
  - `node --test tests/frontend/test_app.js`
- Document project structure overview.

- [ ] **Step 2: Run full test suite end-to-end**

Run:
```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node --test tests/frontend/test_app.js
```
Confirm: 100% pass, 0 failures.

- [ ] **Step 3: Commit and push**

```powershell
git add README.md
git commit -m "docs: update README for modularized project structure and main.py entry point"
```
