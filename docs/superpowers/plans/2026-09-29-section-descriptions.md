# Section Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add semantic header banners with titles and concise descriptions to each of the four main tracker view panels (Heroes, Recipes, Beigoma, Fish) in the Eiyuden Chronicle Gameplay Tracker.

**Architecture:** Add semantic `<header class="section-header">` elements to each view panel in `static/index.html`, style them in `static/style.css` using existing theme tokens with responsive breakpoints, and add automated test coverage across both backend style validation and frontend tests.

**Tech Stack:** HTML5 semantic markup, CSS3 (custom properties / responsive design), Python `unittest` (style and class coverage), Node.js `node:test` (DOM/HTML assertions).

## Global Constraints
- Minimalist aesthetic aligned with existing theme tokens (`var(--text-primary)`, `var(--text-secondary)`, `var(--border-subtle)`).
- All classes added to `static/index.html` must be defined in `static/style.css` to satisfy `TestStyleCSS.test_html_classes_covered_in_css`.
- Zero runtime JavaScript dependencies or rendering overhead for section headers.
- All existing 114 Python tests and 40 frontend tests must continue to pass without regressions.

---

### Task 1: Add Unit & Style Tests for Section Headers

**Files:**
- Modify: `tests/e2e/test_style.py:80-97`
- Modify: `tests/frontend/test_app.js:980-991`

**Interfaces:**
- Consumes: `static/index.html`, `static/style.css`
- Produces: Failing test assertions verifying `section-header`, `section-title`, and `section-desc` exist and are styled.

- [ ] **Step 1: Write the failing tests in `tests/e2e/test_style.py` and `tests/frontend/test_app.js`**

In `tests/e2e/test_style.py`, add a test method `test_section_headers_present`:
```python
    def test_section_headers_present(self):
        """Classes for section header banners must be styled."""
        required = [
            'section-header',
            'section-title',
            'section-desc',
        ]
        for c in required:
            pattern = rf'(\.{re.escape(c)}[\s,\.\:\[\{{\>])'
            self.assertTrue(re.search(pattern, self.css), f"Required section header class missing in style.css: {c}")

    def test_section_headers_in_html(self):
        """Each view panel in index.html must contain section header and description."""
        self.assertIn('Hero Recruitment', self.html)
        self.assertIn('Cooking Recipes', self.html)
        self.assertIn('Beigoma Collection &amp; Trainers', self.html)
        self.assertIn('Fish Collection', self.html)
```

In `tests/frontend/test_app.js`, add tests asserting the section headers and descriptions:
```javascript
test('index.html contains section headers and descriptions for all views', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const htmlPath = path.resolve(__dirname, '../../static/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('class="section-header"'), 'section-header class should be present');
  assert.ok(html.includes('class="section-title"'), 'section-title class should be present');
  assert.ok(html.includes('class="section-desc"'), 'section-desc class should be present');

  // Verify all 4 view sections have their header titles
  assert.ok(html.includes('Hero Recruitment'));
  assert.ok(html.includes('Cooking Recipes'));
  assert.ok(html.includes('Beigoma Collection &amp; Trainers') || html.includes('Beigoma Collection & Trainers'));
  assert.ok(html.includes('Fish Collection'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest tests/e2e/test_style.py`
Expected: FAIL with missing section header classes/text.

