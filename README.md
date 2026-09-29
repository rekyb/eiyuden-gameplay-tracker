# Eiyuden Chronicle Gameplay Tracker

A clean, minimalist, distraction-free local gameplay tracker for **Eiyuden Chronicle: Hundred Heroes**.

The tracker reads and decrypts your game save files (`UserData*.dat`) directly to monitor your progress in real time — covering all 121 heroes, all 93 Kurtz restaurant recipes, all 60 Beigoma tops & 44 trainers, and all 52 fish across 19 fishing spots.

---

## Features

### Heroes Tracker
- **Complete 121 Character Catalog**: Detailed locations, recruitment conditions, and missable warnings (e.g. Leene).
- **Save Synchronization**: In-memory decryption of game saves (`UserData*.dat`) via TripleDES-CBC. 100% read-only and non-destructive.
- **Smart Save Detection**: Automatically locates default save folders across platforms (Steam, GOG, PC Game Pass) with native file browser support.
- **Search & Filters**: Search across hero names, locations, and recruitment notes. Filter by *All*, *Recruited*, *Not Recruited*, and *Missable*. Filter by Story Arc chapter.

### Recipes Tracker
- **Complete 93-Recipe Database**: Full catalog of dishes available at Kurtz's restaurant (HQ), with detailed acquisition and cooking guides.
- **Acquired Status Detection**: Automatically detects collected recipes from your save data.
- **Manual Cooked Tracking**: Interactive checklist to track dishes cooked for the **Gourmand Hero** achievement. Cooked states persist locally and server-side.
- **Search & Filters**: Search across dishes, locations, and source guides. Filter by *All*, *Acquired*, *Not Acquired*, *Cooked*, and *Not Cooked*.

### Beigoma & Trainer Tracker
- **Complete 60-Top Collection**: Full catalog of all collectible tops with drop locations, verified 1–4 star rarity badges, and automatic *Obtained* / *Missing* save detection.
- **Complete 44-Trainer Opponent Catalog**: Comprehensive guide to all duelable Beigoma trainers, their locations, and progression conditions to recruit Reid and Dr. Corque.
- **Sub-Tab Navigation**: Seamlessly toggle between **Beigoma Collection** and **Trainers** views with live progress counters.
- **Search & Filters**: Filter tops by *All*, *Obtained*, or *Missing*; filter trainers by *All*, *Defeated*, or *Not Battled*; filter tops by 1–4 star rarity.

### Fish Tracker
- **Complete 52-Fish Encyclopedia**: Complete catalog of all 52 catchable fish required for the **The Hero Who Fished the World** achievement, with verified 1–5 star rarities, locations, and quest notes (e.g., Huang recruitment).
- **Dynamic Catchable Progression**: Automatically cross-references your save file's discovered fishing spots (`_fishingSpots`) with caught fish (`_fishesRegistrations`) to indicate whether uncaught fish are **Catchable** right now or remain **Undiscovered**.
- **Search & Multi-State Filters**: Filter by status (*All*, *Caught*, *Catchable*, *Undiscovered*), 1–5 star rarity dropdown, or instant search by fish name, location, and notes.
- **Delta-Aware Sync Notifications**: Real-time toast feedback reporting exact progress deltas across heroes, recipes, beigoma, trainers, and fish whenever your save file syncs.

### Fast & Lightweight
- Zero framework overhead: built with pure HTML, CSS, and modern JavaScript backed by a lightweight Python local server.

---

## Quick Start

### 1. Prerequisites

- **Python 3.8+**
- Required library: `cryptography`

Install dependencies:

```bash
pip install -r requirements.txt
```

### 2. Launch the Tracker

#### Windows:
Double-click **`start_tracker.bat`** or run:

```cmd
python main.py --open
```

#### macOS / Linux:
```bash
python3 main.py --open
```

The tracker will launch and automatically open `http://localhost:8000` in your default browser.

---

## How to Use

### Heroes View
1. **Select Save File**: Open **⚙ Settings**, click **Auto-detect** or browse (📁) for your `UserData*.dat` file, then click **Save Path**.
2. **Sync Progress**: Click **Sync Save** anytime you save your game to update your recruitment progress.
3. **Search & Filter**: Search by hero name or location, or filter by status (**All**, **Recruited**, **Not Recruited**, **Missable**).

### Recipes View
1. **Switch to Recipes**: Click the **Recipes** tab in the top navigation.
2. **Acquired Detection**: Sync your save to automatically mark which recipes your party has acquired.
3. **Track Cooked Dishes**: Check the **Cooked** checkbox manually as you cook dishes at Kurtz's restaurant for the Gourmand Hero achievement.
4. **Search & Filter**: Filter by acquisition/cooked status or search by recipe name and source.

