# Recipes Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Recipes Tracker for *Eiyuden Chronicle: Hundred Heroes* with top navigation tabs (`Heroes` | `Recipes`), a curated 93-recipe database, save file auto-sync (`<CookableList>` and inventory recipe items), manual "Cooked" tracking for the *Gourmand Hero* Steam achievement with dual-layer persistence (`localStorage` + `config.json`), and a minimalist footer.

**Architecture:** Extend existing local Python HTTP server and zero-dependency ES6 frontend. Add `recipes.json` database, enhance `save_reader.py` to extract acquired recipe IDs from save data, provide `/api/recipes` and `/api/recipes/cooked` in `server.py`, render a 5-column table (`Name | Category | Location | Status | Cooked`) in `static/index.html`, style with clean contrast and tooltips in `static/style.css`, and handle state, view switching, and persistence in `static/app.js`.

**Tech Stack:** Python 3 (standard library `http.server`, `json`, `os`, `cryptography`), vanilla HTML5/CSS3, vanilla ES6+ JavaScript.

## Global Constraints

- **Strictly Minimalist**: Clean typography, high contrast, zero unnecessary visual clutter.
- **Top Header**: Only app title and `[ ⚙ Settings ]` button with inline SVG gear icon.
- **Save Actions**: `[ Sync Save Now ]` and `[ Backup Save Now ]` reside exclusively inside the Settings dialog under a dedicated **Save Actions** section.
- **Columns for Recipes Table**: `Name` | `Category` | `Location / Source` | `Status` | `Cooked`.
- **Cooked Tracking**: Interactive checkbox per dish with tooltip and table hint for the *Gourmand Hero* achievement; persisted in both `localStorage` and `config.json`.
- **Footer**: Includes `"Tracker created by Reky B. • Eiyuden Chronicle: Hundred Heroes is a trademark of Rabbit & Bear Studios and 505 Games."` and link to `https://github.com/rekyb/eiyuden-gameplay-tracker`.
- **Non-Destructive**: Never mutate user save files on read.

---

### Task 1: Complete 93-Recipe Database (`recipes.json`) & Validation Tests

**Files:**
- Create: `recipes.json`
- Test: `test_recipes.py`

**Interfaces:**
- Consumes: Dish IDs 3000 to 3092 matching game internal IDs.
- Produces: `recipes.json` array of 93 objects with `{ id, name, category, location, howToObtain, recipeItemId }`.

- [ ] **Step 1: Write the failing recipe database test (`test_recipes.py`)**

```python
import json
import os
import unittest

RECIPES_PATH = os.path.join(os.path.dirname(__file__), "recipes.json")

class TestRecipesDatabase(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(RECIPES_PATH), "recipes.json must exist")
        with open(RECIPES_PATH, "r", encoding="utf-8") as f:
            self.recipes = json.load(f)

    def test_exact_93_recipes(self):
        """Verify exactly 93 recipes/dishes are defined."""
        self.assertEqual(len(self.recipes), 93)

    def test_unique_ids_and_range(self):
        """Verify all recipe IDs are unique integers within 3000..3092."""
        ids = [r["id"] for r in self.recipes]
        self.assertEqual(len(ids), len(set(ids)), "Duplicate recipe IDs found")
        for rid in ids:
            self.assertIsInstance(rid, int)
            self.assertTrue(3000 <= rid <= 3092, f"ID {rid} out of expected 3000..3092 range")

    def test_required_keys_and_categories(self):
        """Verify all entries have valid keys and allowable categories."""
        allowed_categories = {"Appetizer", "Main", "Dessert"}
        for r in self.recipes:
            for key in ("id", "name", "category", "location", "howToObtain", "recipeItemId"):
                self.assertIn(key, r, f"Missing key '{key}' in recipe {r.get('id')}")
            self.assertIn(r["category"], allowed_categories, f"Invalid category in recipe {r['id']}")
            self.assertIsInstance(r["name"], str)
            self.assertGreater(len(r["name"].strip()), 0)
            self.assertIsInstance(r["location"], str)
            self.assertIsInstance(r["howToObtain"], str)
            self.assertIsInstance(r["recipeItemId"], int)

    def test_key_starter_and_world_recipes(self):
        """Verify presence of starter dishes and signature world recipes."""
        by_id = {r["id"]: r for r in self.recipes}
        # Poached Egg (3000) starter
        self.assertIn(3000, by_id)
        self.assertEqual(by_id[3000]["name"], "Poached Egg")
        self.assertEqual(by_id[3000]["recipeItemId"], 0)

        # Pancakes (3026)
        self.assertIn(3026, by_id)
        self.assertEqual(by_id[3026]["name"], "Pancakes")
        self.assertEqual(by_id[3026]["category"], "Dessert")
        self.assertEqual(by_id[3026]["recipeItemId"], 8026)

        # Grilled Tutuva (3071)
        self.assertIn(3071, by_id)
        self.assertEqual(by_id[3071]["name"], "Grilled Tutuva")
        self.assertEqual(by_id[3071]["category"], "Appetizer")

        # Golden Zucotto (3092)
        self.assertIn(3092, by_id)
        self.assertEqual(by_id[3092]["name"], "Golden Zucotto")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest test_recipes.py -v`  
