import test from 'node:test';
import assert from 'node:assert/strict';
import { TodoStore } from '../src/todoStore.js';

test('TodoStore - add, list, complete, delete, summary', async (t) => {
  const store = new TodoStore();

  await t.test('initial state is empty', () => {
    assert.deepEqual(store.list(), []);
    assert.deepEqual(store.summary(), {
      total: 0,
      completed: 0,
      pending: 0,
      highPriority: 0
    });
  });

  await t.test('add todo with default priority', () => {
    const item = store.add({ title: 'Read MCP docs' });
    assert.ok(item.id.startsWith('task-'));
    assert.equal(item.title, 'Read MCP docs');
    assert.equal(item.priority, 'medium');
    assert.equal(item.completed, false);
    assert.ok(item.createdAt);
  });

  await t.test('add todo with explicit priority and dueDate', () => {
    const item = store.add({
      title: 'Submit assignment',
      description: 'Finish questions 1 to 5',
      priority: 'high',
      dueDate: '2026-10-07 17:00'
    });
    assert.equal(item.title, 'Submit assignment');
    assert.equal(item.priority, 'high');
    assert.equal(item.dueDate, '2026-10-07 17:00');
  });

  await t.test('list todos with filters', () => {
    const all = store.list();
    assert.equal(all.length, 2);

    const highOnly = store.list({ priority: 'high' });
    assert.equal(highOnly.length, 1);
    assert.equal(highOnly[0].title, 'Submit assignment');

    const pendingOnly = store.list({ status: 'pending' });
    assert.equal(pendingOnly.length, 2);
  });

  await t.test('complete todo by ID', () => {
    const list = store.list();
    const target = list[0];
    const updated = store.complete(target.id);
    assert.equal(updated.completed, true);
    assert.ok(updated.completedAt);

    const completedList = store.list({ status: 'completed' });
    assert.equal(completedList.length, 1);
  });

  await t.test('delete todo by ID', () => {
    const list = store.list();
    const target = list[1];
    const deleted = store.delete(target.id);
    assert.equal(deleted.id, target.id);
    assert.equal(store.list().length, 1);
  });

  await t.test('summary reflects latest counts', () => {
    const summary = store.summary();
    assert.equal(summary.total, 1);
    assert.equal(summary.completed, 1);
    assert.equal(summary.pending, 0);
  });

  await t.test('throws on not found ID', () => {
    assert.throws(() => store.complete('invalid-id'), /not found/i);
    assert.throws(() => store.delete('invalid-id'), /not found/i);
  });
});
