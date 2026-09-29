# Fish Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully synchronized Fish Tracker for *Eiyuden Chronicle: Hundred Heroes* tracking all 52 catchable fish, their rarities, locations, and real-time progression (Caught, Catchable, Undiscovered) from decrypted save files, mirroring the Beigoma tracker UX.

**Architecture:** Static canonical game datasets (`data/fish.json`, `data/fishing_spots.json`) served via `GET /api/fish`; dynamic save parsing in `save_reader.py` extracting caught fish from `_fishesRegistrations` and discovered spots from `_fishingSpots` served via `GET /api/progress`; client-side table rendering in `app.js` with 4 status tabs, 5-star rarity dropdown filter, search input, and reactive status badges.

**Tech Stack:** Python 3.14 (Standard Library `http.server`, `json`, `unittest`), HTML5, CSS3 (CSS custom properties, flexbox/grid), Vanilla JavaScript (ES2022, Node.js `--test`).

## Global Constraints

- **Python tests runner:** `python -m unittest discover tests` (must pass 100%).
- **Frontend tests runner:** `node --test tests/frontend/test_app.js` (must pass 100%).
- **Target Branch:** `feature/fish-tracker`.
- **Zero Regressions:** Existing Heroes, Recipes, and Beigoma features and tests must remain intact.
- **Save File Integrity:** Read-only access to player save files; never write or mutate `UserData*.dat`.

---

### Task 1: Canonical Datasets & Dataset Unit Tests

**Files:**
- Create: `data/fish.json`
- Create: `data/fishing_spots.json`
- Create: `tests/unit/test_fish.py`

**Interfaces:**
- Consumes: None
- Produces: `data/fish.json` containing 52 fish entries with `id`, `name`, `rarity`, `spot_ids`, `location`, `notes`; `data/fishing_spots.json` containing 19 spots with `id`, `name`, `region`, `description`.

- [ ] **Step 1: Write the failing unit tests for fish and fishing spots datasets**

Create `tests/unit/test_fish.py`:
```python
import json
import os
import unittest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


class TestFishDatasets(unittest.TestCase):
    def setUp(self):
        fish_path = os.path.join(DATA_DIR, "fish.json")
        spots_path = os.path.join(DATA_DIR, "fishing_spots.json")
        with open(fish_path, "r", encoding="utf-8") as f:
            self.fish = json.load(f)
        with open(spots_path, "r", encoding="utf-8") as f:
            self.spots = json.load(f)

    def test_fish_json_exists_and_valid(self):
        self.assertIsInstance(self.fish, list)
        self.assertEqual(len(self.fish), 52, "Must contain exactly 52 canonical fish")

        ids = set()
        for item in self.fish:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("rarity", item)
            self.assertIn("spot_ids", item)
            self.assertIn("location", item)
            self.assertIsInstance(item["id"], int)
            self.assertIsInstance(item["name"], str)
            self.assertIsInstance(item["rarity"], int)
            self.assertIn(item["rarity"], [1, 2, 3, 4, 5])
            self.assertIsInstance(item["spot_ids"], list)
            self.assertTrue(len(item["spot_ids"]) > 0, f"Fish {item['name']} must have spot_ids")
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["location"].strip())
            self.assertNotIn(item["id"], ids, f"Duplicate fish ID: {item['id']}")
            ids.add(item["id"])

        self.assertEqual(min(ids), 1)
        self.assertEqual(max(ids), 52)

    def test_fishing_spots_json_exists_and_valid(self):
        self.assertIsInstance(self.spots, list)
        self.assertEqual(len(self.spots), 19, "Must contain exactly 19 fishing spots")

        spot_ids = set()
        for s in self.spots:
            self.assertIn("id", s)
            self.assertIn("name", s)
            self.assertIn("region", s)
            self.assertIsInstance(s["id"], int)
            self.assertTrue(s["name"].strip())
            self.assertTrue(s["region"].strip())
            self.assertNotIn(s["id"], spot_ids, f"Duplicate spot ID: {s['id']}")
            spot_ids.add(s["id"])

    def test_fish_spot_references_valid(self):
        valid_spot_ids = {s["id"] for s in self.spots}
        for item in self.fish:
            for sid in item["spot_ids"]:
                self.assertIn(
                    sid,
                    valid_spot_ids,
                    f"Fish {item['name']} references unknown spot ID {sid}",
                )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_fish.py`
