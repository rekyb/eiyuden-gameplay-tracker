# Beigoma & Trainer Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Beigoma spinning-top collection and Trainer battle tracking with 100% automatic synchronization from the player save file in a unified single-page dashboard.

**Architecture:** Static canonical JSON datasets (`data/beigoma.json` and `data/beigoma_trainers.json`) define all 60 tops and 44 trainers. The backend save reader decrypts and parses `_miniGameBeigoma` from `UserData0.dat` into collected top IDs and defeated trainer IDs. The Python HTTP server serves metadata endpoints and includes Beigoma progress in `/api/progress`. The frontend (`index.html`, `app.js`, `style.css`) renders two sub-tab views with search, filtering, and real-time status badges.

**Tech Stack:** Python 3.14 (built-in `http.server`, `json`, `cryptography`), Vanilla HTML5/CSS3/ES6 JavaScript, `unittest`.

## Global Constraints
- Single-page application: All UI remains in `static/index.html` with modular view panels.
- Zero runtime external dependencies for production app (no UnityPy required at tracker runtime).
- 3-column minimalist table layout:
  - Beigoma: `Beigoma Name` | `Where to Obtain` | `Status`
  - Trainers: `Trainer Name` | `Location` | `Status`
- 100% automatic read-only sync from save file.
- All test suites must pass clean without regression.

---

### Task 1: Generate Static Datasets and Integrity Unit Tests

**Files:**
- Create: `data/beigoma.json`
- Create: `data/beigoma_trainers.json`
- Create: `tests/unit/test_beigoma.py`

**Interfaces:**
- Produces:
  - `data/beigoma.json`: List of 60 objects `[{"id": int, "name": str, "whereToObtain": str}]`
  - `data/beigoma_trainers.json`: List of 44 objects `[{"id": int, "name": str, "location": str}]`
  - `test_beigoma.py`: Unittest test cases verifying dataset lengths, unique IDs, and schema fields.

- [ ] **Step 1: Write failing unit test for Beigoma datasets**

Create `tests/unit/test_beigoma.py`:
```python
import json
import os
import unittest

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


class TestBeigomaDatasets(unittest.TestCase):
    def test_beigoma_json_exists_and_valid(self):
        filepath = os.path.join(DATA_DIR, "beigoma.json")
        self.assertTrue(os.path.isfile(filepath), "data/beigoma.json must exist")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 60, "Must contain exactly 60 collectible tops")

        ids = set()
        for item in data:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("whereToObtain", item)
            self.assertIsInstance(item["id"], int)
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["whereToObtain"].strip())
            self.assertNotIn(item["id"], ids, f"Duplicate Beigoma ID: {item['id']}")
            ids.add(item["id"])

    def test_beigoma_trainers_json_exists_and_valid(self):
        filepath = os.path.join(DATA_DIR, "beigoma_trainers.json")
        self.assertTrue(
            os.path.isfile(filepath), "data/beigoma_trainers.json must exist"
        )
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 44, "Must contain exactly 44 opponent trainers")

        ids = set()
        for item in data:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("location", item)
            self.assertIsInstance(item["id"], int)
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["location"].strip())
            self.assertNotIn(item["id"], ids, f"Duplicate Trainer ID: {item['id']}")
            ids.add(item["id"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_beigoma.py`  
Expected: FAIL (`data/beigoma.json must exist`)

- [ ] **Step 3: Generate canonical `data/beigoma.json` and `data/beigoma_trainers.json`**

