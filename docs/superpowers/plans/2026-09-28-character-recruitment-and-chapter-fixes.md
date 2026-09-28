# Character Recruitment and Chapter Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct character recruitment instructions according to vreaper's GameFAQs Recruitment Guide (FAQ #81238), add story arc chapter availability to all 121 characters, and add a Chapter table column and filter dropdown in the tracker UI.

**Architecture:** 
1. Expand `data/characters.json` schema with a `chapter` property mapped to canonical story arcs, and update inaccurate `howToRecruit` descriptions.
2. Update unit tests in `tests/unit/test_characters.py` to enforce `chapter` validation and valid arc names.
3. Enhance `static/index.html` with a chapter select filter and table column header.
4. Add styling for chapter badges, columns, and select inputs in `static/style.css`.
5. Integrate chapter filtering, search matching, and row rendering in `static/app.js`.
6. Verify and update test suites in `tests/`.

**Tech Stack:** Python 3 (unittest, json), HTML5, CSS3, Vanilla JavaScript (ES6+).

## Global Constraints

* Total character count must remain exactly 121 (`EXPECTED_TOTAL_CHARACTERS = 121`).
* Valid roles must remain `{"Battle", "Support", "Attendant"}`.
* Story Arcs must be one of:
  * `"Prologue"`
  * `"The Watch Arc"`
  * `"Eltisweiss War Arc"`
  * `"The Alliance and Treefolk Arc"`
  * `"Eucrisse Arc"`
  * `"Shi'arc Arc"`
  * `"Guardians Arc"`
  * `"Athrabalt War Arc"`
  * `"Alliance War Arc"`
  * `"Finale Arc"`
  * `"DLC / Extra"`
* DRY, semantic markup, accessible attributes (`role`, `aria-label`).
* Every test suite must pass after completion.

---

### Task 1: Update Test Suite for Character Schema Validation

**Files:**
- Modify: `tests/unit/test_characters.py:10-77`

**Interfaces:**
- Consumes: `src.tracker.core.models.load_characters`
- Produces: Updated test assertions enforcing `"chapter"` in `REQUIRED_KEYS` and verifying arc names.

- [ ] **Step 1: Write the updated test assertions**

Update `tests/unit/test_characters.py` to add `VALID_CHAPTERS` and include `"chapter"` in `REQUIRED_KEYS` and type checking:

```python
VALID_ROLES = {"Battle", "Support", "Attendant"}
VALID_CHAPTERS = {
    "Prologue",
    "The Watch Arc",
    "Eltisweiss War Arc",
    "The Alliance and Treefolk Arc",
    "Eucrisse Arc",
    "Shi'arc Arc",
    "Guardians Arc",
    "Athrabalt War Arc",
    "Alliance War Arc",
    "Finale Arc",
    "DLC / Extra",
}
REQUIRED_KEYS = {"id", "name", "role", "chapter", "location", "howToRecruit", "missable"}
```

And in `test_required_keys_and_types`:
```python
            self.assertIsInstance(c["chapter"], str, f"Chapter must be str: {char_id}")
            self.assertIn(
                c["chapter"],
                VALID_CHAPTERS,
                f"Chapter for {char_name} must be in VALID_CHAPTERS, got '{c.get('chapter')}'",
            )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_characters.py`
Expected: FAIL with `AssertionError: Character Nowa (ID: 10) missing keys: {'chapter'}`.

- [ ] **Step 3: Commit failing test update**

```bash
git add tests/unit/test_characters.py
git commit -m "test: require chapter key and valid arc names in characters test"
```

---

### Task 2: Update Characters Data (`data/characters.json`)

**Files:**
- Modify: `data/characters.json:1-970`

**Interfaces:**
- Consumes: None
- Produces: Updated JSON database with 121 character records containing corrected `howToRecruit`, `chapter`, and `missable` fields.

- [ ] **Step 1: Update all 121 character entries in `data/characters.json`**

