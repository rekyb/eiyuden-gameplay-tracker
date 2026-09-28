const test = require('node:test');
const assert = require('node:assert');
const app = require('../../static/app.js');

test('handleSaveFileStatus handles null/empty status as not_found', () => {
  const result = app.handleSaveFileStatus(null, { silent: true });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'not_found');

  const resultEmpty = app.handleSaveFileStatus({}, { silent: true });
  assert.strictEqual(resultEmpty.ok, false);
  assert.strictEqual(resultEmpty.reason, 'not_found');
});

test('handleSaveFileStatus handles file_exists: false as not_found', () => {
  const dummyTarget = { textContent: '', className: '', hidden: true };
  const result = app.handleSaveFileStatus({ file_exists: false }, { silent: true, statusTarget: dummyTarget });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'not_found');
  assert.strictEqual(dummyTarget.hidden, false);
  assert.ok(dummyTarget.className.includes('hint-error'));
  assert.ok(dummyTarget.textContent.includes('Save file not found'));
});

test('handleSaveFileStatus handles corrupted save file gracefully', () => {
  const dummyTarget = { textContent: '', className: '', hidden: true };
  const result = app.handleSaveFileStatus(
    { file_exists: true, corrupted: true, error: 'Padding invalid' },
    { silent: true, statusTarget: dummyTarget }
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'corrupted');
  assert.strictEqual(dummyTarget.hidden, false);
  assert.ok(dummyTarget.className.includes('hint-error'));
  assert.ok(dummyTarget.textContent.includes('corrupted or unreadable'));
});

test('handleSaveFileStatus handles general error safely', () => {
  const dummyTarget = { textContent: '', className: '', hidden: true };
  const result = app.handleSaveFileStatus(
    { file_exists: true, error: 'Permission denied' },
    { silent: true, statusTarget: dummyTarget }
  );
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'error');
  assert.strictEqual(dummyTarget.hidden, false);
  assert.ok(dummyTarget.className.includes('hint-error'));
  assert.ok(dummyTarget.textContent.includes('Permission denied'));
});

test('handleSaveFileStatus handles valid save data as synced', () => {
  const dummyTarget = { textContent: '', className: '', hidden: true };
  const result = app.handleSaveFileStatus(
    { file_exists: true, recruited_ids: [1, 2, 3], acquired_recipe_ids: [3000] },
    { silent: true, statusTarget: dummyTarget }
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reason, 'synced');
  assert.strictEqual(dummyTarget.hidden, false);
  assert.ok(dummyTarget.className.includes('hint-success'));
  assert.ok(dummyTarget.textContent.includes('Save synchronized'));
});

test('validateSavePath returns invalid on empty path', async () => {
  const result = await app.validateSavePath('');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.exists, false);
});

test('validateSavePath handles valid and invalid server responses', async () => {
  const origFetch = global.fetch;
  try {
    // Valid response
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ valid: true, exists: true, summary: { recruited_ids: [1, 2, 3] } }),
    });
    const validRes = await app.validateSavePath('C:/saves/UserData0.dat');
    assert.strictEqual(validRes.valid, true);
    assert.strictEqual(validRes.exists, true);

    // Invalid response
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ valid: false, exists: true, error: 'Decryption failed' }),
    });
    const invalidRes = await app.validateSavePath('C:/saves/invalid.dat');
    assert.strictEqual(invalidRes.valid, false);
    assert.strictEqual(invalidRes.error, 'Decryption failed');
  } finally {
    global.fetch = origFetch;
  }
});

test('updateSavePathButtonState keeps button disabled when path unchanged or empty', () => {
  app.state.saveConfig = { save_path: 'C:/saves/UserData0.dat' };
  app.dom.configPathInput = { value: 'C:/saves/UserData0.dat' };
  app.dom.btnSavePath = { disabled: false };
  app.dom.detectStatusHint = { textContent: '', className: '', hidden: true };

  // Identical path
  app.updateSavePathButtonState();
  assert.strictEqual(app.dom.btnSavePath.disabled, true);

  // Empty path
  app.dom.configPathInput.value = '   ';
  app.updateSavePathButtonState();
  assert.strictEqual(app.dom.btnSavePath.disabled, true);
});

test('updateSavePathButtonState enables button when valid new path is verified', async () => {
  const origFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        valid: true,
        exists: true,
        summary: { recruited_ids: [1, 2, 3], playtime_formatted: '10h 25m' },
      }),
    });

    app.state.saveConfig = { save_path: 'C:/saves/UserData0.dat' };
    app.dom.configPathInput = { value: 'C:/saves/UserData1.dat' };
    app.dom.btnSavePath = { disabled: false };
    app.dom.detectStatusHint = { textContent: '', className: '', hidden: true };

    app.updateSavePathButtonState();
    // Initially disabled while checking
    assert.strictEqual(app.dom.btnSavePath.disabled, true);

    // Wait for 350ms debounce
    await new Promise((r) => setTimeout(r, 350));

    assert.strictEqual(app.dom.btnSavePath.disabled, false);
    assert.strictEqual(app.dom.detectStatusHint.hidden, false);
    assert.ok(app.dom.detectStatusHint.className.includes('hint-success'));
    assert.ok(app.dom.detectStatusHint.textContent.includes('Valid save file verified'));
  } finally {
    global.fetch = origFetch;
  }
});

