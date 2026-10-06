/**
 * In-memory Todo Storage service for SSE MCP Server.
 */
export class TodoStore {
  constructor() {
    this.todos = [];
    this.nextId = 1;
  }

  add({ title, description = '', priority = 'medium', dueDate = null }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Todo title is required and cannot be empty.');
    }

    const validPriorities = ['low', 'medium', 'high'];
    const resolvedPriority = validPriorities.includes(priority?.toLowerCase())
      ? priority.toLowerCase()
      : 'medium';

    const todo = {
      id: `task-${this.nextId++}`,
      title: title.trim(),
      description: (description || '').trim(),
      priority: resolvedPriority,
      dueDate: dueDate || null,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.todos.push(todo);
    return { ...todo };
  }

  list({ status = 'all', priority } = {}) {
    return this.todos
      .filter((todo) => {
        if (status === 'completed' && !todo.completed) return false;
        if (status === 'pending' && todo.completed) return false;
        if (priority && todo.priority !== priority.toLowerCase()) return false;
        return true;
      })
      .map((t) => ({ ...t }));
  }

  complete(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new Error(`Todo with ID '${id}' not found.`);
    }

    todo.completed = true;
    todo.completedAt = new Date().toISOString();
    return { ...todo };
  }

  delete(id) {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Todo with ID '${id}' not found.`);
    }

    const [deleted] = this.todos.splice(index, 1);
    return { ...deleted };
  }

  summary() {
    const total = this.todos.length;
    const completed = this.todos.filter((t) => t.completed).length;
    const pending = total - completed;
    const highPriority = this.todos.filter((t) => t.priority === 'high' && !t.completed).length;

    return {
      total,
      completed,
      pending,
      highPriority
    };
  }

  clear() {
    this.todos = [];
    this.nextId = 1;
  }
}