Expected: FAIL with `FileNotFoundError: ... fish.json`

- [ ] **Step 3: Create `data/fishing_spots.json` and `data/fish.json`**

Create `data/fishing_spots.json` with the 19 canonical spots matching save file `_fishingSpots._id`:
`[ {"id": 1, "name": "Grum County (North)", "region": "Grum County", "description": "Riverbank north of Arenside"}, ... ]`

Create `data/fish.json` with all 52 canonical fish (IDs 1 to 52).

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_fish.py`
Expected: PASS (Ran 3 tests, OK)

- [ ] **Step 5: Commit**

```bash
git add data/fish.json data/fishing_spots.json tests/unit/test_fish.py
git commit -m "feat(data): add canonical fish and fishing spots datasets with unit tests"
```

---

### Task 2: Core Save Reader Extraction & Save Reader Unit Tests

**Files:**
- Modify: `src/tracker/core/save_reader.py`
- Modify: `tests/unit/test_save_reader.py`

**Interfaces:**
- Consumes: Decrypted save dictionary containing `_fishesRegistrations` and `_fishingSpots`.
- Produces: `read_save_summary(filepath)` output containing:
  - `fish_caught_ids`: `List[int]` (sorted unique integers 1–52)
  - `fish_caught_count`: `int`
  - `fish_total_count`: `int` (always 52)
  - `discovered_spot_ids`: `List[int]` (sorted unique integers where `_isDiscoverd is True`)

- [ ] **Step 1: Write the failing unit tests for fish and spot extraction in `tests/unit/test_save_reader.py`**

Add tests to `tests/unit/test_save_reader.py`:
```python
    def test_fish_and_spots_extraction_from_save(self):
        mock_save = {
            "_fishesRegistrations": [
                {"_fishId": 21, "_spotId": 1, "_count": 5, "_newFlag": True},
                {"_fishId": 40, "_spotId": 1, "_count": 2, "_newFlag": True},
                {"_fishId": 21, "_spotId": 4, "_count": 1, "_newFlag": False},  # duplicate fish ID
                {"_fishId": 999, "_spotId": 1, "_count": 1},  # invalid fish ID (>52)
            ],
            "_fishingSpots": [
                {"_id": 1, "_resource": {"_count": 10, "_max": 10}, "_coolTime": 0.0, "_isDiscoverd": True},
                {"_id": 2, "_resource": {"_count": 10, "_max": 10}, "_coolTime": 0.0, "_isDiscoverd": False},
                {"_id": 51, "_resource": {"_count": 15, "_max": 15}, "_coolTime": 0.0, "_isDiscoverd": True},
            ]
        }
        # Verify read_save_summary parses fish_caught_ids=[21, 40], fish_caught_count=2, fish_total_count=52, discovered_spot_ids=[1, 51]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_save_reader.py`
Expected: FAIL because `fish_caught_ids` is not yet in summary.

- [ ] **Step 3: Implement fish extraction in `src/tracker/core/save_reader.py`**

In `empty_summary` dictionary, add:
```python
    "fish_caught_ids": [],
    "fish_caught_count": 0,
    "fish_total_count": 52,
    "discovered_spot_ids": [],
```