test('updateSavePathButtonState keeps button disabled when candidate path is invalid', async () => {
  const origFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        valid: false,
        exists: true,
        error: 'Not a valid Eiyuden Chronicle save file',
      }),
    });

    app.state.saveConfig = { save_path: 'C:/saves/UserData0.dat' };
    app.dom.configPathInput = { value: 'C:/saves/fake.dat' };
    app.dom.btnSavePath = { disabled: false };
    app.dom.detectStatusHint = { textContent: '', className: '', hidden: true };

    app.updateSavePathButtonState();
    assert.strictEqual(app.dom.btnSavePath.disabled, true);

    // Wait for 350ms debounce
    await new Promise((r) => setTimeout(r, 350));

    assert.strictEqual(app.dom.btnSavePath.disabled, true);
    assert.strictEqual(app.dom.detectStatusHint.hidden, false);
    assert.ok(app.dom.detectStatusHint.className.includes('hint-error'));
    assert.ok(app.dom.detectStatusHint.textContent.includes('Not a valid Eiyuden Chronicle save file'));
  } finally {
    global.fetch = origFetch;
  }
});

test('updateSavePathButtonState enables button when new save path does not exist yet (e.g. UserDataXYZ.dat)', async () => {
  const origFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        valid: false,
        exists: false,
        error: 'File does not exist: C:/saves/UserDataXYZ.dat',
      }),
    });

    app.state.saveConfig = { save_path: 'C:/saves/UserData0.dat' };
    app.dom.configPathInput = { value: 'C:/saves/UserDataXYZ.dat' };
    app.dom.btnSavePath = { disabled: false };
    app.dom.detectStatusHint = { textContent: '', className: '', hidden: true };

    app.updateSavePathButtonState();
    // Initially disabled while checking
    assert.strictEqual(app.dom.btnSavePath.disabled, true);

    // Wait for 350ms debounce
    await new Promise((r) => setTimeout(r, 350));

    // When file does not exist, user is allowed to save the path!
    assert.strictEqual(app.dom.btnSavePath.disabled, false);
    assert.strictEqual(app.dom.detectStatusHint.hidden, false);
    assert.ok(app.dom.detectStatusHint.className.includes('hint-info'));
    assert.ok(app.dom.detectStatusHint.textContent.includes('does not exist yet'));
  } finally {
    global.fetch = origFetch;
  }
});

test('filterRecipe does not allow searching by category', () => {
  const recipe = {
    id: 3025,
    name: 'Black Tea Cookies',
    category: 'Dessert',
    location: 'Twinhorne East',
    howToObtain: 'Purchased at the Tool Shop.',
  };

  // Searching by dish name works
  assert.strictEqual(app.filterRecipe(recipe, new Set(), new Set(), 'all', 'cookies'), true);

  // Searching by category (Dessert) must NOT match
  assert.strictEqual(app.filterRecipe(recipe, new Set(), new Set(), 'all', 'dessert'), false);
  assert.strictEqual(app.filterRecipe(recipe, new Set(), new Set(), 'all', 'appetizer'), false);
});

test('filterCharacter does not allow searching by role', () => {
  const character = {
    id: 1,
    name: 'Nowa',
    role: 'Battle',
    location: 'Eltisweiss',
    howToRecruit: 'Joins automatically during the prologue.',
  };

  // Searching by name works
  assert.strictEqual(app.filterCharacter(character, new Set(), 'all', 'nowa'), true);

  // Searching by role (Battle) must NOT match
  assert.strictEqual(app.filterCharacter(character, new Set(), 'all', 'battle'), false);
  assert.strictEqual(app.filterCharacter(character, new Set(), 'all', 'support'), false);
});

test('filterBeigoma correctly filters by status and text search', () => {
  const top = {
    id: 1,
    name: 'Wind Sprout',
    whereToObtain: 'Grum County dropped by Seed Hare',
  };

  // Status: all
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', ''), true);

  // Status: missing when not in collectedIds
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'missing', ''), true);
  assert.strictEqual(app.filterBeigoma(top, new Set([1]), 'missing', ''), false);

  // Status: obtained
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'obtained', ''), false);
  assert.strictEqual(app.filterBeigoma(top, new Set([1]), 'obtained', ''), true);
  // Also supports array
  assert.strictEqual(app.filterBeigoma(top, [1], 'obtained', ''), true);

  // Search by name
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'sprout'), true);
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'dragon'), false);

  // Search by location
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'seed hare'), true);
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'grum'), true);
});

