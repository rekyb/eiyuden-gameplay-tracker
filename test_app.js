const test = require('node:test');
const assert = require('node:assert');
const app = require('./static/app.js');

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

