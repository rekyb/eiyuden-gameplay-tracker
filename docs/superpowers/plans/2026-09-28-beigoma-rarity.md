# Beigoma Rarity Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Rarity column (1-Star to 4-Star) to the Beigoma Collection table, backed by `rarity` metadata in `data/beigoma.json`, with gold star ratings and accessibility labels.

**Architecture:** Extend `data/beigoma.json` with an integer `rarity` field (1–4) for each top. Update `static/index.html` to add the `<th>Rarity</th>` header. Add CSS rules in `static/style.css` for `.col-beigoma-rarity`, `.rarity-stars`, `.star-filled`, and `.star-empty`. Update `createBeigomaRowHtml` in `static/app.js` to render stars in the table rows. Add comprehensive Python and Node.js unit tests.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3, Python `unittest`, Node.js test runner (`node:test`, `node:assert`).

## Global Constraints

- Single-page application: All UI remains in `static/index.html`.
- Zero external runtime dependencies: Pure vanilla JS and CSS.
- Scope: Exactly the Beigoma Collection table (`#beigoma-table`). Trainers table remains 3 columns.
- Rarity values: Exactly 1 to 4 stars matching official data and wiki reference (16 1-star, 27 2-star, 12 3-star, 5 4-star).
- Text search: Remains strictly on Name and Where to Obtain; rarity is not matched.
- All test suites must pass clean without regression (`python -m unittest discover tests`, `node --test tests/frontend/test_app.js`).
- Tooling rule: Always use `rtk git ...` for git operations.

---

### Task 1: Update `data/beigoma.json` and Python Integrity Tests

**Files:**
- Modify: `tests/unit/test_beigoma.py`
- Modify: `data/beigoma.json`

**Interfaces:**
- Consumes: `data/beigoma.json`
- Produces: `rarity` integer field (1..4) for all 60 tops in `data/beigoma.json`

- [ ] **Step 1: Write the failing test**

Add assertions in `tests/unit/test_beigoma.py`:
```python
    def test_beigoma_rarity_field_and_distribution(self):
        star_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for item in self.beigoma:
            self.assertIn("rarity", item, f"Item {item.get('name')} missing rarity")
            rarity = item["rarity"]
            self.assertIsInstance(rarity, int)
            self.assertIn(rarity, [1, 2, 3, 4])
            star_counts[rarity] += 1

        self.assertEqual(star_counts[1], 16)
        self.assertEqual(star_counts[2], 27)
        self.assertEqual(star_counts[3], 12)
        self.assertEqual(star_counts[4], 5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/unit/test_beigoma.py`
Expected: FAIL with `AssertionError: 'rarity' not found in ...`

- [ ] **Step 3: Update `data/beigoma.json` with rarity for all 60 tops**

Update each item in `data/beigoma.json` with its corresponding rarity:
- **1-Star (16 items):**
  - Plantvine (id 1): 1
  - Rabbit Knight (id 2): 1
  - Huge Mite (id 3): 1
  - Lizard (id 4): 1
  - Wild Boar (id 5): 1
  - Hraesvelgr (id 6): 1
  - Cockatrice (Hatchling) (id 7): 1
  - Rabbit Mage (id 8): 1
  - Titan Slug (id 9): 1
  - Angry Bat (id 10): 1
  - Grimeoid (id 28): 1
  - Fire Beigoma (id 995): 1
  - Water Beigoma (id 996): 1
  - Wind Beigoma (id 997): 1
  - Practice Beigoma (id 998): 1
  - Practice Beigoma (id 999): 1