test('filterTrainer correctly filters by status and text search', () => {
  const trainer = {
    id: 1,
    name: 'Zeph',
    location: 'Altverden Village',
  };

  // Status: all
  assert.strictEqual(app.filterTrainer(trainer, new Set(), 'all', ''), true);

  // Status: unbattled
  assert.strictEqual(app.filterTrainer(trainer, new Set(), 'unbattled', ''), true);
  assert.strictEqual(app.filterTrainer(trainer, new Set([1]), 'unbattled', ''), false);

  // Status: defeated
  assert.strictEqual(app.filterTrainer(trainer, new Set(), 'defeated', ''), false);
  assert.strictEqual(app.filterTrainer(trainer, new Set([1]), 'defeated', ''), true);
  // Also supports array
  assert.strictEqual(app.filterTrainer(trainer, [1], 'defeated', ''), true);

  // Search by trainer name
  assert.strictEqual(app.filterTrainer(trainer, new Set(), 'all', 'zeph'), true);
  assert.strictEqual(app.filterTrainer(trainer, new Set(), 'all', 'reid'), false);

  // Search by location
  assert.strictEqual(app.filterTrainer(trainer, new Set(), 'all', 'altverden'), true);
});

test('createBeigomaRowHtml produces correct markup with rarity stars', () => {
  const top3Star = { id: 41, name: 'Soul Reaper', whereToObtain: 'Drop in Deadworld', rarity: 3 };
  const html = app.createBeigomaRowHtml(top3Star, true);

  assert.ok(html.includes('col-beigoma-rarity'));
  assert.ok(html.includes('aria-label="Rarity: 3 of 4 stars"'));
  assert.ok(html.includes('<span class="star-filled">★★★</span>'));
  assert.ok(html.includes('<span class="star-empty">☆</span>'));
  assert.ok(html.includes('badge-obtained'));

  const top1Star = { id: 1, name: 'Plantvine', whereToObtain: 'Drop in Forest', rarity: 1 };
  const html1 = app.createBeigomaRowHtml(top1Star, false);
  assert.ok(html1.includes('aria-label="Rarity: 1 of 4 stars"'));
  assert.ok(html1.includes('<span class="star-filled">★</span>'));
  assert.ok(html1.includes('<span class="star-empty">☆☆☆</span>'));
  assert.ok(html1.includes('badge-missing'));
});

test('createTrainerRowHtml produces correct markup for defeated and unbattled trainers', () => {
  const trainer = {
    id: 10,
    name: 'Brog',
    location: 'Dappled Forest',
  };

  const htmlDefeated = app.createTrainerRowHtml(trainer, true);
  assert.ok(htmlDefeated.includes('Brog'));
  assert.ok(htmlDefeated.includes('Dappled Forest'));
  assert.ok(htmlDefeated.includes('badge-defeated'));
  assert.ok(htmlDefeated.includes('Defeated'));

  const htmlUnbattled = app.createTrainerRowHtml(trainer, false);
  assert.ok(htmlUnbattled.includes('Brog'));
  assert.ok(htmlUnbattled.includes('badge-not-battled'));
  assert.ok(htmlUnbattled.includes('Not Battled'));
});

test('updateBeigomaStats updates counts and badge text correctly', () => {
  app.state.beigoma = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `Top ${i + 1}` }));
  app.state.beigomaTrainers = Array.from({ length: 44 }, (_, i) => ({ id: i + 1, name: `Trainer ${i + 1}` }));
  app.state.beigomaCollectedIds = [1, 2, 3, 4, 5];
  app.state.beigomaDefeatedTrainerIds = [1, 2];

  app.dom.navCountBeigoma = { textContent: '' };
  app.dom.subnavCountBeigoma = { textContent: '' };
  app.dom.subnavCountTrainers = { textContent: '' };
  app.dom.countBeigomaAll = { textContent: '' };
  app.dom.countBeigomaObtained = { textContent: '' };
  app.dom.countBeigomaMissing = { textContent: '' };
  app.dom.countTrainerAll = { textContent: '' };
  app.dom.countTrainerDefeated = { textContent: '' };
  app.dom.countTrainerUnbattled = { textContent: '' };

  app.updateBeigomaStats();

  assert.strictEqual(app.dom.navCountBeigoma.textContent, '5/60');
  assert.strictEqual(app.dom.subnavCountBeigoma.textContent, '5/60');
  assert.strictEqual(app.dom.subnavCountTrainers.textContent, '2/44');
  assert.strictEqual(app.dom.countBeigomaAll.textContent, '60');
  assert.strictEqual(app.dom.countBeigomaObtained.textContent, '5');
  assert.strictEqual(app.dom.countBeigomaMissing.textContent, '55');
  assert.strictEqual(app.dom.countTrainerAll.textContent, '44');
  assert.strictEqual(app.dom.countTrainerDefeated.textContent, '2');
  assert.strictEqual(app.dom.countTrainerUnbattled.textContent, '42');
});

