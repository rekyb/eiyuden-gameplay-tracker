# Beigoma Rarity Filter Design Specification

## Overview
This specification details the implementation of a Rarity filter dropdown for the Beigoma collection tracker in Eiyuden Gameplay Tracker. Similar to the Chapter filter dropdown on the Heroes recruitment table, this control enables users to filter the 60 Beigoma tops by their canonical rarity tiers (1★ Bronze, 2★ Silver, 3★ Gold, 4★ Rainbow).

## 1. UI & HTML Markup (`static/index.html`)

In `#subview-beigoma-collection .search-filter-controls`, insert a `.select-box` container before the `.search-box`:

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

The styling classes `.select-box` and `.select-filter` are already established in `static/style.css` and automatically provide theme styling, hover/focus rings, and responsive full-width display on mobile viewports.

## 2. Client Application Logic (`static/app.js`)

### 2.1 State Management
* `state.beigomaRarityFilter`: Initialized to `'all'`.
* DOM cache: `dom.beigomaRarityFilter = document.getElementById('beigoma-rarity-filter')`.
* Event binding: Listen for `'change'` events on `dom.beigomaRarityFilter` to set `state.beigomaRarityFilter = e.target.value` and trigger `renderBeigoma()`.

### 2.2 Filtering (`filterBeigoma`)
Update the function signature to:
`function filterBeigoma(item, collectedIds, activeFilter, searchQuery, activeRarityFilter = 'all')`

Logic evaluation:
1. Status filter (`all` / `obtained` / `missing`).
2. Rarity filter:
   `if (activeRarityFilter && activeRarityFilter !== 'all') { if (Number(item.rarity) !== Number(activeRarityFilter)) return false; }`
3. Text search matching:
   Match against `item.name`, `item.whereToObtain`, `item.id`, plus tier labels corresponding to the item's rarity (e.g. searching "rainbow", "gold", "silver", "bronze", or "X star").

### 2.3 List Rendering (`renderBeigoma`)
Pass `state.beigomaRarityFilter` into `filterBeigoma(...)` inside `renderBeigoma()`.

## 3. Automated Testing (`tests/frontend/test_app.js`)
* Unit tests verifying `filterBeigoma` with rarity filter values `1`, `2`, `3`, `4`, and `'all'`.
* Unit tests verifying text search by rarity tier keywords.
* Integration test verifying `renderBeigoma` accurately filters the DOM list when `state.beigomaRarityFilter` changes.
* Full test suite run (`python -m unittest discover tests` and `node --test tests/frontend/test_app.js`) passing 100%.
