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

  // Navigation Badges
  navCountHeroes: null,
  navCountRecipes: null,

  // Configuration Dialog & Upload
  configDialog: null,
  configPathInput: null,
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
 * Shows an accessible, auto-dismissing toast notification.
 * @param {string} message - Notification text
 * @param {'info'|'success'|'error'} [type='info'] - Style category
 * @param {number} [duration=4000] - Duration in ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 4000) {
  if (!dom.toastContainer) return;

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
      <td class="col-recipe-cat">${recipeCategoryBadge(recipe.category)}</td>
      <td class="col-recipe-loc">${escapeHtml(recipe.location || '—')}</td>
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
 * Synchronizes save file status from the backend API.
 * @param {object} [options]
 * @param {boolean} [options.silent=false] - Suppress success toast if true
 * @returns {Promise<boolean>} Success status
 */
async function syncSave({ silent = false } = {}) {
  try {
    const res = await fetch('/api/save/status');
    const data = await res.json();

    if (!res.ok) {
      state.saveStatus = data;
      state.recruitedIds = new Set();
      state.acquiredRecipeIds = new Set();
      updateStats();
      updateProgress();
      renderTable();
      renderRecipesTable();
      showToast(`Could not read save: ${data.error || res.statusText}`, 'error');
      return false;
    }

    state.saveStatus = data;
    state.recruitedIds = new Set(data.recruited_ids || []);
    state.acquiredRecipeIds = new Set(data.acquired_recipe_ids || []);

    updateStats();
    updateProgress();
    renderTable();
    renderRecipesTable();

    if (!data.file_exists) {
      if (!silent) {
        showToast(
          `Save file not found at "${state.saveConfig?.save_path || 'UserData0.dat'}". Open Settings to configure.`,
          'info'
        );
      }
    } else if (!silent) {
      showToast(
        `Synchronized save file (${state.recruitedIds.size} recruited)`,
        'success'
      );
    }

    return true;
  } catch (err) {
    showToast(`Network error syncing save: ${err.message}`, 'error');
    return false;
  }
}


/**
 * Creates a timestamped backup of the current save file.
 */
async function createBackup() {
  if (!dom.btnBackup) return;
  dom.btnBackup.disabled = true;

  try {
    const res = await fetch('/api/save/backup', { method: 'POST' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create backup');
    }

    const fileName = (data.backup_file || '').split(/[/\\]/).pop();
    showToast(`Backup created: ${fileName}`, 'success');
  } catch (err) {
    showToast(`Backup failed: ${err.message}`, 'error');
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

  // Config Dialog & Upload
  dom.configDialog = document.getElementById('config-dialog');
  dom.configPathInput = document.getElementById('config-path-input');
  dom.dropZone = document.getElementById('drop-zone');
  dom.fileInput = document.getElementById('file-input');

  dom.toastContainer = document.getElementById('toast-container');
}


/**
 * Registers all user interaction event listeners.
 */
function setupEventListeners() {
  // Sync Save Button
  if (dom.btnSync) {
    dom.btnSync.addEventListener('click', async () => {
      dom.btnSync.disabled = true;
      try {
        const cfgRes = await fetch('/api/config');
        if (cfgRes.ok) {
          state.saveConfig = await cfgRes.json();
        }
        await syncSave({ silent: false });
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

  // Save Path Button
  if (dom.btnSavePath && dom.configPathInput) {
    dom.btnSavePath.addEventListener('click', async () => {
      const newPath = dom.configPathInput.value.trim();
      if (!newPath) {
        showToast('Please enter a valid save file path', 'error');
        return;
      }

      dom.btnSavePath.disabled = true;
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ save_path: newPath }),
        });
        const data = await res.json();

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

        showToast('Save path updated successfully', 'success');
        await syncSave({ silent: false });
      } catch (err) {
        showToast(`Error updating path: ${err.message}`, 'error');
      } finally {
        dom.btnSavePath.disabled = false;
      }
    });
  }

  // Detect Steam Path Button
  if (dom.btnUseSteam && dom.configPathInput) {
    dom.btnUseSteam.addEventListener('click', async () => {
      dom.btnUseSteam.disabled = true;
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          state.saveConfig = await res.json();
        }
        const detected = state.saveConfig?.detected_steam_path;
        if (detected) {
          dom.configPathInput.value = detected;
          showToast('Detected Steam save path applied to input', 'info');
        } else {
          showToast('No Steam save path detected automatically', 'info');
        }
      } catch (err) {
        showToast(`Error detecting Steam path: ${err.message}`, 'error');
      } finally {
        dom.btnUseSteam.disabled = false;
      }
    });
  }

  // Native File Browser trigger
  if (dom.btnBrowseFile) {
    dom.btnBrowseFile.addEventListener('click', async () => {
      dom.btnBrowseFile.disabled = true;
      const prevText = dom.btnBrowseFile.textContent;
      dom.btnBrowseFile.textContent = 'Browsing...';

      try {
        const res = await fetch('/api/save/browse', { method: 'POST' });
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.cancelled) {
          // User closed or cancelled the file dialog
          return;
        }
        if (data.success && data.path) {
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
            updateStats();
            updateProgress();
            renderTable();
          }
          showToast(`Save file set to: ${data.path}`, 'success');
          if (dom.configDialog && typeof dom.configDialog.close === 'function') {
            dom.configDialog.close();
          }
        } else if (data.error) {
          showToast(data.error, 'error');
        }
      } catch (err) {
        showToast(`Failed to browse file: ${err.message}`, 'error');
      } finally {
        dom.btnBrowseFile.disabled = false;
        dom.btnBrowseFile.textContent = prevText;
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
    await syncSave({ silent: true });

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
    init,
  };
}