Expected: FAIL with `AssertionError: False is not true : recipes.json must exist`

- [ ] **Step 3: Create `recipes.json` with all 93 dishes**

Create `recipes.json` with complete data for dishes 3000 through 3092 covering all Appetizers, Mains, and Desserts with accurate locations and howToObtain notes.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest test_recipes.py -v`  
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add test_recipes.py recipes.json
git commit -m "feat: add complete 93 recipes database and validation tests"
```

---

### Task 2: Save Reader Recipe Extraction (`save_reader.py`)

**Files:**
- Modify: `save_reader.py`
- Test: `test_save_reader.py`

**Interfaces:**
- Consumes: Decrypted `_fortressTownRestaurantData.<CookableList>k__BackingField` and `_itemObtainData._counters`.
- Produces: `read_save_summary()` returns dict containing `acquired_recipe_ids: List[int]` and `acquired_recipe_count: int`.

- [ ] **Step 1: Write test for recipe extraction in `test_save_reader.py`**

Add test method to `test_save_reader.py`:
```python
    def test_read_save_summary_extracts_recipes(self):
        """Verify read_save_summary extracts acquired_recipe_ids from save fixture."""
        summary = read_save_summary(FIXTURE_PATH)
        self.assertIn("acquired_recipe_ids", summary)
        self.assertIsInstance(summary["acquired_recipe_ids"], list)
        self.assertGreater(len(summary["acquired_recipe_ids"]), 0)
        # All extracted IDs must be in 3000..3092 range
        for rid in summary["acquired_recipe_ids"]:
            self.assertIsInstance(rid, int)
            self.assertTrue(3000 <= rid <= 3092)
        # Verify specific known unlocked recipe (e.g. 3000 Poached Egg or 3038 Moonview Kebab)
        self.assertIn(3000, summary["acquired_recipe_ids"])
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m unittest test_save_reader.TestSaveReader.test_read_save_summary_extracts_recipes -v`  
Expected: FAIL (`AssertionError: 'acquired_recipe_ids' not found in summary`)

- [ ] **Step 3: Implement recipe extraction in `save_reader.py`**

In `save_reader.py` inside `read_save_summary(filepath: str)`:
```python
    # Recipe & Restaurant Dishes extraction
    acquired_recipe_ids_set = set()

    # 1. From Restaurant CookableList
    rest_data = save_data.get("_fortressTownRestaurantData", {})
    cookable_list = rest_data.get("<CookableList>k__BackingField", [])
    if isinstance(cookable_list, list):
        for item in cookable_list:
            if isinstance(item, dict):
                cuisine_id = item.get("<Cuisine>k__BackingField")
                if isinstance(cuisine_id, int) and 3000 <= cuisine_id <= 3092:
                    acquired_recipe_ids_set.add(cuisine_id)

    # 2. From Item Obtain Counters (recipe items in 8000s)
    item_data = save_data.get("_itemObtainData", {})
    counters = item_data.get("_counters", [])
    if isinstance(counters, list):
        for c in counters:
            if isinstance(c, dict):
                item_id = c.get("_key")
                count = c.get("_value", 0)
                if isinstance(item_id, int) and 8000 <= item_id <= 8201 and count > 0:
                    # Convert item 80XX to dish 30XX
                    dish_id = 3000 + (item_id % 1000)
                    if 3000 <= dish_id <= 3092:
                        acquired_recipe_ids_set.add(dish_id)

    acquired_recipe_ids = sorted(list(acquired_recipe_ids_set))
```
Add `acquired_recipe_ids` and `acquired_recipe_count: len(acquired_recipe_ids)` to the returned summary dictionary.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest test_save_reader.py -v`  
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add save_reader.py test_save_reader.py
git commit -m "feat: extract acquired recipes from restaurant and inventory save data"
```

