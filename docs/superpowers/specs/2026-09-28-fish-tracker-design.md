# Fish Tracker Design Specification

**Date:** 2026-09-28  
**Branch:** `feature/fish-tracker`  
**Status:** Approved  

---

## 1. Overview & Goals

The Fish Tracker introduces complete tracking for the fishing minigame and fishing encyclopedia in *Eiyuden Chronicle: Hundred Heroes*. It enables players to:
1. Track all 52 catchable fish required for the *"The Hero Who Fished the World"* achievement and in-game Fish Guide.
2. View clear catch locations, spot IDs, and 1–5 star rarity ratings.
3. Automatically monitor fishing progress from the player's encrypted save file (`UserData*.dat`).
4. Dynamically identify which unobtained fish are **Catchable Right Now** based on unlocked/discovered fishing spots versus those that remain **Undiscovered** in later story areas.

The UX mirrors the clean, responsive design of the Beigoma and Recipes trackers.

---

## 2. Architecture & Data Flow

Following the existing patterns of the Heroes, Recipes, and Beigoma trackers:
- **Static Metadata**: Canonical game data is maintained in `data/fish.json` (52 fish) and `data/fishing_spots.json` (19 fishing spots).
- **Dynamic Save File Extraction**: `save_reader.py` decrypts `UserData*.dat` and extracts:
  - Caught fish IDs from `_fishesRegistrations`
  - Discovered fishing spot IDs from `_fishingSpots` where `_isDiscoverd == True`
- **Backend API**: `server.py` serves static fish metadata via `GET /api/fish` and progress via `GET /api/progress`.
- **Frontend**: `index.html`, `app.js`, and `style.css` render the table with real-time status badges, 4 status filter tabs, a 5-tier Rarity dropdown, and instant text search.

```
+---------------------+        +--------------------+
|   data/fish.json    | -----> |   GET /api/fish    | -----\
+---------------------+        +--------------------+       \
                                                             +--> [Frontend: app.js]
+---------------------+        +--------------------+       /     - Main Nav Tab: Fish (0/52)
|  Save File (.dat)   | -----> |  GET /api/progress | -----/      - Toolbar: 4 Status Tabs + Rarity + Search
|  - _fishesRegistr.  |        |  (caught_ids,      |             - 4-Column Responsive Table
|  - _fishingSpots    |        |   discovered_spots)|             - Dynamic Status: Caught / Catchable / Undiscovered
+---------------------+        +--------------------+
```

---

## 3. Data Models & Specifications

### 3.1 Fish Dataset (`data/fish.json`)
The game contains exactly 52 fish (IDs 1 through 52 in official in-game guide order).

Schema:
```json
[
  {
    "id": 1,
    "name": "Curry Mackerel",
    "rarity": 1,
    "spot_ids": [9, 52],
    "location": "Dabavin, Headquarters Fishing Spot #2",
    "notes": "Available in Dabavin docks or Castle Spot #2"
  },
  {
    "id": 15,
    "name": "Wheel-Eye Bream",
    "rarity": 4,
    "spot_ids": [6],
    "location": "Seaside Cavern, Outside Seaside Cavern",
    "notes": "Rare spawn; required to recruit Huang"
  }
]
```

Fields:
- `id` (`int`, 1–52): Canonical in-game fish identifier.
- `name` (`str`): Official fish name.
- `rarity` (`int`, 1–5): Star rating (1 to 5 stars).
- `spot_ids` (`List[int]`): List of fishing spot IDs where the fish can be caught.
- `location` (`str`): Formatted string of locations and fishing spots.
- `notes` (`str`, optional): Any special requirements, rod upgrades, or quest tips.

### 3.2 Fishing Spots Dataset (`data/fishing_spots.json`)
The game features 19 fishing spots across world regions and Headquarters upgrades (Spot IDs matching save file `_fishingSpots._id`: 1–12, 14–16, 51–54).

Schema:
```json
[
  {
    "id": 1,
    "name": "Grum County (North)",
    "region": "Grum County",
    "description": "Riverbank north of Arenside"
  },
  {
    "id": 6,
    "name": "Seaside Cavern",
    "region": "Coast",
    "description": "Inside Seaside Cavern northern chamber"
  },
  {
    "id": 51,
    "name": "Headquarters Spot #1",
    "region": "Headquarters",
    "description": "Base fishing pond (Level 1)"
  }
]
```

