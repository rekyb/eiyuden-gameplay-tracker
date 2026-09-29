/**
 * Eiyuden Chronicle: Hundred Heroes — Save Tracker & Recruitment Guide
 * Client-Side Application Logic (Vanilla ES6+)
 *
 * Design Philosophy: Minimalist, Zero-Distraction, Maximum Readability
 */

'use strict';

// =============================================================================
// Application State
// =============================================================================

const state = {
  // --- Heroes ---
  characters: [],          // Array of 121 character definition objects
  recruitedIds: new Set(), // Set of recruited character ID numbers
  activeFilter: 'all',     // 'all' | 'recruited' | 'missing' | 'missable'
  activeChapterFilter: 'all', // 'all' | chapter arc name string
  searchQuery: '',         // Lowercase trimmed search string

  // --- Recipes ---
  recipes: [],                      // Array of 93 recipe definition objects
  acquiredRecipeIds: new Set(),     // Set of acquired recipe IDs from save file
  cookedRecipeIds: new Set(),       // Set of manually-marked cooked recipe IDs
  activeRecipesFilter: 'all',       // 'all' | 'acquired' | 'not_acquired' | 'cooked' | 'not_cooked'
  recipesSearchQuery: '',           // Lowercase trimmed recipes search string

  // --- Beigoma & Trainers ---
  beigoma: [],                      // Array of 60 collectible top objects
  beigomaTrainers: [],              // Array of 44 trainer objects
  beigomaSubView: 'collection',     // 'collection' | 'trainers'
  beigomaFilter: 'all',             // 'all' | 'obtained' | 'missing'
  beigomaRarityFilter: 'all',       // 'all' | '1' | '2' | '3' | '4'
  beigomaSearch: '',                // Lowercase trimmed beigoma search string
  trainerFilter: 'all',             // 'all' | 'defeated' | 'unbattled'
  trainerSearch: '',                // Lowercase trimmed trainer search string
  beigomaCollectedIds: [],          // Array of collected beigoma IDs from save file
  beigomaDefeatedTrainerIds: [],    // Array of defeated trainer IDs from save file

  // --- Fish Tracker ---
  fishList: [],                     // Array of 52 fish definition objects
  fishCaughtIds: new Set(),         // Set of caught fish IDs from save file
  discoveredSpotIds: new Set(),     // Set of discovered fishing spot IDs from save file
  activeFishFilter: 'all',          // 'all' | 'caught' | 'catchable' | 'undiscovered'
  activeFishRarity: 'all',          // 'all' | '1' | '2' | '3' | '4' | '5'
  fishSearchQuery: '',              // Lowercase trimmed search string

  // --- App ---
  activeView: 'heroes',    // 'heroes' | 'recipes' | 'beigoma' | 'fish'
  saveConfig: null,        // Server config: { save_path, file_exists, detected_steam_path }
  saveStatus: null,        // Save summary: { file_exists, recruited_ids, playtime_formatted, money, ... }
};

