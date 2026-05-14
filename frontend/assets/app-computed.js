/* TODO: app-computed.js
  - Same pattern as pase-lista app-computed.js
  - Export const appComputed = { ... }
  - Computed properties:

    isAuthenticated():
      return !!this.token && !!this.user

    authHeaders():
      return this.token ? { 'Authorization': 'Bearer ' + this.token } : {}

    activeFragment():
      return this.fragmentHtml[this.activeView] || ''

    pendingBufferCount():
      return this.bufferItems.filter(i => i.status === 'pending').length

    activeTasksCount():
      return this.tasks.filter(t => t.active).length

    totalExecutionsToday():
      - Calculate from bufferItems filtered by today's date and status 'fired'

    uptimeFormatted():
      - Format server uptime from stats if available

    paginationInfo():
      - Return formatted string: "Página {page} de {totalPages} ({total} registros)"
*/

export const appComputed = {
  isAuthenticated() {
    return !!this.token && !!this.user;
  },
  authHeaders() {
    return this.token ? { 'Authorization': 'Bearer ' + this.token } : {};
  },
  activeFragment() {
    return this.fragmentHtml[this.activeView] || '';
  },
  pendingBufferCount() {
    return Array.isArray(this.bufferItems) ? this.bufferItems.filter(i => i.status === 'pending').length : 0;
  },
  activeTasksCount() {
    return Array.isArray(this.tasks) ? this.tasks.filter(t => t.active).length : 0;
  },
};