In `read_save_summary(filepath)`:
```python
    # Fish & Fishing Spots extraction
    fishes_data = save_data.get("_fishesRegistrations", [])
    caught_ids_set = set()
    if isinstance(fishes_data, list):
        for entry in fishes_data:
            if isinstance(entry, dict):
                fid = entry.get("_fishId")
                if isinstance(fid, int) and 1 <= fid <= 52:
                    caught_ids_set.add(fid)
    fish_caught_ids = sorted(list(caught_ids_set))

    spots_data = save_data.get("_fishingSpots", [])
    discovered_spots_set = set()
    if isinstance(spots_data, list):
        for s in spots_data:
            if isinstance(s, dict):
                sid = s.get("_id")
                if isinstance(sid, int) and s.get("_isDiscoverd") is True:
                    discovered_spots_set.add(sid)
    discovered_spot_ids = sorted(list(discovered_spots_set))
```
And populate the returned summary dictionary.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_save_reader.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tracker/core/save_reader.py tests/unit/test_save_reader.py
git commit -m "feat(core): extract fish progress and discovered spots in save reader"
```

---

### Task 3: Server API Endpoints & E2E Integration Tests

**Files:**
- Modify: `src/tracker/server.py`
- Modify: `tests/e2e/test_server.py`

**Interfaces:**
- Consumes: `data/fish.json`, `save_reader.read_save_summary()`
- Produces:
  - `GET /api/fish` -> HTTP 200 JSON with 52 items
  - `GET /api/progress` -> includes `fish_caught_ids`, `fish_caught_count`, `fish_total_count`, `discovered_spot_ids`

- [ ] **Step 1: Write the failing tests in `tests/e2e/test_server.py`**

Add tests in `tests/e2e/test_server.py`:
```python
    def test_get_fish_endpoint(self):
        response = self.client.get("/api/fish")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 52)
        self.assertEqual(data[0]["name"], "Curry Mackerel")

    def test_progress_includes_fish_data(self):
        response = self.client.get("/api/progress")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("fish_caught_ids", data)
        self.assertIn("fish_caught_count", data)
        self.assertIn("fish_total_count", data)
        self.assertIn("discovered_spot_ids", data)
        self.assertEqual(data["fish_total_count"], 52)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/e2e/test_server.py`
Expected: FAIL (404 on `/api/fish` or missing fish keys in `/api/progress`)

- [ ] **Step 3: Implement endpoints in `src/tracker/server.py`**

In `server.py`:
1. Load `data/fish.json` on initialization into `self.fish_data`.
2. In request routing (`do_GET`):
   - Handle path `/api/fish`:
     ```python
     if self.path == "/api/fish":
         self.send_json_response(200, self.fish_data)
         return
     ```
3. In `/api/progress`:
   - Pass through `fish_caught_ids`, `fish_caught_count`, `fish_total_count`, and `discovered_spot_ids` from summary.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/e2e/test_server.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tracker/server.py tests/e2e/test_server.py
git commit -m "feat(server): serve fish dataset and include fish progress in progress endpoint"
```

---

### Task 4: Frontend HTML Structure & CSS Styling

**Files:**
- Modify: `static/index.html`
- Modify: `static/style.css`
- Modify: `tests/e2e/test_style.py`

**Interfaces:**
- Consumes: None
- Produces:
  - Top navigation button `#tab-nav-fish` with count badge `#nav-count-fish`
  - View panel `#view-fish` with `#fish-filter-tabs`, `#fish-rarity-filter`, `#search-fish-input`, `#fish-table`, `#fish-tbody`, `#fish-empty-state`
  - CSS styles for `.fish-table`, `.col-fish-name`, `.col-fish-location`, `.col-fish-rarity`, `.col-fish-status`, `.status-badge.status-caught`, `.status-badge.status-catchable`, `.status-badge.status-undiscovered`, `.rarity-5`, etc.

- [ ] **Step 1: Write failing HTML/CSS style tests in `tests/e2e/test_style.py`**

Add tests checking that `#view-fish`, `#fish-table`, and status classes exist in HTML and CSS.

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: FAIL

- [ ] **Step 3: Update `static/index.html` and `static/style.css`**

1. In `static/index.html`:
   - Add `#tab-nav-fish` button to `#main-nav`:
     ```html
     <button type="button" id="tab-nav-fish" class="nav-tab" role="tab" aria-selected="false" data-view="fish">
       Fish <span class="nav-badge" id="nav-count-fish">0/52</span>
     </button>
     ```
   - Add `#view-fish` panel:
     - 4 status tabs: `all`, `caught`, `catchable`, `undiscovered` with badges `#count-fish-all`, `#count-fish-caught`, `#count-fish-catchable`, `#count-fish-undiscovered`
     - Rarity dropdown `#fish-rarity-filter` (All, 5, 4, 3, 2, 1)
     - Search input `#search-fish-input`
     - Table `#fish-table` with `thead` (Name, Where to Catch, Rarity, Status) and `tbody id="fish-tbody"`
     - Empty state `#fish-empty-state`