---

### Task 3: Backend API Endpoints & Cooked Persistence (`server.py`)

**Files:**
- Modify: `server.py`
- Test: `test_server.py`

**Interfaces:**
- Consumes: `recipes.json`, `config.json` (`cooked_recipe_ids`).
- Produces:
  - `GET /api/recipes` -> `200` with 93 records.
  - `GET /api/recipes/cooked` -> `200` with `{"cooked_ids": [...]}`.
  - `POST /api/recipes/cooked` with body `{"cooked_ids": [...]}` -> updates `config.json` and returns `{"success": true, "cooked_ids": [...]}`.

- [ ] **Step 1: Write API tests in `test_server.py`**

Add tests for `/api/recipes` and `/api/recipes/cooked`:
```python
    def test_get_recipes(self):
        """GET /api/recipes returns 93 recipe records."""
        req = urllib.request.Request(self._url("/api/recipes"), method="GET")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(len(data), 93)
            self.assertEqual(data[0]["id"], 3000)

    def test_get_and_post_recipes_cooked(self):
        """POST /api/recipes/cooked saves IDs and GET returns them."""
        # 1. POST cooked IDs
        payload = {"cooked_ids": [3000, 3026, 3071]}
        req_post = urllib.request.Request(
            self._url("/api/recipes/cooked"),
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req_post) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(res.get("success"))
            self.assertEqual(res.get("cooked_ids"), [3000, 3026, 3071])

        # 2. GET cooked IDs
        req_get = urllib.request.Request(self._url("/api/recipes/cooked"), method="GET")
        with urllib.request.urlopen(req_get) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(res.get("cooked_ids"), [3000, 3026, 3071])
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m unittest test_server.TestServerAPI.test_get_recipes test_server.TestServerAPI.test_get_and_post_recipes_cooked -v`  
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Implement endpoints in `server.py`**

1. In `SaveTrackerServer.__init__`:
   Add `recipes_path: str = "recipes.json"`.
2. In `do_GET`:
   - Route `path == "/api/recipes"`: load and return `recipes.json`.
   - Route `path == "/api/recipes/cooked"`: load `config.json`, return `{"cooked_ids": cfg.get("cooked_recipe_ids", [])}`.
3. In `do_POST`:
   - Route `path == "/api/recipes/cooked"`: validate body JSON, ensure `cooked_ids` is list of ints, save to `cfg["cooked_recipe_ids"]`, call `save_config`, return `{"success": True, "cooked_ids": cooked_ids}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest test_server.py -v`  
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add server.py test_server.py
git commit -m "feat: add recipes and cooked persistence API endpoints"
```

---

### Task 4: Frontend HTML: Top Navigation, Recipes Table, Guidance Hint, and Footer (`static/index.html`)

**Files:**
- Modify: `static/index.html`

**Interfaces:**
- Produces:
  - Header: `#btn-config` with SVG gear icon; removed `#btn-sync` and `#btn-backup` from header.
  - Settings Modal: `#btn-sync` and `#btn-backup` relocated under `.save-actions-group`.
  - Top Navigation: `<nav class="top-nav">` with `#tab-nav-heroes` and `#tab-nav-recipes`.
  - Views: `#view-heroes` and `#view-recipes`.
  - Recipes Table: `#recipes-tbody`, `#search-recipes-input`, recipe filter tabs, hint paragraph `<p class="recipes-hint">`.
  - Footer: `<footer>` with attribution and GitHub link.

- [ ] **Step 1: Update `static/index.html`**

1. **Header**:
   Change `.header-actions` to only contain:
   ```html
   <button type="button" id="btn-config" class="btn btn-secondary btn-settings" aria-label="Open settings">
     <svg class="icon icon-gear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
       <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
       <circle cx="12" cy="12" r="3"></circle>
     </svg>
     <span>Settings</span>
   </button>
   ```

