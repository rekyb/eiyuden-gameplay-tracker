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

test('filterCharacter filters by activeChapterFilter', () => {
  const charWatch = {
    id: 1,
    name: 'Garr',
    chapter: 'The Watch Arc',
    location: 'Altverden',
    howToRecruit: 'Recruit in Watch Arc',
  };
  const charEucrisse = {
    id: 2,
    name: 'Perielle',
    chapter: 'Eucrisse Arc',
    location: 'Hishahn',
    howToRecruit: 'Recruit in Eucrisse Arc',
  };

  // 'all' matches both
  assert.strictEqual(app.filterCharacter(charWatch, new Set(), 'all', '', 'all'), true);
  assert.strictEqual(app.filterCharacter(charEucrisse, new Set(), 'all', '', 'all'), true);

  // 'The Watch Arc' matches charWatch, rejects charEucrisse
  assert.strictEqual(app.filterCharacter(charWatch, new Set(), 'all', '', 'The Watch Arc'), true);
  assert.strictEqual(app.filterCharacter(charEucrisse, new Set(), 'all', '', 'The Watch Arc'), false);

  // 'Eucrisse Arc' matches charEucrisse, rejects charWatch
  assert.strictEqual(app.filterCharacter(charWatch, new Set(), 'all', '', 'Eucrisse Arc'), false);
  assert.strictEqual(app.filterCharacter(charEucrisse, new Set(), 'all', '', 'Eucrisse Arc'), true);
});

test('filterCharacter matches char.chapter in text search query', () => {
  const character = {
    id: 1,
    name: 'Nowa',
    chapter: 'The Watch Arc',
    location: 'Eltisweiss',
    howToRecruit: 'Prologue',
  };

  // Searching by chapter text matches
  assert.strictEqual(app.filterCharacter(character, new Set(), 'all', 'watch'), true);
  assert.strictEqual(app.filterCharacter(character, new Set(), 'all', 'watch arc'), true);
  assert.strictEqual(app.filterCharacter(character, new Set(), 'all', 'eucrisse'), false);
});

