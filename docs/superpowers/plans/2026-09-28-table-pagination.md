# Table Pagination (20 Items Per Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side pagination with 20 items per page to all four tables (Heroes, Recipes, Beigoma tops, and Trainers) with accessible controls, item count info, and search/filter resets.

**Architecture:** Single reusable pagination helper (`paginateItems`) in `static/app.js` that computes total pages, boundary clamps, slices arrays to 20 items, renders a `<nav class="pagination-bar">` component with Prev/Numbered/Next buttons, and binds page click events. Table render functions delegate slicing to `paginateItems`, while filter/search events reset the corresponding active page state back to 1.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3, Node.js test runner (`node:test`, `node:assert`), Python `unittest`.

## Global Constraints

- Single-page application: All UI remains in `static/index.html` with modular view panels.
- Zero runtime external dependencies: Pure vanilla JS and CSS; no external pagination libraries.
- Page size: Exactly 20 items per page (`PAGE_SIZE = 20`).
- Scope: Exactly 4 tables (Heroes, Recipes, Beigoma Collection, Beigoma Trainers).
- Dark mode theme: Match existing dark aesthetic tokens (`--bg-surface`, `--border-subtle`, `--text-primary`, `--text-muted`, `--bg-active`).
- Search & filter interaction: Any search query change or filter tab switch resets the active page for that table back to `1`.
- Empty state: When 0 items match, hide pagination bar and show table empty state.
- All test suites must pass clean without regression (`python -m unittest discover tests`, `node --test tests/frontend/test_app.js`).
- Tooling rule: Always use `rtk git ...` for git operations.

---

### Task 1: HTML Markup for Pagination Containers

**Files:**
- Modify: `static/index.html:100-110, 170-185, 235-250, 290-305`
- Test: `tests/e2e/test_pagination_dom.py`

**Interfaces:**
- Produces: 4 pagination container elements in DOM:
  - `#heroes-pagination` in `#view-heroes`
  - `#recipes-pagination` in `#view-recipes`
  - `#beigoma-pagination` in `#subview-beigoma-collection`
  - `#trainer-pagination` in `#subview-beigoma-trainers`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/test_pagination_dom.py`:
```python
import unittest
from pathlib import Path


class TestPaginationDom(unittest.TestCase):
    def setUp(self):
        index_path = Path(__file__).resolve().parent.parent.parent / "static" / "index.html"
        self.html = index_path.read_text(encoding="utf-8")

    def test_pagination_containers_exist(self):
        self.assertIn('id="heroes-pagination"', self.html)
        self.assertIn('id="recipes-pagination"', self.html)
        self.assertIn('id="beigoma-pagination"', self.html)
        self.assertIn('id="trainer-pagination"', self.html)

    def test_pagination_aria_and_classes(self):
        self.assertIn('class="pagination-bar"', self.html)
        self.assertIn('aria-label="Heroes pagination"', self.html)
        self.assertIn('aria-label="Recipes pagination"', self.html)
        self.assertIn('aria-label="Beigoma collection pagination"', self.html)
        self.assertIn('aria-label="Beigoma trainers pagination"', self.html)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/e2e/test_pagination_dom.py`
Expected: FAIL with `AssertionError: 'id="heroes-pagination"' not found in ...`

- [ ] **Step 3: Add pagination container markup to static/index.html**

In `static/index.html`:
1. In `#view-heroes` right after `#empty-state`:
```html
        <!-- Pagination Bar -->
        <nav id="heroes-pagination" class="pagination-bar" aria-label="Heroes pagination" hidden></nav>
```
2. In `#view-recipes` right after `#recipes-empty-state`:
```html
        <!-- Pagination Bar -->
        <nav id="recipes-pagination" class="pagination-bar" aria-label="Recipes pagination" hidden></nav>
```
3. In `#subview-beigoma-collection` right after `#beigoma-empty-state`:
```html
          <!-- Pagination Bar -->
          <nav id="beigoma-pagination" class="pagination-bar" aria-label="Beigoma collection pagination" hidden></nav>
```
4. In `#subview-beigoma-trainers` right after `#trainer-empty-state`:
```html
          <!-- Pagination Bar -->
          <nav id="trainer-pagination" class="pagination-bar" aria-label="Beigoma trainers pagination" hidden></nav>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/e2e/test_pagination_dom.py`