2. **Top Navigation Bar**:
   Add right under `<header>`:
   ```html
   <nav class="top-nav" role="tablist" aria-label="Tracker Sections">
     <button type="button" id="tab-nav-heroes" class="nav-tab active" role="tab" aria-selected="true" data-view="heroes">
       Heroes <span class="nav-badge" id="nav-count-heroes">0/121</span>
     </button>
     <button type="button" id="tab-nav-recipes" class="nav-tab" role="tab" aria-selected="false" data-view="recipes">
       Recipes <span class="nav-badge" id="nav-count-recipes">0/93</span>
     </button>
   </nav>
   ```

3. **Wrap Existing Content in `#view-heroes`**:
   Wrap the progress bar, filter bar, and heroes table inside `<div id="view-heroes" class="view-panel">`.

4. **Add `#view-recipes` Panel**:
   ```html
   <div id="view-recipes" class="view-panel" hidden>
     <!-- Recipes Dual Progress Section -->
     <section class="progress-section" aria-label="Recipes Collection Progress">
       <div class="progress-header">
         <span class="progress-label">Recipes Acquired</span>
         <span class="progress-metric">
           <strong id="recipes-progress-count">0 / 93</strong>
           <span id="recipes-progress-percent" class="progress-pct">(0.0%)</span>
           <span class="metric-divider">|</span>
           <span class="cooked-metric">Cooked: <strong id="recipes-cooked-count">0 / 93</strong> <span id="recipes-cooked-percent">(0.0%)</span></span>
         </span>
       </div>
       <div class="progress-track" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="93" id="recipes-progress-bar">
         <div class="progress-fill" id="recipes-progress-fill" style="width: 0%;"></div>
       </div>
     </section>

     <p class="recipes-hint">
       Tip: Check off dishes manually in the <strong>Cooked</strong> column as you prepare them at Kurtz's restaurant to track your progress toward the <em>Gourmand Hero</em> Steam achievement.
     </p>

     <!-- Recipes Controls: Filter Tabs & Search -->
     <nav class="controls-bar" aria-label="Recipe Filters and Search">
       <div class="filter-tabs" role="tablist" id="recipes-filter-tabs">
         <button type="button" class="filter-tab active" data-filter="all" role="tab" aria-selected="true">
           All <span class="badge" id="count-recipes-all">93</span>
         </button>
         <button type="button" class="filter-tab" data-filter="acquired" role="tab" aria-selected="false">
           Acquired <span class="badge" id="count-recipes-acquired">0</span>
         </button>
         <button type="button" class="filter-tab" data-filter="not_acquired" role="tab" aria-selected="false">
           Not Acquired <span class="badge" id="count-recipes-not-acquired">0</span>
         </button>
         <button type="button" class="filter-tab" data-filter="cooked" role="tab" aria-selected="false">
           Cooked <span class="badge" id="count-recipes-cooked">0</span>
         </button>
         <button type="button" class="filter-tab" data-filter="not_cooked" role="tab" aria-selected="false">
           Not Cooked <span class="badge" id="count-recipes-not-cooked">0</span>
         </button>
       </div>

       <div class="search-filter-controls">
         <div class="search-box">
           <label for="search-recipes-input" class="sr-only">Search recipes</label>
           <input type="search" id="search-recipes-input" class="search-input" placeholder="Search by dish name, category (Appetizer/Main/Dessert), location..." autocomplete="off">
         </div>
       </div>
     </nav>

     <!-- Recipes Table Section -->
     <section class="table-section" aria-label="Cooking recipes list">
       <div class="table-wrapper">
         <table class="characters-table recipes-table">
           <thead>
             <tr>
               <th scope="col" class="col-recipe-name">Name</th>
               <th scope="col" class="col-recipe-cat">Category</th>
               <th scope="col" class="col-recipe-loc">Location / Source</th>
               <th scope="col" class="col-recipe-status">Status</th>
               <th scope="col" class="col-recipe-cooked" title="Click checkbox manually when you have prepared this dish at Kurtz's restaurant for the Gourmand Hero achievement.">
                 Cooked <span class="hint-icon" aria-hidden="true">ⓘ</span>
               </th>
             </tr>
           </thead>
           <tbody id="recipes-tbody">
             <!-- Populated dynamically via app.js -->
           </tbody>
         </table>
       </div>

       <!-- Empty State -->
       <div id="recipes-empty-state" class="empty-state" hidden>
         <p class="empty-title">No recipes found</p>
         <p class="empty-desc">No dishes match your active filter and search query.</p>
       </div>
     </section>
   </div>
   ```

