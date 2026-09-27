# Eiyuden Chronicle Save Tracker & Recruitment Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimalist, high-readability local HTML tracker for *Eiyuden Chronicle: Hundred Heroes* that parses and syncs the save file (`UserData0.dat`), lists all 121 recruitable characters with location and how-to-recruit instructions, provides save backups, and supports flexible save file selection.

**Architecture:** A lightweight Python server (`server.py`) serving a vanilla HTML/CSS/JS frontend (`static/index.html`, `static/style.css`, `static/app.js`) and REST APIs (`/api/save/status`, `/api/save/backup`, `/api/config`). Data for 121 heroes is stored in `characters.json` and active save path in `config.json`.

**Tech Stack:** Python 3.10+ (stdlib `http.server`, `json`, `shutil`), `cryptography` (TripleDES-CBC), Vanilla HTML5, CSS3, modern JavaScript (ES6+).

## Global Constraints
- Design must be minimal, distraction-free, and maximize readability and information density (clean contrast, no fancy/cluttered icons).
- Save decryption uses TripleDES-CBC PKCS7 padding with fixed game key and IV.
- Save reading must be strictly non-destructive; backups must be timestamped and immutable in `backups/`.
- Device portability: Save file path must be configurable and persisted in `config.json` and browser `localStorage`, with support for browsing/uploading.

---

### Task 1: Complete 121 Character Database (`characters.json`)

**Files:**
- Create: `characters.json`
- Test: `test_characters.py`

**Interfaces:**
- Produces: JSON array of 121 character objects:
  ```json
  [
    {
      "id": 10,
      "name": "Nowa",
      "role": "Battle",
      "location": "Starting Character",
      "howToRecruit": "Joins automatically at the start of the game.",
      "missable": false
    }
  ]
  ```

- [ ] **Step 1: Write validation test for characters database**
  Create `test_characters.py` that verifies:
  - Exactly 121 entries exist.
  - Every entry has `id` (int), `name` (str), `role` (str: Battle/Support/Attendant), `location` (str), `howToRecruit` (str), and `missable` (bool).
  - All IDs match known unit IDs from the game.

- [ ] **Step 2: Run test to verify it fails**
  Run: `python -m unittest test_characters.py`
  Expected: FAIL (`FileNotFoundError: characters.json`)

- [ ] **Step 3: Generate and write `characters.json`**
  Build the curated 121-character database combining unit names, roles, and verified recruitment locations and steps.

- [ ] **Step 4: Run test to verify it passes**
  Run: `python -m unittest test_characters.py`
  Expected: PASS (all 121 characters validated)

- [ ] **Step 5: Commit**
  ```bash
  git add characters.json test_characters.py
  git commit -m "feat: add complete 121 characters recruitment database"
  ```

---

### Task 2: Save File Decryption & Parser Core (`save_reader.py`)

**Files:**
- Create: `save_reader.py`
- Test: `test_save_reader.py`

**Interfaces:**
- Consumes: `UserData0.dat` (binary)
- Produces:
  - `decrypt_save(data: bytes) -> dict`: Decrypts 3DES-CBC payload to Python dict.
  - `read_save_summary(filepath: str) -> dict`: Returns `{ "recruited_ids": list[int], "playtime_seconds": float, "money": int, "town_level": int, "population": int, "protagonist": str, "save_timestamp": int }`
  - `backup_save(filepath: str, backup_dir: str = "backups") -> str`: Creates timestamped copy in `backup_dir` and returns destination path.

- [ ] **Step 1: Write unit tests for save reader and backup**
  Create `test_save_reader.py` testing:
  - Decrypting `UserData0.dat` yields 87 recruited IDs.
  - `read_save_summary` returns correct Baqua (`113,753`), town level (`3`), population (`8,260`).
  - `backup_save` creates a new timestamped file in `backups/` without modifying the original.

- [ ] **Step 2: Run test to verify it fails**
  Run: `python -m unittest test_save_reader.py`
  Expected: FAIL (`ModuleNotFoundError: No module named 'save_reader'`)

- [ ] **Step 3: Implement `save_reader.py`**
  Write TripleDES decryption, JSON loading, summary extraction, and timestamped backup creation.

