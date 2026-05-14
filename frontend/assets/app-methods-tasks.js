export const appMethodsTasks = {
  async refreshTasks() {
    this.loading = true;
    try {
      const { url, method } = window.EndpointConfig.get('list-tasks');
      const response = await this.apiFetch(url, { method });
      const result = await response.json();
      
      if (result.success) {
        this.tasks = result.data;
        this.tasksTotal = result.total || result.data.length;
      }
    } catch (e) {
      this.showError(`Error cargando tareas: ${e.message}`);
    } finally {
      this.loading = false;
    }
  },

  async createTask() {
    try {
      const { url, method } = window.EndpointConfig.get('create-task');
      const response = await this.apiFetch(url, {
        method,
        body: JSON.stringify(this.taskForm),
      });
      const result = await response.json();
      if (result.success) {
        this.showToast('Tarea creada con éxito', 'success');
        await this.refreshTasks();
        this.closeModal();
      } else {
        this.showError(result.description);
      }
    } catch (e) {
      this.showError(e.message);
    }
  },

  async updateTask(id) {
    try {
      const { url, method } = window.EndpointConfig.get('update-task', { id });
      const response = await this.apiFetch(url, {
        method,
        body: JSON.stringify(this.taskForm),
      });
      const result = await response.json();
      if (result.success) {
        this.showToast('Tarea actualizada', 'success');
        await this.refreshTasks();
        this.closeModal();
      } else {
        this.showError(result.description);
      }
    } catch (e) {
      this.showError(e.message);
    }
  },

  async deleteTask(id) {
    try {
      const { url, method } = window.EndpointConfig.get('delete-task', { id });
      const response = await this.apiFetch(url, { method });
      const result = await response.json();
      if (result.success) {
        this.showToast('Tarea eliminada', 'success');
        await this.refreshTasks();
      } else {
        this.showError(result.description);
      }
    } catch (e) {
      this.showError(e.message);
    }
  },

  async triggerTask(id) {
    try {
      const { url, method } = window.EndpointConfig.get('trigger-task', { id });
      const response = await this.apiFetch(url, { method });
      const result = await response.json();
      if (result.success) {
        this.showToast('Tarea disparada manualmente', 'success');
      } else {
        this.showError(result.description);
      }
    } catch (e) {
      this.showError(e.message);
    }
  },

  openTaskForm(task = null) {
    this.selectedTask = task;
    if (task) {
      this.taskForm = { ...task };
    } else {
      this.taskForm = {
        name: '',
        label: '',
        description: '',
        schedule_datetime: '',
        recursive_timestamp: 0,
        active: true,
        script: '',
      };
    }
    this.openModal('taskFormModal');
  },
};

