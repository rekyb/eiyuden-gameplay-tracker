# Eiyuden Chronicle: Hundred Heroes — Save Tracker & Recruitment Guide Design

## 1. Overview & Goals
The goal of this tool is to provide a clean, lightweight, and device-portable HTML dashboard to track playthrough progress for *Eiyuden Chronicle: Hundred Heroes*.

In this initial phase, the tool focuses on:
1. **Recruitment Tracking**: Presenting all 121 recruitable characters, their locations, roles, and instructions on how to recruit them.
2. **Save File Synchronization**: Reading and decrypting `UserData0.dat` (TripleDES-CBC) to automatically detect which characters are already recruited vs. missing.
3. **Flexible Save Configuration**: Allowing the user to select or browse the save file on any machine, saving the chosen path to `config.json` (and browser storage) for persistence across sessions, while also supporting direct file upload/drag-and-drop.
4. **Failsafe / Backup Management**: Enabling one-click timestamped backups of the save file before any operations.

---

## 2. Architecture & File Structure

```
eiyuden-save-edit/
├── server.py              # Lightweight Python HTTP server & API endpoints
├── config.json            # Persisted configuration (e.g. active save file path)
├── characters.json        # Database of 121 characters with recruitment guides
├── UserData0.dat          # Game save file (TripleDES encrypted)
├── backups/               # Directory storing timestamped save backups
│   └── UserData0_bak_YYYYMMDD_HHMMSS.dat
├── static/
│   ├── index.html         # Responsive dashboard UI
│   ├── style.css          # Modern dark/light themed styling
│   └── app.js             # Client-side state, filters, search, and API calls
└── docs/
    └── superpowers/specs/ # Specifications and plans
```

---

## 3. Core Components

### 3.1 Backend & Cryptography (`server.py`)
* Built with Python standard library (`http.server`, `json`, `os`, `shutil`) and `cryptography` (for TripleDES decryption).
* **Cryptographic parameters**:
  * Algorithm: TripleDES in CBC mode.
  * Key: `b3ba76ead29507bad9e68bab87b6e920fe5193bdce92a870`
  * IV: `2f6e9693c9779505`
  * Padding: PKCS7 (64-bit / 8-byte block size).
* **API Endpoints**:
  * `GET /api/config`: Returns the current configuration (configured save path, last sync status).
  * `POST /api/config`: Updates the save file path in `config.json`.
  * `GET /api/save/status`: Reads and decrypts the configured save file, returning:
    * Save metadata: Playtime, Baqua, Headquarters Level, Population, Save timestamp.
    * Recruited unit IDs: Set of integer IDs found in `_unitData._units`.
    * Active protagonist and current party.
  * `POST /api/save/upload`: Accepts direct file upload of a save file from the browser, saving to disk or updating the active path.
  * `POST /api/save/backup`: Creates a timestamped copy in the `backups/` directory and returns the backup filename.
  * `GET /api/characters`: Serves `characters.json`.

### 3.2 Data Layer (`characters.json`)
A curated database covering all 121 heroes:
* `id` (int): Unit ID matching game internals (e.g., 10 for Nowa, 610 for Iugo, 200 for Hakugin).
* `name` (string): Hero name.
* `role` (string): "Battle", "Support", or "Attendant".
* `location` (string): Specific town, dungeon, or fortress area where the character is found.
* `howToRecruit` (string): Step-by-step instructions, prerequisite story missions, required items, duels, or mini-games.
* `missable` (bool): True if the character has strict timing or story cutoff points (e.g., Leene).

### 3.3 Frontend Dashboard (`index.html`, `style.css`, `app.js`)
* **Header Bar**:
  * Game summary card: Protagonist, Playtime, Baqua, Fortress Level & Population.
  * Progress Meter: Visual bar showing `X / 121 Recruited (Y%)`.
  * Controls:
    * `[Sync with Save]`: Re-queries the backend and updates recruitment checkboxes.
    * `[Backup Save]`: Triggers a timestamped backup with instant toast confirmation.
    * `[Save Location]`: Displays current path with a modal/input to browse or enter a new path or drag-and-drop a file.
* **Filter & Search Controls**:
  * Filter tabs: **All (121)**, **Recruited (X)**, **Missing (Y)**, **Missable Only**.
  * Role filters: All, Battle, Support, Attendant.
  * Search input: Instant text filtering by character name or location.
* **Character Grid / Cards**:
  * Card design with:
    * Character name and role badge.
    * Recruited status indicator (Green checkmark vs. Amber missing icon).
    * Location badge.
    * Collapsible/expandable recruitment instructions.

---

## 4. Device Portability & Flexible Save Handling
* Users may switch between PC, Steam Deck, or multiple installations.
* `config.json` stores the default path on the current machine:
  ```json
  {
    "save_path": "UserData0.dat"
  }
  ```
* If the configured path does not exist on disk, the UI warns the user and presents a file browser / path selector and drag-and-drop zone.
* The browser also stores the path in `localStorage` as a fallback.

---

## 5. Failsafe & Backup Strategy
* Any future write operation will require an automatic backup.
* Even in read-only mode, the user can click `[Backup Save Now]`, saving `backups/UserData0_bak_<timestamp>.dat`.
* Backups are kept immutable and never overwritten.

---

## 6. Verification & Testing
1. **Cryptographic Decryption Test**: Verify `server.py` correctly decrypts `UserData0.dat` and matches the 87 recruited character count.
2. **Character Database Validation**: Verify `characters.json` contains all 121 character IDs with valid names, roles, and instructions.
3. **API Tests**: Verify `/api/config`, `/api/save/status`, and `/api/save/backup` return HTTP 200 with proper payloads.
4. **Browser & UI Verification**: Open the web dashboard, confirm the 87 recruited characters are marked correctly, search and filter buttons work smoothly, and backup generation succeeds.