5. **Settings Dialog**:
   Add Save Actions section with `#btn-sync` and `#btn-backup`:
   ```html
   <div class="divider" role="separator"></div>
   <div class="form-group save-actions-group">
     <label class="form-label">Save Actions</label>
     <div class="save-actions-row">
       <button type="button" id="btn-sync" class="btn btn-primary">Sync Save Now</button>
       <button type="button" id="btn-backup" class="btn btn-secondary">Backup Save Now</button>
     </div>
     <p class="form-hint">Sync immediately re-reads your save file. Backup creates a timestamped copy in <code>backups/</code>.</p>
   </div>
   ```

6. **Footer**:
   Add before closing `</body>`:
   ```html
   <footer class="app-footer">
     <div class="footer-content">
       <p class="footer-attribution">Tracker created by Reky B. &bull; Eiyuden Chronicle: Hundred Heroes is a trademark of Rabbit &amp; Bear Studios and 505 Games.</p>
       <p class="footer-links">
         <a href="https://github.com/rekyb/eiyuden-gameplay-tracker" target="_blank" rel="noopener noreferrer" class="footer-link">GitHub Repository</a>
       </p>
     </div>
   </footer>
   ```

- [ ] **Step 2: Commit**

```bash
git add static/index.html
git commit -m "feat: add top navigation, recipes view, relocated save actions, and footer"
```

---

### Task 5: Minimalist Styling for Navigation, Badges, Checkboxes & Footer (`static/style.css`)

**Files:**
- Modify: `static/style.css`
- Test: `test_style.py`

**Interfaces:**
- Produces: CSS rules for `.top-nav`, `.nav-tab`, `.nav-badge`, `.recipes-hint`, `.col-recipe-*`, `.recipe-cat-badge`, `.col-recipe-cooked`, `.cooked-checkbox`, `.app-footer`, `.footer-link`.

- [ ] **Step 1: Write style test additions in `test_style.py`**

In `test_style.py`:
```python
    def test_recipes_and_navigation_classes_present(self):
        """Classes for navigation, recipe categories, and footer must be styled."""
        required = [
            'top-nav',
            'nav-tab',
            'recipes-hint',
            'recipe-cat-appetizer',
            'recipe-cat-main',
            'recipe-cat-dessert',
            'col-recipe-cooked',
            'cooked-checkbox',
            'app-footer',
            'footer-link',
        ]
        for c in required:
            pattern = rf'(\.{re.escape(c)}[\s,\.:\[\{{>])'
            self.assertTrue(re.search(pattern, self.css), f"Required class missing in style.css: {c}")
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m unittest test_style.TestStyleCSS.test_recipes_and_navigation_classes_present -v`  
Expected: FAIL (`Required class missing in style.css: top-nav`)

- [ ] **Step 3: Implement styles in `static/style.css`**

Add styling rules:
1. `.top-nav`: Flex container with gap, border-bottom, padding.
2. `.nav-tab`: Pill or clean tab button with transparent background, `--text-secondary`, transition, `.active` state with `--accent-primary` or `--text-primary` and subtle underline/highlight.
3. `.nav-badge`: Small subtle badge showing `0/121` or `0/93`.
4. `.recipes-hint`: Subtle italicized or muted text (`--text-secondary`, font size `0.85rem`) with top/bottom margin.
5. Column widths for recipes table:
   - `.col-recipe-name`: `180px`, nowrap, font-weight 600.
   - `.col-recipe-cat`: `110px`, nowrap.
   - `.col-recipe-loc`: `240px`.
   - `.col-recipe-status`: `130px`, nowrap.
   - `.col-recipe-cooked`: `90px`, text-align center.
6. Category badges:
   - `.recipe-cat-appetizer`: teal tint
   - `.recipe-cat-main`: amber tint
   - `.recipe-cat-dessert`: purple tint
7. Checkbox styling:
   - `.cooked-checkbox`: width `18px`, height `18px`, accent-color, cursor pointer.
8. `.app-footer`:
   - Top border, padding `1.5rem 0`, font size `0.8rem`, color `--text-muted`, flex layout between attribution and GitHub link.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest test_style.py -v`  
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add static/style.css test_style.py
git commit -m "feat: style top navigation tabs, recipes table, checkboxes, and footer"
```