test('switchBeigomaSubview toggles panels and active classes', () => {
  app.dom.subviewBeigomaCollection = { hidden: false };
  app.dom.subviewBeigomaTrainers = { hidden: true };
  const mockClassList = (initialActive) => {
    let active = initialActive;
    return {
      toggle: (cls, val) => { if (cls === 'active') active = val; },
      contains: (cls) => cls === 'active' && active,
    };
  };
  app.dom.subtabBeigomaCollection = {
    dataset: { subview: 'collection' },
    classList: mockClassList(true),
    setAttribute: () => {},
  };
  app.dom.subtabBeigomaTrainers = {
    dataset: { subview: 'trainers' },
    classList: mockClassList(false),
    setAttribute: () => {},
  };

  // Switch to trainers
  app.switchBeigomaSubview('trainers');
  assert.strictEqual(app.state.beigomaSubView, 'trainers');
  assert.strictEqual(app.state.beigomaSubview, 'trainers');
  assert.strictEqual(app.dom.subviewBeigomaCollection.hidden, true);
  assert.strictEqual(app.dom.subviewBeigomaTrainers.hidden, false);
  assert.strictEqual(app.dom.subtabBeigomaTrainers.classList.contains('active'), true);
  assert.strictEqual(app.dom.subtabBeigomaCollection.classList.contains('active'), false);

  // Switch back to collection
  app.switchBeigomaSubview('collection');
  assert.strictEqual(app.state.beigomaSubView, 'collection');
  assert.strictEqual(app.dom.subviewBeigomaCollection.hidden, false);
  assert.strictEqual(app.dom.subviewBeigomaTrainers.hidden, true);
});

test('applyProgress updates state and counts from save payload', () => {
  const savePayload = {
    file_exists: true,
    recruited_ids: [1, 2],
    acquired_recipe_ids: [3001, 3002],
    beigoma_collected_ids: [10, 20, 30],
    beigoma_defeated_trainer_ids: [5, 6],
  };

  app.applyProgress(savePayload);

  assert.deepStrictEqual(app.state.beigomaCollectedIds, [10, 20, 30]);
  assert.deepStrictEqual(app.state.beigomaDefeatedTrainerIds, [5, 6]);
  assert.strictEqual(app.state.recruitedIds.has(1), true);
  assert.strictEqual(app.state.recruitedIds.has(2), true);
  assert.strictEqual(app.state.acquiredRecipeIds.has(3001), true);
});

test('buildSyncToast generates proper delta and up-to-date messages', () => {
  // Case 1: First sync / no prevCounts -> shows "Save up to date"
  const initialCounts = { heroCount: 23, recipeCount: 45, beigomaCount: 23, trainerCount: 14 };
  const firstSyncMsg = app.buildSyncToast(null, initialCounts);
  assert.strictEqual(firstSyncMsg, 'Save up to date');

  // Case 2: Deltas present -> only mentions changed categories
  const prevCounts = { heroCount: 23, recipeCount: 45, beigomaCount: 23, trainerCount: 14 };
  const updatedCounts = { heroCount: 25, recipeCount: 45, beigomaCount: 28, trainerCount: 15 };
  const deltaMsg = app.buildSyncToast(prevCounts, updatedCounts);
  assert.strictEqual(deltaMsg, 'Synced · +2 heroes · +5 beigoma · +1 trainer');

  // Case 3: Singular delta (+1 hero)
  const singleDelta = app.buildSyncToast({ heroCount: 10, recipeCount: 5, beigomaCount: 0, trainerCount: 0 },
                                         { heroCount: 11, recipeCount: 5, beigomaCount: 0, trainerCount: 0 });
  assert.strictEqual(singleDelta, 'Synced · +1 hero');

  // Case 4: No change / no update yet -> simply shows "Save up to date" without item listing or deltas
  const noChangeMsg = app.buildSyncToast(prevCounts, prevCounts);
  assert.strictEqual(noChangeMsg, 'Save up to date');
});

test('PAGE_SIZE is defined as 20', () => {
  assert.strictEqual(app.PAGE_SIZE, 20);
});

test('state initializes pagination page properties to 1', () => {
  assert.strictEqual(app.state.heroesPage, 1);
  assert.strictEqual(app.state.recipesPage, 1);
  assert.strictEqual(app.state.beigomaPage, 1);
  assert.strictEqual(app.state.trainerPage, 1);
});

test('paginateItems returns empty array and hides container when items is empty', () => {
  const dummyContainer = { innerHTML: '', hidden: false };
  const sliced = app.paginateItems({
    container: dummyContainer,
    items: [],
    currentPage: 1,
    pageSize: 20,
    onPageChange: () => {},
  });

  assert.deepStrictEqual(sliced, []);
  assert.strictEqual(dummyContainer.hidden, true);
  assert.strictEqual(dummyContainer.innerHTML, '');
});

test('paginateItems correctly slices first page, middle page, and last page', () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ id: i + 1 }));
  const dummyContainer = {
    innerHTML: '',
    hidden: true,
    addEventListener: () => {},
    querySelectorAll: () => [],
  };

  // Page 1 (items 1..20)
  const page1 = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 1,
    pageSize: 20,
  });
  assert.strictEqual(page1.length, 20);
  assert.strictEqual(page1[0].id, 1);
  assert.strictEqual(page1[19].id, 20);
  assert.strictEqual(dummyContainer.hidden, false);
  assert.ok(dummyContainer.innerHTML.includes('Showing 1–20 of 45 items'));

  // Page 2 (items 21..40)
  const page2 = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 2,
    pageSize: 20,
  });
  assert.strictEqual(page2.length, 20);
  assert.strictEqual(page2[0].id, 21);
  assert.strictEqual(page2[19].id, 40);
  assert.ok(dummyContainer.innerHTML.includes('Showing 21–40 of 45 items'));

  // Page 3 (items 41..45)
  const page3 = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 3,
    pageSize: 20,
  });
  assert.strictEqual(page3.length, 5);
  assert.strictEqual(page3[0].id, 41);
  assert.strictEqual(page3[4].id, 45);
  assert.ok(dummyContainer.innerHTML.includes('Showing 41–45 of 45 items'));
});

