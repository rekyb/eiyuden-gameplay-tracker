# Character Recruitment and Chapter Availability Design Specification

## Overview
This specification details data content corrections and UI enhancements for the Heroes Recruitment Tracker in Eiyuden Gameplay Tracker. It incorporates accurate recruitment instructions based on vreaper's GameFAQs Recruitment Guide (FAQ #81238), introduces story progression tracking by assigning each character to their respective Story Arc, and adds both a dedicated "Chapter" column and a Chapter filter dropdown to the tracker UI.

## 1. Data Schema and Content Updates (`data/characters.json`)

### 1.1 Schema Changes
Every character object in `data/characters.json` will require the following properties:
* `id` (`int`): Unique identifier matching save file character flags.
* `name` (`str`): Character name.
* `role` (`str`): One of `"Battle"`, `"Support"`, or `"Attendant"`.
* `chapter` (`str`): The primary story arc when the character first becomes recruitable.
* `location` (`str`): The specific town, dungeon, or region where the recruitment quest starts.
* `howToRecruit` (`str`): Step-by-step instructions, including prerequisites, items, and dialogue steps.
* `missable` (`bool`): `true` if the character can be permanently missed prior to point-of-no-return cutoffs, otherwise `false`.

### 1.2 Story Arc Definitions
Story arcs follow the canonical divisions used in the GameFAQs guide:
* `Prologue`: Initial tutorial and opening sequence.
* `The Watch Arc`: Missions in Arenside, Fort Xialduke, and early Eltisweiss.
* `Eltisweiss War Arc`: Initial war battles in Grum County.
* `The Alliance and Treefolk Arc`: Unlocking the Headquarters Castle and the initial major wave of recruits.
* `Eucrisse Arc`: Exploration across Hishahn, Twinhorne East/West, and the waterways.
* `Shi'arc Arc`: Dunes, Impershi'arc, and the split routes.
* `Guardians Arc`: The Great Forest, Eldroad, and Yarnaan.
* `Athrabalt War Arc`: Desert nation of Norston, Athrabalt, and Twinhorne South.
* `Alliance War Arc`: Late-game fortress defense and coalition gathering.
* `Finale Arc`: The final push, Gardhaven Castle, and endgame conclusions.
* `DLC / Extra`: Bonus or DLC characters (e.g., Grace).

### 1.3 Recruitment Details (`howToRecruit`)
All 121 character entries are audited and updated to correct common errors:
* Specify exact prerequisite party members (e.g. Marisa in active battle party for Aleior).
* Detail exact quest item sources and quantities (e.g., Runes, Lumbar, Palenque eggs, Pearl Pocket Watch, Grilled Fish recipe).
* Accurately reflect required Headquarters development buildings (e.g. Guildroom, Mission Counter, Pasturage, Theater, Library).
* Explicitly flag missable cutoffs (notably Leene, who requires all 119 other characters to be recruited before the war council event).

## 2. Test Suite Updates (`tests/unit/test_characters.py`)

* Update `REQUIRED_KEYS` to include `"chapter"`.
* Add assertions verifying that:
  * `c["chapter"]` is a non-empty string.
  * `c["chapter"]` belongs to the list of defined Story Arcs.
* Maintain existing assertions for unique IDs, 121 total entries, valid roles, non-empty locations, detailed `howToRecruit` texts, and accurate missable flags.

## 3. UI Design & Layout

### 3.1 Chapter Filter Dropdown (`static/index.html`)
In the `.search-filter-controls` container of `#view-heroes`:
* Add a select element `#chapter-filter` with class `.select-filter`.
* Options include `All Chapters` (`value="all"`) and each canonical Story Arc.

### 3.2 Table Columns (`static/index.html`)
The `#characters-tbody` table header will be structured as:
1. `Name` (`.col-name`)
2. `Chapter` (`.col-chapter`)
3. `Location` (`.col-location`)
4. `How to Recruit` (`.col-guide`)
5. `Status` (`.col-status`)

### 3.3 Visual Styling (`static/style.css`)
* `.select-filter`: Styled consistently with `.search-input` using theme CSS variables (`--bg-surface`, `--border-color`, `--text-primary`, `--accent-blue`).
* `.col-chapter`: Allocated suitable column width (`140px`-`160px` on desktop) with centered/badge alignment.
* `.chapter-badge`: Compact pill styling with subtle background tint and high-contrast text.
* Responsive breakpoints: Ensure graceful horizontal scrolling or stacked view on narrower viewports.

## 4. Frontend Application Logic (`static/app.js`)

### 4.1 State Management
* `state.activeChapterFilter`: Initialized to `'all'`.
* Cached DOM element: `dom.chapterFilter`.
* Event listener: Handle `change` event on `dom.chapterFilter` to update `state.activeChapterFilter` and call `renderCharactersTable()`.

### 4.2 Filtering (`filterCharacter`)
Filter criteria will evaluate:
* Status filter: `all` | `recruited` | `missing` | `missable`.
* Chapter filter: `activeChapterFilter === 'all' || char.chapter === activeChapterFilter`.
* Search query: Case-insensitive search matching against `char.name`, `char.chapter`, `char.location`, and `char.howToRecruit`.

### 4.3 Table Row Rendering (`createCharacterRowHtml`)
Generates the new `<td>` containing `<span class="chapter-badge">${escapeHtml(char.chapter || '—')}</span>`.

## 5. Verification and Quality Assurance
* Python test suite (`python -m unittest discover tests`) passing 100%.
* E2E / style test suite verifying the updated table column layout and DOM structure.
* Manual verification of dropdown filtering, search matching, and row rendering.
