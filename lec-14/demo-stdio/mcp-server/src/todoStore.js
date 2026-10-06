/**
 * In-memory Todo Storage service.
 */
export class TodoStore {
  constructor() {
    this.todos = [];
    this.nextId = 1;
  }

  /**
   * Add a new todo item.
   * @param {Object} data
   * @param {string} data.title
   * @param {string} [data.description]
   * @param {"low" | "medium" | "high"} [data.priority="medium"]
   * @param {string} [data.dueDate]
   * @returns {Object} Newly created todo item
   */
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

  /**
   * List todos with optional filtering.
   * @param {Object} [filter={}]
   * @param {"all" | "pending" | "completed"} [filter.status="all"]
   * @param {"low" | "medium" | "high"} [filter.priority]
   * @returns {Array<Object>}
   */
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

  /**
   * Complete a todo by id.
   * @param {string} id
   * @returns {Object} Updated todo
   */
  complete(id) {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) {
      throw new Error(`Todo with ID '${id}' not found.`);
    }

    todo.completed = true;
    todo.completedAt = new Date().toISOString();
    return { ...todo };
  }

  /**
   * Delete a todo by id.
   * @param {string} id
   * @returns {Object} Deleted todo
   */
  delete(id) {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Todo with ID '${id}' not found.`);
    }

    const [deleted] = this.todos.splice(index, 1);
    return { ...deleted };
  }

  /**
   * Retrieve aggregate statistics of todos.
   * @returns {Object}
   */
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

  /**
   * Reset store (useful for tests)
   */
  clear() {
    this.todos = [];
    this.nextId = 1;
  }
}
