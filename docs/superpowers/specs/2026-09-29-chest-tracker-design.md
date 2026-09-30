# Chest Tracker Design Specification

**Date:** 2026-09-29  
**Branch:** `feat/chest-tracker`  
**Status:** Approved  

---

## 1. Overview & Goals

The Chest Tracker introduces complete tracking for the 227 treasure chests in *Eiyuden Chronicle: Hundred Heroes*. It enables players to:
1. Track all **227 chests** required for the **Treasure Hunter** trophy/achievement.
2. See each chest's **location per region** and **how to obtain it** (opened in the field/dungeon vs. gimmick battle).
3. Automatically detect opened chests from the player's encrypted save file (`UserData*.dat`) — 100% read-only.
4. Filter by status (**All / Opened / Not Opened / Missable**), by **Region**, and via instant search.

The UX mirrors the Heroes tracker exactly: section header → toolbar (status tabs + dropdown + search) → table → empty state.

**Scope decisions (confirmed with user):**
- Status source: **save-synced auto detection** (spike-verified, see §4).
- Catalog compiled by the agent from community guides (Neoseeker, FoggyProductions — 227 total, per-region lists).
- Region shown as a **table column + dropdown filter** (not grouped sections).
- "How to obtain" is a **free-text column** (no method filter/badges in v1; taxonomy retained in data).
- **Missable tab included**: gimmick-battle chests flagged `missable: true` (user confirmed fled gimmick chests respawn, so missable = flee-risk flag, not permanent loss).

---

## 2. Architecture & Data Flow

Follows the established tracker pattern (fish is the closest template), with **no manual persistence layer** — unlike recipes' "cooked" state, chest status is 100% derived from the save file; no `POST` endpoint or server-side state store exists.

- **Static Metadata**: Canonical chest catalog in `data/chests.json` (227 entries + region list) and field-prefix registry in `data/chest_fields.json`.
- **Dynamic Save File Extraction**: `save_reader.py` decrypts `UserData*.dat` and extracts opened chest IDs from `_fieldAction._treasureChestList._opened`.
- **Backend API**: `server.py` serves catalog via `GET /api/chests` and progress via `GET /api/progress`.
- **Frontend**: `index.html`, `app.js`, `style.css` render nav tab, toolbar, and 4-column table with status badges.

```
+-----------------------+      +--------------------+
| data/chests.json      | ---> | GET /api/chests    | -----\
| data/chest_fields.json|      +--------------------+       \
+-----------------------+                                    +--> [Frontend: app.js]
+-----------------------+      +--------------------+       /     - Nav Tab: Chests (0/227)
| Save File (.dat)      | ---> | GET /api/progress  | -----/      - Toolbar: 4 Status Tabs
| - _fieldAction        |      | (chest_opened_ids, |             + Region Dropdown + Search
|   ._treasureChestList |      |  counts)           |             - 4-Column Table
|   ._opened            |      +--------------------+             - Opened / Not Opened chips
+-----------------------+
```

**Read-only guarantee:** the feature never writes to the save file.

**Component change list:**

| Layer | New/Changed | Work |
|---|---|---|
| `data/chests.json` | new | 227 chest rows + region list, compiled from guides, with field-prefix IDs |
| `data/chest_fields.json` | new | `field_prefix` ↔ `region` calibration registry |
| `src/tracker/core/models.py` | changed | `load_chests()` (+ `load_chest_fields()`) |
| `src/tracker/core/save_reader.py` | changed | extract `chest_opened_ids` → counts in save summary |
| `src/tracker/server.py` | changed | `GET /api/chests`; chest counts in `/api/progress` |
| `static/index.html` | changed | nav tab + `#view-chests` panel |
| `static/app.js` | changed | state, filters, rendering, `SYNC_TRACKERS` `chestCount` entry, `snapshotCounts()` helper (§6) |
| `static/style.css` | changed | column-width rules only; reuse existing classes |

---

## 3. Data Models & Specifications

### 3.1 Chest Dataset (`data/chests.json`)

Exactly **227** entries (community-verified total for the Treasure Hunter trophy).

Schema:
```json
{
  "regions": ["Grum County", "Northern Woods", "The Runebarrows"],
  "chests": [
    {
      "chest_id": 3030101,
      "region": "Northern Woods",
      "location": "The Runebarrows — entrance hall",
      "howToObtain": "Open the chest beside the broken switch.",
      "method": "field",
      "missable": false,
      "notes": ""
    }
  ]
}
```

