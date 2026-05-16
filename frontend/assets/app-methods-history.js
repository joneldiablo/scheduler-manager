export const appMethodsHistory = {
  async refreshHistory() {
    this.loading = true;
    try {
      const { url, method } = window.EndpointConfig.get('list-history');
      const response = await this.apiFetch(url, { method });
      const result = await response.json();
      if (result.success) {
        this.historyItems = result.data?.items || [];
        this.historyTotal = result.data?.total || 0;
      }
    } catch (e) {
      this.showError(`Error cargando historial: ${e.message}`);
    } finally {
      this.loading = false;
    }
  },

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  },
};