test('createCharacterRowHtml renders col-chapter with chapter-badge', () => {
  const character = {
    id: 1,
    name: 'Nowa',
    chapter: 'The Watch Arc',
    location: 'Eltisweiss',
    howToRecruit: 'Prologue',
    missable: false,
  };

  const html = app.createCharacterRowHtml(character, false);
  assert.ok(html.includes('<td class="col-chapter">'));
  assert.ok(html.includes('<span class="chapter-badge">The Watch Arc</span>'));

  // Test fallback when chapter is missing or empty
  const charNoChapter = {
    id: 2,
    name: 'Mellore',
    location: 'Altverden',
    howToRecruit: 'Quest',
  };
  const htmlNoChapter = app.createCharacterRowHtml(charNoChapter, true);
  assert.ok(htmlNoChapter.includes('<td class="col-chapter">'));
  assert.ok(htmlNoChapter.includes('<span class="chapter-badge">—</span>'));
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
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes('aria-label="Rarity: 3 of 4 stars"'));
  assert.ok(html.includes('<span class="star-filled" aria-hidden="true">★★★</span>'));
  assert.ok(html.includes('<span class="star-empty" aria-hidden="true">☆</span>'));
  assert.ok(html.includes('badge-obtained'));
  assert.ok(html.includes('Soul Reaper'));
  assert.ok(html.includes('Drop in Deadworld'));

  const top1Star = { id: 1, name: 'Plantvine', whereToObtain: 'Drop in Forest', rarity: 1 };
  const html1 = app.createBeigomaRowHtml(top1Star, false);
  assert.ok(html1.includes('role="img"'));
  assert.ok(html1.includes('aria-label="Rarity: 1 of 4 stars"'));
  assert.ok(html1.includes('<span class="star-filled" aria-hidden="true">★</span>'));
  assert.ok(html1.includes('<span class="star-empty" aria-hidden="true">☆☆☆</span>'));
  assert.ok(html1.includes('badge-missing'));
  assert.ok(html1.includes('Plantvine'));
  assert.ok(html1.includes('Drop in Forest'));
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

test('renderTable renders all filtered heroes into tbody without pagination', () => {
  app.state.characters = Array.from({ length: 45 }, (_, i) => ({
    id: i + 1,
    name: `Hero ${i + 1}`,
    location: 'Test Location',
    guide: 'Test Guide',
    missable: false,
  }));
  app.state.recruitedIds = new Set();
  app.state.activeFilter = 'all';
  app.state.searchQuery = '';

  const dummyTbody = { innerHTML: '' };
  const dummyEmpty = { hidden: false };
  app.dom.charactersTbody = dummyTbody;
  app.dom.emptyState = dummyEmpty;

  app.renderTable();
  assert.strictEqual(dummyEmpty.hidden, true);
  assert.strictEqual((dummyTbody.innerHTML.match(/<tr/g) || []).length, 45);
});

test('renderTable respects state.activeChapterFilter', () => {
  app.state.characters = [
    { id: 1, name: 'Hero 1', chapter: 'Prologue', location: 'Loc 1', howToRecruit: 'Recruit 1' },
    { id: 2, name: 'Hero 2', chapter: 'The Watch Arc', location: 'Loc 2', howToRecruit: 'Recruit 2' },
  ];
  app.state.recruitedIds = new Set();
  app.state.activeFilter = 'all';
  app.state.searchQuery = '';
  app.state.activeChapterFilter = 'The Watch Arc';

  const dummyTbody = { innerHTML: '' };
  const dummyEmpty = { hidden: false };
  app.dom.charactersTbody = dummyTbody;
  app.dom.emptyState = dummyEmpty;

  app.renderTable();
  assert.strictEqual(dummyEmpty.hidden, true);
  assert.strictEqual((dummyTbody.innerHTML.match(/<tr/g) || []).length, 1);
  assert.ok(dummyTbody.innerHTML.includes('Hero 2'));
  assert.ok(!dummyTbody.innerHTML.includes('Hero 1'));

  // Reset
  app.state.activeChapterFilter = 'all';
});

test('renderRecipesTable renders all filtered recipes into tbody without pagination', () => {
  app.state.recipes = Array.from({ length: 30 }, (_, i) => ({
    id: 3000 + i + 1,
    name: `Recipe ${i + 1}`,
    category: 'Appetizer',
    howToObtain: 'Chest',
  }));
  app.state.acquiredRecipeIds = new Set();
  app.state.cookedRecipeIds = new Set();
  app.state.activeRecipesFilter = 'all';
  app.state.recipesSearchQuery = '';

  const dummyTbody = { innerHTML: '' };
  const dummyEmpty = { hidden: false };
  app.dom.recipesTbody = dummyTbody;
  app.dom.recipesEmptyState = dummyEmpty;
  app.dom.navCountRecipes = { textContent: '' };
  app.dom.countRecipesAll = { textContent: '' };
  app.dom.countRecipesAcquired = { textContent: '' };
  app.dom.countRecipesNotAcquired = { textContent: '' };
  app.dom.countRecipesCooked = { textContent: '' };
  app.dom.countRecipesNotCooked = { textContent: '' };

  app.renderRecipesTable();
  assert.strictEqual(dummyEmpty.hidden, true);
  assert.strictEqual((dummyTbody.innerHTML.match(/<tr/g) || []).length, 30);
});

test('renderBeigoma renders all filtered beigoma tops into list without pagination', () => {
  app.state.beigoma = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `Top ${i + 1}`,
    whereToObtain: 'Drop',
    rarity: 2,
  }));
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = '';

  const dummyList = { innerHTML: '' };
  const dummyEmpty = { hidden: false };
  app.dom.beigomaList = dummyList;
  app.dom.beigomaEmptyState = dummyEmpty;
  app.dom.navCountBeigoma = { textContent: '' };
  app.dom.subnavCountBeigoma = { textContent: '' };
  app.dom.subnavCountTrainers = { textContent: '' };
  app.dom.countBeigomaAll = { textContent: '' };
  app.dom.countBeigomaObtained = { textContent: '' };
  app.dom.countBeigomaMissing = { textContent: '' };
  app.dom.countTrainerAll = { textContent: '' };
  app.dom.countTrainerDefeated = { textContent: '' };
  app.dom.countTrainerUnbattled = { textContent: '' };

  app.renderBeigoma();
  assert.strictEqual(dummyEmpty.hidden, true);
  assert.strictEqual((dummyList.innerHTML.match(/<tr/g) || []).length, 25);
});