Fields:
- `chest_id` (`int`): Save-linked ID = `field_prefix` + 2-digit index (e.g. prefix `30301` + `01`). ID length varies with prefix length (5-digit or 3-digit prefixes observed). Drives per-row status.
- `region` (`str`): Top-level area for the Region column and dropdown filter. **Must be a member of `regions`.**
- `location` (`str`): Sub-area/dungeon detail — the "location per region".
- `howToObtain` (`str`): Free text, searchable. E.g. "Open the chest in the deeper section of Bounty Hill." or "Gimmick battle — destroy the chest before combat ends."
- `method` (`str`): `field` | `gimmick_battle`. Not rendered in v1 (YAGNI-safe taxonomy retained for future filtering).
- `missable` (`bool`): `true` for gimmick-battle flee-risk chests; powers the Missable tab and chip.
- `notes` (`str`, optional): Extra tips (contents of note, quest dependency like "after defeating Chandra").

### 3.2 Field Registry (`data/chest_fields.json`)

Maps save-file field prefixes to named regions. Separate file so guide re-compilation never disturbs ID mapping.

```json
{
  "fields": [
    { "field_prefix": 30301, "region": "Northern Woods", "guide_chest_count": 5, "verified_via": "count_signature" },
    { "field_prefix": 701,   "region": "Arenside",        "guide_chest_count": 1, "verified_via": "walk" }
  ]
}
```

- `verified_via`: `count_signature` | `walk` | `delta` (audit trail of how the mapping was established).
- Coverage test (§9) requires every catalog `chest_id` prefix to exist here.

---

## 4. ID Mapping & Calibration Strategy (Approach 1: save-observation)