---

### Task 6: Interactive Client Application Logic (`static/app.js`) & End-to-End Tests (`test_e2e.py`)

**Files:**
- Modify: `static/app.js`
- Test: `test_e2e.py`

**Interfaces:**
- Consumes: `/api/recipes`, `/api/recipes/cooked`, `/api/save/status`, `localStorage`.
- Produces: View switching between Heroes and Recipes, dynamic recipe table rendering, live search, tab filtering, cooked checkbox persistence.

- [ ] **Step 1: Write E2E test in `test_e2e.py`**

Add test method to `test_e2e.py`:
```python
    def test_e2e_recipes_api_and_assets(self):
        # 93 recipes served
        with urllib.request.urlopen(self._url("/api/recipes")) as resp:
            self.assertEqual(resp.status, 200)
            recipes = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(len(recipes), 93)

        # HTML has recipes view and navigation
        with urllib.request.urlopen(self._url("/")) as resp:
            html = resp.read().decode("utf-8")
            self.assertIn("tab-nav-heroes", html)
            self.assertIn("tab-nav-recipes", html)
            self.assertIn("recipes-tbody", html)
            self.assertIn("Tracker created by Reky B.", html)
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m unittest test_e2e.TestEndToEndSaveTracker.test_e2e_recipes_api_and_assets -v`  
Expected: FAIL (or partial fail before app.js update)

- [ ] **Step 3: Implement client logic in `static/app.js`**

1. **State expansion**:
   - `activeView: 'heroes'` ('heroes' | 'recipes')
   - `recipes: []` (93 items)
   - `acquiredRecipeIds: new Set()`
   - `cookedRecipeIds: new Set()`
   - `activeRecipesFilter: 'all'`
   - `recipesSearchQuery: ''`
2. **DOM caching**:
   - Cache `tabNavHeroes`, `tabNavRecipes`, `viewHeroes`, `viewRecipes`, `recipesTbody`, `searchRecipesInput`, `recipesFilterTabs`, `recipesProgressFill`, `recipesProgressCount`, `recipesCookedCount`, etc.
3. **View switching**:
   - `switchView(viewName)`: toggles `.active` and `aria-selected` on top nav tabs, sets `hidden` on view panels, saves to `localStorage['eiyuden_active_view']`.
4. **Recipe filtering & rendering**:
   - `filterRecipe(recipe, acquiredIds, cookedIds, activeFilter, searchQuery)`
   - `createRecipeRowHtml(recipe, isAcquired, isCooked)`: generates row with category badge, status badge, and `<input type="checkbox" class="cooked-checkbox" ...>`
   - `renderRecipesTable()`: renders rows or toggles empty state.
5. **Cooked dish checkbox handler**:
   - Event listener delegation on `recipesTbody` change event for `.cooked-checkbox`.
   - Toggle in `state.cookedRecipeIds`.
   - Save to `localStorage['eiyuden_cooked_recipes']`.
   - Debounced `POST /api/recipes/cooked` to sync with `config.json`.
   - Update counters and progress bar.
6. **Init sequence**:
   - Parallel fetch: `/api/config`, `/api/characters`, `/api/recipes`, `/api/recipes/cooked`.
   - Restore `cookedRecipeIds` from `localStorage` merged with server.
   - Sync save, render both tables, restore saved active view.

- [ ] **Step 4: Run full test suite**

Run: `python -m unittest discover -s . -p "test_*.py" -v`  
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add static/app.js test_e2e.py
git commit -m "feat: implement recipes state, view switching, live search, and cooked sync"
```

---

### Task 7: Full System Verification & Branch Integration

- [ ] **Step 1: Run comprehensive test discovery**

Run: `python -m unittest discover -s . -p "test_*.py" -v`  
Expected: All tests pass with zero errors.

- [ ] **Step 2: Verify git status and commit cleanliness**

Run: `git status`  
Expected: Working tree clean on branch `feat/recipes-tracker`.

- [ ] **Step 3: Update README.md with Recipes Tracker instructions**

Add Recipes Tracker features and usage to `README.md`.

- [ ] **Step 4: Commit and report completion**

```bash
git add README.md
git commit -m "docs: update README with recipes tracker and navigation documentation"
```