> **Tip:** The Cooked status is tracked manually because the save file does not store individual restaurant cooking history. Cooked selections are saved automatically.

### Beigoma View
1. **Switch to Beigoma**: Click the **Beigoma** tab in the top navigation.
2. **Collection vs Trainers**: Toggle between **Beigoma Collection** (to check owned tops and rarity) and **Trainers** (to track defeated opponents).
3. **Automatic Progress**: Save syncing automatically detects all obtained Beigoma tops and defeated trainers.
4. **Search & Filter**: Search tops and trainers by name or location, and filter by status and 1–4 star rarity.

### Fish View
1. **Switch to Fish**: Click the **Fish** tab in the top navigation.
2. **Dynamic Progression**: View all 52 catchable fish with real-time status:
   - 🟢 **Caught**: Fish registered as caught in your save.
   - 🔵 **Catchable**: Fish whose fishing spot has been discovered/unlocked in your save.
   - ⚪ **Undiscovered**: Fish whose fishing spots have not yet been reached in your story progression.
3. **Search & Filter**: Filter by status (**All**, **Caught**, **Catchable**, **Undiscovered**), filter by 1–5 star rarity, or search by name, location, and notes.

---

## Default Save File Locations

> **Note on Save Slot Numbering:** The game's save files use 0-based indexing on disk. `UserData0.dat` corresponds to **Save Slot 1** in-game, `UserData1.dat` corresponds to **Save Slot 2**, and so on. `UserData999.dat` is the game's **Auto-Save** slot.

If you need to find your save files manually:

- **Steam (Windows)**:
  ```
  %USERPROFILE%\AppData\LocalLow\505 Games S_p_A\EiyudenChronicle\<SteamID>\SaveData\UserData0.dat
  ```
- **GOG (Windows)**:
  ```
  %USERPROFILE%\AppData\LocalLow\505 Games S_p_A\EiyudenChronicle\SaveData\UserData0.dat
  ```
- **Xbox Game Pass / PC Game Pass (Windows)**:
  ```
  %LOCALAPPDATA%\Packages\505GAMESS.p.A.EiyudenChronicleHundredHeroes_*\SystemAppData\wgs\
  ```
- **Steam Deck / Linux (Proton)**:
  ```
  ~/.steam/steam/steamapps/compatdata/1658280/pfx/drive_c/users/steamuser/AppData/LocalLow/505 Games S_p_A/EiyudenChronicle/<SteamID>/SaveData/UserData0.dat
  ```

---

## Project Structure

```text
eiyuden-gameplay-tracker/
├── main.py                     # Canonical application entry point
├── start_tracker.bat           # Windows double-click launcher
├── config/                     # Application configuration
│   └── config.json             # User settings (save paths, options)
├── data/                       # Game catalogs & static data
│   ├── characters.json         # 121 heroes database
│   ├── recipes.json            # 93 recipes database
│   ├── beigoma.json            # 60 beigoma tops database (with 1-4 star rarity)
│   ├── beigoma_trainers.json   # 44 beigoma trainers database
│   ├── fish.json               # 52 fish database (with 1-5 star rarity)
│   └── fishing_spots.json      # 19 fishing spots database
├── src/                        # Modular application source code
│   └── tracker/
│       ├── config/             # Configuration & platform detection
│       │   ├── detector.py     # Steam, GOG, Game Pass save file detector
│       │   └── manager.py      # ConfigManager for loading/saving settings
│       ├── core/               # Core business logic & data processing
│       │   ├── crypto.py       # TripleDES-CBC save file decryption
│       │   ├── models.py       # Catalog loaders (heroes, recipes, beigoma, fish)
│       │   └── save_reader.py  # Save file parsing & multi-tracker progress extraction
│       └── server.py           # HTTP API server & static file host
├── static/                     # Frontend web interface (HTML, CSS, JS)
│   ├── index.html              # Single-page application interface
│   ├── app.js                  # Frontend state management & logic
│   └── style.css               # Application styling & responsive layout
└── tests/                      # Automated test suites
    ├── fixtures/               # Test save files and sample fixtures
    ├── unit/                   # Unit tests (models, save reader, beigoma, fish, config)
    ├── e2e/                    # End-to-end server & style tests
    └── frontend/               # Headless Node.js frontend tests
```

---

## Running Tests

### Backend & E2E Tests (Python)
Unit, integration, style, and end-to-end tests:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

### Frontend State & Filter Tests (Node.js)
Headless state, debounce, and filtering tests:

```bash
node --test tests/frontend/test_app.js
```

---

## License

MIT License. Free to use and modify.

Made with love by Reky • Eiyuden Chronicle: Hundred Heroes is a trademark of Rabbit & Bear Studios and 505 Games.