test('renderTrainers renders all filtered trainers into list without pagination', () => {
  app.state.beigomaTrainers = Array.from({ length: 25 }, (_, i) => ({
    id: 100 + i + 1,
    name: `Trainer ${i + 1}`,
    location: 'Test Location',
  }));
  app.state.beigomaDefeatedTrainerIds = [];
  app.state.trainerFilter = 'all';
  app.state.trainerSearch = '';

  const dummyList = { innerHTML: '' };
  const dummyEmpty = { hidden: false };
  app.dom.trainerList = dummyList;
  app.dom.trainerEmptyState = dummyEmpty;

  app.renderTrainers();
  assert.strictEqual(dummyEmpty.hidden, true);
  assert.strictEqual((dummyList.innerHTML.match(/<tr/g) || []).length, 25);
});

test('filterBeigoma filters by activeRarityFilter', () => {
  const top4Star = { id: 56, name: 'Devil of Destruction', rarity: 4, whereToObtain: 'Boss' };
  const top2Star = { id: 17, name: 'Sahagin', rarity: 2, whereToObtain: 'Lake' };

  // All matches both
  assert.strictEqual(app.filterBeigoma(top4Star, new Set(), 'all', '', 'all'), true);
  assert.strictEqual(app.filterBeigoma(top2Star, new Set(), 'all', '', 'all'), true);

  // Filter 4 stars
  assert.strictEqual(app.filterBeigoma(top4Star, new Set(), 'all', '', '4'), true);
  assert.strictEqual(app.filterBeigoma(top2Star, new Set(), 'all', '', '4'), false);

  // Filter 2 stars
  assert.strictEqual(app.filterBeigoma(top4Star, new Set(), 'all', '', '2'), false);
  assert.strictEqual(app.filterBeigoma(top2Star, new Set(), 'all', '', '2'), true);
});

test('filterBeigoma matches rarity tier keywords in text search query', () => {
  const top = { id: 56, name: 'Devil of Destruction', rarity: 4, whereToObtain: 'Boss' };
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'rainbow'), true);
  assert.strictEqual(app.filterBeigoma(top, new Set(), 'all', 'gold'), false);
});

test('renderBeigoma respects state.beigomaRarityFilter', () => {
  const originalList = app.dom.beigomaList;
  const originalEmpty = app.dom.beigomaEmptyState;
  const originalBeigoma = app.state.beigoma;
  const originalFilter = app.state.beigomaRarityFilter;

  const mockList = { innerHTML: '' };
  const mockEmpty = { hidden: true };
  app.dom.beigomaList = mockList;
  app.dom.beigomaEmptyState = mockEmpty;

  app.state.beigoma = [
    { id: 1, name: 'Plantvine', rarity: 1, whereToObtain: 'Drop' },
    { id: 56, name: 'Devil of Destruction', rarity: 4, whereToObtain: 'Boss' },
  ];
  app.state.beigomaCollectedIds = [];
  app.state.beigomaFilter = 'all';
  app.state.beigomaSearch = '';
  app.state.beigomaRarityFilter = '4';

  app.renderBeigoma();
  assert.ok(mockList.innerHTML.includes('Devil of Destruction'));
  assert.ok(!mockList.innerHTML.includes('Plantvine'));

  // Restore
  app.dom.beigomaList = originalList;
  app.dom.beigomaEmptyState = originalEmpty;
  app.state.beigoma = originalBeigoma;
  app.state.beigomaRarityFilter = originalFilter;
});