// Aliases for property casing compatibility
Object.defineProperty(state, 'beigomaSubview', {
  get() { return this.beigomaSubView; },
  set(v) { this.beigomaSubView = v; },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(state, 'fish', {
  get() { return this.fishList; },
  set(v) { this.fishList = v; },
  enumerable: true,
  configurable: true,
});

const appState = state;


// =============================================================================
// DOM Elements Cache
// =============================================================================

const dom = {
  // Action Buttons
  btnSync: null,
  btnConfig: null,
  btnCloseConfig: null,
  btnBrowseFile: null,
  btnSavePath: null,
  btnUseSteam: null,

  // Top Navigation Tabs
  tabNavHeroes: null,
  tabNavRecipes: null,
  tabNavBeigoma: null,
  tabNavFish: null,

  // View Panels
  viewHeroes: null,
  viewRecipes: null,
  viewBeigoma: null,
  viewFish: null,

  // Stats Display
  statSavePath: null,
  statProtagonist: null,
  statPlaytime: null,
  statMoney: null,
  statHq: null,

  // Heroes Filter Counts & Tabs
  filterTabs: [],
  countAll: null,
  countRecruited: null,
  countMissing: null,
  countMissable: null,

  // Heroes Search & Chapter Filter Input
  searchInput: null,
  chapterFilter: null,

  // Heroes Table & Empty State
  charactersTbody: null,
  emptyState: null,

  // Recipes Filter Tabs & Search
  recipesFilterTabs: [],
  countRecipesAll: null,
  countRecipesAcquired: null,
  countRecipesNotAcquired: null,
  countRecipesCooked: null,
  countRecipesNotCooked: null,
  searchRecipesInput: null,

  // Recipes Table & Empty State
  recipesTbody: null,
  recipesEmptyState: null,
  btnCookedHint: null,
  cookedPopover: null,
  btnCloseCookedPopover: null,

  // Navigation Badges
  navCountHeroes: null,
  navCountRecipes: null,
  navCountBeigoma: null,
  navCountFish: null,

  // Beigoma Sub-Navigation
  beigomaSubnav: null,
  subtabBeigomaCollection: null,
  subtabBeigomaTrainers: null,
  subnavCountBeigoma: null,
  subnavCountTrainers: null,

  // Beigoma Collection Subview
  subviewBeigomaCollection: null,
  beigomaFilterTabs: [],
  countBeigomaAll: null,
  countBeigomaObtained: null,
  countBeigomaMissing: null,
  beigomaRarityFilter: null,
  beigomaSearch: null,
  beigomaTable: null,
  beigomaList: null,
  beigomaEmptyState: null,

  // Beigoma Trainers Subview
  subviewBeigomaTrainers: null,
  trainerFilterTabs: [],
  countTrainerAll: null,
  countTrainerDefeated: null,
  countTrainerUnbattled: null,
  trainerSearch: null,
  trainerTable: null,
  trainerList: null,
  trainerEmptyState: null,

  // Fish Tracker
  fishFilterTabs: [],
  countFishAll: null,
  countFishCaught: null,
  countFishCatchable: null,
  countFishUndiscovered: null,
  fishRarityFilter: null,
  searchFishInput: null,
  fishTable: null,
  fishTbody: null,
  fishEmptyState: null,

  // Configuration Dialog & Upload
  configDialog: null,
  configPathInput: null,
  detectStatusHint: null,
  dropZone: null,
  fileInput: null,

  // Toast Container
  toastContainer: null,
};


// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Escapes HTML characters to prevent XSS vulnerabilities.
 * @param {string|number|null} text
 * @returns {string} Escaped string
 */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sets inline status hint message and styling inside a dialog.
 * @param {HTMLElement|null} element - Status hint element
 * @param {string} message - Text message to display
 * @param {'success'|'error'|'info'} [type='info'] - Severity level
 */
function setDialogStatus(element, message, type = 'info') {
  if (!element) return;
  if (!message) {
    element.textContent = '';
    element.className = 'dialog-status-hint';
    element.hidden = true;
    return;
  }
  element.textContent = message;
  element.className = `dialog-status-hint hint-${type}`;
  element.hidden = false;
}

/**
 * Shows an accessible, auto-dismissing toast notification.
 * @param {string} message - Notification text
 * @param {'info'|'success'|'error'} [type='info'] - Style category
 * @param {number} [duration=4000] - Duration in ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 4000) {
  if (!dom.toastContainer) return;
  // If settings modal is open, avoid background toasts blurred behind dialog backdrop
  if (dom.configDialog && dom.configDialog.open) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;

  let timer = null;
  const dismiss = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    toast.classList.add('toast-leaving');
    setTimeout(() => {
      if (toast.parentNode === dom.toastContainer) {
        dom.toastContainer.removeChild(toast);
      }
    }, 200);
  };

  toast.addEventListener('click', dismiss);
  timer = setTimeout(dismiss, duration);

  dom.toastContainer.appendChild(toast);
}

/**
 * Filters a single character based on status and text search.
 * @param {object} char - Character object from characters.json
 * @param {Set<number>} recruitedIds - Set of recruited character IDs
 * @param {string} activeFilter - 'all' | 'recruited' | 'missing' | 'missable'
 * @param {string} searchQuery - Search query in lowercase
 * @param {string} [activeChapterFilter='all'] - Chapter filter string or 'all'
 * @returns {boolean} Whether character matches all criteria
 */
function filterCharacter(char, recruitedIds, activeFilter, searchQuery, activeChapterFilter = 'all') {
  const isRecruited = recruitedIds.has(char.id);

  // Status Filter Tab
  if (activeFilter === 'recruited' && !isRecruited) return false;
  if (activeFilter === 'missing' && isRecruited) return false;
  if (activeFilter === 'missable' && !char.missable) return false;

  // Chapter Filter Dropdown
  if (activeChapterFilter && activeChapterFilter !== 'all' && char.chapter !== activeChapterFilter) {
    return false;
  }

  // Instant Text Search (name, location, recruitment notes, chapter, ID)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = (char.name || '').toLowerCase().includes(q);
    const locMatch = (char.location || '').toLowerCase().includes(q);
    const howMatch = (char.howToRecruit || '').toLowerCase().includes(q);
    const chapterMatch = (char.chapter || '').toLowerCase().includes(q);
    const idMatch = String(char.id).includes(q);

    if (!nameMatch && !locMatch && !howMatch && !chapterMatch && !idMatch) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates overall recruitment statistics and percentage.
 * @param {Array<object>} characters
 * @param {Set<number>} recruitedIds
 * @returns {object} Statistics summary
 */
function calculateProgress(characters, recruitedIds) {
  const total = characters.length;
  let recruited = 0;
  let missable = 0;

  for (const char of characters) {
    if (recruitedIds.has(char.id)) {
      recruited++;
    }
    if (char.missable) {
      missable++;
    }
  }

  const missing = Math.max(0, total - recruited);
  const percentage = total > 0 ? (recruited / total) * 100 : 0;

  return {
    total,
    recruited,
    missing,
    missable,
    percentage: Number(percentage.toFixed(1)),
    percentageFormatted: percentage.toFixed(1),
  };
}

/**
 * Generates table row HTML for a character.
 * @param {object} char - Character definition
 * @param {boolean} isRecruited - Recruitment status
 * @returns {string} Table row HTML string
 */
function createCharacterRowHtml(char, isRecruited) {
  const statusBadge = isRecruited
    ? '<span class="status-badge status-recruited">Recruited</span>'
    : '<span class="status-badge status-missing">Not Recruited</span>';

  const missableBadge = char.missable
    ? '<span class="badge-missable">Missable</span>'
    : '';

  return `
    <tr class="${isRecruited ? 'is-recruited' : ''}">
      <td class="col-name">
        <div class="hero-cell">
          <span class="hero-name">${escapeHtml(char.name)}</span>
          ${missableBadge}
        </div>
      </td>
      <td class="col-chapter">
        <span class="chapter-badge">${escapeHtml(char.chapter || '—')}</span>
      </td>
      <td class="col-location">${escapeHtml(char.location || '—')}</td>
      <td class="col-guide">${escapeHtml(char.howToRecruit || '—')}</td>
      <td class="col-status">${statusBadge}</td>
    </tr>
  `;
}

// =============================================================================
// UI Rendering & Updates
// =============================================================================

/**
 * Updates the active save path indicator in the header.
 */
function updateStats() {
  const cfgPath = state.saveConfig?.save_path || 'UserData0.dat';
  if (dom.statSavePath) {
    dom.statSavePath.textContent = cfgPath;
    dom.statSavePath.title = cfgPath;
  }
}

/**
 * Updates filter tab counter badges for heroes.
 */
function updateProgress() {
  const stats = calculateProgress(state.characters, state.recruitedIds);

  if (dom.countAll) dom.countAll.textContent = String(stats.total);
  if (dom.countRecruited) dom.countRecruited.textContent = String(stats.recruited);
  if (dom.countMissing) dom.countMissing.textContent = String(stats.missing);
  if (dom.countMissable) dom.countMissable.textContent = String(stats.missable);

  if (dom.navCountHeroes) dom.navCountHeroes.textContent = `${stats.recruited}/121`;
}

/**
 * Filters character list and renders HTML table rows.
 */
function renderTable() {
  if (!dom.charactersTbody) return;

  const filtered = state.characters.filter(char =>
    filterCharacter(
      char,
      state.recruitedIds,
      state.activeFilter,
      state.searchQuery,
      state.activeChapterFilter
    )
  );

  if (filtered.length === 0) {
    dom.charactersTbody.innerHTML = '';
    if (dom.emptyState) {
      dom.emptyState.hidden = false;
    }
  } else {
    if (dom.emptyState) {
      dom.emptyState.hidden = true;
    }

    const htmlRows = filtered
      .map(char => createCharacterRowHtml(char, state.recruitedIds.has(char.id)))
      .join('');
    dom.charactersTbody.innerHTML = htmlRows;
  }
}

// =============================================================================
// View Switching
// =============================================================================

/**
 * Switches the active top-level view (Heroes, Recipes, Beigoma, or Fish).
 * @param {'heroes'|'recipes'|'beigoma'|'fish'} viewName
 */
function switchView(viewName) {
  state.activeView = viewName;

  // Toggle view panels
  if (dom.viewHeroes) dom.viewHeroes.hidden = (viewName !== 'heroes');
  if (dom.viewRecipes) dom.viewRecipes.hidden = (viewName !== 'recipes');
  if (dom.viewBeigoma) dom.viewBeigoma.hidden = (viewName !== 'beigoma');
  if (dom.viewFish) dom.viewFish.hidden = (viewName !== 'fish');

  // Toggle nav tab active state
  [dom.tabNavHeroes, dom.tabNavRecipes, dom.tabNavBeigoma, dom.tabNavFish].forEach(tab => {
    if (!tab) return;
    const isActive = tab.dataset.view === viewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  if (viewName === 'beigoma') {
    switchBeigomaSubview(state.beigomaSubView || 'collection');
    renderBeigoma();
    renderTrainers();
  }

  if (viewName === 'fish') {
    renderFishTable();
  }

  // Persist active view
  try {
    localStorage.setItem('eiyuden_active_view', viewName);
  } catch (_) {}
}

// =============================================================================
// Recipes Filtering, Rendering & Cooked Persistence
// =============================================================================

/**
 * Debounced cooked IDs sync to backend.
 */
let _cookedSyncTimer = null;
function scheduleCookedSync() {
  clearTimeout(_cookedSyncTimer);
  _cookedSyncTimer = setTimeout(async () => {
    try {
      await fetch('/api/recipes/cooked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cooked_ids: Array.from(state.cookedRecipeIds) }),
      });
    } catch (_) {
      // Non-critical — localStorage already saved
    }
  }, 800);
}

/**
 * Filters a single recipe against the active tab filter and search query.
 * @param {object} recipe
 * @param {Set<number>} acquiredIds
 * @param {Set<number>} cookedIds
 * @param {string} activeFilter
 * @param {string} searchQuery
 * @returns {boolean}
 */
function filterRecipe(recipe, acquiredIds, cookedIds, activeFilter, searchQuery) {
  const isAcquired = acquiredIds.has(recipe.id);
  const isCooked = cookedIds.has(recipe.id);

  if (activeFilter === 'acquired' && !isAcquired) return false;
  if (activeFilter === 'not_acquired' && isAcquired) return false;
  if (activeFilter === 'cooked' && !isCooked) return false;
  if (activeFilter === 'not_cooked' && isCooked) return false;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = (recipe.name || '').toLowerCase().includes(q);
    const locMatch = (recipe.location || '').toLowerCase().includes(q);
    const howMatch = (recipe.howToObtain || '').toLowerCase().includes(q);
    if (!nameMatch && !locMatch && !howMatch) return false;
  }

  return true;
}

/**
 * Returns category badge HTML for a recipe.
 * @param {string} category - 'Appetizer' | 'Main' | 'Dessert'
 * @returns {string}
 */
function recipeCategoryBadge(category) {
  const cls = {
    'Appetizer': 'recipe-cat-appetizer',
    'Main': 'recipe-cat-main',
    'Dessert': 'recipe-cat-dessert',
  }[category] || '';
  return `<span class="recipe-cat-badge ${cls}">${escapeHtml(category)}</span>`;
}

/**
 * Generates table row HTML for a recipe.
 * @param {object} recipe
 * @param {boolean} isAcquired
 * @param {boolean} isCooked
 * @returns {string}
 */
function createRecipeRowHtml(recipe, isAcquired, isCooked) {
  const statusBadge = isAcquired
    ? '<span class="status-badge status-recruited">Acquired</span>'
    : '<span class="status-badge status-missing">Not Acquired</span>';

  const checkedAttr = isCooked ? 'checked' : '';
  const tooltip = 'Check manually when you\'ve cooked this dish at Kurtz\'s restaurant';

  return `
    <tr>
      <td class="col-recipe-name">${escapeHtml(recipe.name)}</td>
      <td class="col-recipe-loc">${escapeHtml(recipe.howToObtain || recipe.location || '—')}</td>
      <td class="col-recipe-status">${statusBadge}</td>
      <td class="col-recipe-cooked">
        <input type="checkbox" class="cooked-checkbox" data-recipe-id="${recipe.id}"
          ${checkedAttr} title="${tooltip}" aria-label="Mark ${escapeHtml(recipe.name)} as cooked">
      </td>
    </tr>
  `;
}

/**
 * Updates recipes filter tab counter badges and nav badge.
 */
function updateRecipesProgress() {
  const total = state.recipes.length;
  const acquired = state.acquiredRecipeIds.size;
  const cooked = state.cookedRecipeIds.size;
  const notAcquired = total - acquired;
  const notCooked = total - cooked;

  if (dom.countRecipesAll) dom.countRecipesAll.textContent = String(total);
  if (dom.countRecipesAcquired) dom.countRecipesAcquired.textContent = String(acquired);
  if (dom.countRecipesNotAcquired) dom.countRecipesNotAcquired.textContent = String(notAcquired);
  if (dom.countRecipesCooked) dom.countRecipesCooked.textContent = String(cooked);
  if (dom.countRecipesNotCooked) dom.countRecipesNotCooked.textContent = String(notCooked);

  if (dom.navCountRecipes) dom.navCountRecipes.textContent = `${acquired}/93`;
}

/**
 * Filters recipes and renders HTML table rows.
 */
function renderRecipesTable() {
  if (!dom.recipesTbody) return;

  const filtered = state.recipes.filter(r =>
    filterRecipe(
      r,
      state.acquiredRecipeIds,
      state.cookedRecipeIds,
      state.activeRecipesFilter,
      state.recipesSearchQuery
    )
  );

  if (filtered.length === 0) {
    dom.recipesTbody.innerHTML = '';
    if (dom.recipesEmptyState) dom.recipesEmptyState.hidden = false;
  } else {
    if (dom.recipesEmptyState) dom.recipesEmptyState.hidden = true;

    dom.recipesTbody.innerHTML = filtered
      .map(r => createRecipeRowHtml(r, state.acquiredRecipeIds.has(r.id), state.cookedRecipeIds.has(r.id)))
      .join('');
  }

  updateRecipesProgress();
}

// =============================================================================
// Beigoma & Trainers Filtering, Rendering & Subviews
// =============================================================================

/**
 * Switches the active Beigoma subview (Collection or Trainers).
 * @param {'collection'|'trainers'} subviewName
 */
function switchBeigomaSubview(subviewName) {
  state.beigomaSubView = subviewName;

  if (dom.subviewBeigomaCollection) {
    dom.subviewBeigomaCollection.hidden = (subviewName !== 'collection');
  }
  if (dom.subviewBeigomaTrainers) {
    dom.subviewBeigomaTrainers.hidden = (subviewName !== 'trainers');
  }

  [dom.subtabBeigomaCollection, dom.subtabBeigomaTrainers].forEach(tab => {
    if (!tab) return;
    const isActive = tab.dataset.subview === subviewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  try {
    localStorage.setItem('eiyuden_beigoma_subview', subviewName);
  } catch (_) {}
}

/**
 * Filters a single Beigoma top against active filter, rarity filter, and search query.
 * @param {object} item
 * @param {Set<number>|Array<number>} collectedIds
 * @param {string} activeFilter - 'all' | 'obtained' | 'missing'
 * @param {string} searchQuery
 * @param {string} [activeRarityFilter='all'] - 'all' | '1' | '2' | '3' | '4'
 * @returns {boolean}
 */
function filterBeigoma(item, collectedIds, activeFilter, searchQuery, activeRarityFilter = 'all') {
  const isObtained = collectedIds instanceof Set
    ? collectedIds.has(item.id)
    : (Array.isArray(collectedIds) ? collectedIds.includes(item.id) : false);

  if (activeFilter === 'obtained' && !isObtained) return false;
  if (activeFilter === 'missing' && isObtained) return false;

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

  return true;
}

/**
 * Filters a single Beigoma trainer against active filter and search query.
 * @param {object} trainer
 * @param {Set<number>|Array<number>} defeatedIds
 * @param {string} activeFilter - 'all' | 'defeated' | 'unbattled'
 * @param {string} searchQuery
 * @returns {boolean}
 */
function filterTrainer(trainer, defeatedIds, activeFilter, searchQuery) {
  const isDefeated = defeatedIds instanceof Set
    ? defeatedIds.has(trainer.id)
    : (Array.isArray(defeatedIds) ? defeatedIds.includes(trainer.id) : false);

  if (activeFilter === 'defeated' && !isDefeated) return false;
  if (activeFilter === 'unbattled' && isDefeated) return false;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = (trainer.name || '').toLowerCase().includes(q);
    const locMatch = (trainer.location || '').toLowerCase().includes(q);
    const idMatch = String(trainer.id).includes(q);
    if (!nameMatch && !locMatch && !idMatch) return false;
  }

  return true;
}

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
    <span class="rarity-stars" role="img" aria-label="Rarity: ${rarity} of 4 stars" title="${rarity} of 4 stars">
      <span class="star-filled" aria-hidden="true">${filledStars}</span><span class="star-empty" aria-hidden="true">${emptyStars}</span>
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

/**
 * Generates table row HTML for a Beigoma trainer.
 * @param {object} trainer
 * @param {boolean} isDefeated
 * @returns {string}
 */
function createTrainerRowHtml(trainer, isDefeated) {
  const statusBadge = isDefeated
    ? '<span class="status-badge badge-defeated">Defeated</span>'
    : '<span class="status-badge badge-not-battled">Not Battled</span>';

  return `
    <tr class="${isDefeated ? 'is-recruited' : ''}">
      <td class="col-trainer-name">${escapeHtml(trainer.name)}</td>
      <td class="col-trainer-location">${escapeHtml(trainer.location || '—')}</td>
      <td class="col-trainer-status">${statusBadge}</td>
    </tr>
  `;
}

/**
 * Updates Beigoma and trainer counter badges in nav, subnav, and filter bars.
 */
function updateBeigomaStats() {
  const totalBeigoma = state.beigoma.length || 60;
  const collectedIds = state.beigomaCollectedIds || [];
  const collectedCount = Array.isArray(collectedIds) ? collectedIds.length : (collectedIds.size || 0);
  const missingCount = Math.max(0, totalBeigoma - collectedCount);

  const totalTrainers = state.beigomaTrainers.length || 44;
  const defeatedIds = state.beigomaDefeatedTrainerIds || [];
  const defeatedCount = Array.isArray(defeatedIds) ? defeatedIds.length : (defeatedIds.size || 0);
  const unbattledCount = Math.max(0, totalTrainers - defeatedCount);

  // Top Nav counter
  if (dom.navCountBeigoma) {
    dom.navCountBeigoma.textContent = `${collectedCount}/${totalBeigoma}`;
  }

  // Subnav badges
  if (dom.subnavCountBeigoma) {
    dom.subnavCountBeigoma.textContent = `${collectedCount}/${totalBeigoma}`;
  }
  if (dom.subnavCountTrainers) {
    dom.subnavCountTrainers.textContent = `${defeatedCount}/${totalTrainers}`;
  }

  // Beigoma Filter badges
  if (dom.countBeigomaAll) dom.countBeigomaAll.textContent = String(totalBeigoma);
  if (dom.countBeigomaObtained) dom.countBeigomaObtained.textContent = String(collectedCount);
  if (dom.countBeigomaMissing) dom.countBeigomaMissing.textContent = String(missingCount);

  // Trainer Filter badges
  if (dom.countTrainerAll) dom.countTrainerAll.textContent = String(totalTrainers);
  if (dom.countTrainerDefeated) dom.countTrainerDefeated.textContent = String(defeatedCount);
  if (dom.countTrainerUnbattled) dom.countTrainerUnbattled.textContent = String(unbattledCount);
}

/**
 * Filters Beigoma list and renders HTML table rows.
 */
function renderBeigoma() {
  if (!dom.beigomaList) return;

  const collectedSet = new Set(state.beigomaCollectedIds);
  const filtered = state.beigoma.filter(item =>
    filterBeigoma(
      item,
      collectedSet,
      state.beigomaFilter,
      state.beigomaSearch,
      state.beigomaRarityFilter
    )
  );

  if (filtered.length === 0) {
    dom.beigomaList.innerHTML = '';
    if (dom.beigomaEmptyState) dom.beigomaEmptyState.hidden = false;
  } else {
    if (dom.beigomaEmptyState) dom.beigomaEmptyState.hidden = true;

    dom.beigomaList.innerHTML = filtered
      .map(top => createBeigomaRowHtml(top, collectedSet.has(top.id)))
      .join('');
  }

  updateBeigomaStats();
}

/**
 * Filters Trainers list and renders HTML table rows.
 */
function renderTrainers() {
  if (!dom.trainerList) return;

  const defeatedSet = new Set(state.beigomaDefeatedTrainerIds);
  const filtered = state.beigomaTrainers.filter(trainer =>
    filterTrainer(
      trainer,
      defeatedSet,
      state.trainerFilter,
      state.trainerSearch
    )
  );

  if (filtered.length === 0) {
    dom.trainerList.innerHTML = '';
    if (dom.trainerEmptyState) dom.trainerEmptyState.hidden = false;
  } else {
    if (dom.trainerEmptyState) dom.trainerEmptyState.hidden = true;

    dom.trainerList.innerHTML = filtered
      .map(trainer => createTrainerRowHtml(trainer, defeatedSet.has(trainer.id)))
      .join('');
  }

  updateBeigomaStats();
}

// =============================================================================
// Fish Tracker Logic & Rendering
// =============================================================================

/**
 * Computes fish status: 'caught' | 'catchable' | 'undiscovered'.
 * @param {object} fish
 * @param {Set<number>|Array<number>} [caughtIds=state.fishCaughtIds]
 * @param {Set<number>|Array<number>} [discoveredSpotIds=state.discoveredSpotIds]
 * @returns {'caught'|'catchable'|'undiscovered'}
 */
function getFishStatus(fish, caughtIds = state.fishCaughtIds, discoveredSpotIds = state.discoveredSpotIds) {
  if (!fish) return 'undiscovered';
  const cSet = caughtIds instanceof Set ? caughtIds : new Set(caughtIds || []);
  const sSet = discoveredSpotIds instanceof Set ? discoveredSpotIds : new Set(discoveredSpotIds || []);

  if (cSet.has(fish.id)) {
    return 'caught';
  }
  if (Array.isArray(fish.spot_ids) && fish.spot_ids.some(sid => sSet.has(sid))) {
    return 'catchable';
  }
  return 'undiscovered';
}

/**
 * Filters a fish item based on status, rarity, and text search.
 * @param {object} fish
 * @param {Set<number>|Array<number>} [caughtIds=state.fishCaughtIds]
 * @param {Set<number>|Array<number>} [discoveredSpotIds=state.discoveredSpotIds]
 * @param {string} [filter=state.activeFishFilter]
 * @param {string} [searchQuery=state.fishSearchQuery]
 * @param {string} [rarityFilter=state.activeFishRarity]
 * @returns {boolean}
 */
function filterFish(
  fish,
  caughtIds = state.fishCaughtIds,
  discoveredSpotIds = state.discoveredSpotIds,
  filter = state.activeFishFilter,
  searchQuery = state.fishSearchQuery,
  rarityFilter = state.activeFishRarity
) {
  if (!fish) return false;

  const status = getFishStatus(fish, caughtIds, discoveredSpotIds);

  // Status Filter: 'all' | 'caught' | 'catchable' | 'undiscovered'
  if (filter && filter !== 'all' && status !== filter) {
    return false;
  }

  // Rarity Filter: 'all' | '1' | '2' | '3' | '4' | '5'
  if (rarityFilter && rarityFilter !== 'all') {
    if (String(fish.rarity) !== String(rarityFilter)) {
      return false;
    }
  }

  // Text Search (name, location, notes)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = (fish.name || '').toLowerCase().includes(q);
    const locMatch = (fish.location || '').toLowerCase().includes(q);
    const notesMatch = (fish.notes || '').toLowerCase().includes(q);
    if (!nameMatch && !locMatch && !notesMatch) {
      return false;
    }
  }

  return true;
}

/**
 * Generates table row HTML for a single fish.
 * @param {object} fish
 * @param {'caught'|'catchable'|'undiscovered'} status
 * @returns {string}
 */
function createFishRowHtml(fish, status) {
  let badgeClass = 'status-undiscovered';
  let badgeLabel = 'Undiscovered';

  if (status === 'caught') {
    badgeClass = 'status-caught';
    badgeLabel = 'Caught';
  } else if (status === 'catchable') {
    badgeClass = 'status-catchable';
    badgeLabel = 'Catchable';
  }

  const rarity = Math.max(1, Math.min(5, parseInt(fish.rarity, 10) || 1));
  const filledStars = '★'.repeat(rarity);
  const emptyStars = '☆'.repeat(5 - rarity);

  const rarityHtml = `
    <span class="rarity-stars" role="img" aria-label="Rarity: ${rarity} of 5 stars" title="${rarity} of 5 stars">
      <span class="star-filled" aria-hidden="true">${filledStars}</span><span class="star-empty" aria-hidden="true">${emptyStars}</span>
    </span>
  `;

  return `
    <tr class="${status === 'caught' ? 'is-recruited' : ''}">
      <td class="col-fish-name">${escapeHtml(fish.name)}</td>
      <td class="col-fish-location">${escapeHtml(fish.location || '—')}</td>
      <td class="col-fish-rarity">${rarityHtml}</td>
      <td class="col-fish-status"><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
    </tr>
  `;
}

/**
 * Updates fish counters in top navigation and filter tabs.
 */
function updateFishCounts() {
  const total = state.fishList.length || 52;
  let caught = 0;
  let catchable = 0;
  let undiscovered = 0;

  for (const f of state.fishList) {
    const st = getFishStatus(f, state.fishCaughtIds, state.discoveredSpotIds);
    if (st === 'caught') caught++;
    else if (st === 'catchable') catchable++;
    else undiscovered++;
  }

  if (dom.navCountFish) {
    dom.navCountFish.textContent = `${caught}/${total}`;
  }
  if (dom.countFishAll) dom.countFishAll.textContent = String(total);
  if (dom.countFishCaught) dom.countFishCaught.textContent = String(caught);
  if (dom.countFishCatchable) dom.countFishCatchable.textContent = String(catchable);
  if (dom.countFishUndiscovered) dom.countFishUndiscovered.textContent = String(undiscovered);
}

const updateFishStatusCounts = updateFishCounts;

/**
 * Filters fish collection and renders table rows.
 */
function renderFishTable() {
  if (!dom.fishTbody) return;

  const filtered = state.fishList.filter(f =>
    filterFish(
      f,
      state.fishCaughtIds,
      state.discoveredSpotIds,
      state.activeFishFilter,
      state.fishSearchQuery,
      state.activeFishRarity
    )
  );

  if (filtered.length === 0) {
    dom.fishTbody.innerHTML = '';
    if (dom.fishEmptyState) dom.fishEmptyState.hidden = false;
  } else {
    if (dom.fishEmptyState) dom.fishEmptyState.hidden = true;
    dom.fishTbody.innerHTML = filtered
      .map(f => createFishRowHtml(f, getFishStatus(f, state.fishCaughtIds, state.discoveredSpotIds)))
      .join('');
  }
}

/**
 * Fetches fish catalog data from server.
 * @returns {Promise<Array<object>>}
 */
async function fetchFishData() {
  try {
    const res = await fetch('/api/fish');
    if (res.ok) {
      state.fishList = await res.json();
      return state.fishList;
    }
  } catch (err) {
    showToast(`Could not load fish catalog: ${err.message}`, 'error');
  }
  return [];
}

/**
 * Synchronizes save progress across all tracker domains:
 * Heroes, Recipes, Beigoma collection, Beigoma trainers, and Fish.
 * @param {object} data - Save summary object
 */
function applyProgress(data) {
  if (!data) return;

  if (Array.isArray(data.recruited_ids)) {
    state.recruitedIds = new Set(data.recruited_ids);
  } else if (data.file_exists === false) {
    state.recruitedIds = new Set();
  }

  if (Array.isArray(data.acquired_recipe_ids)) {
    state.acquiredRecipeIds = new Set(data.acquired_recipe_ids);
  } else if (data.file_exists === false) {
    state.acquiredRecipeIds = new Set();
  }

  if (Array.isArray(data.beigoma_collected_ids)) {
    state.beigomaCollectedIds = [...data.beigoma_collected_ids];
  } else if (data.file_exists === false) {
    state.beigomaCollectedIds = [];
  }

  if (Array.isArray(data.beigoma_defeated_trainer_ids)) {
    state.beigomaDefeatedTrainerIds = [...data.beigoma_defeated_trainer_ids];
  } else if (data.file_exists === false) {
    state.beigomaDefeatedTrainerIds = [];
  }

  if (Array.isArray(data.fish_caught_ids)) {
    state.fishCaughtIds = new Set(data.fish_caught_ids);
  } else if (data.file_exists === false) {
    state.fishCaughtIds = new Set();
  }

  if (Array.isArray(data.discovered_spot_ids)) {
    state.discoveredSpotIds = new Set(data.discovered_spot_ids);
  } else if (data.file_exists === false) {
    state.discoveredSpotIds = new Set();
  }

  updateStats();
  updateProgress();
  if (typeof updateRecipesProgress === 'function') updateRecipesProgress();
  if (typeof updateBeigomaStats === 'function') updateBeigomaStats();
  if (typeof updateFishCounts === 'function') updateFishCounts();

  renderTable();
  if (typeof renderRecipesTable === 'function') renderRecipesTable();
  if (typeof renderBeigoma === 'function') renderBeigoma();
  if (typeof renderTrainers === 'function') renderTrainers();
  if (typeof renderFishTable === 'function') renderFishTable();
}

// =============================================================================
// API Actions & Data Syncing
// =============================================================================

/**
 * Handles edge cases when interacting with a save file:
 * - Missing or non-existent file (e.g. deleted or moved)
 * - Corrupted or unreadable file data (e.g. partial write)
 * - Error reading save file
 * - Successful synchronization
 *
 * @param {object} statusData - Result from /api/save/status or read_save_summary
 * @param {object} [options]
 * @param {boolean} [options.silent=false] - Whether to suppress toast notifications
 * @param {HTMLElement} [options.statusTarget=null] - Optional DOM element for inline status
 * @param {object} [options.prevCounts=null] - Snapshot of counts before sync (for delta toast)
 * @returns {{ ok: boolean, reason: string }}
 */
function handleSaveFileStatus(statusData, { silent = false, statusTarget = null, prevCounts = null } = {}) {
  const savePath = state.saveConfig?.save_path || 'UserData0.dat';

  if (!statusData || !statusData.file_exists) {
    const hintMsg = `Save file not found at: ${savePath}`;
    if (statusTarget) {
      setDialogStatus(statusTarget, hintMsg, 'error');
    }
    if (!silent) {
      showToast(`Save file not found at "${savePath}". Open Settings to select or auto-detect your save file.`, 'info');
    }
    return { ok: false, reason: 'not_found' };
  }

  if (statusData.corrupted) {
    const errMsg = `Save file is corrupted or unreadable (${statusData.error || 'decryption failed'})`;
    if (statusTarget) {
      setDialogStatus(statusTarget, errMsg, 'error');
    }
    if (!silent) {
      showToast(errMsg, 'error');
    }
    return { ok: false, reason: 'corrupted' };
  }

  if (statusData.error) {
    const errMsg = `Save file error: ${statusData.error}`;
    if (statusTarget) {
      setDialogStatus(statusTarget, errMsg, 'error');
    }
    if (!silent) {
      showToast(errMsg, 'error');
    }
    return { ok: false, reason: 'error' };
  }

  // Build sync message — inline status bar uses simple totals, toast uses delta copy.
  const heroCount = (statusData.recruited_ids || []).length;
  const recipeCount = (statusData.acquired_recipe_ids || []).length;
  const beigomaCount = (statusData.beigoma_collected_ids || []).length;
  const trainerCount = (statusData.beigoma_defeated_trainer_ids || []).length;
  const fishCount = (statusData.fish_caught_ids || []).length;

  if (statusTarget) {
    setDialogStatus(
      statusTarget,
      `Save synchronized · ${heroCount} heroes · ${recipeCount} recipes · ${beigomaCount}/60 tops · ${trainerCount}/44 trainers · ${fishCount}/52 fish`,
      'success'
    );
  } else if (!silent) {
    showToast(buildSyncToast(prevCounts, { heroCount, recipeCount, beigomaCount, trainerCount, fishCount }), 'success');
  }

  return { ok: true, reason: 'synced' };
}

/**
 * Tracker definitions for delta-aware sync toast.
 * Add a new entry here when a new tracker category is introduced (fish, chests, runes, etc.).
 * Each entry: { label: singular, labelPlural: plural, key: key in newCounts }
 */
const SYNC_TRACKERS = [
  { label: 'hero',    labelPlural: 'heroes',           key: 'heroCount' },
  { label: 'recipe',  labelPlural: 'recipes',           key: 'recipeCount' },
  { label: 'beigoma', labelPlural: 'beigoma',           key: 'beigomaCount' },
  { label: 'trainer', labelPlural: 'trainers defeated', key: 'trainerCount' },
  { label: 'fish',    labelPlural: 'fish',             key: 'fishCount' },
];

/**
 * Builds a human-friendly sync toast message.
 *
 * When deltas are detected, emits delta copy:
 *   "Synced · +2 heroes · +5 beigoma"
 * When there are no new updates, emits simple status without listing items:
 *   "Save up to date"
 *
 * Designed to be extended: add entries to SYNC_TRACKERS for fish, chests, runes, etc.
 *
 * @param {object|null} prevCounts - Snapshot before applyProgress (keys match SYNC_TRACKERS)
 * @param {object} newCounts - Current counts after applyProgress
 * @returns {string}
 */
function buildSyncToast(prevCounts, newCounts) {
  if (prevCounts) {
    const deltas = SYNC_TRACKERS
      .map(t => {
        const delta = (newCounts[t.key] || 0) - (prevCounts[t.key] || 0);
        if (delta <= 0) return null;
        const word = delta === 1 ? t.label : t.labelPlural;
        return `+${delta} ${word}`;
      })
      .filter(Boolean);

    if (deltas.length > 0) {
      return `Synced · ${deltas.join(' · ')}`;
    }
  }

  return 'Save up to date';
}

/**
 * Synchronizes save file status from the backend API.
 * Handles edge cases safely:
 * - Missing/deleted save file
 * - Corrupted save file data
 * - Network or server errors
 *
 * @param {object} [options]
 * @param {boolean} [options.silent=false] - Suppress success toast if true
 * @param {HTMLElement} [options.statusTarget=null] - Inline status element
 * @returns {Promise<boolean>} Success status
 */
async function syncSave({ silent = false, statusTarget = null } = {}) {
  try {
    const res = await fetch('/api/save/status');
    const data = await res.json();

    state.saveStatus = data;

    // Snapshot counts before applying new progress (for delta toast)
    const prevCounts = {
      heroCount:    state.recruitedIds.size,
      recipeCount:  state.acquiredRecipeIds.size,
      beigomaCount: state.beigomaCollectedIds.length,
      trainerCount: state.beigomaDefeatedTrainerIds.length,
    };

    if (!data.file_exists || data.corrupted || !res.ok) {
      applyProgress({
        file_exists: false,
        recruited_ids: [],
        acquired_recipe_ids: [],
        beigoma_collected_ids: [],
        beigoma_defeated_trainer_ids: [],
      });
    } else {
      applyProgress(data);
    }

    const handled = handleSaveFileStatus(data, { silent, statusTarget, prevCounts });
    return handled.ok;
  } catch (err) {
    applyProgress({
      file_exists: false,
      recruited_ids: [],
      acquired_recipe_ids: [],
      beigoma_collected_ids: [],
      beigoma_defeated_trainer_ids: [],
    });

    if (statusTarget) {
      setDialogStatus(statusTarget, `Network error syncing save: ${err.message}`, 'error');
    }
    if (!silent) {
      showToast(`Network error syncing save: ${err.message}`, 'error');
    }
    return false;
  }
}



/**
 * Uploads a local save file (.dat) to the backend.
 * @param {File} file
 */
async function handleFileUpload(file) {
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.dat')) {
    showToast('Invalid file format. Please upload a .dat save file (e.g. UserData0.dat, UserData1.dat).', 'error');
    return;
  }

  showToast(`Uploading ${file.name}...`, 'info');

  const formData = new FormData();
  formData.append('file', file, file.name);

  try {
    const res = await fetch('/api/save/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    state.saveConfig = {
      ...(state.saveConfig || {}),
      save_path: data.save_path,
      file_exists: true,
    };
    try {
      localStorage.setItem('eiyuden_save_path', data.save_path);
    } catch (_) {
      // LocalStorage might be restricted
    }

    if (data.summary) {
      state.saveStatus = data.summary;
      applyProgress(data.summary);
    } else {
      await syncSave({ silent: true });
    }

    if (dom.configDialog && dom.configDialog.open) {
      dom.configDialog.close();
    }

    showToast(buildSyncToast(null, {
      heroCount:    state.recruitedIds.size,
      recipeCount:  state.acquiredRecipeIds.size,
      beigomaCount: state.beigomaCollectedIds.length,
      trainerCount: state.beigomaDefeatedTrainerIds.length,
    }), 'success');
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
  }
}

// =============================================================================
// DOM Initialization & Event Handlers
// =============================================================================

/**
 * Caches all required DOM elements.
 */
function cacheDomElements() {
  dom.btnSync = document.getElementById('btn-sync');
  dom.btnConfig = document.getElementById('btn-config');
  dom.btnCloseConfig = document.getElementById('btn-close-config');
  dom.btnBrowseFile = document.getElementById('btn-browse-file');
  dom.btnSavePath = document.getElementById('btn-save-path');
  dom.btnUseSteam = document.getElementById('btn-use-steam');

  // Top Navigation
  dom.tabNavHeroes = document.getElementById('tab-nav-heroes');
  dom.tabNavRecipes = document.getElementById('tab-nav-recipes');
  dom.tabNavBeigoma = document.getElementById('tab-nav-beigoma');
  dom.navCountHeroes = document.getElementById('nav-count-heroes');
  dom.navCountRecipes = document.getElementById('nav-count-recipes');
  dom.navCountBeigoma = document.getElementById('nav-count-beigoma');

  // View Panels
  dom.viewHeroes = document.getElementById('view-heroes');
  dom.viewRecipes = document.getElementById('view-recipes');
  dom.viewBeigoma = document.getElementById('view-beigoma');

  // Stats Display
  dom.statSavePath = document.getElementById('stat-save-path');
  dom.statProtagonist = document.getElementById('stat-protagonist');
  dom.statPlaytime = document.getElementById('stat-playtime');
  dom.statMoney = document.getElementById('stat-money');
  dom.statHq = document.getElementById('stat-hq');

  // Heroes Filter Tabs & Counts
  dom.filterTabs = Array.from(document.querySelectorAll('#view-heroes .filter-tab'));
  dom.countAll = document.getElementById('count-all');
  dom.countRecruited = document.getElementById('count-recruited');
  dom.countMissing = document.getElementById('count-missing');
  dom.countMissable = document.getElementById('count-missable');

  // Heroes Search & Chapter Filter
  dom.searchInput = document.getElementById('search-input');
  dom.chapterFilter = document.getElementById('chapter-filter');

  // Heroes Table
  dom.charactersTbody = document.getElementById('characters-tbody');
  dom.emptyState = document.getElementById('empty-state');

  // Recipes Filter Tabs & Counts
  dom.recipesFilterTabs = Array.from(document.querySelectorAll('#recipes-filter-tabs .filter-tab'));
  dom.countRecipesAll = document.getElementById('count-recipes-all');
  dom.countRecipesAcquired = document.getElementById('count-recipes-acquired');
  dom.countRecipesNotAcquired = document.getElementById('count-recipes-not-acquired');
  dom.countRecipesCooked = document.getElementById('count-recipes-cooked');
  dom.countRecipesNotCooked = document.getElementById('count-recipes-not-cooked');

  // Recipes Search
  dom.searchRecipesInput = document.getElementById('search-recipes-input');

  // Recipes Table
  dom.recipesTbody = document.getElementById('recipes-tbody');
  dom.recipesEmptyState = document.getElementById('recipes-empty-state');
  dom.btnCookedHint = document.getElementById('btn-cooked-hint');
  dom.cookedPopover = document.getElementById('cooked-popover');
  dom.btnCloseCookedPopover = document.getElementById('btn-close-cooked-popover');

  // Beigoma Sub-Navigation
  dom.beigomaSubnav = document.getElementById('beigoma-subnav');
  dom.subtabBeigomaCollection = document.getElementById('subtab-beigoma-collection');
  dom.subtabBeigomaTrainers = document.getElementById('subtab-beigoma-trainers');
  dom.subnavCountBeigoma = document.getElementById('subnav-count-beigoma');
  dom.subnavCountTrainers = document.getElementById('subnav-count-trainers');

  // Beigoma Collection Subview
  dom.subviewBeigomaCollection = document.getElementById('subview-beigoma-collection');
  dom.beigomaFilterTabs = Array.from(document.querySelectorAll('#beigoma-filter-tabs .filter-tab'));
  dom.countBeigomaAll = document.getElementById('count-beigoma-all');
  dom.countBeigomaObtained = document.getElementById('count-beigoma-obtained');
  dom.countBeigomaMissing = document.getElementById('count-beigoma-missing');
  dom.beigomaRarityFilter = document.getElementById('beigoma-rarity-filter');
  dom.beigomaSearch = document.getElementById('beigoma-search');
  dom.beigomaTable = document.getElementById('beigoma-table');
  dom.beigomaList = document.getElementById('beigoma-list');
  dom.beigomaEmptyState = document.getElementById('beigoma-empty-state');

  // Beigoma Trainers Subview
  dom.subviewBeigomaTrainers = document.getElementById('subview-beigoma-trainers');
  dom.trainerFilterTabs = Array.from(document.querySelectorAll('#trainer-filter-tabs .filter-tab'));
  dom.countTrainerAll = document.getElementById('count-trainer-all');
  dom.countTrainerDefeated = document.getElementById('count-trainer-defeated');
  dom.countTrainerUnbattled = document.getElementById('count-trainer-unbattled');
  dom.trainerSearch = document.getElementById('trainer-search');
  dom.trainerTable = document.getElementById('trainer-table');
  dom.trainerList = document.getElementById('trainer-list');
  dom.trainerEmptyState = document.getElementById('trainer-empty-state');

  // Fish Navigation & View Panel
  dom.tabNavFish = document.getElementById('tab-nav-fish');
  dom.navCountFish = document.getElementById('nav-count-fish');
  dom.viewFish = document.getElementById('view-fish');
  dom.fishFilterTabs = Array.from(document.querySelectorAll('#fish-filter-tabs .filter-tab'));
  dom.countFishAll = document.getElementById('count-fish-all');
  dom.countFishCaught = document.getElementById('count-fish-caught');
  dom.countFishCatchable = document.getElementById('count-fish-catchable');
  dom.countFishUndiscovered = document.getElementById('count-fish-undiscovered');
  dom.fishRarityFilter = document.getElementById('fish-rarity-filter');
  dom.searchFishInput = document.getElementById('search-fish-input');
  dom.fishTable = document.getElementById('fish-table');
  dom.fishTbody = document.getElementById('fish-tbody');
  dom.fishEmptyState = document.getElementById('fish-empty-state');

  // Config Dialog & Upload
  dom.configDialog = document.getElementById('config-dialog');
  dom.configPathInput = document.getElementById('config-path-input');
  dom.detectStatusHint = document.getElementById('detect-status-hint');
  dom.dropZone = document.getElementById('drop-zone');
  dom.fileInput = document.getElementById('file-input');

  dom.toastContainer = document.getElementById('toast-container');
}

/**
 * Validates a candidate save file path against the backend API.
 * @param {string} candidatePath
 * @returns {Promise<{ valid: boolean, exists: boolean, error?: string, summary?: object }>}
 */
async function validateSavePath(candidatePath) {
  if (!candidatePath) {
    return { valid: false, exists: false, error: 'Path is empty' };
  }
  try {
    const res = await fetch('/api/save/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save_path: candidatePath }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: false,
        exists: data.exists !== undefined ? data.exists : false,
        error: data.error || `Server error (${res.status})`,
      };
    }
    return await res.json();
  } catch (err) {
    return { valid: false, exists: false, error: err.message };
  }
}

let _validateSaveTimer = null;

/**
 * Checks whether the current input differs from the active saved path,
 * debounces server validation, and toggles the Save Path button state.
 */
function updateSavePathButtonState() {
  if (!dom.btnSavePath || !dom.configPathInput) return;

  const currentVal = dom.configPathInput.value.trim();
  const activeVal = (state.saveConfig?.save_path || '').trim();

  // If empty or identical to active saved path, keep disabled
  if (!currentVal || currentVal === activeVal) {
    dom.btnSavePath.disabled = true;
    clearTimeout(_validateSaveTimer);
    setDialogStatus(dom.detectStatusHint, '');
    return;
  }

  // Path changed: show checking and debounce validation
  clearTimeout(_validateSaveTimer);
  dom.btnSavePath.disabled = true;
  setDialogStatus(dom.detectStatusHint, 'Checking save file...', 'info');

  _validateSaveTimer = setTimeout(async () => {
    const val = await validateSavePath(currentVal);
    // Discard if input changed in the meantime
    if (dom.configPathInput.value.trim() !== currentVal) return;

    if (val.valid) {
      dom.btnSavePath.disabled = false;
      const count = val.summary?.recruited_ids?.length || 0;
      const playtime = val.summary?.playtime_formatted || '';
      const heroText = count === 1 ? '1 hero' : `${count} heroes`;
      const playText = playtime ? `, ${playtime}` : '';
      setDialogStatus(
        dom.detectStatusHint,
        `✓ Valid save file verified (${heroText}${playText})`,
        'success'
      );
    } else if (!val.exists) {
      // File does not exist yet (e.g. UserDataXYZ.dat, new save slot) — allow user to save path
      dom.btnSavePath.disabled = false;
      setDialogStatus(
        dom.detectStatusHint,
        'Note: Save file does not exist yet at this path (path will be watched).',
        'info'
      );
    } else {
      dom.btnSavePath.disabled = true;
      setDialogStatus(
        dom.detectStatusHint,
        val.error || 'Selected file is not a valid Eiyuden Chronicle save file',
        'error'
      );
    }
  }, 300);
}


/**
 * Registers all user interaction event listeners.
 */
function setupEventListeners() {
  // Sync Save Button (with 3-second loading indicator delay)
  if (dom.btnSync) {
    dom.btnSync.addEventListener('click', async () => {
      dom.btnSync.disabled = true;
      dom.btnSync.classList.add('is-syncing');
      const textSpan = dom.btnSync.querySelector('.btn-text');
      const prevText = textSpan ? textSpan.textContent : dom.btnSync.textContent;
      if (textSpan) {
        textSpan.textContent = 'Syncing...';
      } else {
        dom.btnSync.textContent = 'Syncing...';
      }

      // Snapshot counts before sync so the toast can show only what changed
      const prevCounts = {
        heroCount:    state.recruitedIds.size,
        recipeCount:  state.acquiredRecipeIds.size,
        beigomaCount: state.beigomaCollectedIds.length,
        trainerCount: state.beigomaDefeatedTrainerIds.length,
      };

      try {
        const delayPromise = new Promise(resolve => setTimeout(resolve, 3000));
        let syncError = null;
        const syncPromise = (async () => {
          try {
            const cfgRes = await fetch('/api/config');
            if (cfgRes.ok) {
              state.saveConfig = await cfgRes.json();
            }
            await syncSave({ silent: true });
          } catch (err) {
            syncError = err;
          }
        })();

        await Promise.all([syncPromise, delayPromise]);

        if (syncError) {
          showToast(`Sync error: ${syncError.message}`, 'error');
        } else if (state.saveStatus) {
          handleSaveFileStatus(state.saveStatus, { silent: false, prevCounts });
        }
      } finally {
        dom.btnSync.disabled = false;
        dom.btnSync.classList.remove('is-syncing');
        if (textSpan) {
          textSpan.textContent = prevText;
        } else {
          dom.btnSync.textContent = prevText;
        }
      }
    });
  }

  // Top Navigation Tab Switching
  [dom.tabNavHeroes, dom.tabNavRecipes, dom.tabNavBeigoma, dom.tabNavFish].forEach(tab => {
    if (!tab) return;
    tab.addEventListener('click', () => {
      switchView(tab.dataset.view || 'heroes');
    });
  });

  // Fish Filter Tabs
  if (dom.fishFilterTabs) {
    dom.fishFilterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.fishFilterTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.activeFishFilter = tab.dataset.filter || 'all';
        renderFishTable();
      });
    });
  }

  // Fish Search Input
  if (dom.searchFishInput) {
    dom.searchFishInput.addEventListener('input', (e) => {
      state.fishSearchQuery = e.target.value.trim().toLowerCase();
      renderFishTable();
    });

    dom.searchFishInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.searchFishInput.value) {
        dom.searchFishInput.value = '';
        state.fishSearchQuery = '';
        renderFishTable();
      }
    });
  }

  // Fish Rarity Filter Dropdown
  if (dom.fishRarityFilter) {
    dom.fishRarityFilter.addEventListener('change', (e) => {
      state.activeFishRarity = e.target.value;
      renderFishTable();
    });
  }

  // Beigoma Sub-Navigation (Collection vs Trainers)
  [dom.subtabBeigomaCollection, dom.subtabBeigomaTrainers].forEach(tab => {
    if (!tab) return;
    tab.addEventListener('click', () => {
      switchBeigomaSubview(tab.dataset.subview || 'collection');
    });
  });

  // Beigoma Filter Tabs
  dom.beigomaFilterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.beigomaFilterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.beigomaFilter = tab.dataset.filter || 'all';
      renderBeigoma();
    });
  });

  // Beigoma Search Input
  if (dom.beigomaSearch) {
    dom.beigomaSearch.addEventListener('input', (e) => {
      state.beigomaSearch = e.target.value.trim().toLowerCase();
      renderBeigoma();
    });

    dom.beigomaSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.beigomaSearch.value) {
        dom.beigomaSearch.value = '';
        state.beigomaSearch = '';
        renderBeigoma();
      }
    });
  }

  // Beigoma Rarity Filter Dropdown
  if (dom.beigomaRarityFilter) {
    dom.beigomaRarityFilter.addEventListener('change', (e) => {
      state.beigomaRarityFilter = e.target.value;
      renderBeigoma();
    });
  }

  // Trainer Filter Tabs
  dom.trainerFilterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.trainerFilterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.trainerFilter = tab.dataset.filter || 'all';
      renderTrainers();
    });
  });

  // Trainer Search Input
  if (dom.trainerSearch) {
    dom.trainerSearch.addEventListener('input', (e) => {
      state.trainerSearch = e.target.value.trim().toLowerCase();
      renderTrainers();
    });

    dom.trainerSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.trainerSearch.value) {
        dom.trainerSearch.value = '';
        state.trainerSearch = '';
        renderTrainers();
      }
    });
  }

  // Heroes Filter Status Tabs
  dom.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.activeFilter = tab.dataset.filter || 'all';
      renderTable();
    });
  });

  // Recipes Filter Tabs
  dom.recipesFilterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.recipesFilterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.activeRecipesFilter = tab.dataset.filter || 'all';
      renderRecipesTable();
    });
  });

  // Recipes Search Input
  if (dom.searchRecipesInput) {
    dom.searchRecipesInput.addEventListener('input', (e) => {
      state.recipesSearchQuery = e.target.value.trim().toLowerCase();
      renderRecipesTable();
    });

    dom.searchRecipesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.searchRecipesInput.value) {
        dom.searchRecipesInput.value = '';
        state.recipesSearchQuery = '';
        renderRecipesTable();
      }
    });
  }

  // Cooked Checkbox — event delegation on recipes tbody
  if (dom.recipesTbody) {
    dom.recipesTbody.addEventListener('change', (e) => {
      const checkbox = e.target.closest('.cooked-checkbox');
      if (!checkbox) return;
      const recipeId = parseInt(checkbox.dataset.recipeId, 10);
      if (isNaN(recipeId)) return;

      if (checkbox.checked) {
        state.cookedRecipeIds.add(recipeId);
      } else {
        state.cookedRecipeIds.delete(recipeId);
      }

      // Persist to localStorage immediately
      try {
        localStorage.setItem('eiyuden_cooked_recipes', JSON.stringify(Array.from(state.cookedRecipeIds)));
      } catch (_) {}

      // Debounced sync to backend
      scheduleCookedSync();

      // Update counters without full re-render (checkbox already reflects state)
      updateRecipesProgress();
    });
  }

  // Cooked Column Hint Tooltip Popover
  if (dom.btnCookedHint && dom.cookedPopover) {
    dom.btnCookedHint.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dom.cookedPopover.hasAttribute('hidden');
      if (isHidden) {
        dom.cookedPopover.removeAttribute('hidden');
        dom.btnCookedHint.setAttribute('aria-expanded', 'true');
      } else {
        dom.cookedPopover.setAttribute('hidden', '');
        dom.btnCookedHint.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (dom.btnCloseCookedPopover && dom.cookedPopover) {
    dom.btnCloseCookedPopover.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.cookedPopover.setAttribute('hidden', '');
      if (dom.btnCookedHint) dom.btnCookedHint.setAttribute('aria-expanded', 'false');
    });
  }

  if (dom.cookedPopover) {
    dom.cookedPopover.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Close Cooked popover on outside click or Escape key
  document.addEventListener('click', () => {
    if (dom.cookedPopover && !dom.cookedPopover.hasAttribute('hidden')) {
      dom.cookedPopover.setAttribute('hidden', '');
      if (dom.btnCookedHint) dom.btnCookedHint.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.cookedPopover && !dom.cookedPopover.hasAttribute('hidden')) {
        dom.cookedPopover.setAttribute('hidden', '');
        if (dom.btnCookedHint) dom.btnCookedHint.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Chapter Filter Dropdown
  if (dom.chapterFilter) {
    dom.chapterFilter.addEventListener('change', (e) => {
      state.activeChapterFilter = e.target.value;
      renderTable();
    });
  }

  // Instant Search Input
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderTable();
    });

    dom.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.searchInput.value) {
        dom.searchInput.value = '';
        state.searchQuery = '';
        renderTable();
      }
    });
  }

  // Settings Modal Open / Close
  if (dom.btnConfig && dom.configDialog) {
    dom.btnConfig.addEventListener('click', () => {
      setDialogStatus(dom.detectStatusHint, '');
      if (dom.btnSavePath) {
        dom.btnSavePath.disabled = true;
      }
      if (dom.configPathInput) {
        let activePath = state.saveConfig?.save_path;
        if (!activePath) {
          try {
            activePath = localStorage.getItem('eiyuden_save_path');
          } catch (_) {}
        }
        dom.configPathInput.value = activePath || 'UserData0.dat';
      }
      dom.configDialog.showModal();
    });
  }

  if (dom.btnCloseConfig && dom.configDialog) {
    dom.btnCloseConfig.addEventListener('click', () => {
      dom.configDialog.close();
    });
  }

  // Close modal when clicking outside dialog window (backdrop)
  if (dom.configDialog) {
    dom.configDialog.addEventListener('click', (e) => {
      const rect = dom.configDialog.getBoundingClientRect();
      const clickedInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!clickedInDialog) {
        dom.configDialog.close();
      }
    });
  }

  // Config Path Input listeners: validate and update Save Path button state
  if (dom.configPathInput) {
    dom.configPathInput.addEventListener('input', updateSavePathButtonState);
    dom.configPathInput.addEventListener('change', updateSavePathButtonState);
    dom.configPathInput.addEventListener('paste', () => {
      setTimeout(updateSavePathButtonState, 10);
    });
  }

  // Save Path Button
  if (dom.btnSavePath && dom.configPathInput) {
    dom.btnSavePath.addEventListener('click', async () => {
      const newPath = dom.configPathInput.value.trim();
      if (!newPath) {
        showToast('Please enter a valid save file path', 'error');
        return;
      }

      dom.btnSavePath.disabled = true;
      setDialogStatus(dom.detectStatusHint, 'Saving and validating path...', 'info');

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ save_path: newPath }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update configuration');
        }

        state.saveConfig = data.config;
        try {
          localStorage.setItem('eiyuden_save_path', newPath);
        } catch (_) {}

        if (dom.configDialog) {
          dom.configDialog.close();
        }

        if (data.config && !data.config.file_exists) {
          showToast(`Path saved, but no save file was found at "${newPath}".`, 'info');
        } else {
          showToast('Save path updated successfully', 'success');
        }
        await syncSave({ silent: false });
      } catch (err) {
        setDialogStatus(dom.detectStatusHint, err.message, 'error');
        showToast(`Error updating path: ${err.message}`, 'error');
        dom.btnSavePath.disabled = false;
      }
    });
  }

  // Auto-Detect Save Path Button
  if (dom.btnUseSteam && dom.configPathInput) {
    dom.btnUseSteam.addEventListener('click', async () => {
      dom.btnUseSteam.disabled = true;
      setDialogStatus(dom.detectStatusHint, '');
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          state.saveConfig = await res.json();
        }
        const detected = state.saveConfig?.detected_save_path || state.saveConfig?.detected_steam_path;
        if (detected) {
          dom.configPathInput.value = detected;
          const activeVal = (state.saveConfig?.save_path || '').trim();
          if (detected.trim() === activeVal) {
            if (dom.btnSavePath) dom.btnSavePath.disabled = true;
            setDialogStatus(dom.detectStatusHint, 'Save file detected (already active)', 'info');
          } else {
            updateSavePathButtonState();
          }
        } else {
          setDialogStatus(
            dom.detectStatusHint,
            'Could not find save file automatically. Please use Browse (📁) to locate your save file.',
            'error'
          );
        }
      } catch (err) {
        setDialogStatus(dom.detectStatusHint, `Error detecting save path: ${err.message}`, 'error');
      } finally {
        dom.btnUseSteam.disabled = false;
      }
    });
  }

  // Native File Browser trigger
  if (dom.btnBrowseFile) {
    dom.btnBrowseFile.addEventListener('click', async () => {
      dom.btnBrowseFile.disabled = true;
      const prevTitle = dom.btnBrowseFile.title;
      dom.btnBrowseFile.title = 'Browsing files...';
      setDialogStatus(dom.detectStatusHint, '');

      try {
        const res = await fetch('/api/save/browse', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (data.cancelled) {
          // User closed or cancelled the file dialog
          return;
        }
        if (!res.ok || !data.success) {
          const errMsg = data.error || `Server returned HTTP ${res.status}`;
          setDialogStatus(dom.detectStatusHint, errMsg, 'error');
          showToast(`File rejected: ${errMsg}`, 'error');
          return;
        }

        if (data.path) {
          if (dom.configPathInput) {
            dom.configPathInput.value = data.path;
          }
          if (state.saveConfig) {
            state.saveConfig.save_path = data.path;
            state.saveConfig.file_exists = true;
          }
          try {
            localStorage.setItem('eiyuden_save_path', data.path);
          } catch (e) {
            // Ignore storage restrictions
          }
          if (data.summary) {
            state.saveStatus = data.summary;
            applyProgress(data.summary);
          }
          if (dom.btnSavePath) {
            dom.btnSavePath.disabled = false;
          }
          const count = data.summary?.recruited_ids?.length || 0;
          const playtime = data.summary?.playtime_formatted || '';
          const heroText = count === 1 ? '1 hero' : `${count} heroes`;
          const playText = playtime ? `, ${playtime}` : '';
          setDialogStatus(
            dom.detectStatusHint,
            `✓ Valid save file loaded (${heroText}${playText})`,
            'success'
          );
          showToast(`Save file set to: ${data.path}`, 'success');
        }
      } catch (err) {
        setDialogStatus(dom.detectStatusHint, `Failed to browse file: ${err.message}`, 'error');
        showToast(`Failed to browse file: ${err.message}`, 'error');
      } finally {
        dom.btnBrowseFile.disabled = false;
        dom.btnBrowseFile.title = prevTitle;
      }
    });
  }
}

