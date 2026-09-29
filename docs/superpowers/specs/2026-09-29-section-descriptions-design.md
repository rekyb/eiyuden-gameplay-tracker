# Design Specification: Section Descriptions & Headers

- **Date:** 2026-09-29
- **Branch:** `feature/qol-improvements`
- **Scope:** Quality of Life (QOL) improvement adding contextual titles and descriptions to each primary view section.

---

## 1. Motivation & Goals

The Eiyuden Chronicle Gameplay Tracker features 4 main navigation tabs:
1. **Heroes** (Recruitment & Missable tracker)
2. **Recipes** (Cooking recipes & Kurtz's restaurant tracking)
3. **Beigoma** (Top collection & Trainer battles)
4. **Fish** (Catchable fish & Fishing spots)

Currently, switching between views jumps directly into filter toolbars and data tables without any context or description explaining what each section tracks, the related in-game achievements, or how save data interacts with the view.

### Goals
- Provide clear, accessible, semantic section headers (`<h2>`) and descriptions (`<p>`) for all 4 tracker views.
- Maintain the minimalist, clean aesthetic of the tracker without adding clutter or consuming excessive vertical space.
- Keep implementation lightweight and robust with zero JavaScript runtime overhead (native semantic HTML + CSS).
- Ensure 100% test coverage and no regressions in existing automated test suites.

---

## 2. Architecture & HTML Markup Structure

Each view panel in [`static/index.html`](file:///C:/projects/eiyuden-gameplay-tracker/static/index.html) will receive a dedicated `<header class="section-header">` placed immediately before its filter toolbar / sub-navigation.

### 2.1 View Panels Markup

```html
<!-- Inside #view-heroes -->
<header class="section-header">
  <h2 class="section-title">Hero Recruitment</h2>
  <p class="section-desc">Track all 121 recruitable allies across story chapters, identifying missable characters required for the true ending and fortress expansion.</p>
</header>

<!-- Inside #view-recipes -->
<header class="section-header">
  <h2 class="section-title">Cooking Recipes</h2>
  <p class="section-desc">Track all 93 cooking recipes and prepared dishes for Kurtz's restaurant to complete the Gourmand Hero achievement.</p>
</header>

<!-- Inside #view-beigoma -->
<header class="section-header">
  <h2 class="section-title">Beigoma Collection &amp; Trainers</h2>
  <p class="section-desc">Catalog all 60 spinning tops by rarity and track victories against all 44 regional trainers across the continent.</p>
</header>

<!-- Inside #view-fish -->
<header class="section-header">
  <h2 class="section-title">Fish Collection</h2>
  <p class="section-desc">Track all 52 catchable fish species across 19 fishing spots dynamically unlocked in your save file for The Hero Who Fished the World.</p>
</header>
```

---

## 3. Styling & Responsive Design

Styles added to [`static/style.css`](file:///C:/projects/eiyuden-gameplay-tracker/static/style.css):

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

/* Mobile responsive adjustments */
@media (max-width: 768px) {
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
}
```

### Visual Characteristics
- **Vertical Footprint:** Compact (~50px height), ensuring data tables remain prominently visible.
- **Divider:** Subtle 1px solid border (`var(--border-subtle)`) establishing a crisp boundary above sticky filter toolbars.
- **Hierarchy:** `font-weight: 600` on the title with subdued muted secondary text for descriptions.

---

## 4. Testing & Verification

1. **Frontend Tests (`tests/frontend/test_app.js`):**
   - Assert each view panel (`#view-heroes`, `#view-recipes`, `#view-beigoma`, `#view-fish`) contains `.section-header > .section-title` and `.section-desc`.
   - Assert exact titles and key text phrases for each section.
2. **Backend Tests (`python -m unittest discover tests`):**
   - Verify all 114 Python tests pass with zero regressions.
3. **Responsive & Browser Check:**
   - Verify layout responsiveness on both desktop and mobile viewports.
