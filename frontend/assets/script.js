import { appState } from './app-state.js';
import { appComputed } from './app-computed.js';
import { appMethodsAuth } from './app-methods-auth.js';
import { appMethodsUI } from './app-methods-ui.js';
import { appMethodsTasks } from './app-methods-tasks.js';
import { appMethodsScheduler } from './app-methods-scheduler.js';

const _origConsole = { ...console };
const _logStore = [];
const _MAX_LOG = 200;

function _pushLog(level, args) {
  const entry = { ts: new Date().toISOString(), level, args: args.map(a => {
    if (a instanceof Error) return a.message + "\n" + (a.stack || "");
    if (typeof a === "object") { try { return JSON.stringify(a); } catch { return String(a); } }
    return String(a);
  })};
  _logStore.push(entry);
  if (_logStore.length > _MAX_LOG) _logStore.shift();
  if (window.__appLogCallback) window.__appLogCallback(entry);
}

window.__getLog = () => [..._logStore];
window.__clearLog = () => { _logStore.length = 0; };
window.__pushLog = _pushLog;

console = {
  log: (...a) => { _pushLog("log", a); _origConsole.log(...a); },
  error: (...a) => { _pushLog("error", a); _origConsole.error(...a); },
  warn: (...a) => { _pushLog("warn", a); _origConsole.warn(...a); },
  info: (...a) => { _pushLog("info", a); _origConsole.info(...a); },
  debug: (...a) => { _pushLog("debug", a); _origConsole.debug(...a); },
};

window.addEventListener("error", (e) => {
  _pushLog("error", [`Uncaught: ${e.message} at ${e.filename}:${e.lineno}`]);
});
window.addEventListener("unhandledrejection", (e) => {
  _pushLog("error", [`Unhandled rejection: ${e.reason}`]);
});

const app = Vue.createApp({
  data() {
    return {
      ...appState,
    };
  },
  computed: {
    ...appComputed,
    isAuthenticated() {
      return !!this.token;
    },
    viewComponent() {
      if (!this.activeView) return null;
      return `View${this.activeView.charAt(0).toUpperCase() + this.activeView.slice(1)}`;
    }
  },
  methods: {
    ...appMethodsAuth,
    ...appMethodsUI,
    ...appMethodsTasks,
    ...appMethodsScheduler,
  },
  async mounted() {
    console.log("[The Alchemist] App mounted");

    // 1. Initialize Bootstrap Modals
    this.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    this.logModal = new bootstrap.Modal(document.getElementById('logModal'));

    // 2. Debug mode check
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      this.urlHasDebug = true;
      const bar = document.querySelector('.debug-bar');
      if (bar) bar.style.display = 'block';
    }
    if (params.get('clear') === '1') {
      localStorage.clear();
      console.log("[The Alchemist] Cache cleared via URL");
    }

    // 3. Session check
    if (this.loadSession()) {
      await this.fetchMe();
    }

    // 4. Initial UI setup
    await this.loadAllFragments();
    this.navigateTo('dashboard');

    // 5. Auth check
    if (!this.isAuthenticated) {
      this.openLoginModal();
    } else {
      await this.connectWebSocket();
    }

    // Expose Vue instance globally for dynamic components
    window.alchemistApp = this;
    window.vueAppRoot = this;
  }
});

// Global mixin so dynamic components can access root methods and data
app.mixin({
  computed: {
    $root() {
      return window.alchemistApp;
    }
  }
});

// Global Helpers
window.__openLogModal = () => {
  const modalEl = document.getElementById('logModal');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    renderLog();
  }
};

async function loadFragments() {
  const fragments = ['dashboard', 'tasks', 'scheduler'];
  console.log("[The Alchemist] Loading fragments...");
  
  try {
    await Promise.all(fragments.map(async (name) => {
      const response = await fetch(`assets/fragments/${name}.html`);
      if (!response.ok) throw new Error(`Failed to load ${name}.html`);
      const html = await response.text();
      const tpl = document.getElementById(`tpl-${name}`);
      if (tpl) {
        tpl.innerHTML = html;
      } else {
        console.error(`Template tpl-${name} not found in DOM`);
      }
    }));
    console.log("[The Alchemist] All fragments loaded into templates.");
  } catch (e) {
    console.error("[The Alchemist] Error loading fragments:", e);
    // We continue anyway to let the app mount, but some views might be empty
  }
}

(async function init() {
  await loadFragments();
  app.mount('#app');
  console.log("[The Alchemist] Vue app mounted after fragment loading");
})();

function renderLog() {
  const list = document.getElementById('log-list');
  if (!list) return;
  const logs = window.__getLog();
  list.innerHTML = logs.map(l => 
    `<div class="mb-1"><span class="text-secondary">[${l.ts.split('T')[1].split('.')[0]}]</span> 
     <span class="text-${l.level === 'error' ? 'danger' : l.level === 'warn' ? 'warning' : 'info'}">${l.level.toUpperCase()}</span>: 
     ${l.args.join(' ')}</div>`
  ).join('');
}

window.__showCacheInfo = () => {
  const info = document.getElementById('cache-info');
  if (info) {
    info.style.display = 'block';
    info.innerText = `Session: ${localStorage.getItem('alchemist-session') ? 'Active' : 'None'}`;
  }
};

window.__clearCache = () => {
  localStorage.clear();
  window.__showCacheInfo();
  console.log("Cache cleared");
};

console.log("[The Alchemist] Frontend initialized");