- **2-Star (27 items):**
  - Wyvern (id 11): 2
  - Killer Fungus (id 12): 2
  - Hellhound (id 13): 2
  - Pawn Demon (id 14): 2
  - Bear Rider (id 15): 2
  - Sahagin (id 16): 2
  - Cactus Predator (id 17): 2
  - Sea Ghost (id 18): 2
  - Remora (id 19): 2
  - Desert Serval (id 20): 2
  - Desert Crab (id 21): 2
  - Scorpion Assassin (id 22): 2
  - Gigas (id 23): 2
  - Sandfish (id 24): 2
  - Cockatrice (Adult) (id 25): 2
  - Tyrant Tortoise (id 26): 2
  - Dragon Viper (id 27): 2
  - Carbuncle (id 29): 2
  - Corpse Rider (id 30): 2
  - Seed Conqueror (id 31): 2
  - Earth Dragon (id 32): 2
  - Azhdahag (id 33): 2
  - Snow Boxer (id 35): 2
  - Assault Tiger (id 36): 2
  - Petit Gargoyle (id 38): 2
  - Hellflower (id 39): 2
  - Balor (id 40): 2
- **3-Star (12 items):**
  - Nidhoggr (id 34): 3
  - Xibalba (id 37): 3
  - Soul Reaper (id 41): 3
  - Arch-Demon (id 42): 3
  - Neo Absolute Zero (id 505): 3
  - Infinity Force (id 506): 3
  - Fenrir (id 507): 3
  - Elder Dragon (id 508): 3
  - Dragon Fang (id 600): 3
  - Gigas Fist (id 601): 3
  - Cheetalita (id 602): 3
  - Snakebite (id 603): 3
- **4-Star (5 items):**
  - Earthsmack (id 500): 4
  - Trinity Cyclone (id 501): 4
  - Azure Dragon (id 502): 4
  - Galactic Flame (id 503): 4
  - Devil of Destruction (id 504): 4

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/unit/test_beigoma.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add data/beigoma.json tests/unit/test_beigoma.py
rtk git commit -m "feat(data): add rarity attribute to all 60 beigoma tops"
```

---

### Task 2: HTML Table Header and CSS Styling

**Files:**
- Modify: `static/index.html:225-240`
- Modify: `static/style.css:1470-1490`
- Test: `tests/e2e/test_style.py`

**Interfaces:**
- Produces:
  - Header `<th scope="col" class="col-beigoma-rarity">Rarity</th>` in `#beigoma-table`
  - CSS rules: `.col-beigoma-rarity`, `.rarity-stars`, `.star-filled`, `.star-empty`

- [ ] **Step 1: Write the failing test**

Add assertions in `tests/e2e/test_style.py`:
```python
    def test_beigoma_rarity_styles_defined(self):
        css_path = Path(__file__).resolve().parent.parent.parent / "static" / "style.css"
        css = css_path.read_text(encoding="utf-8")
        self.assertIn('.col-beigoma-rarity', css)
        self.assertIn('.rarity-stars', css)
        self.assertIn('.star-filled', css)
        self.assertIn('.star-empty', css)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: FAIL with `AssertionError: '.col-beigoma-rarity' not found in ...`

- [ ] **Step 3: Update `static/index.html` and `static/style.css`**

1. In `static/index.html`:
```html
            <table id="beigoma-table" class="characters-table beigoma-table">
              <thead>
                <tr>
                  <th scope="col" class="col-beigoma-name">Beigoma Name</th>
                  <th scope="col" class="col-beigoma-location">Where to Obtain</th>
                  <th scope="col" class="col-beigoma-rarity">Rarity</th>
                  <th scope="col" class="col-beigoma-status">Status</th>
                </tr>
              </thead>
              <tbody id="beigoma-list">
```

2. In `static/style.css`:
```css
.col-beigoma-rarity {
  width: 90px;
  white-space: nowrap;
}

.rarity-stars {
  display: inline-flex;
  align-items: center;
  font-size: 0.95rem;
  line-height: 1;
  letter-spacing: 0.08em;
  user-select: none;
}

.star-filled {
  color: #f59e0b;
}

