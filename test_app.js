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