test('paginateItems clamps out-of-range currentPage', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
  const dummyContainer = { innerHTML: '', hidden: true, querySelectorAll: () => [] };

  // currentPage 99 should clamp to page 2 (last page)
  const pageHigh = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 99,
    pageSize: 20,
  });
  assert.strictEqual(pageHigh.length, 5);
  assert.strictEqual(pageHigh[0].id, 21);
  assert.ok(dummyContainer.innerHTML.includes('Showing 21–25 of 25 items'));

  // currentPage 0 or negative should clamp to page 1
  const pageLow = app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: -1,
    pageSize: 20,
  });
  assert.strictEqual(pageLow.length, 20);
  assert.strictEqual(pageLow[0].id, 1);
});

test('paginateItems attaches onPageChange listeners for numbered and nav buttons', () => {
  const items = Array.from({ length: 45 }, (_, i) => ({ id: i + 1 }));
  const calls = [];
  const mockButtons = [];

  const createMockButton = (dataset, disabled = false) => {
    let clickHandler = null;
    const btn = {
      dataset,
      disabled,
      addEventListener: (evt, fn) => {
        if (evt === 'click') clickHandler = fn;
      },
      click: () => {
        if (clickHandler) clickHandler({ preventDefault: () => {} });
      },
    };
    mockButtons.push(btn);
    return btn;
  };

  const btnPrev = createMockButton({ action: 'prev' }, false);
  const btnPage1 = createMockButton({ page: '1' }, false);
  const btnPage2 = createMockButton({ page: '2' }, false);
  const btnPage3 = createMockButton({ page: '3' }, false);
  const btnNext = createMockButton({ action: 'next' }, false);

  const dummyContainer = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: (selector) => {
      if (selector === '.page-btn') return mockButtons;
      return [];
    },
  };

  app.paginateItems({
    container: dummyContainer,
    items,
    currentPage: 2,
    pageSize: 20,
    onPageChange: (newPage) => calls.push(newPage),
  });

  // Clicking page 3
  btnPage3.click();
  assert.deepStrictEqual(calls, [3]);

  // Clicking current page (page 2) should NOT trigger callback
  btnPage2.click();
  assert.deepStrictEqual(calls, [3]);

  // Clicking prev (from page 2 -> 1)
  btnPrev.click();
  assert.deepStrictEqual(calls, [3, 1]);

  // Clicking next (from page 2 -> 3)
  btnNext.click();
  assert.deepStrictEqual(calls, [3, 1, 3]);

  // Disabled button should not trigger
  const disabledBtn = createMockButton({ page: '1' }, true);
  disabledBtn.click();
  assert.deepStrictEqual(calls, [3, 1, 3]);
});

test('paginateItems returns sliced items when container is null', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const sliced = app.paginateItems({
    container: null,
    items,
    currentPage: 1,
    pageSize: 2,
  });
  assert.strictEqual(sliced.length, 2);
  assert.strictEqual(sliced[0].id, 1);
  assert.strictEqual(sliced[1].id, 2);
});

test('paginateItems uses singular item label when total items is 1', () => {
  const dummyContainer = { innerHTML: '', hidden: false, querySelectorAll: () => [] };
  app.paginateItems({
    container: dummyContainer,
    items: [{ id: 1 }],
    currentPage: 1,
    pageSize: 20,
  });
  assert.ok(dummyContainer.innerHTML.includes('Showing 1–1 of 1 item'));
  assert.ok(!dummyContainer.innerHTML.includes('1 items'));
});

