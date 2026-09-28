# Next Session Handover & Context

- **Current Branch:** `refactor/project-structure`
- **Working Tree:** Clean (all commits up to date)
- **Status:** Brainstorming complete, Spec approved, Implementation Plan created & committed. Ready to execute.

---

## 1. Quick Resume Instructions for Next Session

To continue in the next session, instruct the agent:
> *"Resume from `docs/NEXT_SESSION.md` and execute the implementation plan at `docs/superpowers/plans/2026-09-28-project-structure-refactor.md` starting with Task 1."*

---

## 2. Key Architecture Decisions Made

1. **Standard `src/` Layout**:
   - `src/tracker/core/`: Save file decryption (`crypto.py`), parser (`save_reader.py`), data models (`models.py`).
   - `src/tracker/config/`: Configuration persistence manager (`manager.py`) and platform detector (`detector.py` for Steam, GOG, Game Pass).
   - `src/tracker/server.py`: API endpoints and HTTP static file server.
2. **Data & Config Locations**:
   - `data/characters.json` and `data/recipes.json` moved to a dedicated `data/` folder at project root.
   - `config/config.json` moved to a dedicated `config/` folder with default `"save_path": ""`.
3. **Save File Removal**:
   - `UserData0.dat` will be removed from git tracking.
   - `.gitignore` will ignore `UserData*.dat`, `*.dat`, and `config/*.local.json`.
   - Tests will use a synthetic in-memory encrypted save generator fixture (`tests/fixtures/generator.py`).
4. **Single Root Launcher**:
   - `main.py` is the canonical entry point: `python main.py --open`.
   - `start_tracker.bat` is preserved in the project root for one-click launching.
   - The old root `server.py` and `save_reader.py` will be removed once migrated.
5. **Split Test Hierarchy**:
   - `tests/unit/`: Unit tests for crypto, characters, recipes, save reader, config.
   - `tests/e2e/`: Server API, end-to-end sync workflow, style tests.
   - `tests/frontend/`: Node.js tests (`test_app.js`).

---

## 3. Reference Documents

- **Design Specification:** [`docs/superpowers/specs/2026-09-28-project-structure-refactor-design.md`](file:///C:/Users/rekyb/Downloads/eiyuden-save-edit/docs/superpowers/specs/2026-09-28-project-structure-refactor-design.md)
- **Implementation Plan:** [`docs/superpowers/plans/2026-09-28-project-structure-refactor.md`](file:///C:/Users/rekyb/Downloads/eiyuden-save-edit/docs/superpowers/plans/2026-09-28-project-structure-refactor.md)

---

## 4. Tasks Ready to Execute (from Plan)

- [ ] **Task 1**: Scaffolding, Data Move & Save File Removal
- [ ] **Task 2**: Core Crypto & Synthetic Save Fixture Generator
- [ ] **Task 3**: Core Models, Save Reader & Domain Unit Tests
- [ ] **Task 4**: Configuration Manager & Platform Save Detector
- [ ] **Task 5**: HTTP API Server & Integration Tests Migration
- [ ] **Task 6**: Root Entry Point, Bat Launcher & Frontend Test Migration
- [ ] **Task 7**: Documentation, Cleanup & Full Verification
