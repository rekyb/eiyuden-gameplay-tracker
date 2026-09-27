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
  characters: [],          // Array of 121 character definition objects
  recruitedIds: new Set(), // Set of recruited character ID numbers
  activeFilter: 'all',     // 'all' | 'recruited' | 'missing' | 'missable'
  searchQuery: '',         // Lowercase trimmed search string
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

  // Stats Display
  statSavePath: null,
  statProtagonist: null,
  statPlaytime: null,
  statMoney: null,
  statHq: null,

  // Progress Bar
  progressCount: null,
  progressText: null,
  progressFill: null,
  progressTrack: null,

  // Filter Counts & Tabs
  filterTabs: [],
  countAll: null,
  countRecruited: null,
  countMissing: null,
  countMissable: null,

  // Search Input
  searchInput: null,

  // Table & Empty State
  charactersTbody: null,
  emptyState: null,

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
 * Updates the progress bar track, percentages, and filter tab counter badges.
 */
function updateProgress() {
  const stats = calculateProgress(state.characters, state.recruitedIds);

  if (dom.progressCount) {
    dom.progressCount.textContent = `${stats.recruited} / ${stats.total}`;
  }
  if (dom.progressText) {
    dom.progressText.textContent = `(${stats.percentageFormatted}%)`;
  }
  if (dom.progressFill) {
    dom.progressFill.style.width = `${stats.percentage}%`;
  }
  if (dom.progressTrack) {
    dom.progressTrack.setAttribute('aria-valuenow', String(stats.recruited));
    dom.progressTrack.setAttribute('aria-valuemax', String(stats.total));
  }

  if (dom.countAll) dom.countAll.textContent = String(stats.total);
  if (dom.countRecruited) dom.countRecruited.textContent = String(stats.recruited);
  if (dom.countMissing) dom.countMissing.textContent = String(stats.missing);
  if (dom.countMissable) dom.countMissable.textContent = String(stats.missable);
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
      updateStats();
      updateProgress();
      renderTable();
      showToast(`Could not read save: ${data.error || res.statusText}`, 'error');
      return false;
    }

    state.saveStatus = data;
    state.recruitedIds = new Set(data.recruited_ids || []);

    updateStats();
    updateProgress();
    renderTable();

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

  dom.statSavePath = document.getElementById('stat-save-path');
  dom.statProtagonist = document.getElementById('stat-protagonist');
  dom.statPlaytime = document.getElementById('stat-playtime');
  dom.statMoney = document.getElementById('stat-money');
  dom.statHq = document.getElementById('stat-hq');

  dom.progressCount = document.getElementById('progress-count');
  dom.progressText = document.getElementById('progress-text');
  dom.progressFill = document.getElementById('progress-fill');
  dom.progressTrack = document.querySelector('.progress-track');

  dom.filterTabs = Array.from(document.querySelectorAll('.filter-tab'));
  dom.countAll = document.getElementById('count-all');
  dom.countRecruited = document.getElementById('count-recruited');
  dom.countMissing = document.getElementById('count-missing');
  dom.countMissable = document.getElementById('count-missable');

  dom.searchInput = document.getElementById('search-input');

  dom.charactersTbody = document.getElementById('characters-tbody');
  dom.emptyState = document.getElementById('empty-state');

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

  // Filter Status Tabs
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
    // Fetch server configuration and character definitions in parallel
    const [cfgRes, charRes] = await Promise.all([
      fetch('/api/config'),
      fetch('/api/characters'),
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

    // Attempt localStorage restore if server path doesn't exist but localStorage has one
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

    // Fetch active save status
    await syncSave({ silent: true });
  } catch (err) {
    showToast(`Initialization failed: ${err.message}`, 'error');
  } finally {
    updateStats();
    updateProgress();
    renderTable();
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
    calculateProgress,
    createCharacterRowHtml,
    updateStats,
    updateProgress,
    renderTable,
    syncSave,
    createBackup,
    handleFileUpload,
    init,
  };
}