/**
 * Main application initialization sequence.
 */
async function init() {
  cacheDomElements();
  setupEventListeners();

  try {
    // Fetch server configuration, characters, recipes, cooked state, beigoma, trainers, and fish in parallel
    const [cfgRes, charRes, recipeRes, cookedRes, beigomaRes, trainerRes, fishRes] = await Promise.all([
      fetch('/api/config'),
      fetch('/api/characters'),
      fetch('/api/recipes'),
      fetch('/api/recipes/cooked'),
      fetch('/api/beigoma'),
      fetch('/api/beigoma/trainers'),
      fetch('/api/fish'),
    ]);

    if (cfgRes.ok) {
      state.saveConfig = await cfgRes.json();
    } else {
      showToast('Could not load configuration from server', 'error');
    }

    if (charRes.ok) {
      state.characters = await charRes.json();
    } else {
      showToast('Could not load characters catalog', 'error');
    }

    if (recipeRes.ok) {
      state.recipes = await recipeRes.json();
    } else {
      showToast('Could not load recipes catalog', 'error');
    }

    if (beigomaRes.ok) {
      state.beigoma = await beigomaRes.json();
    } else {
      showToast('Could not load beigoma catalog', 'error');
    }

    if (trainerRes.ok) {
      state.beigomaTrainers = await trainerRes.json();
    } else {
      showToast('Could not load beigoma trainers catalog', 'error');
    }

    if (fishRes && fishRes.ok) {
      state.fishList = await fishRes.json();
    } else {
      showToast('Could not load fish catalog', 'error');
    }

    // Restore cooked IDs: merge localStorage + server config
    const serverCookedIds = cookedRes.ok ? ((await cookedRes.json()).cooked_ids || []) : [];
    let localCookedIds = [];
    try {
      const raw = localStorage.getItem('eiyuden_cooked_recipes');
      if (raw) localCookedIds = JSON.parse(raw);
    } catch (_) {}
    const mergedCooked = new Set([...serverCookedIds, ...localCookedIds]);
    state.cookedRecipeIds = mergedCooked;

    // If merged differs from server, sync back
    if (mergedCooked.size !== serverCookedIds.length) {
      try {
        await fetch('/api/recipes/cooked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cooked_ids: Array.from(mergedCooked) }),
        });
        localStorage.setItem('eiyuden_cooked_recipes', JSON.stringify(Array.from(mergedCooked)));
      } catch (_) {}
    }

    // Attempt localStorage restore of save path
    try {
      const savedLocalPath = localStorage.getItem('eiyuden_save_path');
      if (savedLocalPath && state.saveConfig && !state.saveConfig.file_exists && state.saveConfig.save_path !== savedLocalPath) {
        const updateRes = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ save_path: savedLocalPath }),
        });
        if (updateRes.ok) {
          const updated = await updateRes.json();
          if (updated.config) {
            state.saveConfig = updated.config;
          }
        }
      }
    } catch (_) {
      // Ignore localStorage sync issues
    }

    // Fetch active save status (updates recruitedIds + acquiredRecipeIds + beigoma)
    const hasSave = await syncSave({ silent: true });
    if (!hasSave && state.saveConfig && !state.saveConfig.file_exists) {
      showToast(
        `No save file found at "${state.saveConfig.save_path || 'UserData0.dat'}". Open Settings to configure.`,
        'info'
      );
    }

    // Restore saved active view
    try {
      const savedView = localStorage.getItem('eiyuden_active_view');
      if (savedView === 'recipes') {
        switchView('recipes');
      } else if (savedView === 'beigoma') {
        switchView('beigoma');
      } else if (savedView === 'fish') {
        switchView('fish');
      } else {
        switchView('heroes');
      }
    } catch (_) {
      switchView('heroes');
    }

    // Restore saved beigoma subview
    try {
      const savedSubview = localStorage.getItem('eiyuden_beigoma_subview');
      if (savedSubview === 'trainers') {
        switchBeigomaSubview('trainers');
      } else {
        switchBeigomaSubview('collection');
      }
    } catch (_) {
      switchBeigomaSubview('collection');
    }
  } catch (err) {
    showToast(`Initialization failed: ${err.message}`, 'error');
  } finally {
    updateStats();
    updateProgress();
    renderTable();
    renderRecipesTable();
    updateBeigomaStats();
    renderBeigoma();
    renderTrainers();
    updateFishCounts();
    renderFishTable();
  }
}

// =============================================================================
// Bootstrap & Exports
// =============================================================================

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// Export for Node.js test environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    state,
    appState,
    dom,
    escapeHtml,
    showToast,
    setDialogStatus,
    handleSaveFileStatus,
    filterCharacter,
    filterRecipe,
    filterBeigoma,
    filterTrainer,
    calculateProgress,
    createCharacterRowHtml,
    createRecipeRowHtml,
    createBeigomaRowHtml,
    createTrainerRowHtml,
    recipeCategoryBadge,
    updateStats,
    updateProgress,
    updateRecipesProgress,
    updateBeigomaStats,
    renderTable,
    renderRecipesTable,
    renderBeigoma,
    renderTrainers,
    getFishStatus,
    filterFish,
    createFishRowHtml,
    updateFishCounts,
    updateFishStatusCounts,
    renderFishTable,
    fetchFishData,
    switchView,
    switchBeigomaSubview,
    applyProgress,
    buildSyncToast,
    SYNC_TRACKERS,
    scheduleCookedSync,
    syncSave,
    handleFileUpload,
    validateSavePath,
    updateSavePathButtonState,
    init,
  };
}