Generate `data/beigoma.json` (60 tops) and `data/beigoma_trainers.json` (44 trainers) using the extracted game metadata, mapping enemy drop locations and trainer towns.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_beigoma.py`  
Expected: PASS (`Ran 2 tests in ... OK`)

- [ ] **Step 5: Commit**

```bash
rtk git add data/beigoma.json data/beigoma_trainers.json tests/unit/test_beigoma.py
rtk git commit -m "feat(data): add canonical beigoma and trainer datasets with unit tests"
```

---

### Task 2: Update Save Reader for Beigoma & Trainer Extraction

**Files:**
- Modify: `src/tracker/core/save_reader.py`
- Modify: `tests/unit/test_save_reader.py`

**Interfaces:**
- Consumes: Decrypted save dictionary `save_data.get("_miniGameBeigoma", {})`
- Produces in `read_save_summary()`:
  - `beigoma_collected_ids`: `List[int]`
  - `beigoma_collected_count`: `int`
  - `beigoma_defeated_trainer_ids`: `List[int]`
  - `beigoma_defeated_trainer_count`: `int`

- [ ] **Step 1: Write failing unit test for Beigoma save extraction**

In `tests/unit/test_save_reader.py`, add `test_beigoma_extraction()`:
```python
    def test_beigoma_and_trainer_extraction(self):
        """Verify extraction of usable Beigomas and defeated trainers from save."""
        save_data = {
            "_unitData": {"_units": [{"_id": 10}]},
            "_miniGameBeigoma": {
                "_usableBeigomaIDs": [6, 14, 15, 500, 999],
                "_matchResult": [
                    {"_characterParamId": 1000, "_winCount": 1},
                    {"_characterParamId": 5, "_winCount": 2},
                    {"_characterParamId": 6, "_winCount": 0},  # Not won yet
                ],
            },
        }
        raw_bytes = encrypt_save(save_data)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dat") as tf:
            tf.write(raw_bytes)
            tf_path = tf.name

        try:
            summary = read_save_summary(tf_path)
            self.assertEqual(summary["beigoma_collected_ids"], [6, 14, 15, 500, 999])
            self.assertEqual(summary["beigoma_collected_count"], 5)
            self.assertEqual(summary["beigoma_defeated_trainer_ids"], [1000, 5])
            self.assertEqual(summary["beigoma_defeated_trainer_count"], 2)
        finally:
            if os.path.exists(tf_path):
                os.remove(tf_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_save_reader.py`  
Expected: FAIL (`KeyError: 'beigoma_collected_ids'`)

- [ ] **Step 3: Implement extraction in `save_reader.py`**

In `src/tracker/core/save_reader.py`:
1. In `empty_summary`: add:
   ```python
   "beigoma_collected_ids": [],
   "beigoma_collected_count": 0,
   "beigoma_defeated_trainer_ids": [],
   "beigoma_defeated_trainer_count": 0,
   ```
2. Extract from `save_data.get("_miniGameBeigoma", {})`:
   ```python
   beigoma_data = save_data.get("_miniGameBeigoma", {})
   raw_usable = beigoma_data.get("_usableBeigomaIDs", [])
   # Only keep valid collectible IDs (exclude enemy-only tops 604, 605, 606)
   excluded_tops = {604, 605, 606}
   beigoma_collected_ids = sorted(
       list({bid for bid in raw_usable if isinstance(bid, int) and bid not in excluded_tops})
   )

   raw_matches = beigoma_data.get("_matchResult", [])
   defeated_trainer_ids = set()
   if isinstance(raw_matches, list):
       for match in raw_matches:
           if isinstance(match, dict):
               c_id = match.get("_characterParamId")
               win_cnt = match.get("_winCount", 0)
               if isinstance(c_id, int) and c_id != 1 and win_cnt > 0:
                   defeated_trainer_ids.add(c_id)

   beigoma_defeated_trainer_ids = sorted(list(defeated_trainer_ids))
   ```
3. Include in return dictionary of `read_save_summary()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_save_reader.py`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/tracker/core/save_reader.py tests/unit/test_save_reader.py
rtk git commit -m "feat(core): extract beigoma and trainer progress in save reader"
```

---

### Task 3: Backend API Endpoints for Beigoma & Trainers

**Files:**
- Modify: `src/tracker/server.py`
- Modify: `tests/e2e/test_server.py`

**Interfaces:**
- Produces:
  - `GET /api/beigoma`: Returns 60 items from `data/beigoma.json`
  - `GET /api/beigoma/trainers`: Returns 44 items from `data/beigoma_trainers.json`
  - `GET /api/progress`: Returns extended summary with `beigoma_collected_ids`, `beigoma_collected_count`, `beigoma_total_count: 60`, `beigoma_defeated_trainer_ids`, `beigoma_defeated_trainer_count`, `beigoma_total_trainers: 44`.

- [ ] **Step 1: Write failing test in `tests/e2e/test_server.py`**

Add tests for `/api/beigoma`, `/api/beigoma/trainers`, and `/api/progress` fields:
```python
    def test_api_beigoma_endpoints(self):
        # GET /api/beigoma
        res = self.fetch("/api/beigoma")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 60)

        # GET /api/beigoma/trainers
        res_t = self.fetch("/api/beigoma/trainers")
        self.assertEqual(res_t.status_code, 200)
        data_t = res_t.json()
        self.assertEqual(len(data_t), 44)

    def test_api_progress_includes_beigoma(self):
        res = self.fetch("/api/progress")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("beigoma_collected_ids", data)
        self.assertIn("beigoma_collected_count", data)
        self.assertEqual(data.get("beigoma_total_count"), 60)
        self.assertIn("beigoma_defeated_trainer_ids", data)
        self.assertIn("beigoma_defeated_trainer_count", data)
        self.assertEqual(data.get("beigoma_total_trainers"), 44)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/e2e/test_server.py`  
Expected: FAIL (`404` for `/api/beigoma` or missing fields)

- [ ] **Step 3: Implement endpoints in `src/tracker/server.py`**

In `server.py`:
1. Cache `BEIGOMA_FILE` and `BEIGOMA_TRAINERS_FILE` from `data/`.
2. Add route handlers in `do_GET`:
   - `if path == "/api/beigoma": return self.send_json(load_beigoma())`
   - `if path in ("/api/beigoma/trainers", "/api/beigoma-trainers"): return self.send_json(load_beigoma_trainers())`
3. In `/api/progress`: include `beigoma_total_count: len(load_beigoma())` (60) and `beigoma_total_trainers: len(load_beigoma_trainers())` (44).

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/e2e/test_server.py`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/tracker/server.py tests/e2e/test_server.py
rtk git commit -m "feat(server): serve beigoma and trainer data and progress endpoints"
```

---

### Task 4: Frontend HTML Structure and CSS Styling

**Files:**
- Modify: `static/index.html`
- Modify: `static/style.css`

**Interfaces:**
- Produces:
  - Top tab: `#tab-nav-beigoma` with `#nav-count-beigoma`
  - View panel: `#view-beigoma`
  - Sub-navigation: `#beigoma-subnav` with `#subtab-beigoma-collection` and `#subtab-beigoma-trainers`
  - Sub-panels:
    - `#subview-beigoma-collection`: Search input `#beigoma-search`, status tabs (`All`, `Obtained`, `Not Obtained`), table `#beigoma-table` with tbody `#beigoma-list`
    - `#subview-beigoma-trainers`: Search input `#trainer-search`, status tabs (`All`, `Defeated`, `Not Battled`), table `#trainer-table` with tbody `#trainer-list`
  - Responsive styles for sub-tabs and table badges.

- [ ] **Step 1: Update `static/index.html` with Beigoma navigation and view panel**

Add `#tab-nav-beigoma` to `.top-nav`:
```html
<button type="button" id="tab-nav-beigoma" class="nav-tab" role="tab" aria-selected="false" data-view="beigoma">
  Beigoma <span class="nav-badge" id="nav-count-beigoma">0/60</span>
</button>
```

Add `#view-beigoma` view container with sub-tabs, filter toolbars, and 3-column table containers for Collection and Trainers.

- [ ] **Step 2: Add styles in `static/style.css`**

Add CSS rules for:
- Sub-navigation button group (`.subnav-tabs`, `.subnav-tab`, `.subnav-tab.active`).
- Responsive table styling for Beigoma and Trainer columns.
- Status badges: `.badge-obtained` / `.badge-defeated` (green) vs `.badge-missing` / `.badge-not-battled` (neutral).

- [ ] **Step 3: Run existing style and e2e tests**

Run: `python -m unittest tests/e2e/test_style.py`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
rtk git add static/index.html static/style.css
rtk git commit -m "feat(ui): add beigoma and trainer html views and subnav styles"
```

---

### Task 5: Frontend Logic in `static/app.js`

**Files:**
- Modify: `static/app.js`

**Interfaces:**
- Consumes: `/api/beigoma`, `/api/beigoma/trainers`, and `/api/progress`
- Produces:
  - `state.beigoma`: Array of 60 tops
  - `state.beigomaTrainers`: Array of 44 trainers
  - `state.beigomaSubview`: `"collection"` | `"trainers"`
  - Rendering functions: `renderBeigoma()`, `renderTrainers()`, `updateBeigomaStats()`
  - Event listeners for Beigoma search, status filter clicks, and sub-tab switching.

- [ ] **Step 1: Update application state in `static/app.js`**

Add Beigoma state properties:
```javascript
beigoma: [],
beigomaTrainers: [],
beigomaSubView: "collection", // "collection" | "trainers"
beigomaFilter: "all",        // "all" | "obtained" | "missing"
beigomaSearch: "",
trainerFilter: "all",        // "all" | "defeated" | "unbattled"
trainerSearch: "",
```

- [ ] **Step 2: Implement data fetching and rendering functions**

1. Fetch `/api/beigoma` and `/api/beigoma/trainers` on initialization alongside characters and recipes.
2. Implement `renderBeigoma()`:
   - Filter by search (name or whereToObtain) and filter tab (`all`, `obtained`, `missing`).
   - Render 3 columns: `Name`, `Where to Obtain`, `Status`.
3. Implement `renderTrainers()`:
   - Filter by search (name or location) and filter tab (`all`, `defeated`, `unbattled`).
   - Render 3 columns: `Trainer Name`, `Location`, `Status`.
4. Implement `updateBeigomaStats()`:
   - Update `#nav-count-beigoma`, sub-tab badges, and filter count badges.
5. Hook into `applyProgress()`:
   - Automatically re-render Beigoma and Trainers on save sync.

- [ ] **Step 3: Bind event listeners**

Bind subnav toggle buttons, search inputs, and filter buttons.

- [ ] **Step 4: Commit**

```bash
rtk git add static/app.js
rtk git commit -m "feat(app): implement beigoma and trainer filtering, rendering, and save sync"
```

---

### Task 6: Full Verification with Real Save File and Test Suites

**Files:**
- Test: `tests/unit/test_beigoma.py`
- Test: `tests/unit/test_save_reader.py`
- Test: `tests/e2e/test_server.py`
- Test: `tests/e2e/test_e2e.py`

- [ ] **Step 1: Run all unit and integration test suites**

Run: `python -m unittest discover tests`  
Expected: PASS (all tests passing)

- [ ] **Step 2: Verify real save file data integration**

Run script to decrypt player's local save `UserData0.dat` and verify:
- Exactly 23 Beigomas marked as `Obtained` (out of 60).
- Exactly 14 Trainers marked as `Defeated` (out of 44).

- [ ] **Step 3: Commit any final refinements and documentation**

```bash
rtk git add .
rtk git commit -m "test: verify all beigoma tests and live save synchronization"
```