Expected: PASS (2 tests, OK)

- [ ] **Step 5: Commit**

```bash
rtk git add static/index.html tests/e2e/test_pagination_dom.py
rtk git commit -m "feat(html): add pagination container elements for all four tables"
```

---

### Task 2: CSS Styles for Pagination Controls

**Files:**
- Modify: `static/style.css:1520-1540`
- Test: `tests/e2e/test_style.py`

**Interfaces:**
- Produces CSS classes:
  - `.pagination-bar`: Flex container matching table width, aligned between info text and controls.
  - `.pagination-info`: Muted text showing item count range (e.g. `Showing 1–20 of 121 items`).
  - `.pagination-controls`: Flex row of page buttons with gap.
  - `.page-btn`: Pill-style button with subtle borders, hover state, and focus outline.
  - `.page-btn.active`: Highlighted button for current page with `var(--bg-active)` or accent color.
  - `.page-btn:disabled`: Muted, non-clickable button for Prev/Next at boundaries.

- [ ] **Step 1: Write the failing test**

Add assertions in `tests/e2e/test_style.py`:
```python
    def test_pagination_styles_defined(self):
        css_path = Path(__file__).resolve().parent.parent.parent / "static" / "style.css"
        css = css_path.read_text(encoding="utf-8")
        self.assertIn('.pagination-bar', css)
        self.assertIn('.pagination-info', css)
        self.assertIn('.pagination-controls', css)
        self.assertIn('.page-btn', css)
        self.assertIn('.page-btn.active', css)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: FAIL with `AssertionError: '.pagination-bar' not found in ...`

- [ ] **Step 3: Add pagination CSS rules to static/style.css**

Append the following styles at the bottom of `static/style.css`:
```css
/* --- Pagination Bar --- */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 0.25rem 0.25rem 0.25rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}

.pagination-bar[hidden] {
  display: none !important;
}

.pagination-info {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--text-secondary);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  user-select: none;
}

.page-btn:hover:not(:disabled) {
  color: var(--text-primary);
  background-color: var(--bg-hover);
  border-color: var(--border-medium);
}

.page-btn.active {
  color: var(--text-primary);
  background-color: var(--bg-active);
  border-color: var(--border-focus);
  font-weight: 600;
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.page-btn-nav {
  padding: 0 0.65rem;
}

@media (max-width: 640px) {
  .pagination-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add static/style.css tests/e2e/test_style.py
rtk git commit -m "style: add responsive pagination controls styling"
```

---

### Task 3: Implement `paginateItems` Helper and State in `static/app.js`

**Files:**
- Modify: `static/app.js:30-80, 1100-1170, 1880-1925`
- Test: `tests/frontend/test_app.js`

**Interfaces:**
- Consumes: `container` (DOM element), `items` (Array), `currentPage` (number), `pageSize` (number), `onPageChange` (function)
- Produces:
  - `PAGE_SIZE = 20`
  - `state.heroesPage = 1`
  - `state.recipesPage = 1`
  - `state.beigomaPage = 1`
  - `state.trainerPage = 1`
  - `dom.heroesPagination`, `dom.recipesPagination`, `dom.beigomaPagination`, `dom.trainerPagination`
  - `paginateItems({ container, items, currentPage, pageSize = PAGE_SIZE, onPageChange }) -> Array`
  - Exports in `module.exports`: `PAGE_SIZE`, `paginateItems`

- [ ] **Step 1: Write the failing unit tests**

Add pagination unit tests in `tests/frontend/test_app.js`:
```javascript
test('PAGE_SIZE is defined as 20', () => {
  assert.strictEqual(app.PAGE_SIZE, 20);
});

test('paginateItems returns empty array and hides container when items is empty', () => {
  const dummyContainer = { innerHTML: '', hidden: false };
  const sliced = app.paginateItems({
    container: dummyContainer,
    items: [],
    currentPage: 1,
    pageSize: 20,
    onPageChange: () => {},
  });

  assert.deepStrictEqual(sliced, []);
  assert.strictEqual(dummyContainer.hidden, true);
  assert.strictEqual(dummyContainer.innerHTML, '');
});

test('paginateItems correctly slices first page, middle page, and last page', () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ id: i + 1 }));
  const dummyContainer = {
    innerHTML: '',
    hidden: true,
    addEventListener: () => {},
    querySelectorAll: () => [],
  };

  // Page 1 (items 1..20)
  const page1 = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 1,
    pageSize: 20,
  });
  assert.strictEqual(page1.length, 20);
  assert.strictEqual(page1[0].id, 1);
  assert.strictEqual(page1[19].id, 20);
  assert.strictEqual(dummyContainer.hidden, false);
  assert.ok(dummyContainer.innerHTML.includes('Showing 1–20 of 45 items'));

  // Page 2 (items 21..40)
  const page2 = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 2,
    pageSize: 20,
  });
  assert.strictEqual(page2.length, 20);
  assert.strictEqual(page2[0].id, 21);
  assert.strictEqual(page2[19].id, 40);
  assert.ok(dummyContainer.innerHTML.includes('Showing 21–40 of 45 items'));

  // Page 3 (items 41..45)
  const page3 = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 3,
    pageSize: 20,
  });
  assert.strictEqual(page3.length, 5);
  assert.strictEqual(page3[0].id, 41);
  assert.strictEqual(page3[4].id, 45);
  assert.ok(dummyContainer.innerHTML.includes('Showing 41–45 of 45 items'));
});

