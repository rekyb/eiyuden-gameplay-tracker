# Next Session Handover & Context

- **Current Branch:** `feat/chest-tracker`
- **Working Tree:** `config/config.json` modified (user file, never stage); `docs/SENIOR_CODE_REVIEW.md` → `docs/CODE_REVIEW.md` rename uncommitted (user's, unrelated — leave alone)
- **Status:** Chest Tracker **brainstorm → spec → implementation plan complete and committed**. Implementation NOT started. Execution method NOT yet chosen (pending user decision: subagent-driven recommended).

---

## 1. Quick Resume Instructions for Next Session

To continue in the next session, instruct the agent:
> *"Resume from `docs/MEMORY.md`. Working on `feat/chest-tracker` branch. Chest tracker spec + plan are committed; ask me which execution method to use (subagent-driven vs native) and start implementing `docs/superpowers/plans/2026-09-29-chest-tracker.md`."*

**Baseline before starting implementation:** 116 Python (`python -m unittest discover -s tests -p "test_*.py"`) + 41 Node.js (`node --test tests/frontend/test_app.js`), all green.

---

## 2. Progress Summary

### Chest Tracker (this session — `feat/chest-tracker`)

| Task | Description | Status | Commits |
|------|-------------|--------|---------|
| Branch | Created `feat/chest-tracker` from `feature/qol-improvements` (`a93b4a3`); baseline verified 116 + 41 green | ✅ Done | — |
| Spike | Read-only save analysis: chest state lives at `_fieldAction._treasureChestList._opened` (list[int]); 156 opened in user's save; ID = `<field_prefix><2-digit index>`; 26 field groups observed; 227 total per community guides (Neoseeker/FoggyProductions). Throwaway scripts in `C:\Users\rekyb\AppData\Local\Temp\opencode\chest_spike*.py` | ✅ Done | — |
| Bug Found | Fish save-sync regression: 3 count-snapshot sites in `static/app.js` (~1246, ~1338, ~1580) omit `fishCount` → toast deltas wrong; fix rolled into chest plan (Task 1 `snapshotCounts()`) | ✅ Found (fix planned) | — |
| Chest Spec | Approved design: save-synced status, heroes-style UX (region column + dropdown, text-only how-to-obtain, 4 status tabs incl. Missable), Approach 1 save-observation calibration, fish snapshot fix | ✅ Done (approved) | `9454e45` |
| Chest Plan | 7-task TDD implementation plan with exact tests/signatures + 5-item Review Focus | ✅ Done (committed, **not yet execution-approved**) | `c56c090` |
| Execution | Choose subagent-driven vs native, then run plan tasks 1–7 | ⏳ **Pending user decision** | — |

- **All tests passing:** 116 Python + 41 Node.js (unchanged this session — no code changes yet)
- **Zero regressions:** Existing Heroes, Recipes, Beigoma, and Fish tracking unaffected.

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

### Chest Tracker (approved spec §3–§7)

| Feature | Implementation Choice |
|---------|-----------------------|
| Status source | Save-synced only: `_fieldAction._treasureChestList._opened` → `chest_opened_ids` (sorted, unique, **catalog-intersected**); no manual persistence, no POST |
| ID mapping | Approach 1 save-observation: `data/chest_fields.json` registry (`field_prefix ↔ region`), built via guide count-signatures → walk (`_miniMapData._latestPassedFieldId`) → live deltas; game-file extraction explicitly NOT committed (fallback only) |
| ID rule | `chest_id = field_prefix * 100 + seq` (e.g. `3030101` = prefix `30301` + `01`) |
| Catalog | `data/chests.json`: 227 rows `{chest_id, region, location, howToObtain, method, missable, notes}` + `regions` list; compiled from Neoseeker (primary) + FoggyProductions (secondary), cross-checked to 227; **total always `len(catalog)`, never hardcoded** |
| UX | Heroes clone: nav `Chests (X/227)`, section header, 4 status tabs (`All/Opened/Not Opened/Missable`), Region dropdown (JS-populated `#region-filter`), instant search; table `Region \| Location \| How to Obtain \| Status`; orange `Missable` chip only on unopened rows; missable = gimmick-flee risk (user confirmed respawn) |
| Missable semantics | Filter over `missable: true` independent of open state (spec §3) |
| Fish bug fix | New `snapshotCounts()` helper replaces 3 triplicated inline count objects (lines ~1246 syncSave, ~1338 handleFileUpload — also fixes `null` prevCounts suppressing all upload deltas, ~1580 sync button); `SYNC_TRACKERS` gains `chestCount` |
| Safety | Save files strictly read-only; no new dependencies |

---

## 4. Reference Documents

- **Chest Tracker Spec:** [`docs/superpowers/specs/2026-09-29-chest-tracker-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-29-chest-tracker-design.md)
- **Chest Tracker Plan:** [`docs/superpowers/plans/2026-09-29-chest-tracker.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/plans/2026-09-29-chest-tracker.md)
- **Section Descriptions Spec:** [`docs/superpowers/specs/2026-09-29-section-descriptions-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-29-section-descriptions-design.md)
- **Fish Tracker Spec:** [`docs/superpowers/specs/2026-09-28-fish-tracker-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-28-fish-tracker-design.md)
- **Beigoma Tracker Spec:** [`docs/superpowers/specs/2026-09-28-beigoma-tracker-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-28-beigoma-tracker-design.md)
- **Character Fixes Spec:** [`docs/superpowers/specs/2026-09-28-character-recruitment-and-chapter-fixes-design.md`](file:///C:/projects/eiyuden-gameplay-tracker/docs/superpowers/specs/2026-09-28-character-recruitment-and-chapter-fixes-design.md)

---

## 5. Pending Decisions & Traps

1. **Execution method:** ask the user — **subagent-driven** (recommended in session) vs **native**. Plan Task 7 updates this file again at completion.
2. **Plan Task 2 STOP gate:** guide compilation may leave ambiguous/unobserved field prefixes — the agent must pause and ask the user to *enter region + save* (or open one chest there) for calibration. Expect this.
3. Prior plan text says Task 7 commits the `NEXT_SESSION → MEMORY` rename — **already done in this session's checkpoint commit**; Task 7 should only update content.
4. Never stage `config/config.json` or the `CODE_REVIEW` rename.
