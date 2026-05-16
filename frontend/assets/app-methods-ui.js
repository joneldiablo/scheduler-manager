/* TODO: app-methods-ui.js
  - Same pattern as pase-lista app-methods-ui.js
  - Export const appMethodsUI = { ... }

  Methods:

    navigateTo(view):
      - Set this.activeView = view
      - If fragment not yet loaded, call loadFragment(view)
      - If view === 'tasks', refresh tasks table
      - If view === 'scheduler', load buffer data
      - If view === 'dashboard', load stats

    async loadFragment(name):
      - Fetch from assets/fragments/{name}.html
      - Store raw HTML in fragmentTemplates[name]
      - Replace __PLACEHOLDER__ tokens with actual values
      - Store final HTML in fragmentHtml[name]
      - Set fragmentsLoaded = true

    async loadAllFragments():
      - Load all fragments in parallel
      - ['dashboard', 'tasks', 'scheduler'].forEach(name => loadFragment(name))

    async apiFetch(url, options):
      - Wrapper around fetch()
      - Add auth headers automatically if token exists
      - On 401 response: call clearSession() and openLoginModal()
      - On network error: show error message
      - Return response object

    showError(message):
      - Set this.error = message
      - Auto-clear after 5 seconds

    toggleDebug():
      - Toggle debug bar visibility

    openModal(modalId):
      - Initialize and show Bootstrap modal by ID

    closeModal():
      - Close any open Bootstrap modal

    showToast(message, type):
      - Show Bootstrap toast notification
      - Types: 'success', 'danger', 'warning', 'info'
*/

export const appMethodsUI = {
  async navigateTo(view) {
    await this.loadFragment(view);
    this.activeView = view;
    
    // Trigger view-specific data loads
    if (view === 'tasks') {
      if (this.refreshTasks) await this.refreshTasks();
    } else if (view === 'scheduler') {
      if (this.refreshBuffer) await this.refreshBuffer();
    } else if (view === 'dashboard') {
      if (this.refreshStats) await this.refreshStats();
    } else if (view === 'history') {
      if (this.refreshHistory) await this.refreshHistory();
    } else if (view === 'docs') {
      // no data to load
    }
  },

  async loadFragment(name) {
    try {
      const componentName = `View${name.charAt(0).toUpperCase() + name.slice(1)}`;
      
      // If already registered, just set and return
      if (window.vueApp && window.vueApp._context.components[componentName]) {
        this.activeView = name;
        return;
      }

      // Get template HTML from store (loaded before Vue mount)
      const html = window.__fragmentStore && window.__fragmentStore[name];
      if (!html) {
        throw new Error(`Fragment not found in store: ${name}`);
      }
      
      // Register component using the stored HTML
      if (window.vueApp) {
        window.vueApp.component(componentName, {
          template: html
        });
      }
      
      this.activeView = name;
      this.fragmentsLoaded = true;
    } catch (e) {
      this.showError(`Error loading view ${name}: ${e.message}`);
    }
  },



  async loadAllFragments() {
    const views = ['dashboard', 'tasks', 'scheduler', 'history', 'docs'];
    await Promise.all(views.map(v => this.loadFragment(v)));
  },

  async apiFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 401) {
        this.clearSession();
        this.closeModal();
        this.openLoginModal();
        throw new Error('Unauthorized: Session expired');
      }

      return response;
    } catch (e) {
      this.showError(e.message);
      throw e;
    }
  },

  showError(message) {
    this.error = message;
    setTimeout(() => {
      this.error = '';
    }, 5000);
  },

  toggleDebug() {
    this.urlHasDebug = !this.urlHasDebug;
    const bar = document.querySelector('.debug-bar');
    if (bar) bar.style.display = this.urlHasDebug ? 'block' : 'none';
  },

  openModal(modalId) {
    this.closeModal();
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  },

  closeModal() {
    const openModals = document.querySelectorAll('.modal.show');
    openModals.forEach(modalEl => {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    });
  },

  showToast(message, type = 'info') {
    // Implementation for Bootstrap toasts
    console.log(`Toast [${type}]: ${message}`);
  },
};