test('paginateItems clamps out-of-range currentPage', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
  const dummyContainer = { innerHTML: '', hidden: true, querySelectorAll: () => [] };

  // currentPage 99 should clamp to page 2 (last page)
  const pageHigh = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 99,
    pageSize: 20,
  });
  assert.strictEqual(pageHigh.length, 5);
  assert.strictEqual(pageHigh[0].id, 21);
  assert.ok(dummyContainer.innerHTML.includes('Showing 21–25 of 25 items'));

  // currentPage 0 or negative should clamp to page 1
  const pageLow = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: -1,
    pageSize: 20,
  });
  assert.strictEqual(pageLow.length, 20);
  assert.strictEqual(pageLow[0].id, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL with `TypeError: app.paginateItems is not a function` or `undefined`

- [ ] **Step 3: Implement `PAGE_SIZE`, state, and `paginateItems` in `static/app.js`**

1. Define `PAGE_SIZE = 20` near top of `static/app.js`:
```javascript
const PAGE_SIZE = 20;
```

2. Add pagination page indices in `appState` / `state`:
```javascript
  heroesPage: 1,
  recipesPage: 1,
  beigomaPage: 1,
  trainerPage: 1,
```

3. Cache DOM elements in `cacheDomElements()`:
```javascript
  dom.heroesPagination = document.getElementById('heroes-pagination');
  dom.recipesPagination = document.getElementById('recipes-pagination');
  dom.beigomaPagination = document.getElementById('beigoma-pagination');
  dom.trainerPagination = document.getElementById('trainer-pagination');
```

4. Implement `paginateItems`:
```javascript
/**
 * Renders pagination controls into a container and returns sliced items for display.
 *
 * @param {object} options
 * @param {HTMLElement|null} options.container - Container element for pagination controls
 * @param {Array} options.items - Full array of filtered items
 * @param {number} options.currentPage - Current active page (1-indexed)
 * @param {number} [options.pageSize=PAGE_SIZE] - Number of items per page
 * @param {function} [options.onPageChange] - Callback receiving new page number
 * @returns {Array} Sliced items for the current page
 */
function paginateItems({ container, items, currentPage = 1, pageSize = PAGE_SIZE, onPageChange }) {
  if (!items || items.length === 0) {
    if (container) {
      container.innerHTML = '';
      container.hidden = true;
    }
    return [];
  }

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const slicedItems = items.slice(startIndex, endIndex);

  if (!container) return slicedItems;

  container.hidden = false;

  const itemLabel = totalItems === 1 ? 'item' : 'items';
  const infoText = `Showing ${startIndex + 1}–${endIndex} of ${totalItems} ${itemLabel}`;

  // Build button HTML
  let controlsHtml = '<div class="pagination-controls">';

  // Prev button
  const prevDisabled = safePage <= 1 ? 'disabled' : '';
  controlsHtml += `<button type="button" class="page-btn page-btn-nav page-btn-prev" data-action="prev" ${prevDisabled} aria-label="Previous page">Prev</button>`;

  // Numbered page buttons
  for (let p = 1; p <= totalPages; p++) {
    const isActive = p === safePage;
    const activeClass = isActive ? ' active' : '';
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    controlsHtml += `<button type="button" class="page-btn page-btn-num${activeClass}" data-page="${p}"${ariaCurrent} aria-label="Page ${p}">${p}</button>`;
  }

  // Next button
  const nextDisabled = safePage >= totalPages ? 'disabled' : '';
  controlsHtml += `<button type="button" class="page-btn page-btn-nav page-btn-next" data-action="next" ${nextDisabled} aria-label="Next page">Next</button>`;
  controlsHtml += '</div>';

  container.innerHTML = `
    <div class="pagination-info">${infoText}</div>
    ${controlsHtml}
  `;

  // Attach event listener via delegation if callback provided
  if (typeof onPageChange === 'function') {
    const buttons = container.querySelectorAll('.page-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const pageAttr = btn.dataset.page;
        const actionAttr = btn.dataset.action;

        if (pageAttr) {
          const targetPage = parseInt(pageAttr, 10);
          if (targetPage !== safePage) {
            onPageChange(targetPage);
          }
        } else if (actionAttr === 'prev' && safePage > 1) {
          onPageChange(safePage - 1);
        } else if (actionAttr === 'next' && safePage < totalPages) {
          onPageChange(safePage + 1);
        }
      });
    });
  }

  return slicedItems;
}
```

5. Export `PAGE_SIZE` and `paginateItems` in `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add static/app.js tests/frontend/test_app.js
rtk git commit -m "feat(pagination): add paginateItems helper and state properties"
```

---

### Task 4: Integrate Pagination into Heroes and Recipes Views

**Files:**
- Modify: `static/app.js:360-390, 540-570, 1400-1460`
- Test: `tests/frontend/test_app.js`

**Interfaces:**
- Consumes: `paginateItems`, `state.heroesPage`, `state.recipesPage`
- Modifies: `renderTable()`, `renderRecipesTable()`, event listeners for filter tabs and search inputs.

- [ ] **Step 1: Write the failing tests**

Add tests in `tests/frontend/test_app.js`:
```javascript
test('renderTable renders at most 20 heroes per page with pagination bar', () => {
  // Setup 50 dummy characters
  app.state.characters = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Hero ${i + 1}`,
    location: 'Test Location',
    howToRecruit: 'Test Guide',
    missable: false,
  }));
  app.state.recruitedIds = new Set();
  app.state.activeFilter = 'all';
  app.state.searchQuery = '';
  app.state.heroesPage = 1;

  const dummyTbody = { innerHTML: '' };
  const dummyPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: () => [],
  };
  const dummyEmpty = { hidden: false };

  app.dom.charactersTbody = dummyTbody;
  app.dom.heroesPagination = dummyPagination;
  app.dom.emptyState = dummyEmpty;

  app.renderTable();

  // Page 1 should contain 20 rows
  const rowMatches = (dummyTbody.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatches, 20);
  assert.strictEqual(dummyPagination.hidden, false);
  assert.ok(dummyPagination.innerHTML.includes('Showing 1–20 of 50 heroes'));
});

