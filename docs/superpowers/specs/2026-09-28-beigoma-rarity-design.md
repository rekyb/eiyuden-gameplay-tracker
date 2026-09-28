# Design Spec: Beigoma Rarity Column

- **Date:** 2026-09-28
- **Status:** Approved
- **Target Branch:** `feat/beigoma-tracker`

---

## 1. Overview & Goals

In Eiyuden Chronicle: Hundred Heroes, Beigoma tops are categorized into 4 tiers of rarity (1-Star through 4-Star). Adding the Rarity column to the Beigoma Collection table allows players to quickly gauge the strength and tier of their collection and plan their mini-game battles effectively.

---

## 2. Table Column Structure

The Beigoma Collection table layout updates from 3 columns to 4 columns:

| Column Header | Class | Description |
|---|---|---|
| **Beigoma Name** | `.col-beigoma-name` | Name of the Beigoma top |
| **Where to Obtain** | `.col-beigoma-location` | Enemy drop location, chest, or NPC reward |
| **Rarity** | `.col-beigoma-rarity` | 1–4 star rating rendered as gold/muted stars |
| **Status** | `.col-beigoma-status` | `Obtained` (green) or `Not Obtained` (neutral) |

Trainers table (`#trainer-table`) remains unchanged with 3 columns (Trainer Name, Location, Status).

---

## 3. Data Schema Update (`data/beigoma.json`)

Each of the 60 items in `data/beigoma.json` will include an integer `rarity` field (1 to 4):

```json
{
  "id": 1,
  "name": "Plantvine",
  "whereToObtain": "Drop from Plantvine in Northern Forest",
  "rarity": 1
}
```

### Exact Rarity Breakdown (60 tops total)
- **1-Star (16 tops):**
  - Plantvine, Rabbit Knight, Huge Mite, Angry Bat, Cockatrice (Hatchling), Rabbit Mage, Titan Slug, Grimeoid, Practice Beigoma (2 copies: IDs 998, 999), Fire Beigoma, Water Beigoma, Wind Beigoma, Lizard, Wild Boar, Hraesvelgr.
- **2-Star (27 tops):**
  - Wyvern, Killer Fungus, Hellhound, Pawn Demon, Bear Rider, Sahagin, Cactus Predator, Sea Ghost, Remora, Desert Serval, Desert Crab, Scorpion Assassin, Gigas, Sandfish, Cockatrice (Adult), Tyrant Tortoise, Dragon Viper, Carbuncle, Corpse Rider, Seed Conqueror, Earth Dragon, Azhdahag, Snow Boxer, Assault Tiger, Petit Gargoyle, Hellflower, Balor.
- **3-Star (12 tops):**
  - Xibalba, Soul Reaper, Arch-Demon, Nidhoggr, Fenrir, Elder Dragon, Dragon Fang, Gigas Fist, Cheetalita, Snakebite, Infinity Force, Neo Absolute Zero.
- **4-Star (5 tops):**
  - Earthsmack, Trinity Cyclone, Azure Dragon, Galactic Flame, Devil of Destruction.

---

## 4. UI/UX & Visual Styling

### 4.1 Star Rating Display
The rarity is rendered with Unicode stars:
- Filled star: `★` (`U+2605`)
- Empty star: `☆` (`U+2606`)
- Structure:
  ```html
  <span class="rarity-stars" aria-label="Rarity: 3 of 4 stars" title="3 of 4 stars">
    <span class="star-filled">★★★</span><span class="star-empty">☆</span>
  </span>
  ```

### 4.2 Styling (`static/style.css`)
- `.col-beigoma-rarity`:
  - Fixed width: `100px`
  - Text alignment: left-aligned with subtle letter spacing
  - Whitespace: `nowrap`
- `.star-filled`:
  - Color: `#f59e0b` (Amber/gold)
  - Text shadow / glow: subtle warm tone
- `.star-empty`:
  - Color: `var(--text-muted)`
  - Opacity: `0.35`

### 4.3 Search & Filter Interaction
- Text search input (`#beigoma-search`) continues to filter strictly against **Name** and **Where to Obtain** (case-insensitive substring match). Rarity is not matched in text search per user requirement.
- Status filters (`All`, `Obtained`, `Not Obtained`) continue to operate on item collection status.

---

## 5. Testing & Verification

1. **Python Unit Tests (`tests/unit/test_beigoma.py`):**
   - Verify every item in `data/beigoma.json` contains a valid integer `rarity` between 1 and 4.
   - Verify the exact count distribution: 16 (1-star), 27 (2-star), 12 (3-star), 5 (4-star).
2. **Frontend Tests (`tests/frontend/test_app.js`):**
   - Verify `createBeigomaRowHtml` generates the 4-column structure with `col-beigoma-rarity` and correct star counts.
   - Verify ARIA label `Rarity: X of 4 stars`.
3. **Full Regression Suites:**
   - Full Python test suite (`python -m unittest discover tests`) - 103+ tests passing.
   - Full Node.js frontend test suite (`node --test tests/frontend/test_app.js`) - 41+ tests passing.
