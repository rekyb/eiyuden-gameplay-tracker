# Beigoma & Trainer Tracker Design Specification

**Date:** 2026-09-28  
**Branch:** `feat/beigoma-tracker`  
**Status:** Approved  

---

## 1. Overview & Goals

The Beigoma Tracker introduces comprehensive tracking for the Beigoma spinning-top minigame in *Eiyuden Chronicle: Hundred Heroes*. It enables players to track both:
1. **Beigoma Collection**: All 60 collectible player tops, where to obtain them, and whether they are currently owned.
2. **Beigoma Trainers**: All 44 opponents required for the *Whirled Peace* achievement, their locations, and whether they have been defeated.

All tracking is 100% automatic and synchronized directly from the player's encrypted save file (`UserData0.dat`).

---

## 2. Architecture & Data Flow

Following the existing patterns established by the Heroes and Recipes trackers:
- Canonical metadata is stored in static JSON files (`data/beigoma.json` and `data/beigoma_trainers.json`).
- Dynamic user progress is extracted from the decrypted save file by `save_reader.py`.
- The backend (`server.py`) serves the static metadata via dedicated endpoints and includes Beigoma progress in `/api/progress`.
- The frontend (`index.html`, `app.js`, `style.css`) renders the tables and handles client-side filtering and real-time state synchronization.

```
+--------------------+        +-------------------------+
|  data/beigoma.json | -----> |   GET /api/beigoma      | -----\
+--------------------+        +-------------------------+       \
                                                                 +--> [Frontend: app.js]
+-----------------------------+   +------------------------------+ /   - Top Tab: Beigoma
| data/beigoma_trainers.json  |-->| GET /api/beigoma/trainers    |/    - Sub-tabs: Collection & Trainers
+-----------------------------+   +------------------------------+     - 3-column responsive tables
                                                                       - Search & Status Filters
+--------------------+        +-------------------------+
|  Save File (.dat)  | -----> |   GET /api/progress     | -----> Reactive UI Badges & Counters
+--------------------+        +-------------------------+
```

---

## 3. Data Models & Specifications

### 3.1 Beigoma Tops (`data/beigoma.json`)
The game contains exactly 60 collectible player tops (IDs 1–42 for monster drops/regions, 500–508 for quest/special, 600–603 for trainer rewards, and 995–999 for starter/practice tops; IDs 604–606 are enemy-only tops and excluded).

Schema:
```json
[
  {
    "id": 1,
    "name": "Plantvine",
    "whereToObtain": "Grum County (North) — Plantvine enemy drop"
  },
  {
    "id": 508,
    "name": "Elder Dragon",
    "whereToObtain": "Reward for completing the Mythic Tablet (Slate of Seals)"
  }
]
```

### 3.2 Beigoma Trainers (`data/beigoma_trainers.json`)
The game features 44 opponent trainers (Trophy 39 target):
- **14 Sidequest / Boss Trainers**: Reid (tutorial + 3 HQ rematches), Taq, Fender, Celera, Venom, Thudd, Zeph, Flowe, Pyre, Crash, Dr. Corque.
- **30 World / Free Trainers**: 27 town & dungeon trainers + 3 HQ resident trainers. (Nowa at ID 1 is the player avatar and excluded from opponent tracking).

Schema:
```json
[
  {
    "id": 1000,
    "name": "Reid",
    "location": "Eltisweiss"
  },
  {
    "id": 5,
    "name": "Taq",
    "location": "Altverden Village"
  },
  {
    "id": 101,
    "name": "Villager",
    "location": "Arenside"
  }
]
```

---

## 4. Backend Implementation

### 4.1 Save Reader (`src/tracker/core/save_reader.py`)
In `read_save_summary(filepath)`:
1. Inspect `save_data.get("_miniGameBeigoma", {})`.
2. Extract collected tops:
   - `beigoma_collected_ids`: Array of integer IDs from `_usableBeigomaIDs` (filtered to valid integer IDs).
   - `beigoma_collected_count`: Count of valid collectible IDs owned (capped at 60).
3. Extract defeated trainers:
   - `beigoma_defeated_trainer_ids`: Array of `_characterParamId` from `_matchResult` where `_winCount > 0`.
   - `beigoma_defeated_trainer_count`: Count of unique defeated trainers (capped at 44).
4. Provide safe defaults (empty lists and `0` counts) when `_miniGameBeigoma` is missing, corrupted, or uninitialized.

### 4.2 API Endpoints (`src/tracker/server.py`)
- `GET /api/beigoma`: Serves all 60 tops from `data/beigoma.json`.
- `GET /api/beigoma/trainers`: Serves all 44 trainers from `data/beigoma_trainers.json`.
- `GET /api/progress`: Extends payload with:
  ```json
  {
    "beigoma_collected_ids": [6, 14, 15, ...],
    "beigoma_collected_count": 23,
    "beigoma_total_count": 60,
    "beigoma_defeated_trainer_ids": [1000, 5, 6, ...],
    "beigoma_defeated_trainer_count": 14,
    "beigoma_total_trainers": 44
  }
  ```

---

## 5. Frontend UI & UX

### 5.1 Main Navigation (`index.html`)
The top bar includes a third view button:
```html
<button type="button" id="tab-nav-beigoma" class="nav-tab" role="tab" aria-selected="false" data-view="beigoma">
  Beigoma <span class="nav-badge" id="nav-count-beigoma">0/60</span>
</button>
```

### 5.2 Sub-Navigation
Inside `#view-beigoma`, a pill sub-navigation switches between two panels:
- `[Beigoma Collection (0/60)]` (Active by default)
- `[Trainers (0/44)]`

### 5.3 Section 1: Beigoma Collection Sub-View
- **Toolbar**:
  - Filter Tabs: `All (60)` | `Obtained (X)` | `Not Obtained (Y)`
  - Search Input: Real-time search across Top Name and Where to Obtain.
- **Table (3 Columns)**:
  1. `Beigoma Name`: String (e.g., "Plantvine", "Earth Dragon").
  2. `Where to Obtain`: Location & monster drop / quest details.
  3. `Status`: Badge (`Obtained` in green or `Not Obtained` in neutral/muted).

### 5.4 Section 2: Trainers Sub-View
- **Toolbar**:
  - Filter Tabs: `All (44)` | `Defeated (X)` | `Not Battled (Y)`
  - Search Input: Real-time search across Trainer Name and Location.
- **Table (3 Columns)**:
  1. `Trainer Name`: String (e.g., "Taq", "Reid", "Beigoma Sage", "Villager").
  2. `Location`: String (e.g., "Altverden Village", "Athrabalt").
  3. `Status`: Badge (`Defeated` in green or `Not Battled` in neutral/muted).

### 5.5 State & Styling (`app.js`, `style.css`)
- Reuses clean, responsive design tokens and table styles.
- Reactive re-rendering on save synchronization without resetting user search/filter state.
- Empty states with informative messages when filters yield zero rows.

---

## 6. Testing & Verification

1. **Unit Tests**:
   - `tests/unit/test_beigoma.py`: Validate static JSON datasets (count, uniqueness of IDs, required fields).
   - `tests/unit/test_save_reader.py`: Test `_miniGameBeigoma` parsing with mock data and edge cases (missing, empty, corrupted).
2. **Server / Integration Tests**:
   - `tests/e2e/test_server.py`: Verify `/api/beigoma`, `/api/beigoma/trainers`, and extended `/api/progress`.
3. **Live Save File Verification**:
   - Verify parsing against actual player save `UserData0.dat` (23 collected, 14 defeated).