test('search and filter resets heroesPage to 1', () => {
  app.state.heroesPage = 3;
  // Simulating filter tab change or search input reset
  app.setHeroesSearch('nowa');
  assert.strictEqual(app.state.heroesPage, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL

- [ ] **Step 3: Update `renderTable`, `renderRecipesTable`, and listeners in `static/app.js`**

1. Update `renderTable()`:
```javascript
function renderTable() {
  if (!dom.charactersTbody) return;

  const filtered = state.characters.filter(char =>
    filterCharacter(
      char,
      state.recruitedIds,
      state.activeFilter,
      state.searchQuery
    )
  );

  if (filtered.length === 0) {
    dom.charactersTbody.innerHTML = '';
    if (dom.emptyState) {
      dom.emptyState.hidden = false;
    }
    if (dom.heroesPagination) {
      dom.heroesPagination.innerHTML = '';
      dom.heroesPagination.hidden = true;
    }
  } else {
    if (dom.emptyState) {
      dom.emptyState.hidden = true;
    }

    const paged = paginateItems({
      container: dom.heroesPagination,
      items: filtered,
      currentPage: state.heroesPage || 1,
      pageSize: PAGE_SIZE,
      onPageChange: (newPage) => {
        state.heroesPage = newPage;
        renderTable();
      },
    });

    const htmlRows = paged
      .map(char => createCharacterRowHtml(char, state.recruitedIds.has(char.id)))
      .join('');
    dom.charactersTbody.innerHTML = htmlRows;
  }
}
```

2. Update `renderRecipesTable()`:
```javascript
function renderRecipesTable() {
  if (!dom.recipesTbody) return;

  const filtered = state.recipes.filter(r =>
    filterRecipe(
      r,
      state.acquiredRecipeIds,
      state.cookedRecipeIds,
      state.activeRecipesFilter,
      state.recipesSearchQuery
    )
  );

  if (filtered.length === 0) {
    dom.recipesTbody.innerHTML = '';
    if (dom.recipesEmptyState) dom.recipesEmptyState.hidden = false;
    if (dom.recipesPagination) {
      dom.recipesPagination.innerHTML = '';
      dom.recipesPagination.hidden = true;
    }
  } else {
    if (dom.recipesEmptyState) dom.recipesEmptyState.hidden = true;

    const paged = paginateItems({
      container: dom.recipesPagination,
      items: filtered,
      currentPage: state.recipesPage || 1,
      pageSize: PAGE_SIZE,
      onPageChange: (newPage) => {
        state.recipesPage = newPage;
        renderRecipesTable();
      },
    });

    dom.recipesTbody.innerHTML = paged
      .map(r => createRecipeRowHtml(r, state.acquiredRecipeIds.has(r.id), state.cookedRecipeIds.has(r.id)))
      .join('');
  }

  updateRecipesProgress();
}
```

3. In `setupEventListeners()`:
- In heroes search input listener: `state.heroesPage = 1;`
- In heroes filter tabs click listener: `state.heroesPage = 1;`
- In recipes search input listener: `state.recipesPage = 1;`
- In recipes filter tabs click listener: `state.recipesPage = 1;`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add static/app.js tests/frontend/test_app.js
rtk git commit -m "feat(pagination): integrate pagination into heroes and recipes tables"
```

---

### Task 5: Integrate Pagination into Beigoma Collection and Trainers Views

**Files:**
- Modify: `static/app.js:730-800, 1340-1400`
- Test: `tests/frontend/test_app.js`

**Interfaces:**
- Consumes: `paginateItems`, `state.beigomaPage`, `state.trainerPage`
- Modifies: `renderBeigoma()`, `renderTrainers()`, event listeners for Beigoma / trainer filter tabs and search inputs.

- [ ] **Step 1: Write the failing tests**

Add tests in `tests/frontend/test_app.js`:
```javascript
test('renderBeigoma and renderTrainers paginate to 20 items per page', () => {
  app.state.beigoma = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    name: `Beigoma ${i + 1}`,
    whereToObtain: 'Drop Location',
  }));
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = '';
  app.state.beigomaPage = 1;

  const dummyBeigomaList = { innerHTML: '' };
  const dummyBeigomaPagination = { innerHTML: '', hidden: true, querySelectorAll: () => [] };
  const dummyBeigomaEmpty = { hidden: false };

  app.dom.beigomaList = dummyBeigomaList;
  app.dom.beigomaPagination = dummyBeigomaPagination;
  app.dom.beigomaEmptyState = dummyBeigomaEmpty;

  app.renderBeigoma();

  // Exactly 20 rows on page 1 of 60 items
  const rowMatches = (dummyBeigomaList.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatches, 20);
  assert.strictEqual(dummyBeigomaPagination.hidden, false);
  assert.ok(dummyBeigomaPagination.innerHTML.includes('Showing 1–20 of 60 items'));
});

