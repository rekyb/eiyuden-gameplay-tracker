# Eiyuden Chronicle Gameplay Tracker — Recipes Tracker Design Specification

**Date:** 2026-09-27  
**Branch:** `feat/recipes-tracker`  
**Status:** Approved Design  

---

## 1. Overview & Objectives

The **Recipes Tracker** extends the *Eiyuden Chronicle Gameplay Tracker* with a dedicated cooking recipe and dish tracking view. It helps players complete their 93-recipe collection in *Eiyuden Chronicle: Hundred Heroes* and track which dishes have been cooked toward the **"Gourmand Hero"** Steam achievement/trophy.

### Core Objectives
1. **Top Navigation Structure**: Introduce a persistent, scalable top navigation bar (`Heroes` | `Recipes`) that easily supports future trackers (Runes, Beigoma, Fishing, etc.) while preserving full horizontal table width for maximum readability.
2. **Complete 93-Recipe Database**: Provide a curated catalog of all 93 cooking recipes/dishes with name, category (*Appetizer*, *Main*, *Dessert*), world location, and concise acquisition notes.
3. **Save File Synchronization**: Automatically detect acquired recipes from `UserData*.dat` by scanning `<CookableList>` in `_fortressTownRestaurantData` and recipe items in `_itemObtainData`.
4. **Manual Cooked Dish Tracking**: Provide a persistent manual checkbox for each dish so players can track what they have cooked for the Steam achievement.
5. **Dual-Layer Persistence**: Mirror manual cooked status between browser `localStorage` and backend `config.json` (`"cooked_recipe_ids": [...]`) to prevent progress loss when clearing cache.
6. **Minimalist, Clutter-Free UI**: Consistent dark, high-contrast typography, instant live search, and filter tabs without visual noise.

---

## 2. Navigation Architecture & View Management

### 2.1 Top Navigation Bar
A horizontal navigation bar sits directly beneath the app header:
```
+--------------------------------------------------------------------------+
|  Eiyuden Chronicle Gameplay Tracker              [Sync Save] [Settings]  |
|                                                                          |
|  [ Heroes (98/121) ]    [ Recipes (41/93) ]                              |
+--------------------------------------------------------------------------+
```
- **Semantic Markup**: `<nav class="top-nav" role="tablist">` with buttons using `role="tab"` and `aria-selected="true|false"`.
- **Progress Badges**: Both tabs display real-time progress numbers (`Heroes (98/121)`, `Recipes (41/93)`).
- **Extensible**: New tabs can be added as simple `<button class="nav-tab">` elements without refactoring layout or styling.

### 2.2 View Switching
- Two view containers: `#view-heroes` and `#view-recipes`.
- Switching views updates the DOM container visibility (`hidden` attribute / `.view-active` class) instantaneously without page reload.
- The shared header (`#stat-save-path`, `[Sync Save]`, and `[Settings]`) remains visible and shared across both views.
- Active view is saved in `localStorage['eiyuden_active_view']`, defaulting to `'heroes'`.

---

## 3. Data Model & Recipe Catalog (`recipes.json`)

The application consumes a curated JSON file at `recipes.json` containing all 93 recipes/dishes.

### 3.1 Schema
```json
[
  {
    "id": 3026,
    "name": "Pancakes",
    "category": "Dessert",
    "location": "Altverden Village",
    "howToObtain": "Inside a chest in the southern residential area.",
    "recipeItemId": 8026
  }
]
```

### 3.2 Field Definitions
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `int` | Unique dish ID matching game internal cuisine ID (`3000` to `3092`). |
| `name` | `str` | Name of the dish (e.g., *"Pancakes"*, *"Grilled Tutuva"*, *"Roast Beef"*). |
| `category` | `str` | Course category: `"Appetizer"`, `"Main"`, or `"Dessert"`. |
| `location` | `str` | Specific town, dungeon, NPC, or shop where the recipe is found. |
| `howToObtain` | `str` | Concise instructions on obtaining the recipe (e.g. chest, NPC dialogue, battle reward, Kurtz starter). |
| `recipeItemId`| `int` | Internal item ID for the recipe scroll (`8000` to `8092`), or `0` for starter recipes unlocked by default. |

---

## 4. Save File Synchronization (`save_reader.py`)

### 4.1 Save Inspection Logic
`save_reader.read_save_summary` decrypts `UserData*.dat` and extracts two recipe data sources:

1. **Restaurant Cookable List (`_fortressTownRestaurantData.<CookableList>k__BackingField`)**:
   - An array of objects: `{"<Recipe>k__BackingField": int, "<Cuisine>k__BackingField": int}`.
   - Any cuisine ID present in this list represents a recipe delivered and active at the Restaurant.
