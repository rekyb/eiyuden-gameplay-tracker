# Eiyuden Chronicle Gameplay Tracker

A clean, minimalist, distraction-free local gameplay tracker for **Eiyuden Chronicle: Hundred Heroes**.

The tracker reads and decrypts your game save files (`UserData*.dat`) directly to monitor your progress in real time — covering all 121 heroes and all 93 Kurtz restaurant recipes.

---

## Features

### Heroes Tracker
- **Complete 121 Character Catalog**: Detailed locations, recruitment conditions, and missable warnings (e.g. Leene).
- **Automatic Save Synchronization**: Reads and decrypts game saves (`UserData0.dat`, `UserData1.dat`, `UserData999.dat`, etc.) in-memory via TripleDES-CBC. Non-destructive—your save file is never modified on read.
- **Automatic Save Detection**: Automatically locates default save folders across platforms (Steam, GOG, PC Game Pass) and picks the most recently saved slot.
- **Native File Browser**: Easily browse and select any save slot on your computer via the Settings menu.
- **Instant Search & Filters**: Live search across names, locations, and recruitment notes. Filter by *All*, *Recruited*, *Not Recruited*, and *Missable*.

### Recipes Tracker
- **Complete 93-Recipe Database**: All dishes available at Kurtz's restaurant (HQ), with detailed acquisition and cooking guides.
- **Acquired Detection**: Reads your save file to automatically detect which recipe items you've collected.
- **Manual Cooked Tracking**: Check dishes off as you cook them at Kurtz's restaurant to track progress toward the **Gourmand Hero** achievement (cook all 93 dishes). Cooked state persists across sessions via `localStorage` + server-side `config.json`.
- **Filter & Search**: Filter by *All*, *Acquired*, *Not Acquired*, *Cooked*, *Not Cooked*, with live search across dish name, location, and source.

### General
- **Top Navigation**: Switch between Heroes and Recipes views with a clean tab bar showing live counts.
- **One-Click Backups**: Create timestamped, byte-exact backups of your save file.
- **Lightweight & Fast**: Zero framework bloat. Pure semantic HTML, clean responsive CSS, and native ES6 JavaScript served via a lightweight Python local server.

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
1. **Select Save File**: Open **⚙ Settings** in the header, then click **Auto-Detect Save Path** or **Browse...** to pick any `UserData*.dat` file.
2. **Track Progress**: Recruited heroes, missing characters, and counts sync automatically when you click **Sync Save Now** (inside Settings).
3. **Search & Filter**: Use the search bar or filter tabs (**All**, **Recruited**, **Not Recruited**, **Missable**) to find heroes and their recruitment requirements.
4. **Backup**: Click **Backup Save Now** (inside Settings) to create a timestamped backup in the `backups/` folder.

### Recipes View
1. **Switch to Recipes**: Click the **Recipes** tab in the top navigation.
2. **Acquired Detection**: Sync your save to automatically mark which recipes your character has collected in their inventory or restaurant.
3. **Track Cooked Dishes**: Check the **Cooked** checkbox manually each time you cook a dish at Kurtz's restaurant. Click the **ⓘ** icon on the Cooked column header for details.
4. **Filter & Search**: Filter by acquisition or cooked status, or search by dish name, location, or guide.

> **Tip:** The Cooked column is entirely manual — the save file does not record individual cooking history. Check dishes off as you cook them in-game.

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

The test suite includes unit, integration, and end-to-end tests (56 total):

```bash
python -m unittest discover -s . -p "test_*.py" -v
```

---

## License

MIT License. Free to use and modify.

Made with love by Reky • Eiyuden Chronicle: Hundred Heroes is a trademark of Rabbit & Bear Studios and 505 Games.

