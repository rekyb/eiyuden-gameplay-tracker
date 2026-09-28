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
  searchQuery: '',         // Lowercase trimmed search string

  // --- Recipes ---
  recipes: [],                      // Array of 93 recipe definition objects
  acquiredRecipeIds: new Set(),     // Set of acquired recipe IDs from save file
  cookedRecipeIds: new Set(),       // Set of manually-marked cooked recipe IDs
  activeRecipesFilter: 'all',       // 'all' | 'acquired' | 'not_acquired' | 'cooked' | 'not_cooked'
  recipesSearchQuery: '',           // Lowercase trimmed recipes search string

  // --- App ---
  activeView: 'heroes',    // 'heroes' | 'recipes'
  saveConfig: null,        // Server config: { save_path, file_exists, detected_steam_path }
  saveStatus: null,        // Save summary: { file_exists, recruited_ids, playtime_formatted, money, ... }
};


// =============================================================================
// DOM Elements Cache
// =============================================================================

const dom = {
  // Action Buttons
  btnSync: null,
  btnBackup: null,
  btnConfig: null,
  btnCloseConfig: null,
  btnBrowseFile: null,
  btnSavePath: null,
  btnUseSteam: null,

  // Top Navigation Tabs
  tabNavHeroes: null,
  tabNavRecipes: null,

  // View Panels
  viewHeroes: null,
  viewRecipes: null,

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

  // Heroes Search Input
  searchInput: null,

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

  // Configuration Dialog & Upload
  configDialog: null,
  configPathInput: null,
  detectStatusHint: null,
  saveActionsStatusHint: null,
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
 * @returns {boolean} Whether character matches all criteria
 */
function filterCharacter(char, recruitedIds, activeFilter, searchQuery) {
  const isRecruited = recruitedIds.has(char.id);

  // Status Filter Tab
  if (activeFilter === 'recruited' && !isRecruited) return false;
  if (activeFilter === 'missing' && isRecruited) return false;
  if (activeFilter === 'missable' && !char.missable) return false;

  // Instant Text Search (name, location, recruitment notes, ID)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const nameMatch = (char.name || '').toLowerCase().includes(q);
    const locMatch = (char.location || '').toLowerCase().includes(q);
    const howMatch = (char.howToRecruit || '').toLowerCase().includes(q);
    const idMatch = String(char.id).includes(q);

    if (!nameMatch && !locMatch && !howMatch && !idMatch) {
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
      state.searchQuery
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
 * Switches the active top-level view (Heroes or Recipes).
 * @param {'heroes'|'recipes'} viewName
 */
function switchView(viewName) {
  state.activeView = viewName;

  // Toggle view panels
  if (dom.viewHeroes) dom.viewHeroes.hidden = (viewName !== 'heroes');
  if (dom.viewRecipes) dom.viewRecipes.hidden = (viewName !== 'recipes');

  // Toggle nav tab active state
  [dom.tabNavHeroes, dom.tabNavRecipes].forEach(tab => {
    if (!tab) return;
    const isActive = tab.dataset.view === viewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

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
    const catMatch = (recipe.category || '').toLowerCase().includes(q);
    const locMatch = (recipe.location || '').toLowerCase().includes(q);
    const howMatch = (recipe.howToObtain || '').toLowerCase().includes(q);
    if (!nameMatch && !catMatch && !locMatch && !howMatch) return false;
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
 * @returns {{ ok: boolean, reason: string }}
 */
function handleSaveFileStatus(statusData, { silent = false, statusTarget = null } = {}) {
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

  if (statusTarget) {
    setDialogStatus(
      statusTarget,
      `Save synchronized (${(statusData.recruited_ids || []).length} heroes, ${(statusData.acquired_recipe_ids || []).length} recipes)`,
      'success'
    );
  } else if (!silent) {
    showToast(
      `Synchronized save file (${(statusData.recruited_ids || []).length} recruited)`,
      'success'
    );
  }

  return { ok: true, reason: 'synced' };
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

    if (!data.file_exists || data.corrupted || !res.ok) {
      state.recruitedIds = new Set();
      state.acquiredRecipeIds = new Set();
    } else {
      state.recruitedIds = new Set(data.recruited_ids || []);
      state.acquiredRecipeIds = new Set(data.acquired_recipe_ids || []);
    }

    updateStats();
    updateProgress();
    renderTable();
    renderRecipesTable();

    const handled = handleSaveFileStatus(data, { silent, statusTarget });
    return handled.ok;
  } catch (err) {
    state.recruitedIds = new Set();
    state.acquiredRecipeIds = new Set();
    updateStats();
    updateProgress();
    renderTable();
    renderRecipesTable();

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
 * Creates a timestamped backup of the current save file.
 */
async function createBackup() {
  if (!dom.btnBackup) return;
  dom.btnBackup.disabled = true;
  setDialogStatus(dom.saveActionsStatusHint, '');

  try {
    const res = await fetch('/api/save/backup', { method: 'POST' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create backup');
    }

    const fileName = (data.backup_file || '').split(/[/\\]/).pop();
    if (dom.configDialog && dom.configDialog.open) {
      setDialogStatus(dom.saveActionsStatusHint, `Backup created: ${fileName}`, 'success');
    } else {
      showToast(`Backup created: ${fileName}`, 'success');
    }
  } catch (err) {
    if (dom.configDialog && dom.configDialog.open) {
      setDialogStatus(dom.saveActionsStatusHint, `Backup failed: ${err.message}`, 'error');
    } else {
      showToast(`Backup failed: ${err.message}`, 'error');
    }
  } finally {
    dom.btnBackup.disabled = false;
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
      state.recruitedIds = new Set(data.summary.recruited_ids || []);
      updateStats();
      updateProgress();
      renderTable();
    } else {
      await syncSave({ silent: true });
    }

    if (dom.configDialog && dom.configDialog.open) {
      dom.configDialog.close();
    }

    showToast(`Save file uploaded successfully (${state.recruitedIds.size} recruited)`, 'success');
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
  dom.btnBackup = document.getElementById('btn-backup');
  dom.btnConfig = document.getElementById('btn-config');
  dom.btnCloseConfig = document.getElementById('btn-close-config');
  dom.btnBrowseFile = document.getElementById('btn-browse-file');
  dom.btnSavePath = document.getElementById('btn-save-path');
  dom.btnUseSteam = document.getElementById('btn-use-steam');

  // Top Navigation
  dom.tabNavHeroes = document.getElementById('tab-nav-heroes');
  dom.tabNavRecipes = document.getElementById('tab-nav-recipes');
  dom.navCountHeroes = document.getElementById('nav-count-heroes');
  dom.navCountRecipes = document.getElementById('nav-count-recipes');

  // View Panels
  dom.viewHeroes = document.getElementById('view-heroes');
  dom.viewRecipes = document.getElementById('view-recipes');

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

  // Heroes Search
  dom.searchInput = document.getElementById('search-input');

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

  // Config Dialog & Upload
  dom.configDialog = document.getElementById('config-dialog');
  dom.configPathInput = document.getElementById('config-path-input');
  dom.detectStatusHint = document.getElementById('detect-status-hint');
  dom.saveActionsStatusHint = document.getElementById('save-actions-status-hint');
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
        exists: false,
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
  // Sync Save Button
  if (dom.btnSync) {
    dom.btnSync.addEventListener('click', async () => {
      dom.btnSync.disabled = true;
      setDialogStatus(dom.saveActionsStatusHint, '');
      try {
        const cfgRes = await fetch('/api/config');
        if (cfgRes.ok) {
          state.saveConfig = await cfgRes.json();
        }
        const isDialogOpen = Boolean(dom.configDialog && dom.configDialog.open);
        await syncSave({
          silent: isDialogOpen,
          statusTarget: isDialogOpen ? dom.saveActionsStatusHint : null,
        });
      } catch (err) {
        showToast(`Sync error: ${err.message}`, 'error');
      } finally {
        dom.btnSync.disabled = false;
      }
    });
  }

  // Backup Save Button
  if (dom.btnBackup) {
    dom.btnBackup.addEventListener('click', createBackup);
  }

  // Top Navigation Tab Switching
  [dom.tabNavHeroes, dom.tabNavRecipes].forEach(tab => {
    if (!tab) return;
    tab.addEventListener('click', () => {
      switchView(tab.dataset.view || 'heroes');
    });
  });

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
      setDialogStatus(dom.saveActionsStatusHint, '');
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
            state.recruitedIds = new Set(data.summary.recruited_ids || []);
            state.acquiredRecipeIds = new Set(data.summary.acquired_recipe_ids || []);
            updateStats();
            updateProgress();
            renderTable();
            if (typeof renderRecipesTable === 'function') {
              renderRecipesTable();
            }
          }
          if (dom.btnSavePath) {
            dom.btnSavePath.disabled = true;
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
    // Fetch server configuration, characters, recipes, and cooked state in parallel
    const [cfgRes, charRes, recipeRes, cookedRes] = await Promise.all([
      fetch('/api/config'),
      fetch('/api/characters'),
      fetch('/api/recipes'),
      fetch('/api/recipes/cooked'),
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

    // Fetch active save status (updates recruitedIds + acquiredRecipeIds)
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
      } else {
        switchView('heroes');
      }
    } catch (_) {
      switchView('heroes');
    }
  } catch (err) {
    showToast(`Initialization failed: ${err.message}`, 'error');
  } finally {
    updateStats();
    updateProgress();
    renderTable();
    renderRecipesTable();
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
    dom,
    escapeHtml,
    showToast,
    setDialogStatus,
    handleSaveFileStatus,
    filterCharacter,
    filterRecipe,
    calculateProgress,
    createCharacterRowHtml,
    createRecipeRowHtml,
    recipeCategoryBadge,
    updateStats,
    updateProgress,
    updateRecipesProgress,
    renderTable,
    renderRecipesTable,
    switchView,
    scheduleCookedSync,
    syncSave,
    createBackup,
    handleFileUpload,
    validateSavePath,
    updateSavePathButtonState,
    init,
  };
}

