/* TODO: app-methods-auth.js
  - Same pattern as pase-lista app-methods-auth.js
  - Export const appMethodsAuth = { ... }

  Methods:

    openLoginModal():
      - Reset login form and error
      - Show Bootstrap modal via this.loginModal.show()

    closeLoginModal():
      - Hide Bootstrap modal via this.loginModal.hide()

    saveSession(token, user):
      - Set this.token and this.user
      - Store in localStorage key 'alchemist-session'
      - JSON.stringify({ token, user })

    clearSession():
      - Reset all auth-related state
      - Clear localStorage 'alchemist-session'
      - Destroy Tabulator table if exists
      - Close WebSocket if connected

    loadSession():
      - Read 'alchemist-session' from localStorage
      - Parse JSON and set this.token and this.user
      - If invalid, call clearSession()

    async login():
      - Set loading = true
      - Call EndpointConfig.get('login') for URL and method
      - POST { username, password } to login endpoint
      - Parse response
      - If error, show loginError message
      - If success, call saveSession(response.data.token, response.data.user)
      - Close modal, navigate to dashboard
      - Connect WebSocket
      - Load initial data

    async logout():
      - Call POST /api/auth/logout via apiFetch
      - Call clearSession()
      - Show login modal
      - Disconnect WebSocket

    async fetchMe():
      - If no token, return
      - GET /api/me with auth headers
      - If unauthorized (401), call clearSession() and show login
      - If success, update this.user with response data

    async connectWebSocket():
      - If wsConnection exists and is open, return
      - Build WS URL: ws://host/api/ws?token=xxx
      - Create new WebSocket(url)
      - On open: set wsConnected = true, console.log connected
      - On message: parse JSON, handle events:
        'task_fired': refresh tasks, show toast notification
        'buffer_updated': refresh scheduler stats if on scheduler view
        'task_updated': refresh tasks list
      - On close: set wsConnected = false, auto-reconnect after 5s
      - On error: console.error
*/

export const appMethodsAuth = {
  openLoginModal() {
    this.loginError = '';
    this.loginForm.username = '';
    this.loginForm.password = '';
    if (this.loginModal) this.loginModal.show();
  },

  closeLoginModal() {
    if (this.loginModal) {
      this.loginModal.hide();
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
    }
  },

  saveSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('alchemist-session', JSON.stringify({ token, user }));
  },

  clearSession() {
    this.token = '';
    this.user = null;
    localStorage.removeItem('alchemist-session');
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnected = false;
    }
  },

  loadSession() {
    try {
      const raw = localStorage.getItem('alchemist-session');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.user) {
        this.token = parsed.token;
        this.user = parsed.user;
        return true;
      }
    } catch (e) {
      this.clearSession();
    }
    return false;
  },

  async login() {
    this.loading = true;
    this.loginError = '';
    try {
      const { url, method } = window.EndpointConfig.get('login');
      const response = await this.apiFetch(url, {
        method,
        body: JSON.stringify(this.loginForm),
      });

      const result = await response.json();
      if (result.success) {
        this.saveSession(result.data.token, result.data.user);
        this.closeLoginModal();
        this.authChecked = true;
        await this.connectWebSocket();
        this.navigateTo('dashboard');
      } else {
        this.loginError = result.description || 'Error al iniciar sesión';
      }
    } catch (e) {
      this.loginError = e.message || 'Error de conexión';
    } finally {
      this.loading = false;
    }
  },

  async logout() {
    try {
      const { url, method } = window.EndpointConfig.get('logout');
      await this.apiFetch(url, { method });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      this.clearSession();
      this.authChecked = true;
      this.openLoginModal();
    }
  },

  async fetchMe() {
    if (!this.token) return;
    try {
      const { url, method } = window.EndpointConfig.get('me');
      const response = await this.apiFetch(url, { method });
      const result = await response.json();
      if (result.success) {
        this.user = result.data;
        this.authChecked = true;
      }
    } catch (e) {
      this.clearSession();
      this.authChecked = true;
      this.openLoginModal();
    }
  },

  async connectWebSocket() {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/ws?token=${this.token}`;

    try {
      this.wsConnection = new WebSocket(url);
      this.wsConnected = false;

      this.wsConnection.onopen = () => {
        this.wsConnected = true;
        console.log('[WS] Connected');
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsEvent(msg);
        } catch (e) {
          console.error('[WS] Message parse error', e);
        }
      };

      this.wsConnection.onclose = () => {
        this.wsConnected = false;
        console.log('[WS] Disconnected. Retrying in 5s...');
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.wsConnection.onerror = (err) => {
        console.error('[WS] Error', err);
      };
    } catch (e) {
      console.error('[WS] Connection failed', e);
    }
  },

  handleWsEvent(msg) {
    const event = msg.type || msg.event;
    const payload = msg.payload || msg.data || {};
    console.log(`[WS Event] ${event}`, payload);
    
    switch (event) {
      case 'task_fired':
        if (this.refreshTasks) this.refreshTasks();
        if (this.activeView === 'scheduler' && this.refreshBuffer) {
          this.refreshBuffer();
        }
        this.showToast(`Tarea disparada: ${payload.name || payload.taskId}`, 'info');
        break;
      case 'buffer_updated':
        if (this.activeView === 'scheduler' && this.refreshBuffer) {
          this.refreshBuffer();
        }
        break;
      case 'task_updated':
        if (this.refreshTasks) this.refreshTasks();
        break;
    }
  },
};
