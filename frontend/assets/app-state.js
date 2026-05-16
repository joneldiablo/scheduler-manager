export const appState = {
  // Auth
  authChecked: false,
  token: '',
  user: null,
  loginForm: { username: '', password: '' },
  loginError: '',
  loginModal: null,

  // UI
  activeView: 'dashboard',
  loading: false,
  error: '',
  urlHasDebug: false,
  fragmentTemplates: { dashboard: '', tasks: '', scheduler: '' },
  fragmentHtml: { dashboard: '', tasks: '', scheduler: '' },
  fragmentsLoaded: false,

  // Tasks
  tasks: [],
  tasksTotal: 0,
  tasksPage: 1,
  tasksLimit: 20,
  tasksSearch: '',
  tasksTable: null,
  selectedTask: null,
  taskForm: {},
  taskFormFields: [],
  taskCreateModal: null,
  taskDetailModal: null,
  taskConfirmModal: null,
  taskSortDir: null,
  taskColumnFilters: [],

  // Scheduler
  bufferItems: [],
  bufferTotal: 0,
  bufferPage: 1,
  bufferLimit: 50,
  stats: { total: 0, active: 0, pending: 0, fired: 0, cancelled: 0 },

  // History
  historyItems: [],
  historyTotal: 0,
  historyPage: 1,
  historyLimit: 50,

  // WebSocket
  wsConnected: false,
  wsConnection: null,
};