2. In `static/style.css`:
   - Add styling for `.status-badge.status-caught` (green), `.status-badge.status-catchable` (cyan/blue accent), `.status-badge.status-undiscovered` (muted gray).
   - Add styling for 5-star rating display `.rarity-stars`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add static/index.html static/style.css tests/e2e/test_style.py
git commit -m "feat(ui): add fish tracker html markup and status badge styles"
```

---

### Task 5: Frontend JavaScript Logic & Tests

**Files:**
- Modify: `static/app.js`
- Modify: `tests/frontend/test_app.js`

**Interfaces:**
- Consumes: `GET /api/fish`, `GET /api/progress`
- Produces:
  - `fetchFishData()`
  - `renderFishTable()`
  - `filterFish()`
  - `updateFishStatusCounts()`
  - Event listeners for `#fish-filter-tabs`, `#fish-rarity-filter`, `#search-fish-input`
  - Integration with `pollProgress()` and `applyProgress()`

- [ ] **Step 1: Write failing frontend tests in `tests/frontend/test_app.js`**

Add tests covering:
- Fish data loading and rendering 52 rows
- Status calculation:
  - Caught when ID in `fish_caught_ids`
  - Catchable when not caught and any spot ID in `discovered_spot_ids`
  - Undiscovered when not caught and no spot ID in `discovered_spot_ids`
- Filter tabs switching (`all`, `caught`, `catchable`, `undiscovered`)
- Rarity dropdown filtering (1 to 5 stars)
- Search text filtering by fish name and location
- Reactive badge updates on `/api/progress` updates

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL

- [ ] **Step 3: Implement Fish logic in `static/app.js`**

Implement:
1. `fishList = []`, `fishCaughtIds = new Set()`, `discoveredSpotIds = new Set()`, `activeFishFilter = 'all'`, `activeFishRarity = 'all'`, `fishSearchQuery = ''`.
2. Fetching `/api/fish` on `init()`.
3. In `applyProgress(data)`:
   - Update `fishCaughtIds` and `discoveredSpotIds`.
   - Update badge `#nav-count-fish`.
   - Update status counts `#count-fish-all`, `#count-fish-caught`, `#count-fish-catchable`, `#count-fish-undiscovered`.
   - Re-render table.
4. `renderFishTable()`:
   - Computes status per fish (`caught`, `catchable`, `undiscovered`).
   - Filters according to `activeFishFilter`, `activeFishRarity`, `fishSearchQuery`.
   - Generates rows with accessible attributes and styled badges.
   - Shows/hides `#fish-empty-state`.
5. Event listeners for tab clicks, rarity filter changes, and search input debounced/live.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add static/app.js tests/frontend/test_app.js
git commit -m "feat(app): implement fish tracker filtering, rendering, and save sync"
```

---

### Task 6: Full Regression Verification & Handover Documentation

**Files:**
- Modify: `docs/NEXT_SESSION.md`

**Interfaces:**
- Consumes: All test runners
- Produces: Passing test reports and updated handover documentation

- [ ] **Step 1: Run all Python tests**

Run: `python -m unittest discover tests`
Expected: All tests pass (>= 110 tests, 0 failures, 0 errors).

- [ ] **Step 2: Run all Frontend tests**

Run: `node --test tests/frontend/test_app.js`
Expected: All tests pass (>= 40 tests, 0 failures).

- [ ] **Step 3: Test with real save file `UserData999.dat`**

Run: `python -c "from src.tracker.core.save_reader import read_save_summary; print(read_save_summary(r'C:\Users\rekyb\AppData\LocalLow\505 Games S_p_A\EiyudenChronicle\76561199242647968\SaveData\UserData999.dat'))"`
Expected: Summary contains `fish_caught_ids`, `fish_caught_count = 20`, `fish_total_count = 52`, and `discovered_spot_ids`.

- [ ] **Step 4: Update `docs/NEXT_SESSION.md`**

Update handover documentation with completed tasks, test counts, and verified behavior.

- [ ] **Step 5: Commit**

```bash
git add docs/NEXT_SESSION.md
git commit -m "docs: update handover notes for completed fish tracker implementation"
```