test('trainer search and filter tab reset trainerPage to 1', () => {
  app.state.trainerPage = 2;
  // Changing trainer filter
  app.state.trainerFilter = 'defeated';
  app.state.trainerPage = 1;
  assert.strictEqual(app.state.trainerPage, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL

- [ ] **Step 3: Update `renderBeigoma`, `renderTrainers`, and event listeners in `static/app.js`**

1. Update `renderBeigoma()`:
```javascript
function renderBeigoma() {
  if (!dom.beigomaList) return;

  const collectedSet = new Set(state.beigomaCollectedIds);
  const filtered = state.beigoma.filter(item =>
    filterBeigoma(
      item,
      collectedSet,
      state.beigomaFilter,
      state.beigomaSearch
    )
  );

  if (filtered.length === 0) {
    dom.beigomaList.innerHTML = '';
    if (dom.beigomaEmptyState) dom.beigomaEmptyState.hidden = false;
    if (dom.beigomaPagination) {
      dom.beigomaPagination.innerHTML = '';
      dom.beigomaPagination.hidden = true;
    }
  } else {
    if (dom.beigomaEmptyState) dom.beigomaEmptyState.hidden = true;

    const paged = paginateItems({
      container: dom.beigomaPagination,
      items: filtered,
      currentPage: state.beigomaPage || 1,
      pageSize: PAGE_SIZE,
      onPageChange: (newPage) => {
        state.beigomaPage = newPage;
        renderBeigoma();
      },
    });

    dom.beigomaList.innerHTML = paged
      .map(top => createBeigomaRowHtml(top, collectedSet.has(top.id)))
      .join('');
  }

  updateBeigomaStats();
}
```

2. Update `renderTrainers()`:
```javascript
function renderTrainers() {
  if (!dom.trainerList) return;

  const defeatedSet = new Set(state.beigomaDefeatedTrainerIds);
  const filtered = state.beigomaTrainers.filter(trainer =>
    filterTrainer(
      trainer,
      defeatedSet,
      state.trainerFilter,
      state.trainerSearch
    )
  );

  if (filtered.length === 0) {
    dom.trainerList.innerHTML = '';
    if (dom.trainerEmptyState) dom.trainerEmptyState.hidden = false;
    if (dom.trainerPagination) {
      dom.trainerPagination.innerHTML = '';
      dom.trainerPagination.hidden = true;
    }
  } else {
    if (dom.trainerEmptyState) dom.trainerEmptyState.hidden = true;

    const paged = paginateItems({
      container: dom.trainerPagination,
      items: filtered,
      currentPage: state.trainerPage || 1,
      pageSize: PAGE_SIZE,
      onPageChange: (newPage) => {
        state.trainerPage = newPage;
        renderTrainers();
      },
    });

    dom.trainerList.innerHTML = paged
      .map(trainer => createTrainerRowHtml(trainer, defeatedSet.has(trainer.id)))
      .join('');
  }

  updateBeigomaStats();
}
```

3. In `setupEventListeners()`:
- In beigoma search input listener: `state.beigomaPage = 1;`
- In beigoma filter tabs click listener: `state.beigomaPage = 1;`
- In trainer search input listener: `state.trainerPage = 1;`
- In trainer filter tabs click listener: `state.trainerPage = 1;`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add static/app.js tests/frontend/test_app.js
rtk git commit -m "feat(pagination): integrate pagination into beigoma and trainers tables"
```

---

### Task 6: Full Verification with All Test Suites

**Files:**
- Test: All test suites across Python and Node.js

- [ ] **Step 1: Run full Python test suite**

Run: `python -m unittest discover tests`
Expected: 100+ tests passing, 0 failures, 0 errors.

- [ ] **Step 2: Run full Node.js frontend test suite**

Run: `node --test tests/frontend/test_app.js`
Expected: All tests passing.

- [ ] **Step 3: Verification commit**

```bash
rtk git commit --allow-empty -m "test: verify all test suites pass with table pagination enabled"
```
