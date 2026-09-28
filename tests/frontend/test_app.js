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

test('createBeigomaRowHtml produces correct markup for obtained and missing tops', () => {
  const top = {
    id: 5,
    name: 'Flame Sprout',
    whereToObtain: 'Mount Caravan dropped by Hellhound',
  };

  const htmlObtained = app.createBeigomaRowHtml(top, true);
  assert.ok(htmlObtained.includes('Flame Sprout'));
  assert.ok(htmlObtained.includes('Mount Caravan'));
  assert.ok(htmlObtained.includes('badge-obtained'));
  assert.ok(htmlObtained.includes('Obtained'));

  const htmlMissing = app.createBeigomaRowHtml(top, false);
  assert.ok(htmlMissing.includes('Flame Sprout'));
  assert.ok(htmlMissing.includes('badge-missing'));
  assert.ok(htmlMissing.includes('Not Obtained'));
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

