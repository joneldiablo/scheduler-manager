export const appMethodsScheduler = {
  formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  },
  async refreshBuffer() {
    this.loading = true;
    try {
      const tasks = this.tasks || [];
      if (tasks.length === 0) {
        await this.refreshTasks();
      }
      const items = [];
      for (const task of (this.tasks || [])) {
        const { url, method } = window.EndpointConfig.get('task-buffer', { id: task.id });
        const response = await this.apiFetch(url, { method });
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          result.data.forEach(buf => {
            items.push({ ...buf, task_name: task.label || task.name });
          });
        }
      }
      this.bufferItems = items;
    } catch (e) {
      console.error('[Scheduler] Error loading buffer:', e.message);
    } finally {
      this.loading = false;
    }
  },

  async cancelExecution(executionId) {
    try {
      const { url, method } = window.EndpointConfig.get('cancel-buffer', { id: executionId });
      const response = await this.apiFetch(url, { method });
      const result = await response.json();
      if (result.success) {
        await this.refreshBuffer();
        await this.refreshStats();
      }
    } catch (e) {
      console.error('[Scheduler] Error cancelling execution:', e.message);
    }
  },

  async refreshStats() {
    try {
      const tasks = this.tasks || [];
      if (tasks.length === 0 && this.refreshTasks) {
        await this.refreshTasks();
      }
      const total = tasks.length;
      const active = tasks.filter(t => t.active).length;
      const pending = (this.bufferItems || []).filter(i => i.status === 'pending').length;
      const fired = (this.bufferItems || []).filter(i => i.status === 'fired').length;
      this.stats = { total, active, pending, fired };
    } catch (e) {
      console.error('Stats error:', e);
    }
  },
};

