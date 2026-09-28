# Eiyuden Chronicle Gameplay Tracker

A clean, minimalist, distraction-free local gameplay tracker for **Eiyuden Chronicle: Hundred Heroes**.

The tracker reads and decrypts your game save files (`UserData*.dat`) directly to monitor your progress in real time — covering all 121 heroes and all 93 Kurtz restaurant recipes.

---

## Features

### Heroes Tracker
- **Complete 121 Character Catalog**: Detailed locations, recruitment conditions, and missable warnings (e.g. Leene).
- **Save Synchronization**: In-memory decryption of game saves (`UserData*.dat`) via TripleDES-CBC. 100% read-only and non-destructive.
- **Smart Save Detection**: Automatically locates default save folders across platforms (Steam, GOG, PC Game Pass) with native file browser support.
- **Search & Filters**: Search across hero names, locations, and recruitment notes. Filter by *All*, *Recruited*, *Not Recruited*, and *Missable*.

### Recipes Tracker
- **Complete 93-Recipe Database**: Full catalog of dishes available at Kurtz's restaurant (HQ), with detailed acquisition and cooking guides.
- **Acquired Status Detection**: Automatically detects collected recipes from your save data.
- **Manual Cooked Tracking**: Interactive checklist to track dishes cooked for the **Gourmand Hero** achievement. Cooked states persist locally and server-side.
- **Search & Filters**: Search across dishes, locations, and source guides. Filter by *All*, *Acquired*, *Not Acquired*, *Cooked*, and *Not Cooked*.

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
python server.py --open
```

#### macOS / Linux:
```bash
python3 server.py --open
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

---

## Default Save File Locations

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

## Running Tests

### Backend & E2E Tests (Python)
59 unit, integration, style, and end-to-end tests:

```bash
python -m unittest discover -s . -p "test_*.py" -v
```

### Frontend State & Filter Tests (Node.js)
12 headless state, debounce, and filtering tests:

```bash
node --test test_app.js
```

---

## License

MIT License. Free to use and modify.

Made with love by Reky • Eiyuden Chronicle: Hundred Heroes is a trademark of Rabbit & Bear Studios and 505 Games.