Run: `node --test tests/frontend/test_app.js`
Expected: FAIL with `section-header class should be present`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/e2e/test_style.py tests/frontend/test_app.js
git commit -m "test: add assertions for section header banners and classes"
```

---

### Task 2: Add CSS Rules in `static/style.css`

**Files:**
- Modify: `static/style.css:1056-1065` and `static/style.css:1420-1435`

**Interfaces:**
- Consumes: CSS custom properties (`--border-subtle`, `--text-primary`, `--text-secondary`)
- Produces: CSS rules for `.section-header`, `.section-title`, `.section-desc`, including mobile media query styles.

- [ ] **Step 1: Add `.section-header`, `.section-title`, and `.section-desc` to `static/style.css`**

Add right before `/* --- View Panels (Heroes / Recipes) --- */`:
```css
/* --- Section Header Banners --- */
.section-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.section-title {
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.section-desc {
  font-size: 0.825rem;
  color: var(--text-secondary);
  line-height: 1.45;
  margin: 0;
}
```

And in the responsive `@media (max-width: 768px)` section:
```css
  .section-header {
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .section-title {
    font-size: 1.05rem;
  }

  .section-desc {
    font-size: 0.775rem;
  }
```

- [ ] **Step 2: Verify `test_section_headers_present` passes**

Run: `python -m unittest tests.e2e.test_style.TestStyleCSS.test_section_headers_present`
Expected: PASS

- [ ] **Step 3: Commit CSS styles**

```bash
git add static/style.css
git commit -m "style: add section header banner typography and responsive styles"
```

---

### Task 3: Add HTML Markup for Section Headers in `static/index.html`

**Files:**
- Modify: `static/index.html:53-56`, `static/index.html:128-132`, `static/index.html:203-207`, `static/index.html:332-336`

**Interfaces:**
- Consumes: CSS classes `.section-header`, `.section-title`, `.section-desc`
- Produces: Accessible semantic header banners inside `#view-heroes`, `#view-recipes`, `#view-beigoma`, and `#view-fish`.

- [ ] **Step 1: Add header to `#view-heroes`**

```html
    <!-- VIEW: HEROES RECRUITMENT TRACKER -->
    <div id="view-heroes" class="view-panel">

      <!-- Section Header -->
      <header class="section-header">
        <h2 class="section-title">Hero Recruitment</h2>
        <p class="section-desc">Track all 121 recruitable allies across story chapters, identifying missable characters required for the true ending and fortress expansion.</p>
      </header>

      <!-- Filters Toolbar -->
```

- [ ] **Step 2: Add header to `#view-recipes`**

```html
    <!-- VIEW: RECIPES TRACKER -->
    <div id="view-recipes" class="view-panel" hidden>

      <!-- Section Header -->
      <header class="section-header">
        <h2 class="section-title">Cooking Recipes</h2>
        <p class="section-desc">Track all 93 cooking recipes and prepared dishes for Kurtz's restaurant to complete the Gourmand Hero achievement.</p>
      </header>

      <!-- Recipes Controls: Filter Tabs & Search -->
```

- [ ] **Step 3: Add header to `#view-beigoma`**

```html
    <!-- VIEW: BEIGOMA TRACKER -->
    <div id="view-beigoma" class="view-panel" hidden>

      <!-- Section Header -->
      <header class="section-header">
        <h2 class="section-title">Beigoma Collection &amp; Trainers</h2>
        <p class="section-desc">Catalog all 60 spinning tops by rarity and track victories against all 44 regional trainers across the continent.</p>
      </header>

      <!-- Sub-Navigation Group (Collection vs Trainers) -->
```

- [ ] **Step 4: Add header to `#view-fish`**

```html
    <!-- VIEW: FISH TRACKER -->
    <div id="view-fish" class="view-panel" hidden>

      <!-- Section Header -->
      <header class="section-header">
        <h2 class="section-title">Fish Collection</h2>
        <p class="section-desc">Track all 52 catchable fish species across 19 fishing spots dynamically unlocked in your save file for The Hero Who Fished the World.</p>
      </header>

      <!-- Filters Toolbar -->
```

- [ ] **Step 5: Run tests to verify all tests pass**

Run: `node --test tests/frontend/test_app.js`
Expected: PASS (41 passing tests)

Run: `python -m unittest discover tests`
Expected: PASS (116 passing tests)

- [ ] **Step 6: Commit HTML updates**

```bash
git add static/index.html
git commit -m "feat(html): add section header banners to all tracker views"
```

---

### Task 4: Full Verification & Documentation Update

**Files:**
- Modify: `docs/NEXT_SESSION.md`

**Interfaces:**
- Consumes: Completed implementation of Section Descriptions
- Produces: Updated handover documentation with test results and branch status.

- [ ] **Step 1: Run comprehensive regression test suites**

Run:
```bash
python -m unittest discover tests
node --test tests/frontend/test_app.js
```
Expected: All tests pass with 0 failures.

- [ ] **Step 2: Update `docs/NEXT_SESSION.md`**

Update `docs/NEXT_SESSION.md` with:
- Current branch: `feature/qol-improvements`
- Progress on QOL Section Descriptions
- Status of tests (116 Python + 41 Node.js tests passing)

- [ ] **Step 3: Commit documentation update**

```bash
git add docs/NEXT_SESSION.md
git commit -m "docs: update NEXT_SESSION.md with section descriptions progress"
```