.star-empty {
  color: var(--text-muted);
  opacity: 0.35;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add static/index.html static/style.css tests/e2e/test_style.py
rtk git commit -m "feat(ui): add rarity column header and star styles"
```

---

### Task 3: Frontend JavaScript Rendering and Unit Tests

**Files:**
- Modify: `static/app.js:655-675`
- Test: `tests/frontend/test_app.js`

**Interfaces:**
- Modifies: `createBeigomaRowHtml(top, isObtained) -> string`
- Produces: 4-column row containing `td.col-beigoma-rarity` with `.star-filled` and `.star-empty`

- [ ] **Step 1: Write the failing unit tests**

Update `test('createBeigomaRowHtml produces correct markup for obtained and missing tops')` in `tests/frontend/test_app.js`:
```javascript
test('createBeigomaRowHtml produces correct markup with rarity stars', () => {
  const top3Star = { id: 41, name: 'Soul Reaper', whereToObtain: 'Drop in Deadworld', rarity: 3 };
  const html = app.createBeigomaRowHtml(top3Star, true);

  assert.ok(html.includes('col-beigoma-rarity'));
  assert.ok(html.includes('aria-label="Rarity: 3 of 4 stars"'));
  assert.ok(html.includes('<span class="star-filled">★★★</span>'));
  assert.ok(html.includes('<span class="star-empty">☆</span>'));
  assert.ok(html.includes('badge-obtained'));

  const top1Star = { id: 1, name: 'Plantvine', whereToObtain: 'Drop in Forest', rarity: 1 };
  const html1 = app.createBeigomaRowHtml(top1Star, false);
  assert.ok(html1.includes('aria-label="Rarity: 1 of 4 stars"'));
  assert.ok(html1.includes('<span class="star-filled">★</span>'));
  assert.ok(html1.includes('<span class="star-empty">☆☆☆</span>'));
  assert.ok(html1.includes('badge-missing'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL with `AssertionError: col-beigoma-rarity not found in ...`

- [ ] **Step 3: Update `createBeigomaRowHtml` in `static/app.js`**

In `static/app.js`:
```javascript
/**
 * Generates table row HTML for a Beigoma top.
 * @param {object} top
 * @param {boolean} isObtained
 * @returns {string}
 */
function createBeigomaRowHtml(top, isObtained) {
  const statusBadge = isObtained
    ? '<span class="status-badge badge-obtained">Obtained</span>'
    : '<span class="status-badge badge-missing">Not Obtained</span>';

  const rarity = Math.max(1, Math.min(4, parseInt(top.rarity, 10) || 1));
  const filledStars = '★'.repeat(rarity);
  const emptyStars = '☆'.repeat(4 - rarity);

  const rarityHtml = `
    <span class="rarity-stars" aria-label="Rarity: ${rarity} of 4 stars" title="${rarity} of 4 stars">
      <span class="star-filled">${filledStars}</span><span class="star-empty">${emptyStars}</span>
    </span>
  `;

  return `
    <tr class="${isObtained ? 'is-recruited' : ''}">
      <td class="col-beigoma-name">${escapeHtml(top.name)}</td>
      <td class="col-beigoma-location">${escapeHtml(top.whereToObtain || '—')}</td>
      <td class="col-beigoma-rarity">${rarityHtml}</td>
      <td class="col-beigoma-status">${statusBadge}</td>
    </tr>
  `;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add static/app.js tests/frontend/test_app.js
rtk git commit -m "feat(beigoma): render rarity stars in beigoma collection rows"
```

---

### Task 4: Full Verification Across All Test Suites

**Files:**
- Test: All test suites across Python and Node.js

- [ ] **Step 1: Run full Python test suite**

Run: `python -m unittest discover tests`
Expected: 103+ tests passing, 0 failures, 0 errors.

- [ ] **Step 2: Run full Node.js frontend test suite**

Run: `node --test tests/frontend/test_app.js`
Expected: 41+ tests passing, 0 failures.

- [ ] **Step 3: Verification commit**

```bash
rtk git commit --allow-empty -m "test: verify all test suites pass with beigoma rarity column"
```
