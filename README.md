# Eiyuden Chronicle Gameplay Tracker

A clean, minimalist, distraction-free local gameplay tracker for **Eiyuden Chronicle: Hundred Heroes**.

The tracker reads and decrypts your game save files (`UserData*.dat`) directly to monitor your recruitment progress across all 121 heroes in real time, providing location info, recruitment guides, and missable warnings without visual clutter.

---

## Features

- **Complete 121 Character Catalog**: Detailed locations, recruitment conditions, and missable warnings (e.g. Leene).
- **Automatic Save Synchronization**: Reads and decrypts game saves (`UserData0.dat`, `UserData1.dat`, `UserData999.dat`, etc.) in-memory via TripleDES-CBC. Non-destructive—your save file is never modified on read.
- **Steam Auto-Detection**: Automatically locates default Steam save folders and picks the most recently saved slot.
- **Native File Browser**: Easily browse and select any save slot on your computer via the Settings menu.
- **Instant Search & Filters**: Live search across names, locations, and recruitment notes. Filter by *All*, *Recruited*, *Not Recruited*, and *Missable*.
- **One-Click Backups**: Create timestamped, byte-exact backups of your save file before making changes.
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

1. **Select Save File**:
   - Open **Settings** in the upper-right corner.
   - Click **Use Detected Steam Path** to auto-detect your save, or click **Browse...** to pick any `UserData*.dat` file on your system.
   - Click **Save Path** to save your selection.
2. **Track Progress**:
   - Your recruited characters, missing heroes, and recruitment percentage will sync automatically.
   - Use the search bar or filter tabs (**All**, **Recruited**, **Not Recruited**, **Missable**) to quickly find heroes and see where to recruit them.
3. **Sync While Playing**:
   - Save your game in *Eiyuden Chronicle*, then click **Sync Save** (or refresh) in the tracker to update your recruited list.
4. **Backup**:
   - Click **Backup Save** at any time to create a timestamped backup in the `backups/` folder.

---

## Default Save File Locations

If you need to find your save files manually:

- **Windows (Steam)**:
  ```
  %USERPROFILE%\AppData\LocalLow\505 Games S_p_A\EiyudenChronicle\<SteamID>\SaveData\UserData0.dat
  ```
- **Steam Deck / Linux (Proton)**:
  ```
  ~/.steam/steam/steamapps/compatdata/1658280/pfx/drive_c/users/steamuser/AppData/LocalLow/505 Games S_p_A/EiyudenChronicle/<SteamID>/SaveData/UserData0.dat
  ```

---

## Running Tests

The test suite includes unit, integration, and end-to-end tests:

```bash
python -m unittest discover -s . -p "test_*.py" -v
```

---

## License

MIT License. Free to use and modify. Eiyuden Chronicle: Hundred Heroes is a trademark of Rabbit & Bear Studios and 505 Games.
