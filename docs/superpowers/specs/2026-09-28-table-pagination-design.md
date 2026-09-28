# Design Spec: Table Pagination (20 Items Per Page)

- **Date:** 2026-09-28
- **Status:** Approved
- **Target Branch:** `feat/beigoma-tracker` (or feature branch)

---

## 1. Overview & Goals

As the tracker expands to support more game categories (Heroes, Recipes, Beigoma tops, Trainers, and future collections like Fish and Chests), long single-page lists degrade readability and require excessive scrolling.

This feature adds client-side pagination to all data tables in the application, standardizing on **20 items per page** with a responsive pagination bar.

---

## 2. Scope & Target Tables

Pagination applies to all 4 tables in the application:

| Table | View / Panel | Total Items | Default Pages (at 20/page) |
|---|---|---|---|
| **Heroes Table** | `#view-heroes` (`#characters-table`) | 121 | 7 pages |
| **Recipes Table** | `#view-recipes` (`#recipes-table`) | 93 | 5 pages |
| **Beigoma Collection** | `#subview-beigoma-collection` (`#beigoma-table`) | 60 | 3 pages |
| **Beigoma Trainers** | `#subview-beigoma-trainers` (`#trainer-table`) | 44 | 3 pages |

---

## 3. UI/UX Specifications

### 3.1 Pagination Bar Layout
Directly underneath each table container, a `<nav class="pagination-bar" id="[prefix]-pagination" aria-label="Pagination">` element will render:
- **Left Side:** Item count information:
  - `Showing 1–20 of 121 items`
  - When filtered: `Showing 1–15 of 15 items`
- **Right Side:** Navigation controls:
  - `[Prev]` button (disabled when on page 1)
  - Numbered buttons `[1]`, `[2]`, `[3]`, etc. (with current page marked with `.active` and `aria-current="page"`)
  - `[Next]` button (disabled when on last page)

### 3.2 Visual Styling
- Matching the dark-mode aesthetic (`var(--bg-surface)`, `var(--border-subtle)`, `var(--text-primary)`, `var(--text-muted)`).
- Pill-shaped or soft-rounded pagination buttons with subtle hover effects.
- Active page highlighted with `var(--accent)` / `var(--bg-active)`.
- Responsive layout: on mobile viewports (<640px), wraps cleanly or shows compact page numbers.

### 3.3 Visibility Rules
- **Empty results (0 items):** Pagination bar is hidden (`hidden` attribute or `display: none`) and table empty state is shown.
- **Single page (<= 20 items):** Pagination bar displays `Showing 1–X of X items` with single page `[1]` and disabled `[Prev]` / `[Next]`.

---

## 4. Behavior & State Management

### 4.1 State Additions in `static/app.js`
Add current page indices to `state`:
```javascript
state.heroesPage = 1;
state.recipesPage = 1;
state.beigomaPage = 1;
state.trainerPage = 1;
```
Page size constant:
```javascript
const PAGE_SIZE = 20;
```

### 4.2 Reset Triggers
To avoid orphaned states (e.g. user on page 5, then types a filter that only has 3 items):
- Typing into search input resets that view's page to `1`.
- Clicking any filter tab resets that view's page to `1`.
- Synchronizing save progress does NOT reset page unless the new filtered count is less than the current page offset.

### 4.3 Reusable Pagination Component (`renderPaginationControls`)
A generic helper function manages pagination calculation and rendering:
```javascript
/**
 * Renders pagination controls and returns sliced items for display.
 *
 * @param {object} options
 * @param {HTMLElement} options.container - Container element for pagination controls
 * @param {Array} options.items - Full array of filtered items
 * @param {number} options.currentPage - Current active page (1-indexed)
 * @param {number} [options.pageSize=20] - Number of items per page
 * @param {function} options.onPageChange - Callback receiving new page number
 * @returns {Array} - The sliced items to render in the table
 */
function paginateItems({ container, items, currentPage, pageSize = PAGE_SIZE, onPageChange })
```

---

## 5. HTML Updates (`static/index.html`)

Insert a pagination container after each table wrapper:
1. `#heroes-pagination` after `#characters-table`
2. `#recipes-pagination` after `#recipes-table`
3. `#beigoma-pagination` after `#beigoma-table`
4. `#trainer-pagination` after `#trainer-table`

---

## 6. Testing Strategy

1. **Unit / Frontend Tests (`tests/frontend/test_app.js`):**
   - Verify `paginateItems` correctly slices items for page 1, middle pages, and last page.
   - Verify total pages calculation (e.g. 121 items at 20/page = 7 pages, 20 items = 1 page, 0 items = 0 pages).
   - Verify filter/search changes reset `currentPage` to 1.
   - Verify `renderTable`, `renderRecipesTable`, `renderBeigoma`, and `renderTrainers` only render the active page's 20 items in their respective tbody elements.
   - Verify Prev/Next button disabled states on boundary pages.
2. **Regression Testing:**
   - Full Python test suite (`python -m unittest discover tests`) - 100 tests passing.
   - Full Node test suite (`node --test tests/frontend/test_app.js`).