test('renderTable renders at most 20 heroes per page with pagination bar', () => {
  // Setup 50 dummy characters
  app.state.characters = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Hero ${i + 1}`,
    location: 'Test Location',
    howToRecruit: 'Test Guide',
    missable: false,
  }));
  app.state.recruitedIds = new Set();
  app.state.activeFilter = 'all';
  app.state.searchQuery = '';
  app.state.heroesPage = 1;

  const dummyTbody = { innerHTML: '' };
  const dummyPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: () => [],
  };
  const dummyEmpty = { hidden: false };

  app.dom.charactersTbody = dummyTbody;
  app.dom.heroesPagination = dummyPagination;
  app.dom.emptyState = dummyEmpty;

  app.renderTable();

  // Page 1 should contain 20 rows
  const rowMatches = (dummyTbody.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatches, 20);
  assert.strictEqual(dummyPagination.hidden, false);
  assert.ok(dummyPagination.innerHTML.includes('Showing 1–20 of 50 items'));

  // Switch to Page 2
  app.state.heroesPage = 2;
  app.renderTable();
  const rowMatchesP2 = (dummyTbody.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatchesP2, 20);
  assert.ok(dummyPagination.innerHTML.includes('Showing 21–40 of 50 items'));

  // Switch to Page 3 (remaining 10)
  app.state.heroesPage = 3;
  app.renderTable();
  const rowMatchesP3 = (dummyTbody.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatchesP3, 10);
  assert.ok(dummyPagination.innerHTML.includes('Showing 41–50 of 50 items'));
});

test('renderTable hides pagination and clears content when no heroes match filter', () => {
  app.state.characters = [{ id: 1, name: 'Nowa', location: 'Here', howToRecruit: 'Start', missable: false }];
  app.state.recruitedIds = new Set();
  app.state.activeFilter = 'all';
  app.state.searchQuery = 'nonexistenthero12345';
  app.state.heroesPage = 1;

  const dummyTbody = { innerHTML: '' };
  const dummyPagination = { innerHTML: 'previous pagination', hidden: false, querySelectorAll: () => [] };
  const dummyEmpty = { hidden: true };

  app.dom.charactersTbody = dummyTbody;
  app.dom.heroesPagination = dummyPagination;
  app.dom.emptyState = dummyEmpty;

  app.renderTable();

  assert.strictEqual(dummyTbody.innerHTML, '');
  assert.strictEqual(dummyEmpty.hidden, false);
  assert.strictEqual(dummyPagination.hidden, true);
  assert.strictEqual(dummyPagination.innerHTML, '');
});

test('renderRecipesTable renders at most 20 recipes per page with pagination bar', () => {
  app.state.recipes = Array.from({ length: 45 }, (_, i) => ({
    id: 3000 + i + 1,
    name: `Recipe ${i + 1}`,
    location: 'Test Kitchen',
    howToObtain: 'Test Chef',
  }));
  app.state.acquiredRecipeIds = new Set();
  app.state.cookedRecipeIds = new Set();
  app.state.activeRecipesFilter = 'all';
  app.state.recipesSearchQuery = '';
  app.state.recipesPage = 1;

  const dummyRecipesTbody = { innerHTML: '' };
  const dummyRecipesPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: () => [],
  };
  const dummyRecipesEmpty = { hidden: false };

  app.dom.recipesTbody = dummyRecipesTbody;
  app.dom.recipesPagination = dummyRecipesPagination;
  app.dom.recipesEmptyState = dummyRecipesEmpty;

  app.renderRecipesTable();

  const rowMatches = (dummyRecipesTbody.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatches, 20);
  assert.strictEqual(dummyRecipesPagination.hidden, false);
  assert.ok(dummyRecipesPagination.innerHTML.includes('Showing 1–20 of 45 items'));
});

test('renderRecipesTable hides pagination when no recipes match filter', () => {
  app.state.recipes = [{ id: 3001, name: 'Pancake', location: 'Kitchen', howToObtain: 'Chef' }];
  app.state.acquiredRecipeIds = new Set();
  app.state.cookedRecipeIds = new Set();
  app.state.activeRecipesFilter = 'all';
  app.state.recipesSearchQuery = 'nonexistentdishxyz';
  app.state.recipesPage = 1;

  const dummyRecipesTbody = { innerHTML: '' };
  const dummyRecipesPagination = { innerHTML: 'prev pagination', hidden: false, querySelectorAll: () => [] };
  const dummyRecipesEmpty = { hidden: true };

  app.dom.recipesTbody = dummyRecipesTbody;
  app.dom.recipesPagination = dummyRecipesPagination;
  app.dom.recipesEmptyState = dummyRecipesEmpty;

  app.renderRecipesTable();

  assert.strictEqual(dummyRecipesTbody.innerHTML, '');
  assert.strictEqual(dummyRecipesEmpty.hidden, false);
  assert.strictEqual(dummyRecipesPagination.hidden, true);
  assert.strictEqual(dummyRecipesPagination.innerHTML, '');
});

test('renderTable onPageChange updates state.heroesPage and re-renders table', () => {
  app.state.characters = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Hero ${i + 1}`,
    location: 'Loc',
    howToRecruit: 'Guide',
    missable: false,
  }));
  app.state.recruitedIds = new Set();
  app.state.activeFilter = 'all';
  app.state.searchQuery = '';
  app.state.heroesPage = 1;

  let pageChangeHandler = null;
  const dummyTbody = { innerHTML: '' };
  const mockButton = {
    dataset: { page: '2' },
    disabled: false,
    addEventListener: (evt, fn) => { if (evt === 'click') pageChangeHandler = fn; },
  };
  const dummyPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: (sel) => sel === '.page-btn' ? [mockButton] : [],
  };
  const dummyEmpty = { hidden: false };

  app.dom.charactersTbody = dummyTbody;
  app.dom.heroesPagination = dummyPagination;
  app.dom.emptyState = dummyEmpty;

  app.renderTable();
  assert.strictEqual(app.state.heroesPage, 1);
  assert.strictEqual((dummyTbody.innerHTML.match(/<tr/g) || []).length, 20);

  // Trigger page 2 click via attached listener
  assert.ok(pageChangeHandler);
  pageChangeHandler({ preventDefault: () => {} });

  assert.strictEqual(app.state.heroesPage, 2);
  assert.strictEqual((dummyTbody.innerHTML.match(/<tr/g) || []).length, 10);
});