**Problem:** the save stores integer chest IDs only; guides have names but no IDs. Spike (read-only) established:
- `_fieldAction._treasureChestList._opened` = `list[int]` (156 opened in user's save).
- ID structure = `<field_prefix><2-digit index>`; 26 field groups observed (e.g. `30501` → indices 01–32).
- Only **~45 field-prefix ↔ region bindings** are needed — not per-chest mappings.

**Calibration workflow (during implementation):**
1. **Compile guide data**: regions, per-region chest counts, location/how-to text → `data/chests.json` (`chest_id` values not yet assigned; they are filled in during steps 2–4).
2. **Count-signature match**: guide chest counts per area ↔ observed group counts in the user's save (e.g. field `30301` group = 5 ↔ guide "Northern Woods: 5"). Bind unambiguous pairs into `chest_fields.json`.
3. **Walk calibration** for ambiguous pairs: the save's `_miniMapData._latestPassedFieldId` updates as the player moves — visiting each ambiguous region binds its field ID from the live save.
4. **Live delta verification**: as the user opens their remaining chests, appended IDs verify assignments (`verified_via: delta`).
5. **Per-row index assignment**: rows for already-opened chests need no exact index (they render Opened regardless — only set membership matters). Unopened rows use guide listing order; any mismatch self-corrects via live deltas (known limitation, documented; the user's 156/227 progress bounds the exposure to 71 rows).

**Fallback (not committed):** game-file extraction for ground truth if calibration proves ambiguous — identical schema, no rework.

---

## 5. Backend Implementation

### 5.1 Models (`src/tracker/core/models.py`)
- `load_chests(data_dir)` → dict with `regions` and `chests` (mirrors `load_fish()`; loads JSON, returns as-is with safe defaults).
- `load_chest_fields(data_dir)` → dict with `fields` list.

### 5.2 Save Reader (`src/tracker/core/save_reader.py`)
In `read_save_summary(filepath)`:
1. Read `save_data.get("_fieldAction", {})` → `.get("_treasureChestList", {})` → `.get("_opened", [])`.
2. Keep only `int` values → sorted unique `chest_opened_ids`.
3. **Missing `_fieldAction` / `_treasureChestList` / `_opened` (new game, older save, malformed) → empty list, no error.**
4. `chest_opened_count = len(set(chest_opened_ids) ∩ catalog_ids)` — **only IDs present in the catalog count** (badge math always ≤ total; compilation gaps surface in CI via §9 coverage test, not in UI).
5. `chest_total_count = len(catalog.chests)` — **from data, never hardcoded.**
6. **Catalog access**: `save_reader` loads the catalog via `models.load_chests()` (safe: `models` does not import `save_reader`, so no circular dependency). Same pattern used for fish total (currently hardcoded `52` — left untouched to avoid unrelated churn).

### 5.3 API Endpoints (`src/tracker/server.py`)
1. `GET /api/chests`:
   - Returns the catalog object (`regions` + `chests`) from `data/chests.json`.
2. `GET /api/progress` (and alias `/api/save/status`):
   - Extends response dictionary with:
     ```json
     {
       "chest_opened_ids": [3030101, 3030102, ...],
       "chest_opened_count": 156,
       "chest_total_count": 227
     }
     ```

---

## 6. Fish Save-Sync Bug Fix (discovered during brainstorm)

**Confirmed defect:** three count-snapshot objects in `static/app.js` omit `fishCount`, so `buildSyncToast` computes fish delta against `0`:

| Site | Line (approx.) |
|---|---|
| `syncSave()` `prevCounts` | 1246 |
| `handleFileUpload()` toast | 1338 |
| Sync button `prevCounts` | 1580 |

**Fix:** extract a single `snapshotCounts()` helper returning `{ heroCount, recipeCount, beigomaCount, trainerCount, fishCount, chestCount }` and use it at all three sites. One source of truth so trackers can never drift apart again (this triplication is exactly what the fish feature missed).

`SYNC_TRACKERS` gains `{ label: 'chest', labelPlural: 'chests', key: 'chestCount' }`; inline sync status line gains `· N/227 chests`.

---

## 7. Frontend UI & UX

### 7.1 Main Navigation Tab (`index.html`)
```html
<button type="button" id="tab-nav-chests" class="nav-tab" role="tab" aria-selected="false" data-view="chests">
  Chests <span class="nav-badge" id="nav-count-chests">0/227</span>
</button>
```

### 7.2 Chests View Panel (`#view-chests`)
1. **Section header**: `.section-header` with title (e.g. "Chest Locations") + description referencing all 227 chests and the Treasure Hunter trophy.
2. **Toolbar (`.toolbar`)**:
   - **Status tabs** (`data-filter`): `All <badge #count-chest-all>227`, `Opened`, `Not Opened`, `Missable`.
   - **Region dropdown** (`#region-filter`): `All Regions` + one option per `regions` entry.
   - **Search** (`#search-chest-input`): instant, debounced; spans region + location + howToObtain (+ notes).
3. **Table (4 columns)** — `Region | Location | How to Obtain | Status`:
   - **Status cell**: green `.status-badge` `Opened` / gray `Not Opened`; unopened missable rows add a small orange `Missable` chip.
4. **Empty state** (`#chest-empty-state`): "No chests match your active filter and search query."

**Behavior:** status tabs + region dropdown + search combine (identical filter logic to heroes). Row badge counts update reactively. View registers in `switchView()`; `updateProgress()` updates the nav badge.

**State/render wiring (`app.js`)** — fish naming convention:
- `state.chestOpenedIds = new Set()` populated in `applyProgress()` from `data.chest_opened_ids` (empty-set reset when `file_exists === false`).
- `updateChestCounts()` + `renderChestTable()` called from `applyProgress()`.

**CSS:** reuse `.section-header`, `.toolbar`, `.filter-tab`, `.select-filter`, `.search-box`, `.table-wrapper`, `.status-badge`, `.badge`. New rules limited to `.col-region` / `.col-location` widths and responsive adjustments (`<= 768px`).

---

## 8. Error & Edge Handling

| Case | Behavior |
|---|---|
| Save without `_treasureChestList` (new game, older save) | `opened_ids = []` → all rows Not Opened; no error |
| `_treasureChestList` present, no `_opened` key | same as above |
| Corrupt/missing save file | existing `handleSaveFileStatus` flow covers all trackers — chests ride along |
| Opened save IDs not in catalog | ignored in counts; CI coverage test surfaces gaps |
| Duplicate/missing `chest_id` in catalog | schema validation test fails |
| Empty `regions`/`chests` (file missing) | `load_chests()` safe defaults; API returns empty catalog; UI shows empty state |
| Frontend fetch failure (`/api/chests`) | existing sync/network error toast pattern |

---

## 9. Testing & Quality Assurance

1. **Unit Tests**:
   - `tests/unit/test_chests.py` (new): catalog schema — exactly 227 entries, unique `chest_id`s, every `region` ∈ `regions`, `method` ∈ `{field, gimmick_battle}`, `missable` bool; `chest_id` structure (prefix + 2-digit index); **calibration coverage** — every `chest_id` prefix ∈ `chest_fields.json`.
   - `tests/unit/test_save_reader.py` (extended): extraction from fixture saves; missing keys → empty list; intersection count math; total from catalog length.
2. **Integration / Server Tests**:
   - `tests/e2e/test_server.py` (extended): `GET /api/chests` serves catalog; `/api/progress` includes chest keys (and still includes fish keys — regression guard).
   - `tests/fixtures/generator.py` (extended): fixture saves gain `_fieldAction._treasureChestList._opened`.
   - `tests/e2e/test_style.py` (extended): `#view-chests` section header, columns, and classes.
3. **Frontend Tests** (`tests/frontend/test_app.js`):
   - `applyProgress` populates `chestOpenedIds`; status-tab / region-dropdown / search combinations; `Opened`/`Not Opened`/`Missable` chip rendering; empty state.
   - `snapshotCounts()` includes **all** `SYNC_TRACKERS` keys (fish regression guard).
4. **Full Regression**: all existing 116 Python + 41 Node.js tests remain green with zero regressions.

---

## 10. Handover & Context Update

`docs/MEMORY.md` will be updated to reflect the `feat/chest-tracker` branch, this spec, the implementation plan, and progress milestones (including calibration status). The fish save-sync fix (§6) ships with this feature and is called out there as a fix, not a new feature.