2. **Item Counters (`_itemObtainData._counters`)**:
   - Recipe items held in inventory or previously obtained have item keys in the `8000`–`8201` range.
   - Maps each recipe item ID back to its cuisine ID (`cuisine_id = 3000 + (item_id % 1000)`).

### 4.2 Output Structure
`read_save_summary()` adds:
```python
{
    ...
    "acquired_recipe_ids": [3000, 3001, 3008, 3026, ...],
    "acquired_recipe_count": 41,
    "total_recipes": 93
}
```

---

## 5. Cooked Status & Dual-Layer Persistence

Because the game's save file tracks unlocked recipes but not individual "cooked dish" history, the tracker provides a manual checkmark for each recipe.

### 5.1 Interactive Table Column
The Recipes table includes a dedicated **Cooked** column:
```
Name      | Category  | Location          | Status        | Cooked
Pancakes  | Dessert   | Altverden Village | Acquired      | [✓]
```
- Clicking the checkbox marks the dish as cooked for the **"Gourmand Hero"** achievement.
- The row displays a subtle indicator when cooked.

### 5.2 Persistence Architecture
1. **Client Mirror (`localStorage`)**:
   - Key: `eiyuden_cooked_recipes` (JSON array of recipe IDs, e.g. `[3000, 3001, 3026]`).
   - Read synchronously during initialization for zero-latency UI rendering.
2. **Backend Storage (`config.json`)**:
   - Key: `"cooked_recipe_ids": [3000, 3001, 3026]`.
   - Endpoint: `POST /api/recipes/cooked` with body `{"cooked_ids": [3000, 3001, ...]}`.
   - Updated asynchronously whenever a checkbox is toggled.
   - Survives browser cache clears, browser changes, and system restarts.

---

## 6. User Interface & Layout Specifications

### 6.1 Recipes View Layout (`static/index.html`)
Inside `<section id="view-recipes" class="view-panel" hidden>`:

1. **Dual Progress Bar & Counters**:
   - `Acquired: X / 93 (XX.X%)`
   - `Cooked: Y / 93 (YY.X%)`
   - Visual track bar showing acquired percentage.
2. **Filter Tabs**:
   - `All (93)`
   - `Acquired (X)`
   - `Not Acquired (Y)`
   - `Cooked (Z)`
   - `Not Cooked (W)`
3. **Live Search Box**:
   - Text search filtering across dish name, category, and location/notes.
4. **Recipes Table**:
   - Columns:
     - `Name` (`.col-recipe-name`): Dish name.
     - `Category` (`.col-recipe-cat`): Appetizer, Main, or Dessert badge.
     - `Location / Source` (`.col-recipe-loc`): Where to find it.
     - `Status` (`.col-recipe-status`): `Acquired` (green) or `Not Acquired` (subtle gray).
     - `Cooked` (`.col-recipe-cooked`): Clickable checkbox `<input type="checkbox">`.

### 6.2 Styling Guidelines (`static/style.css`)
- Dark high-contrast palette consistent with existing theme.
- Sticky table headers (`position: sticky; top: 0;`).
- Accessible checkbox styling with visible focus outline and comfortable touch/click target (`20px x 20px`).
- Category badges:
  - Appetizer: Subtle cyan/teal border and tint.
  - Main: Subtle amber/orange border and tint.
  - Dessert: Subtle purple/pink border and tint.

---

## 7. Backend API Specification (`server.py`)

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/recipes` | Returns all 93 recipe objects from `recipes.json`. | 200, 500 |
| `GET` | `/api/save/status` | Returns save summary including `acquired_recipe_ids`. | 200, 400 |
| `GET` | `/api/recipes/cooked` | Returns list of cooked dish IDs from `config.json`. | 200 |
| `POST` | `/api/recipes/cooked` | Updates `cooked_recipe_ids` in `config.json`. | 200, 400 |

---

## 8. Verification & Testing Strategy

1. **Database Tests (`test_recipes.py`)**:
   - Exactly 93 recipes present.
   - All IDs unique and in range `3000` to `3092`.
   - Every entry has required keys (`id`, `name`, `category`, `location`, `howToObtain`, `recipeItemId`).
   - Categories are strictly one of `{"Appetizer", "Main", "Dessert"}`.
2. **Save Reader Tests (`test_save_reader.py`)**:
   - Verify `acquired_recipe_ids` is extracted from live save fixture.
   - Verify IDs match `<CookableList>` in test fixture.
3. **API Tests (`test_server.py`)**:
   - `GET /api/recipes` returns 200 and 93 records.
   - `GET /api/recipes/cooked` and `POST /api/recipes/cooked` persist correctly to `config.json`.
4. **End-to-End & Style Tests (`test_e2e.py`, `test_style.py`)**:
   - Navigation tabs toggle views properly.
   - Dynamic classes and columns are styled without errors.