test('renderRecipesTable onPageChange updates state.recipesPage and re-renders table', () => {
  app.state.recipes = Array.from({ length: 25 }, (_, i) => ({
    id: 3000 + i + 1,
    name: `Recipe ${i + 1}`,
    location: 'Kitchen',
    howToObtain: 'Chef',
  }));
  app.state.acquiredRecipeIds = new Set();
  app.state.cookedRecipeIds = new Set();
  app.state.activeRecipesFilter = 'all';
  app.state.recipesSearchQuery = '';
  app.state.recipesPage = 1;

  let pageChangeHandler = null;
  const dummyRecipesTbody = { innerHTML: '' };
  const mockButton = {
    dataset: { page: '2' },
    disabled: false,
    addEventListener: (evt, fn) => { if (evt === 'click') pageChangeHandler = fn; },
  };
  const dummyRecipesPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: (sel) => sel === '.page-btn' ? [mockButton] : [],
  };
  const dummyRecipesEmpty = { hidden: false };

  app.dom.recipesTbody = dummyRecipesTbody;
  app.dom.recipesPagination = dummyRecipesPagination;
  app.dom.recipesEmptyState = dummyRecipesEmpty;

  app.renderRecipesTable();
  assert.strictEqual(app.state.recipesPage, 1);
  assert.strictEqual((dummyRecipesTbody.innerHTML.match(/<tr/g) || []).length, 20);

  // Trigger page 2 click
  assert.ok(pageChangeHandler);
  pageChangeHandler({ preventDefault: () => {} });

  assert.strictEqual(app.state.recipesPage, 2);
  assert.strictEqual((dummyRecipesTbody.innerHTML.match(/<tr/g) || []).length, 5);
});

test('renderBeigoma and renderTrainers paginate to 20 items per page', () => {
  app.state.beigoma = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    name: `Beigoma ${i + 1}`,
    whereToObtain: 'Drop Location',
  }));
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = '';
  app.state.beigomaPage = 1;

  const dummyBeigomaList = { innerHTML: '' };
  const dummyBeigomaPagination = { innerHTML: '', hidden: true, querySelectorAll: () => [] };
  const dummyBeigomaEmpty = { hidden: false };

  app.dom.beigomaList = dummyBeigomaList;
  app.dom.beigomaPagination = dummyBeigomaPagination;
  app.dom.beigomaEmptyState = dummyBeigomaEmpty;

  app.renderBeigoma();

  // Exactly 20 rows on page 1 of 60 items
  const rowMatches = (dummyBeigomaList.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatches, 20);
  assert.strictEqual(dummyBeigomaPagination.hidden, false);
  assert.ok(dummyBeigomaPagination.innerHTML.includes('Showing 1–20 of 60 items'));

  // Switch to Page 2
  app.state.beigomaPage = 2;
  app.renderBeigoma();
  const rowMatchesP2 = (dummyBeigomaList.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatchesP2, 20);
  assert.ok(dummyBeigomaPagination.innerHTML.includes('Showing 21–40 of 60 items'));

  // Switch to Page 3 (items 41-60)
  app.state.beigomaPage = 3;
  app.renderBeigoma();
  const rowMatchesP3 = (dummyBeigomaList.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatchesP3, 20);
  assert.ok(dummyBeigomaPagination.innerHTML.includes('Showing 41–60 of 60 items'));
});

test('renderTrainers paginates to 20 trainers per page', () => {
  app.state.beigomaTrainers = Array.from({ length: 44 }, (_, i) => ({
    id: 100 + i + 1,
    name: `Trainer ${i + 1}`,
    location: 'Test Location',
  }));
  app.state.beigomaDefeatedTrainerIds = [];
  app.state.trainerFilter = 'all';
  app.state.trainerSearch = '';
  app.state.trainerPage = 1;

  const dummyTrainerList = { innerHTML: '' };
  const dummyTrainerPagination = { innerHTML: '', hidden: true, querySelectorAll: () => [] };
  const dummyTrainerEmpty = { hidden: false };

  app.dom.trainerList = dummyTrainerList;
  app.dom.trainerPagination = dummyTrainerPagination;
  app.dom.trainerEmptyState = dummyTrainerEmpty;

  app.renderTrainers();

  const rowMatches = (dummyTrainerList.innerHTML.match(/<tr/g) || []).length;
  assert.strictEqual(rowMatches, 20);
  assert.strictEqual(dummyTrainerPagination.hidden, false);
  assert.ok(dummyTrainerPagination.innerHTML.includes('Showing 1–20 of 44 items'));
});

