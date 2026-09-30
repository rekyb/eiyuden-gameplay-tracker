# Chest Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a save-synced Chest Tracker view for all 227 treasure chests (region, location, how-to-obtain, opened/missable status) and fix the fish save-sync snapshot defect.

**Architecture:** Follow the established tracker pattern: static catalog in `data/`, extraction in `save_reader.py`, `GET /api/chests` + progress keys in `server.py`, and a heroes-style view in `static/`. Chest status is 100% save-derived — no manual persistence, no POST endpoints. A one-time calibration registry (`data/chest_fields.json`) bridges save integer IDs to named regions.

**Tech Stack:** Python 3.8+ stdlib (`unittest`, no new deps), vanilla HTML/CSS/JS, Node `node:test` for frontend.

**Spec:** `docs/superpowers/specs/2026-09-29-chest-tracker-design.md` (argue from the spec; read it before starting)

## Global Constraints

- Save files are **read-only**: never encrypt/write back to `UserData*.dat`.
- Chest total = `len(catalog.chests)` = exactly **227**, driven by data; never hardcode 227 in app code (fish's `52` stays untouched).
- No new dependencies (`requirements.txt` remains `cryptography>=41.0.0`).
- Test commands: `python -m unittest discover -s tests -p "test_*.py"` (baseline: 116 passing) and `node --test tests/frontend/test_app.js` (baseline: 41 passing).
- Conventional commits (`feat:`, `fix:`, `docs:`) matching git history.
- Never stage: `config/config.json`, `docs/CODE_REVIEW.md`, `docs/SENIOR_CODE_REVIEW.md` (unrelated uncommitted user files). The `docs/NEXT_SESSION.md` → `docs/MEMORY.md` rename is already committed; Task 7 only updates `docs/MEMORY.md` content.
- Every task ends with both suites green before committing.

## Review Focus

1. **Guide compilation errors** (region count ≠ 227, region name typo, bad ID) — expect CI failure before any UI shows wrong totals → pinned by `test_chests_json_exists_and_valid` + `test_chest_field_registry_covers_catalog` in Task 2.
2. **Save contains opened IDs absent from the catalog** (my compilation gap or unmapped field) — counts must ignore them, never exceed total → pinned by `test_chest_extraction_excludes_unknown_ids` in Task 3.
3. **Guide listing order ≠ save chest index order** — status must depend only on ID set membership so mis-ordered rows cannot flip status logic → pinned by the out-of-order case in `filterChest` test, Task 6.
4. **Missable combined with status/region/search filters** — combinations must AND together correctly → pinned by `filterChest correctly filters by status, region, missable, and search` in Task 6.
5. **Count-snapshot drift** (a tracker key missing from the snapshot helper, the fish bug class) — any SYNC_TRACKERS key absent must fail → pinned by `snapshotCounts covers every SYNC_TRACKERS key` in Task 1 (auto-rechecks when Task 6 adds `chestCount`).

---

### Task 1: Fix save-sync count snapshots (`snapshotCounts`)

**Files:**
- Modify: `static/app.js` — helper next to `SYNC_TRACKERS` (~line 1185); call sites in `syncSave()` (~line 1246), `handleFileUpload()` (~line 1338), sync-button handler (~line 1580); export block (~line 2245)
- Test: `tests/frontend/test_app.js`

**Interfaces:**
- Produces: `snapshotCounts() -> {heroCount: number, recipeCount: number, beigomaCount: number, trainerCount: number, fishCount: number}` — no parameters, reads current `state`. Task 6 adds `chestCount` to this object.

- [ ] **Step 1: Write the failing test**

```js
test('snapshotCounts covers every SYNC_TRACKERS key', () => {
  const snap = app.snapshotCounts();
  for (const t of app.SYNC_TRACKERS) {
    assert.ok(Object.prototype.hasOwnProperty.call(snap, t.key), `snapshot missing ${t.key}`);
    assert.strictEqual(typeof snap[t.key], 'number');
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL — `app.snapshotCounts is not a function`

- [ ] **Step 3: Implement `snapshotCounts()` and replace the three inline snapshot objects**

Add `function snapshotCounts()` beside `SYNC_TRACKERS` returning the five counts with the exact expressions currently inline (`state.recruitedIds.size`, `state.acquiredRecipeIds.size`, `state.beigomaCollectedIds.length`, `state.beigomaDefeatedTrainerIds.length`, `state.fishCaughtIds.size`); add it to `module.exports`. Replace:
- `syncSave()` and the sync-button handler: `const prevCounts = snapshotCounts();`
- `handleFileUpload()`: capture `const prevCounts = snapshotCounts();` immediately **before** `applyProgress(data.summary)`, then `showToast(buildSyncToast(prevCounts, snapshotCounts()), 'success');` — the current code passes `null` as prevCounts (dead counts object, deltas suppressed entirely).

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS — 42 tests (41 + 1 new), 0 failures

- [ ] **Step 5: Commit**

```bash
git add static/app.js tests/frontend/test_app.js
git commit -m "fix(sync): snapshot all tracker counts for delta toasts (fish regression)"
```

---

### Task 2: Chest data — guide research, calibration registry, catalog

**Files:**
- Create: `tests/unit/test_chests.py`
- Create: `data/chest_fields.json`
- Create: `data/chests.json`
- Read-only: `config/config.json` (save path), the real save file, community guides

**Interfaces:**
- Produces: `data/chests.json` = `{"regions": [str], "chests": [{chest_id: int, region: str, location: str, howToObtain: str, method: "field"|"gimmick_battle", missable: bool, notes: str}]}` — exactly 227 rows. Consumed by Tasks 3, 4, 6.
- Produces: `data/chest_fields.json` = `{"fields": [{field_prefix: int, region: str, guide_chest_count: int, verified_via: "count_signature"|"walk"|"delta"}]}`. ID rule: `chest_id = field_prefix * 100 + seq` (seq 01..guide_chest_count). Consumed by this task's coverage test and Task 3.
- Guide sources: primary **Neoseeker** `https://www.neoseeker.com/eiyuden-chronicle-hundred-heroes/All_Chest_Locations` (227 total, numbered list); secondary **FoggyProductions** `https://foggyproductions.com/guides/eiyuden-chronicle-hundred-heroes/topic/treasure-chests` (per-region counts). On conflict, prefer Neoseeker; cross-check must reconcile to 227.

- [ ] **Step 1: Write the failing tests**

```python
class TestChestDatasets(unittest.TestCase):
    def setUp(self):
        # load data/chests.json and data/chest_fields.json (mirror tests/unit/test_fish.py style)
        ...

    def test_chests_json_exists_and_valid(self):
        self.assertEqual(len(self.chests), 227, "Must contain exactly 227 canonical chests")
        self.assertIsInstance(self.regions, list)
        ids = set()
        for c in self.chests:
            for key in ("chest_id", "region", "location", "howToObtain", "method", "missable"):
                self.assertIn(key, c)
            self.assertIsInstance(c["chest_id"], int)
            self.assertIn(c["method"], ["field", "gimmick_battle"])
            self.assertIsInstance(c["missable"], bool)
            self.assertIn(c["region"], self.regions)
            self.assertTrue(c["location"].strip())
            self.assertTrue(c["howToObtain"].strip())
            self.assertNotIn(c["chest_id"], ids, f"Duplicate chest_id: {c['chest_id']}")
            ids.add(c["chest_id"])

    def test_chest_field_registry_covers_catalog(self):
        prefixes = {f["field_prefix"] for f in self.fields}
        for c in self.chests:
            self.assertIn(c["chest_id"] // 100, prefixes,
                          f"chest_id {c['chest_id']} has no calibrated field prefix")
        for f in self.fields:
            self.assertIn(f["region"], self.regions)
            self.assertIn(f["verified_via"], ["count_signature", "walk", "delta"])
        # every prefix's row count matches its declared guide count; total is 227
        per_prefix = collections.Counter(c["chest_id"] // 100 for c in self.chests)
        for f in self.fields:
            self.assertEqual(per_prefix[f["field_prefix"]], f["guide_chest_count"])
        self.assertEqual(sum(f["guide_chest_count"] for f in self.fields), 227)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m unittest tests.unit.test_chests -v`
Expected: FAIL — `FileNotFoundError: data/chests.json`

- [ ] **Step 3: Run the read-only calibration script against the real save**

Read `save_path` from `config/config.json`; decrypt via `src.tracker.core.crypto.decrypt_save_bytes`; from `_fieldAction._treasureChestList._opened` print per-prefix `opened count`, `max index`, and index gaps (prefix = `cid // 100`; group indices = `cid % 100`). The spike at `C:\Users\rekyb\AppData\Local\Temp\opencode\chest_spike4.py` is reusable — copy its output block into the task notes. Never write to the save.

- [ ] **Step 4: Fetch both guide sources; extract per-region chest lists**

Per region record: chest count, per-chest location text, how-to-obtain text (flag "gimmick battle" phrasing), missable/gimmick-flee notes. Cross-check: the two guides' per-region counts agree (Neoseeker authoritative on conflict) and sum to **227**. If they cannot reconcile to 227, STOP and report the discrepancy to the human partner before writing data files.

- [ ] **Step 5: Match observed field prefixes to guide regions**

Signature = observed **max index** per prefix (a lower bound — gaps mean unopened chests), compared against each region's guide count. Bind unambiguous one-to-one matches. **GATE:** if any region or prefix remains ambiguous or unobserved, STOP and report the exact list to the human partner with these instructions: *enter the region and save the game* (then re-run Step 3 — `_miniMapData._latestPassedFieldId` reveals the field ID), or *open one unopened chest there* (the delta reveals the prefix). Full coverage required before Step 6.

- [ ] **Step 6: Write `data/chest_fields.json`**

One entry per bound prefix with `verified_via` reflecting how it was resolved (`count_signature` / `walk` / `delta`).

- [ ] **Step 7: Write `data/chests.json`**

Rows per region in **guide listing order**; assign `chest_id = field_prefix * 100 + seq` with seq starting at 01 per prefix; regions spanning multiple prefixes concatenate prefixes in ascending order. Derive `method` (`gimmick_battle` when the how-to text describes gimmick/destroy-in-battle acquisition, else `field`) and `missable` (true for gimmick-battle flee-risk chests, per spec §1). Keep guide wording in `location`/`howToObtain`; put caveats ("after defeating Chandra") in `notes`.

- [ ] **Step 8: Run tests to verify they pass, then the full suite**

Run: `python -m unittest tests.unit.test_chests -v` → PASS (2 tests)
Run: `python -m unittest discover -s tests -p "test_*.py"` → all green

- [ ] **Step 9: Commit**

```bash
git add data/chests.json data/chest_fields.json tests/unit/test_chests.py
git commit -m "feat(data): add 227-chest catalog and field calibration registry"
```

---

### Task 3: Backend — catalog loaders and save extraction

**Files:**
- Modify: `src/tracker/core/models.py` (append after `load_fish`, ~line 98)
- Modify: `src/tracker/core/save_reader.py` — `empty_summary` (~lines 92-113), extraction after the fish block (~line 260), imports
- Test: `tests/unit/test_save_reader.py`

**Interfaces:**
- Consumes: `data/chests.json`, `data/chest_fields.json` (Task 2)
- Produces:
  - `load_chests(data_dir: Optional[Union[Path, str]] = None) -> Dict[str, Any]` — returns `{"regions": [...], "chests": [...]}`; on missing/malformed file returns `{"regions": [], "chests": []}` (spec §8 safe default; differs from other loaders which raise).
  - `load_chest_fields(data_dir: Optional[Union[Path, str]] = None) -> Dict[str, Any]` — returns `{"fields": [...]}`; safe default `{"fields": []}`.
  - Every `read_save_summary` result (success and all error/empty paths) gains: `chest_opened_ids: List[int]` (sorted, unique, catalog-filtered), `chest_opened_count: int`, `chest_total_count: int` (= `len(load_chests()["chests"])`).
  - Import direction: `save_reader` → `models` (safe; `models` imports only `json`/`pathlib`). Task 4's `/api/chests` consumes `load_chests`.

- [ ] **Step 1: Write the failing tests**

```python
def test_chest_extraction_from_save(self):
    payload = create_synthetic_save(
        _fieldAction={"_treasureChestList": {"_opened": [3030105, 3030101, 3030101, 9999999]}}
    )
    path = self._write_tmp(payload)
    summary = read_save_summary(path)
    # sorted, unique, and 9999999 (not in catalog) excluded
    self.assertEqual(summary["chest_opened_ids"], [3030101, 3030105])
    self.assertEqual(summary["chest_opened_count"], 2)
    self.assertEqual(summary["chest_total_count"], 227)

def test_chest_extraction_excludes_unknown_ids(self):
    payload = create_synthetic_save(_fieldAction={"_treasureChestList": {"_opened": [8888801]}})
    summary = read_save_summary(self._write_tmp(payload))
    self.assertEqual(summary["chest_opened_ids"], [])
    self.assertEqual(summary["chest_opened_count"], 0)   # badge math can never exceed total

def test_chest_extraction_empty_or_missing(self):
    payload = create_synthetic_save()   # no _fieldAction at all
    summary = read_save_summary(self._write_tmp(payload))
    self.assertEqual(summary["chest_opened_ids"], [])
    self.assertEqual(summary["chest_opened_count"], 0)
    self.assertEqual(summary["chest_total_count"], 227)
    # spec §8: _treasureChestList present but no _opened key
    payload2 = create_synthetic_save(_fieldAction={"_treasureChestList": {}})
    summary2 = read_save_summary(self._write_tmp(payload2))
    self.assertEqual(summary2["chest_opened_ids"], [])
    empty = read_save_summary(None)     # empty_summary path also carries chest keys
    self.assertEqual(empty["chest_opened_ids"], [])
    self.assertEqual(empty["chest_total_count"], 227)

def test_load_chests_safe_defaults_on_missing_file(self):
    # spec §8: missing/malformed data file degrades to an empty catalog, not an exception
    import tempfile
    from src.tracker.core.models import load_chests, load_chest_fields
    with tempfile.TemporaryDirectory() as tmp:
        self.assertEqual(load_chests(tmp), {"regions": [], "chests": []})
        self.assertEqual(load_chest_fields(tmp), {"fields": []})
```

(`create_synthetic_save` passes unknown kwargs straight into the payload — no generator change needed. Use the file-writing helper pattern already used by `test_read_save_summary_fixture`.)

- [ ] **Step 2: Run to verify they fail**

Run: `python -m unittest tests.unit.test_save_reader -v`
Expected: FAIL — `KeyError: 'chest_opened_ids'`

- [ ] **Step 3: Implement loaders and extraction**

In `models.py`: two loaders mirroring `load_fish()`'s path resolution, wrapped in `try/except (FileNotFoundError, json.JSONDecodeError)` returning the safe defaults from the Interfaces block. In `save_reader.py`: add the three keys to `empty_summary` (total computed via `load_chests()`); add helper `_extract_chest_opened_ids(save_data: Dict[str, Any], catalog_ids: Set[int]) -> List[int]` navigating `save_data.get("_fieldAction", {}).get("_treasureChestList", {}).get("_opened", [])`, keeping only `int` values present in `catalog_ids`, sorted unique; call it in `read_save_summary` after the fish block.

- [ ] **Step 4: Run tests to verify they pass, then the full suite**

Run: `python -m unittest tests.unit.test_save_reader -v` → PASS
Run: `python -m unittest discover -s tests -p "test_*.py"` → all green

- [ ] **Step 5: Commit**

```bash
git add src/tracker/core/models.py src/tracker/core/save_reader.py tests/unit/test_save_reader.py
git commit -m "feat(save-reader): extract opened chest ids and counts from save"
```

---

### Task 4: Backend — API endpoints

**Files:**
- Modify: `src/tracker/server.py` — import `load_chests` (~line 30); new route directly after the `/api/fish` block (~line 458); `/api/progress` handler (~lines 460-520): compute `total_chests`, override `summary["chest_total_count"]`, add chest keys to the exception-fallback dict
- Test: `tests/e2e/test_server.py`

**Interfaces:**
- Consumes: `load_chests()` (Task 3), summary chest keys (Task 3)
- Produces:
  - `GET /api/chests` → 200 with `{"regions": [...], "chests": [...]}`; on unexpected error → 500 `{"error": "Failed reading chests: ..."}` (mirror `/api/fish`).
  - `GET /api/progress` (alias `/api/save/status`) success **and** error-fallback responses include `chest_opened_ids`, `chest_opened_count`, `chest_total_count` (227 with data present; fish keys must remain — regression guard from spec §9).
  - No CLI path override for chests (unlike `--fish`) — YAGNI, spec does not define one.

- [ ] **Step 1: Write the failing tests**

```python
def test_get_chests_endpoint(self):
    response = self.client.get("/api/chests")
    self.assertEqual(response.status_code, 200)
    data = response.json()
    self.assertIsInstance(data, dict)
    self.assertTrue(data["regions"])
    self.assertEqual(len(data["chests"]), 227)
    first = data["chests"][0]
    for key in ("chest_id", "region", "location", "howToObtain", "method", "missable"):
        self.assertIn(key, first)

def test_progress_includes_chest_data(self):
    data = self.client.get("/api/progress").json()
    self.assertIn("chest_opened_ids", data)
    self.assertIn("chest_opened_count", data)
    self.assertEqual(data["chest_total_count"], 227)
    # fish regression guard (spec §9)
    self.assertIn("fish_caught_ids", data)
    self.assertIn("fish_total_count", data)
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m unittest tests.e2e.test_server -v`
Expected: FAIL — `AssertionError: 404 != 200` / `KeyError: 'chest_opened_ids'`

- [ ] **Step 3: Implement route and progress keys**

Add the `/api/chests` route mirroring `/api/fish` (try `load_chests()` → `send_json`; except → 500 error JSON). In the progress handler: `try: total_chests = len(load_chests()["chests"]) except Exception: total_chests = 0`; set `summary["chest_total_count"] = total_chests` alongside the fish/beigoma overrides; add `"chest_opened_ids": [], "chest_opened_count": 0, "chest_total_count": total_chests` to the exception-fallback dict.

- [ ] **Step 4: Run tests to verify they pass, then the full suite**

Run: `python -m unittest tests.e2e.test_server -v` → PASS
Run: `python -m unittest discover -s tests -p "test_*.py"` → all green

- [ ] **Step 5: Commit**

```bash
git add src/tracker/server.py tests/e2e/test_server.py
git commit -m "feat(api): serve chest catalog and chest progress fields"
```

---

### Task 5: Frontend markup and styles

**Files:**
- Modify: `static/index.html` — nav button after the fish tab (~line 47); view panel after `#view-fish` (~line 423), before `</main>`
- Modify: `static/style.css` — column widths, chest status classes, responsive rules
- Test: `tests/e2e/test_style.py` (new `test_chest_html_structure`, `test_chest_classes_present` mirroring fish at lines 152-182); `tests/frontend/test_app.js` (extend the `index.html contains section headers and descriptions for all views` test, ~line 987)

**Interfaces:**
- Consumes: none (static markup; Task 6 wires behavior)
- Produces DOM contract for Task 6 (exact IDs): `tab-nav-chests` (with `data-view="chests"`), `nav-count-chests` (initial `0/227`), `view-chests`, `chest-filter-tabs` with buttons `data-filter="all"|"opened"|"not_opened"|"missable"` and badges `count-chest-all` (initial 227), `count-chest-opened`, `count-chest-not-opened`, `count-chest-missable`; select `region-filter` containing only `<option value="all">All Regions</option>` (JS populates regions); `search-chest-input`; `chest-table`, `chest-tbody`, `chest-empty-state`.

- [ ] **Step 1: Write the failing tests**

`test_style.py`:
```python
def test_chest_html_structure(self):
    for ident in ('id="tab-nav-chests"', 'id="nav-count-chests"', 'id="view-chests"',
                  'id="chest-filter-tabs"', 'id="count-chest-all"', 'id="count-chest-opened"',
                  'id="count-chest-not-opened"', 'id="count-chest-missable"',
                  'id="region-filter"', 'id="search-chest-input"',
                  'id="chest-table"', 'id="chest-tbody"', 'id="chest-empty-state"'):
        self.assertIn(ident, self.html)

def test_chest_classes_present(self):
    for c in ('col-region', 'col-location', 'col-chest-status',
              'status-opened', 'status-not-opened', 'missable-chip'):
        pattern = re.compile(rf'\.{re.escape(c)}[ ,{{:]')
        self.assertTrue(pattern.search(self.css), f"Missing chest class in style.css: {c}")
```
Frontend test: assert `index.html` contains `<h2 class="section-title">Chest Locations</h2>` and a `.section-desc` mentioning `227` and `Treasure Hunter`.

- [ ] **Step 2: Run to verify they fail**

Run: `python -m unittest tests.e2e.test_style -v` and `node --test tests/frontend/test_app.js`
Expected: FAIL in both

- [ ] **Step 3: Implement markup and CSS**

Nav button per spec §7.1. Panel per spec §7.2: section header (title `Chest Locations`, description referencing 227 chests and the Treasure Hunter trophy), toolbar (4 status tabs with the badge IDs above, region select, search input placeholder `Search by region, location, or how to obtain...`), 4-column table (`Region | Location | How to Obtain | Status`, `thead` classes `col-region col-location col-guide col-chest-status` — reuse existing `col-guide`/`col-status` widths where they already fit), empty state text `No chests match your active filter and search query.`. CSS: `.status-opened` (green, reuse the caught color variables), `.status-not-opened` (gray), `.missable-chip` (orange, small pill), `.col-region`/`.col-location` widths, and `<= 768px` responsive rules mirroring the fish/characters adjustments.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest tests.e2e.test_style -v` → PASS; `node --test tests/frontend/test_app.js` → PASS; then full python suite → green

- [ ] **Step 5: Commit**

```bash
git add static/index.html static/style.css tests/e2e/test_style.py tests/frontend/test_app.js
git commit -m "feat(ui): add chest tracker view markup and styles"
```

---

### Task 6: Frontend logic, filtering, and sync integration

**Files:**
- Modify: `static/app.js` — state block (~line 47), `dom` cache (~lines 79-181 + `cacheDomElements` ~line 1449), chest functions after fish (~line 1047), `applyProgress` (~line 1054), `switchView` (~line 445), `setupEventListeners` fish section (~line 1630), `init` Promise.all (~line 2092), `SYNC_TRACKERS` (~line 1185), `snapshotCounts` (Task 1), `handleSaveFileStatus` inline status (~line 1160-1175), exports (~line 2245)
- Test: `tests/frontend/test_app.js`

**Interfaces:**
- Consumes: DOM IDs (Task 5), `chest_opened_ids`/`chest_total_count` in progress payloads (Tasks 3-4), `snapshotCounts()` (Task 1)
- Produces: `filterChest(chest, openedIds?, filter?, region?, searchQuery?) -> boolean`; `createChestRowHtml(chest, isOpened) -> string`; `updateChestCounts() -> void`; `renderChestTable() -> void`; `populateRegionFilter() -> void`. State gains `chestList: []`, `chestRegions: []`, `chestOpenedIds: new Set()`, `activeChestFilter: 'all'`, `activeChestRegion: 'all'`, `chestSearchQuery: ''`. `snapshotCounts()` gains `chestCount`. `SYNC_TRACKERS` gains `{label: 'chest', labelPlural: 'chests', key: 'chestCount'}`.

- [ ] **Step 1: Write the failing tests**

```js
test('filterChest correctly filters by status, region, missable, and search text', () => {
  const opened = new Set([3030105]);           // out-of-order ID: membership is the only signal
  const chest = { chest_id: 3030105, region: 'Northern Woods', location: 'Entrance hall',
                  howToObtain: 'Open beside the broken switch.', missable: false };
  const unopened = { ...chest, chest_id: 3030106, missable: true,
                     howToObtain: 'Gimmick battle — destroy before combat ends.' };
  assert.strictEqual(app.filterChest(chest, opened, 'all', 'all', ''), true);
  assert.strictEqual(app.filterChest(unopened, opened, 'all', 'all', ''), true);
  assert.strictEqual(app.filterChest(chest, opened, 'opened', 'all', ''), true);
  assert.strictEqual(app.filterChest(unopened, opened, 'opened', 'all', ''), false);
  assert.strictEqual(app.filterChest(unopened, opened, 'not_opened', 'all', ''), true);
  assert.strictEqual(app.filterChest(chest, opened, 'missable', 'all', ''), false);
  assert.strictEqual(app.filterChest(unopened, opened, 'missable', 'all', ''), true);
  assert.strictEqual(app.filterChest(chest, opened, 'all', 'Dappled Forest', ''), false);
  assert.strictEqual(app.filterChest(chest, opened, 'all', 'Northern Woods', ''), true);
  assert.strictEqual(app.filterChest(chest, opened, 'all', 'all', 'gimmick'), false);
  assert.strictEqual(app.filterChest(chest, opened, 'all', 'all', 'entrance'), true);
});

test('createChestRowHtml renders region, location, howToObtain and status with missable chip', () => {
  const c = { chest_id: 1, region: 'Arenside', location: 'Old barn',
              howToObtain: 'Open the chest.', missable: true };
  const open = app.createChestRowHtml(c, true);
  assert.ok(open.includes('status-opened') && open.includes('Opened'));
  assert.ok(!open.includes('missable-chip'));            // chip only when NOT opened
  const closed = app.createChestRowHtml(c, false);
  assert.ok(closed.includes('status-not-opened') && closed.includes('Not Opened'));
  assert.ok(closed.includes('missable-chip') && closed.includes('Missable'));
  assert.ok(closed.includes('col-region') && closed.includes('Arenside'));
});

test('updateChestCounts updates nav badge and filter tab counts', () => { /* seed state; assert nav + 4 badges */ });
test('renderChestTable renders filtered rows and handles empty state', () => { /* filter yields none → empty state visible */ });
test('applyProgress updates chest state and triggers count and render updates', () => { /* mirrors fish test at line 930 */ });
test('buildSyncToast includes chest deltas', () => {
  const msg = app.buildSyncToast({ heroCount: 0, recipeCount: 0, beigomaCount: 0, trainerCount: 0, fishCount: 0, chestCount: 0 },
                                 { heroCount: 0, recipeCount: 0, beigomaCount: 0, trainerCount: 0, fishCount: 0, chestCount: 3 });
  assert.ok(msg.includes('+3 chests'));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL — `app.filterChest is not a function`

- [ ] **Step 3: Implement state, DOM cache, functions**

Add the state fields (Interfaces block) to the state object after the Fish Tracker section; update the `activeView` comment to include `'chests'`. Cache the Task 5 IDs in `cacheDomElements` (mirror fish lines 1449-1460). Implement the four functions + `populateRegionFilter()` after the fish functions (~line 1047):
- `filterChest`: status = `openedIds.has(chest.chest_id) ? 'opened' : 'not_opened'`; `filter` semantics: `'all'` pass, `'opened'`/`'not_opened'` compare status, `'missable'` → `chest.missable === true` **independent of open state** (spec §3); region: `region === 'all' || chest.region === region`; search: case-insensitive substring over region + location + howToObtain + notes.
- `createChestRowHtml`: 4 `<td>`s (`col-region`, `col-location`, `col-guide`, `col-chest-status`), all text through `escapeHtml`; status cell per test above; `tr` gets `is-recruited` class when opened (mirrors fish).
- `updateChestCounts`: total = `state.chestList.length` (fallback 227 not needed — data-driven per spec); badges: all/ opened / `total - opened` / missable count; nav `X/total`.
- `renderChestTable`: mirror `renderFishTable` (filter → empty state toggle → innerHTML map).

- [ ] **Step 4: Wire everything else**

- `applyProgress`: chest block mirroring fish (`Array.isArray(data.chest_opened_ids)` → Set; `file_exists === false` → empty Set) + `updateChestCounts()` / `renderChestTable()` calls (typeof-guarded).
- `switchView`: `dom.viewChests.hidden = (viewName !== 'chests')`, add `dom.tabNavChests` to the nav-tab array, `if (viewName === 'chests') renderChestTable();`.
- `setupEventListeners`: chest filter tabs, search input (+ Escape clear), region select `change` → `state.activeChestRegion` — copy the fish wiring at lines 1630-1667.
- `init`: append `/api/chests` to the `Promise.all` fetch list; on ok → `state.chestList = await chestsRes.json(); state.chestRegions = state.chestList.regions || [];` (response is an object, not array) + `populateRegionFilter()`; else error toast `Could not load chests catalog`.
- `SYNC_TRACKERS`: add the chest entry; `snapshotCounts()`: add `chestCount: state.chestOpenedIds.size` (Task 1's test now covers it automatically).
- `handleSaveFileStatus`: add `const chestCount = (statusData.chest_opened_ids || []).length;`, extend the inline status string with `· ${chestCount}/${statusData.chest_total_count ?? 0} chests`, and add `chestCount` to the toast's newCounts literal (~line 1174).
- `module.exports`: add `filterChest`, `createChestRowHtml`, `updateChestCounts`, `renderChestTable`, `populateRegionFilter`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/frontend/test_app.js` → PASS (all existing + new; Task 1's snapshot test still green)
Run: `python -m unittest discover -s tests -p "test_*.py"` → all green (unchanged)

- [ ] **Step 6: Commit**

```bash
git add static/app.js tests/frontend/test_app.js
git commit -m "feat(chests): add chest tracker state, filtering, and sync integration"
```

---

### Task 7: Full regression and handover (MEMORY)

**Files:**
- Modify: `docs/MEMORY.md` (user-renamed from `docs/NEXT_SESSION.md` — this commit lands the rename too)

**Interfaces:**
- Consumes: everything from Tasks 1-6

- [ ] **Step 1: Run both full suites and record counts**

Run: `python -m unittest discover -s tests -p "test_*.py" -v` → all green (report count; baseline was 116, expect 116 + 5 new)
Run: `node --test tests/frontend/test_app.js` → all green (report count; baseline was 41, expect 41 + 8 new)

- [ ] **Step 2: Update `docs/MEMORY.md`**

Follow its existing structure: current branch `feat/chest-tracker`; status line (all tests passing with exact counts, ready for PR); progress table rows for each task's commits; key design decisions for the Chest Tracker (save-derived status, calibration registry, `snapshotCounts` consolidation); reference links to the spec and this plan. Note the fish save-sync fix under a **fix** (not feature) heading.

- [ ] **Step 3: Commit**

The `NEXT_SESSION.md` → `MEMORY.md` rename was already committed in the session checkpoint that produced this plan's handover entry — only content changes are staged here:

```bash
git add docs/MEMORY.md
git commit -m "docs: record chest tracker completion in MEMORY.md"
```

Do **not** stage `docs/CODE_REVIEW.md` / `docs/SENIOR_CODE_REVIEW.md` — that rename is unrelated and left for the user.
