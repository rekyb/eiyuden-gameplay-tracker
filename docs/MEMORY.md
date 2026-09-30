# Next Session Handover & Context

- **Current Branch:** `hotfix-fish-sync-bug` (renamed from `feat/chest-tracker` on 2026-09-30)
- **Working Tree:** `config/config.json` modified (user file, never stage); `docs/SENIOR_CODE_REVIEW.md` → `docs/CODE_REVIEW.md` rename uncommitted (user's, unrelated — leave alone)
- **Status:** **Scope narrowed to the fish save-sync bug fix only.** That fix is committed and complete. Chest Tracker Tasks 2–6 were **abandoned by user decision on 2026-09-30**; all chest design docs are intentionally retained.

---

## 1. Quick Resume Instructions for Next Session

To continue in the next session, instruct the agent:
> *"Resume from `docs/MEMORY.md`. I'm on `hotfix-fish-sync-bug`. The fish save-sync fix is done and tested. The Chest Tracker was paused after the design/plan stage — see §2 for what was abandoned and what to keep."*

**Baseline (verified green 2026-09-30):** 116 Python (`python -m unittest discover -s tests -p "test_*.py"`) + 42 Node.js (`node --test tests/frontend/test_app.js`).

---

## 2. Progress Summary

### Shipped on this branch — fish save-sync bug fix

| Task | Description | Status | Commits |
|------|-------------|--------|---------|
| Branch | Created from `feature/qol-improvements` (`a93b4a3`) | ✅ Done | — |
| Plan Task 1 | `snapshotCounts()` helper consolidates tracker count snapshots; replaces 3 triplicated inline count objects. Also fixes `handleFileUpload()` passing `null` as `prevCounts`, which suppressed upload deltas entirely | ✅ Done | `666802e` |
| Test | `snapshotCounts covers every SYNC_TRACKERS key` — a guard against this bug class recurring (auto-covers any tracker key added later) | ✅ Done | `666802e` |
| Branch rename | `feat/chest-tracker` → `hotfix-fish-sync-bug` | ✅ Done | — |

- **All tests passing:** 116 Python + 42 Node.js
- **Zero regressions:** Heroes, Recipes, Beigoma, and Fish tracking unaffected.

### Abandoned — Chest Tracker Tasks 2–6 (2026-09-30)

Paused by user decision after Task 1. **Nothing from Tasks 2–6 was ever committed** — no data files, no backend, no UI. Specifically:

| Was going to add | Now |
|-------------------|-----|
| `data/chests.json` (227-row catalog) | Not created |
| `data/chest_fields.json` (calibration registry) | Not created |
| `src/tracker/core/models.py` `load_chests` / `load_chest_fields` | Not created |
| `save_reader.py` chest extraction + summary keys | Not created |
| `GET /api/chests` + `/api/progress` chest keys | Not created |
| Chest view in `static/index.html` / `style.css` | Not created |
| `static/app.js` chest state, filtering, sync wiring | Not created |

**One artifact was discarded:** `tests/unit/test_chests.py` (uncommitted, Task 2 Step 1, red on arrival). Deleted on abandon. Its full source is preserved verbatim in the plan at Task 2 Step 1, so nothing is lost — see [`docs/superpowers/plans/2026-09-29-chest-tracker.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/plans/2026-09-29-chest-tracker.md).

**Throwaway calibration scripts** (read-only save analysis, safe to delete) live in `C:\Users\rekyb\AppData\Local\Temp\opencode\chest_spike{,2,3,4}.py`. Their findings are recorded in §3 below.

### Prior completed work (from `feature/qol-improvements`, ready for PR)

| Task | Description | Status | Commits |
|------|-------------|--------|---------|
| Chars Schema | Unit test validation for `chapter` and valid story arc names | ✅ Done (merged) | `ae9e76d` |
| Chars Data | Added Story Arc chapter and corrected recruitment instructions for all 121 characters (GameFAQs #81238) | ✅ Done (merged) | `19d05dd`, `83b2f8c` |
| Chars HTML | Added Chapter filter dropdown and table column header | ✅ Done (merged) | `d72a7ae` |
| Styling | Added CSS for `.select-box`, `.select-filter`, `.col-chapter`, and `.chapter-badge` with responsive layout | ✅ Done (merged) | `0114f99` |
| Chars JS | Implemented chapter dropdown filtering, instant search by chapter, and 5-column row rendering | ✅ Done (merged) | `034c31e` |
| Beigoma Data | Aligned all 60 Beigoma top rarities with the canonical RPG Site 4-tier distribution (16 Bronze, 27 Silver, 12 Gold, 5 Rainbow) | ✅ Done (merged) | `8c23f9a` |
| Beigoma HTML | Added Rarity filter dropdown to Beigoma collection toolbar | ✅ Done (merged) | `ee25088` |
| Beigoma JS | Implemented client-side rarity dropdown filtering, tier keyword search, and reactive list rendering | ✅ Done (merged) | `583eaa6` |
| Fish Tracker | Full 52-fish tracker (data, core, server, markup, client, verification) | ✅ Done (merged) | `ad8b064` … `9653347` |
| Section Descriptions | Headers/banners for all 4 views — spec, plan, tests, CSS, HTML, verification | ✅ Done (merged) | `dbccbaf` … `c02562f` |

---

## 3. Key Design Decisions

### Shipped — fish save-sync fix

| Feature | Implementation Choice |
|---------|-----------------------|
| Root cause | Three inline count-snapshot objects in `static/app.js` (`syncSave` ~line 1246, `handleFileUpload` ~line 1338, sync-button handler ~line 1580) each omitted keys. `handleFileUpload` additionally passed `null` as `prevCounts`, zeroing all upload deltas |
| Fix | Single `snapshotCounts()` helper beside `SYNC_TRACKERS`, reading current `state`; all three call sites use it |
| Regression guard | Test asserts every `SYNC_TRACKERS` key exists in the snapshot and is a number — fails if a future tracker is added to one list but not the other |
| Safety | No new dependencies; save files still strictly read-only |

### Retained for a future session — Chest Tracker design (spec §3–§7)

Useful if the tracker is ever revived; **none of this is implemented.**

| Feature | Implementation Choice |
|---------|-----------------------|
| Status source | Save-synced only: `_fieldAction._treasureChestList._opened` → `chest_opened_ids` (sorted, unique, **catalog-intersected**); no manual persistence, no POST |
| ID mapping | Approach 1 save-observation: `data/chest_fields.json` registry (`field_prefix ↔ region`), built via guide count-signatures → walk (`_miniMapData._latestPassedFieldId`) → live deltas; game-file extraction explicitly NOT committed (fallback only) |
| ID rule | `chest_id = field_prefix * 100 + seq` (e.g. `3030101` = prefix `30301` + `01`) |
| Catalog | `data/chests.json`: 227 rows `{chest_id, region, location, howToObtain, method, missable, notes}` + `regions` list; compiled from Neoseeker (primary) + FoggyProductions (secondary), cross-checked to 227; **total always `len(catalog)`, never hardcoded** |
| UX | Heroes clone: nav `Chests (X/227)`, section header, 4 status tabs (`All/Opened/Not Opened/Missable`), Region dropdown (JS-populated `#region-filter`), instant search; table `Region \| Location \| How to Obtain \| Status`; orange `Missable` chip only on unopened rows; missable = gimmick-flee risk (user confirmed respawn) |
| Missable semantics | Filter over `missable: true` independent of open state (spec §3) |
| Safety | Save files strictly read-only; no new dependencies |

### Spike findings (reusable, from the abandoned session)

- Chest state lives at `_fieldAction._treasureChestList._opened` (`list[int]`)
- 156 chests opened in the user's save at spike time
- 26 distinct field groups observed
- Community guides (Neoseeker / FoggyProductions) agree the game total is **227**

---

## 4. Reference Documents

- **Chest Tracker Spec (retained, not implemented):** [`docs/superpowers/specs/2026-09-29-chest-tracker-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-29-chest-tracker-design.md)
- **Chest Tracker Plan (retained, Tasks 1 done / 2–6 abandoned):** [`docs/superpowers/plans/2026-09-29-chest-tracker.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/plans/2026-09-29-chest-tracker.md)
- **Section Descriptions Spec:** [`docs/superpowers/specs/2026-09-29-section-descriptions-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-29-section-descriptions-design.md)
- **Fish Tracker Spec:** [`docs/superpowers/specs/2026-09-28-fish-tracker-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-28-fish-tracker-design.md)
- **Beigoma Tracker Spec:** [`docs/superpowers/specs/2026-09-28-beigoma-tracker-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-28-beigoma-tracker-design.md)
- **Character Fixes Spec:** [`docs/superpowers/specs/2026-09-28-character-recruitment-and-chapter-fixes-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-28-character-recruitment-and-chapter-fixes-design.md)

---

## 5. Pending Decisions & Traps

1. **PR base branch is ambiguous — confirm before opening the PR.** `feature/qol-improvements` (the fork point, `a93b4a3`) is itself an unmerged PR branch sitting 21 commits ahead of `master`. A PR from this branch targets `feature/qol-improvements` to show only the 5 new commits; targeting `master` would fold in all 21.
2. `config/config.json` now holds a real `save_path` and a non-empty `cooked_recipe_ids` array — it is a local user file, **never stage it**.
3. The `docs/SENIOR_CODE_REVIEW.md` → `docs/CODE_REVIEW.md` rename is the user's uncommitted change — **never stage it**.
4. If the Chest Tracker is revived, the plan's Task 2 Step 5 is a **STOP gate**: ambiguous field prefixes require the human partner to enter a region and save, or open one chest there, for calibration.