test('renderBeigoma hides pagination when no beigoma match filter', () => {
  app.state.beigoma = [{ id: 1, name: 'Wind Sprout', whereToObtain: 'Drop Location' }];
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = 'nonexistenttopxyz';
  app.state.beigomaPage = 1;

  const dummyBeigomaList = { innerHTML: '' };
  const dummyBeigomaPagination = { innerHTML: 'prev pagination', hidden: false, querySelectorAll: () => [] };
  const dummyBeigomaEmpty = { hidden: true };

  app.dom.beigomaList = dummyBeigomaList;
  app.dom.beigomaPagination = dummyBeigomaPagination;
  app.dom.beigomaEmptyState = dummyBeigomaEmpty;

  app.renderBeigoma();

  assert.strictEqual(dummyBeigomaList.innerHTML, '');
  assert.strictEqual(dummyBeigomaEmpty.hidden, false);
  assert.strictEqual(dummyBeigomaPagination.hidden, true);
  assert.strictEqual(dummyBeigomaPagination.innerHTML, '');
});

test('renderTrainers hides pagination when no trainers match filter', () => {
  app.state.beigomaTrainers = [{ id: 101, name: 'Zeph', location: 'Altverden' }];
  app.state.beigomaDefeatedTrainerIds = [];
  app.state.trainerFilter = 'all';
  app.state.trainerSearch = 'nonexistenttrainerxyz';
  app.state.trainerPage = 1;

  const dummyTrainerList = { innerHTML: '' };
  const dummyTrainerPagination = { innerHTML: 'prev pagination', hidden: false, querySelectorAll: () => [] };
  const dummyTrainerEmpty = { hidden: true };

  app.dom.trainerList = dummyTrainerList;
  app.dom.trainerPagination = dummyTrainerPagination;
  app.dom.trainerEmptyState = dummyTrainerEmpty;

  app.renderTrainers();

  assert.strictEqual(dummyTrainerList.innerHTML, '');
  assert.strictEqual(dummyTrainerEmpty.hidden, false);
  assert.strictEqual(dummyTrainerPagination.hidden, true);
  assert.strictEqual(dummyTrainerPagination.innerHTML, '');
});

test('renderBeigoma onPageChange updates state.beigomaPage and re-renders table', () => {
  app.state.beigoma = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Beigoma ${i + 1}`,
    whereToObtain: 'Drop Location',
  }));
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = '';
  app.state.beigomaPage = 1;

  let pageChangeHandler = null;
  const dummyBeigomaList = { innerHTML: '' };
  const mockButton = {
    dataset: { page: '2' },
    disabled: false,
    addEventListener: (evt, fn) => { if (evt === 'click') pageChangeHandler = fn; },
  };
  const dummyBeigomaPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: (sel) => sel === '.page-btn' ? [mockButton] : [],
  };
  const dummyBeigomaEmpty = { hidden: false };

  app.dom.beigomaList = dummyBeigomaList;
  app.dom.beigomaPagination = dummyBeigomaPagination;
  app.dom.beigomaEmptyState = dummyBeigomaEmpty;

  app.renderBeigoma();
  assert.strictEqual(app.state.beigomaPage, 1);
  assert.strictEqual((dummyBeigomaList.innerHTML.match(/<tr/g) || []).length, 20);

  // Trigger page 2 click
  assert.ok(pageChangeHandler);
  pageChangeHandler({ preventDefault: () => {} });

  assert.strictEqual(app.state.beigomaPage, 2);
  assert.strictEqual((dummyBeigomaList.innerHTML.match(/<tr/g) || []).length, 10);
});

test('renderTrainers onPageChange updates state.trainerPage and re-renders table', () => {
  app.state.beigomaTrainers = Array.from({ length: 25 }, (_, i) => ({
    id: 100 + i + 1,
    name: `Trainer ${i + 1}`,
    location: 'Test Location',
  }));
  app.state.beigomaDefeatedTrainerIds = [];
  app.state.trainerFilter = 'all';
  app.state.trainerSearch = '';
  app.state.trainerPage = 1;

  let pageChangeHandler = null;
  const dummyTrainerList = { innerHTML: '' };
  const mockButton = {
    dataset: { page: '2' },
    disabled: false,
    addEventListener: (evt, fn) => { if (evt === 'click') pageChangeHandler = fn; },
  };
  const dummyTrainerPagination = {
    innerHTML: '',
    hidden: true,
    querySelectorAll: (sel) => sel === '.page-btn' ? [mockButton] : [],
  };
  const dummyTrainerEmpty = { hidden: false };

  app.dom.trainerList = dummyTrainerList;
  app.dom.trainerPagination = dummyTrainerPagination;
  app.dom.trainerEmptyState = dummyTrainerEmpty;

  app.renderTrainers();
  assert.strictEqual(app.state.trainerPage, 1);
  assert.strictEqual((dummyTrainerList.innerHTML.match(/<tr/g) || []).length, 20);

  // Trigger page 2 click
  assert.ok(pageChangeHandler);
  pageChangeHandler({ preventDefault: () => {} });

  assert.strictEqual(app.state.trainerPage, 2);
  assert.strictEqual((dummyTrainerList.innerHTML.match(/<tr/g) || []).length, 5);
});





