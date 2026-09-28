# Beigoma Rarity Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Rarity filter dropdown to the Beigoma collection toolbar, enabling filtering by 1★ (Bronze), 2★ (Silver), 3★ (Gold), 4★ (Rainbow), or All Rarities, with search support and full test coverage.

**Architecture:**
1. Insert the select dropdown markup in `static/index.html` inside `#subview-beigoma-collection .search-filter-controls`.
2. Add unit tests for rarity filtering in `tests/frontend/test_app.js`.
3. Update `static/app.js` with `beigomaRarityFilter` state, DOM caching, event binding, `filterBeigoma` logic, and `renderBeigoma` integration.
4. Execute full Python and Node.js verification suites.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6+), Python 3 (unittest).

## Global Constraints

* Beigoma collection has exactly 60 collectible tops.
* Valid rarities are `1`, `2`, `3`, `4`.
* Filter options must match:
  * `all`: "All Rarities"
  * `4`: "4 Stars (Rainbow)"
  * `3`: "3 Stars (Gold)"
  * `2`: "2 Stars (Silver)"
  * `1`: "1 Star (Bronze)"
* Accessible markup (`label.sr-only`, `aria-label`).
* Every test suite must pass cleanly after completion.

---

### Task 1: Add HTML Markup for Beigoma Rarity Filter (`static/index.html`)

**Files:**
- Modify: `static/index.html:200-240`

**Interfaces:**
- Consumes: `.select-box` and `.select-filter` CSS classes
- Produces: `<select id="beigoma-rarity-filter">` element in DOM.

- [ ] **Step 1: Insert dropdown in `static/index.html`**

In `#subview-beigoma-collection .search-filter-controls`, insert before `.search-box`:
```html
          <div class="select-box">
            <label for="beigoma-rarity-filter" class="sr-only">Filter by Rarity</label>
            <select id="beigoma-rarity-filter" class="select-filter" aria-label="Filter by rarity">
              <option value="all">All Rarities</option>
              <option value="4">4 Stars (Rainbow)</option>
              <option value="3">3 Stars (Gold)</option>
              <option value="2">2 Stars (Silver)</option>
              <option value="1">1 Star (Bronze)</option>
            </select>
          </div>
```

- [ ] **Step 2: Commit HTML structure changes**

```bash
git add static/index.html
git commit -m "feat(html): add rarity filter dropdown to beigoma collection toolbar"
```

---

### Task 2: Implement Client State, Filtering Logic, and Automated Tests

**Files:**
- Modify: `tests/frontend/test_app.js`
- Modify: `static/app.js`

**Interfaces:**
- Consumes: `state.beigoma`, `state.beigomaRarityFilter`
- Produces: Reactive filtering by rarity in `filterBeigoma` and `renderBeigoma`.

- [ ] **Step 1: Write failing unit tests in `tests/frontend/test_app.js`**

Add tests:
```javascript
test('filterBeigoma filters by activeRarityFilter', () => {
  const top4Star = { id: 56, name: 'Devil of Destruction', rarity: 4, whereToObtain: 'Boss' };
  const top2Star = { id: 17, name: 'Sahagin', rarity: 2, whereToObtain: 'Lake' };

  // All matches both
  assert.strictEqual(app.filterBeigoma(top4Star, new Set(), 'all', '', 'all'), true);
  assert.strictEqual(app.filterBeigoma(top2Star, new Set(), 'all', '', 'all'), true);

  // Filter 4 stars
  assert.strictEqual(app.filterBeigoma(top4Star, new Set(), 'all', '', '4'), true);
  assert.strictEqual(app.filterBeigoma(top2Star, new Set(), 'all', '', '4'), false);

  // Filter 2 stars
  assert.strictEqual(app.filterBeigoma(top4Star, new Set(), 'all', '', '2'), false);
  assert.strictEqual(app.filterBeigoma(top2Star, new Set(), 'all', '', '2'), true);
});

test('filterBeigoma matches rarity tier keywords in text search query', () => {
  const top = { id: 56, name: 'Devil of Destruction', rarity: 4, whereToObtain: 'Boss' };
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'rainbow'), true);
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'gold'), false);
});

test('renderBeigoma respects state.beigomaRarityFilter', () => {
  // Setup mock DOM elements and state
  const originalList = app.dom.beigomaList;
  const originalEmpty = app.dom.beigomaEmptyState;
  const originalBeigoma = app.state.beigoma;
  const originalFilter = app.state.beigomaRarityFilter;

  const mockList = { innerHTML: '' };
  const mockEmpty = { hidden: true };
  app.dom.beigomaList = mockList;
  app.dom.beigomaEmptyState = mockEmpty;

  app.state.beigoma = [
    { id: 1, name: 'Plantvine', rarity: 1, whereToObtain: 'Drop' },
    { id: 56, name: 'Devil of Destruction', rarity: 4, whereToObtain: 'Boss' },
  ];
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = '';
  app.state.beigomaRarityFilter = '4';

  app.renderBeigoma();
  assert.ok(mockList.innerHTML.includes('Devil of Destruction'));
  assert.ok(!mockList.innerHTML.includes('Plantvine'));

  // Restore
  app.dom.beigomaList = originalList;
  app.dom.beigomaEmptyState = originalEmpty;
  app.state.beigoma = originalBeigoma;
  app.state.beigomaRarityFilter = originalFilter;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL due to `filterBeigoma` and `renderBeigoma` not yet handling `activeRarityFilter`.

- [ ] **Step 3: Implement filtering logic in `static/app.js`**

1. In `state`:
   `beigomaRarityFilter: 'all',`
2. In `cacheDomElements()`:
   `dom.beigomaRarityFilter = document.getElementById('beigoma-rarity-filter');`
3. In `bindEventListeners()`:
   ```javascript
   if (dom.beigomaRarityFilter) {
     dom.beigomaRarityFilter.addEventListener('change', (e) => {
       state.beigomaRarityFilter = e.target.value;
       renderBeigoma();
     });
   }
   ```
4. In `filterBeigoma(item, collectedIds, activeFilter, searchQuery, activeRarityFilter = 'all')`:
   ```javascript
   if (activeRarityFilter && activeRarityFilter !== 'all') {
     if (Number(item.rarity) !== Number(activeRarityFilter)) {
       return false;
     }
   }

   if (searchQuery) {
     const q = searchQuery.toLowerCase();
     const nameMatch = (item.name || '').toLowerCase().includes(q);
     const locMatch = (item.whereToObtain || '').toLowerCase().includes(q);
     const idMatch = String(item.id).includes(q);

     const rarityNames = { 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'rainbow' };
     const tierMatch = (rarityNames[item.rarity] || '').includes(q) || `${item.rarity} star`.includes(q);

     if (!nameMatch && !locMatch && !idMatch && !tierMatch) return false;
   }
   ```
5. In `renderBeigoma()`:
   Pass `state.beigomaRarityFilter` into `filterBeigoma(...)`.

- [ ] **Step 4: Run frontend tests to verify they pass**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS (all tests passing).

- [ ] **Step 5: Commit frontend implementation**

```bash
git add static/app.js tests/frontend/test_app.js
git commit -m "feat(beigoma): implement rarity dropdown filtering and tier search"
```

---

### Task 3: Full Verification Across All Python and Node.js Suites

**Files:**
- Test: All tests under `tests/`

- [ ] **Step 1: Run Python test suite**

Run: `python -m unittest discover -s tests -p "test_*.py"`
Expected: All 103 tests pass.

- [ ] **Step 2: Run Node.js test suite**

Run: `node --test tests/frontend/test_app.js`
Expected: All tests pass.