Each entry must have:
* `id`
* `name`
* `role`
* `chapter` (e.g. `"Prologue"`, `"The Watch Arc"`, `"The Alliance and Treefolk Arc"`, etc.)
* `location`
* `howToRecruit` (comprehensive instructions matching vreaper's GameFAQs Recruitment Guide)
* `missable` (`true` for Leene and Aleior; `false` otherwise)

- [ ] **Step 2: Run character unit tests to verify they pass**

Run: `python -m unittest tests/unit/test_characters.py`
Expected: PASS (all tests pass including count = 121, unique IDs, required keys, valid chapters, and key characters present).

- [ ] **Step 3: Commit character data updates**

```bash
git add data/characters.json
git commit -m "feat(data): add chapter arc and fix recruitment details for all 121 characters"
```

---

### Task 3: Update HTML Structure (`static/index.html`)

**Files:**
- Modify: `static/index.html:70-95`

**Interfaces:**
- Consumes: Chapter options from the schema
- Produces: Updated markup with `#chapter-filter` select dropdown and `.col-chapter` column header.

- [ ] **Step 1: Add Chapter dropdown and column header in `static/index.html`**

In `.search-filter-controls` before `.search-box`:
```html
          <div class="select-box">
            <label for="chapter-filter" class="sr-only">Filter by Chapter</label>
            <select id="chapter-filter" class="select-filter" aria-label="Filter by chapter">
              <option value="all">All Chapters</option>
              <option value="Prologue">Prologue</option>
              <option value="The Watch Arc">The Watch Arc</option>
              <option value="Eltisweiss War Arc">Eltisweiss War Arc</option>
              <option value="The Alliance and Treefolk Arc">The Alliance and Treefolk Arc</option>
              <option value="Eucrisse Arc">Eucrisse Arc</option>
              <option value="Shi'arc Arc">Shi'arc Arc</option>
              <option value="Guardians Arc">Guardians Arc</option>
              <option value="Athrabalt War Arc">Athrabalt War Arc</option>
              <option value="Alliance War Arc">Alliance War Arc</option>
              <option value="Finale Arc">Finale Arc</option>
              <option value="DLC / Extra">DLC / Extra</option>
            </select>
          </div>
```

In `.characters-table thead tr`:
```html
              <tr>
                <th scope="col" class="col-name">Name</th>
                <th scope="col" class="col-chapter">Chapter</th>
                <th scope="col" class="col-location">Location</th>
                <th scope="col" class="col-guide">How to Recruit</th>
                <th scope="col" class="col-status">Status</th>
              </tr>
```

- [ ] **Step 2: Commit HTML structure changes**

```bash
git add static/index.html
git commit -m "feat(html): add chapter filter dropdown and table column header"
```

---

### Task 4: Update Styling (`static/style.css`)

**Files:**
- Modify: `static/style.css`

**Interfaces:**
- Consumes: CSS variables (`--bg-surface`, `--border-color`, `--text-primary`, `--accent-blue`, etc.)
- Produces: Styles for `.select-filter`, `.select-box`, `.col-chapter`, and `.chapter-badge`.

- [ ] **Step 1: Add styling for `.select-filter` and `.chapter-badge`**

Add CSS rules in `static/style.css`:
```css
/* Chapter Select Filter */
.select-box {
  position: relative;
  display: flex;
  align-items: center;
}

.select-filter {
  background-color: var(--bg-surface-elevated, #23272f);
  color: var(--text-primary, #f6f7f9);
  border: 1px solid var(--border-color, #343a46);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.select-filter:focus {
  border-color: var(--accent-blue, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Chapter Column and Badge */
.col-chapter {
  width: 150px;
  min-width: 130px;
}

.chapter-badge {
  display: inline-block;
  padding: 3px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
  border-radius: 4px;
  background-color: rgba(59, 130, 246, 0.12);
  color: var(--accent-blue, #60a5fa);
  border: 1px solid rgba(59, 130, 246, 0.25);
  white-space: nowrap;
}
```

- [ ] **Step 2: Commit styling additions**

```bash
git add static/style.css
git commit -m "style: add styles for chapter filter and chapter badge"
```

---

### Task 5: Implement Chapter Filtering & Table Rendering in Client App (`static/app.js`)

**Files:**
- Modify: `static/app.js`

**Interfaces:**
- Consumes: `state.characters`, `state.activeChapterFilter`
- Produces: Chapter-filtered character lists and 5-column row rendering.

- [ ] **Step 1: Update client state, DOM caching, and event binding**

In `state`:
```javascript
activeChapterFilter: 'all',
```

In `cacheDomElements()`:
```javascript
dom.chapterFilter = document.getElementById('chapter-filter');
```

In `bindEventListeners()`:
```javascript
if (dom.chapterFilter) {
  dom.chapterFilter.addEventListener('change', (e) => {
    state.activeChapterFilter = e.target.value;
    renderCharactersTable();
  });
}
```

- [ ] **Step 2: Update `filterCharacter` to filter by chapter and search by chapter**

```javascript
function filterCharacter(char, recruitedIds, activeFilter, searchQuery, activeChapterFilter = 'all') {
  const isRecruited = recruitedIds.has(char.id);

  // Status Filter Tab
  if (activeFilter === 'recruited' && !isRecruited) return false;
  if (activeFilter === 'missing' && isRecruited) return false;
  if (activeFilter === 'missable' && !char.missable) return false;

  // Chapter Filter
  if (activeChapterFilter !== 'all' && char.chapter !== activeChapterFilter) {
    return false;
  }

  // Text Search Query
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = (char.name || '').toLowerCase().includes(q);
    const locMatch = (char.location || '').toLowerCase().includes(q);
    const guideMatch = (char.howToRecruit || '').toLowerCase().includes(q);
    const chapterMatch = (char.chapter || '').toLowerCase().includes(q);
    if (!nameMatch && !locMatch && !guideMatch && !chapterMatch) {
      return false;
    }
  }

  return true;
}
```

- [ ] **Step 3: Update `createCharacterRowHtml` to render the chapter column**

```javascript
function createCharacterRowHtml(char, isRecruited) {
  const statusBadge = isRecruited
    ? '<span class="status-badge status-recruited">Recruited</span>'
    : '<span class="status-badge status-missing">Not Recruited</span>';

  const missableBadge = char.missable
    ? '<span class="badge-missable">Missable</span>'
    : '';

  return `
    <tr class="${isRecruited ? 'is-recruited' : ''}">
      <td class="col-name">
        <div class="hero-cell">
          <span class="hero-name">${escapeHtml(char.name)}</span>
          ${missableBadge}
        </div>
      </td>
      <td class="col-chapter">
        <span class="chapter-badge">${escapeHtml(char.chapter || '—')}</span>
      </td>
      <td class="col-location">${escapeHtml(char.location || '—')}</td>
      <td class="col-guide">${escapeHtml(char.howToRecruit || '—')}</td>
      <td class="col-status">${statusBadge}</td>
    </tr>
  `;
}
```

- [ ] **Step 4: Update `renderCharactersTable` to pass `state.activeChapterFilter`**

In `renderCharactersTable()`:
Pass `state.activeChapterFilter` into `filterCharacter(...)`.

- [ ] **Step 5: Commit frontend application logic**

```bash
git add static/app.js
git commit -m "feat(app): implement chapter dropdown filtering and 5-column row rendering"
```

---

### Task 6: Verify and Update Test Suites

**Files:**
- Modify: `tests/e2e/test_style.py` or frontend unit tests if applicable
- Test: All tests under `tests/`

**Interfaces:**
- Consumes: Server endpoints, static assets, databases
- Produces: 100% passing test execution.

- [ ] **Step 1: Check existing E2E and unit tests for table column assertions**

Run: `python -m unittest discover tests`
Fix any assertions that checked for 4 columns in the heroes table to account for 5 columns.

- [ ] **Step 2: Run complete test suite**

Run: `python -m unittest discover -s tests -p "test_*.py"`
Expected: All tests PASS with 0 errors.

- [ ] **Step 3: Commit verification and test adjustments**

```bash
git add tests/
git commit -m "test: verify all test suites pass with chapter column and filter"
```