---

## 4. Backend Implementation

### 4.1 Save Reader (`src/tracker/core/save_reader.py`)
In `read_save_summary(filepath)`:
1. Read `save_data.get("_fishesRegistrations", [])`:
   - Extract unique `_fishId` values where `isinstance(_fishId, int)` and `1 <= _fishId <= 52`.
   - Store as sorted `fish_caught_ids`.
   - Compute `fish_caught_count = len(fish_caught_ids)`.
2. Read `save_data.get("_fishingSpots", [])`:
   - Extract unique `_id` values where `spot.get("_isDiscoverd") is True`.
   - Store as sorted `discovered_spot_ids`.
3. Provide safe default values (empty lists and `0` counts) when keys are missing or malformed.

### 4.2 API Endpoints (`src/tracker/server.py`)
1. `GET /api/fish`:
   - Returns the array of 52 fish from `data/fish.json`.
2. `GET /api/progress`:
   - Extends response dictionary with:
     ```json
     {
       "fish_caught_ids": [1, 2, 7, 8, ...],
       "fish_caught_count": 20,
       "fish_total_count": 52,
       "discovered_spot_ids": [1, 4, 6, 12, 51]
     }
     ```

---

## 5. Frontend UI & UX

### 5.1 Main Navigation Tab (`index.html`)
Header tab added alongside existing tabs:
```html
<button type="button" id="tab-nav-fish" class="nav-tab" role="tab" aria-selected="false" data-view="fish">
  Fish <span class="nav-badge" id="nav-count-fish">0/52</span>
</button>
```

### 5.2 Fish View Panel (`#view-fish`)
A single, focused collection table matching the Beigoma Collection UX:

1. **Toolbar (`.toolbar`)**:
   - **Status Filter Tabs (`#fish-filter-tabs`)**:
     - `All <span class="badge" id="count-fish-all">52</span>`
     - `Caught <span class="badge" id="count-fish-caught">0</span>`
     - `Catchable <span class="badge" id="count-fish-catchable">0</span>`
     - `Undiscovered <span class="badge" id="count-fish-undiscovered">0</span>`
   - **Rarity Dropdown (`#fish-rarity-filter`)**:
     - `All Rarities`
     - `5 Stars`
     - `4 Stars`
     - `3 Stars`
     - `2 Stars`
     - `1 Star`
   - **Search Input (`#search-fish-input`)**:
     - Placeholder: `"Search here"`
     - Filters across Fish Name, Where to Catch, and Notes.

2. **Table (4 Columns)**:
   - `Fish Name`: Name of fish (bold) + notes subtitle (if any).
   - `Where to Catch`: Formatted location text.
   - `Rarity`: Visual ★ star pill (`.rarity-pill` with color-coding corresponding to stars 1–5).
   - `Status`:
     - 🟢 **Caught** (`.status-badge.status-caught`): Player has registered catching this fish in save.
     - 🔵 **Catchable** (`.status-badge.status-catchable`): Not caught, but at least one spawn spot is discovered in save.
     - ⚪ **Undiscovered** (`.status-badge.status-undiscovered`): Not caught and no spawn spot has been discovered yet.

3. **Empty State (`#fish-empty-state`)**:
   - Shown when filters/search yield 0 matching rows.

---

## 6. Testing & Quality Assurance

1. **Unit Tests**:
   - `tests/unit/test_fish.py`: Validates `data/fish.json` and `data/fishing_spots.json` schemas, uniqueness, field types, and 52 fish count.
   - `tests/unit/test_save_reader.py`: Validates extraction of caught fish IDs and discovered spot IDs, including edge cases (empty save, missing keys, corrupt data).
2. **Integration / Server Tests**:
   - `tests/e2e/test_server.py`: Validates `/api/fish` and extended `/api/progress`.
3. **Frontend Tests**:
   - `tests/frontend/test_app.js`: Validates fish table row generation, 4-status filtering, rarity dropdown, and instant search.
4. **Full Regression Test**:
   - All 103 Python tests and 32 Node.js tests remain green with zero regressions.

---

## 7. Handover & Context Update
The `docs/NEXT_SESSION.md` document will track the new feature branch, plan, and progress milestones.