- [ ] **Step 4: Run test to verify it passes**
  Run: `python -m unittest test_save_reader.py`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add save_reader.py test_save_reader.py
  git commit -m "feat: implement save file decryption and backup helper"
  ```

---

### Task 3: Backend API Server (`server.py`) & Config (`config.json`)

**Files:**
- Create: `config.json`
- Create: `server.py`
- Test: `test_server.py`

**Interfaces:**
- Endpoints:
  - `GET /api/config`: `{"save_path": str, "file_exists": bool}`
  - `POST /api/config`: Body `{"save_path": str}` -> updates `config.json`
  - `GET /api/characters`: Serves `characters.json`
  - `GET /api/save/status`: Calls `read_save_summary`, returns save summary + recruited status
  - `POST /api/save/backup`: Triggers `backup_save` and returns `{ "backup_file": str }`
  - `POST /api/save/upload`: Accepts file upload directly from browser, saves as local `UserData0.dat`

- [ ] **Step 1: Write integration tests for API endpoints**
  Create `test_server.py` using `urllib.request` or `unittest` to test endpoints against a test server instance.

- [ ] **Step 2: Run test to verify it fails**
  Run: `python -m unittest test_server.py`
  Expected: FAIL

- [ ] **Step 3: Implement `server.py` and initial `config.json`**
  Build HTTP request handler handling static files (`static/`) and `/api/*` endpoints.

- [ ] **Step 4: Run test to verify it passes**
  Run: `python -m unittest test_server.py`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add config.json server.py test_server.py
  git commit -m "feat: implement backend API server and config persistence"
  ```

---

### Task 4: Minimalist UI — HTML Structure & Layout (`static/index.html`)

**Files:**
- Create: `static/index.html`

**Interfaces:**
- Semantic structure:
  - Header: App Title, Save Path & Status indicator, Playthrough Overview (Protagonist, Playtime, Baqua, HQ Level/Pop).
  - Progress bar: `Recruited: X / 121 (Y%)`.
  - Actions toolbar: `[Sync Now]`, `[Backup Save]`, `[Configure Path]`.
  - Filter bar: Filter tabs (`All`, `Recruited`, `Missing`, `Missable`), Search box.
  - Character Table/Grid: Clean table layout with columns: Status, Hero, Role, Location, How to Recruit.
  - Path Config Modal / Drawer: Input for save file path + Browse/File Upload input.

- [ ] **Step 1: Write `static/index.html` with clean semantic HTML**
  Ensure accessibility, clear labels, and container IDs for JavaScript rendering.

- [ ] **Step 2: Verify HTML validity and structure**
  Check that all DOM elements referenced by the specification exist.

- [ ] **Step 3: Commit**
  ```bash
  git add static/index.html
  git commit -m "feat: create minimalist semantic index.html"
  ```

---

### Task 5: Minimalist Styling for Maximum Readability (`static/style.css`)

**Files:**
- Create: `static/style.css`

**Interfaces:**
- Minimal, high-contrast, distraction-free styles:
  - Clean system font stack (Inter, -apple-system, Segoe UI, Roboto, sans-serif).
  - Neutral dark/clean palette with subtle borders and clear state colors (subtle green for recruited, neutral amber for missing).
  - High information density table with responsive wrapping.
  - Sticky search & filter toolbar.
  - Clean modal/dialog for save file configuration.

- [ ] **Step 1: Write `static/style.css`**
  Implement typography, compact table layout, badges, progress bar, and modal styling.

- [ ] **Step 2: Verify styling in browser**
  Check contrast, table readability, and responsive behavior.

- [ ] **Step 3: Commit**
  ```bash
  git add static/style.css
  git commit -m "feat: add minimalist high-readability CSS styling"
  ```

---

### Task 6: Interactive Tracker Logic (`static/app.js`)

**Files:**
- Create: `static/app.js`

**Interfaces:**
- Consumes:
  - `GET /api/characters`
  - `GET /api/save/status`
  - `POST /api/save/backup`
  - `POST /api/config`
  - `POST /api/save/upload`
- State:
  - `characters`: list of 121 characters
  - `recruitedIds`: Set of recruited IDs from save
  - `activeFilter`: 'all' | 'recruited' | 'missing' | 'missable'
  - `searchQuery`: string
- Functions:
  - `loadData()`: fetches characters & save status, calculates progress.
  - `renderTable()`: renders rows matching search and filter.
  - `triggerBackup()`: calls `/api/save/backup` and displays toast alert.
  - `updateSavePath(newPath)`: saves to backend and localStorage, re-syncs.
  - `handleFileUpload(file)`: uploads selected save file to backend.

- [ ] **Step 1: Implement `static/app.js`**
  Write modular, dependency-free JS code.

- [ ] **Step 2: Verify all interactions**
  - Instant live search filtering rows in under 10ms.
  - Filter tabs updating counts and active rows.
  - Backup button triggering backup and showing notification.
  - Save path change and drag-and-drop file upload.

- [ ] **Step 3: Commit**
  ```bash
  git add static/app.js
  git commit -m "feat: implement tracker frontend state, filtering, and sync"
  ```

---

### Task 7: End-to-End Verification & Verification Run

**Files:**
- Test: All tests + manual browser verification

- [ ] **Step 1: Run all unit & integration tests**
  ```bash
  python -m unittest discover -s . -p "test_*.py" -v
  ```
  Expected: All tests PASS.

- [ ] **Step 2: Launch `server.py` and verify against live `UserData0.dat`**
  Verify in browser:
  - Recruited count matches 87 / 121 (71.9%).
  - Search for "Nowa", "Leene", "Hakugin" works properly.
  - "Backup Save" creates a valid backup file in `backups/`.
  - Configurable save path works.

- [ ] **Step 3: Commit final documentation / polish**
  ```bash
  git add .
  git commit -m "chore: final verification and cleanup"
  ```
