/* TODO: endpoint-config.js
  - Same pattern as pase-lista EndpointConfig
  - Groups: prod (API real)
  - Group structure:
    {
      prod: {
        label: "API real",
        base: "/api",
        endpoints: {
          login:         { url: "{base}/auth/login", method: "POST" },
          logout:        { url: "{base}/auth/logout", method: "POST" },
          me:            { url: "{base}/me", method: "GET" },
          "list-tasks":  { url: "{base}/tasks", method: "GET" },
          "get-task":    { url: "{base}/tasks/{id}", method: "GET" },
          "create-task": { url: "{base}/tasks", method: "POST" },
          "update-task": { url: "{base}/tasks/{id}", method: "PUT" },
          "delete-task": { url: "{base}/tasks/{id}", method: "DELETE" },
          "task-buffer": { url: "{base}/tasks/{id}/buffer", method: "GET" },
          "task-schema": { url: "{base}/tasks/schema", method: "GET" },
          "trigger-task": { url: "{base}/trigger/{id}", method: "POST" },
          "trigger-batch": { url: "{base}/trigger/batch", method: "POST" },
          "health":      { url: "{base}/health", method: "GET" },
        }
      }
    }
  - Methods: get(id, params), getGroup(), getGroups()
  - URL resolution: replace {base} and {param} placeholders
*/

window.EndpointConfig = (function () {
  var groups = {
    prod: {
      label: "API real",
      base: "/api",
      endpoints: {
        login: { url: "{base}/auth/login", method: "POST" },
        logout: { url: "{base}/auth/logout", method: "POST" },
        me: { url: "{base}/me", method: "GET" },
        "list-tasks": { url: "{base}/tasks", method: "GET" },
        "get-task": { url: "{base}/tasks/{id}", method: "GET" },
        "create-task": { url: "{base}/tasks", method: "POST" },
        "update-task": { url: "{base}/tasks/{id}", method: "PUT" },
        "delete-task": { url: "{base}/tasks/{id}", method: "DELETE" },
        "task-buffer": { url: "{base}/tasks/{id}/buffer", method: "GET" },
        "task-schema": { url: "{base}/tasks/schema", method: "GET" },
        "trigger-task": { url: "{base}/trigger/{id}", method: "POST" },
        "trigger-batch": { url: "{base}/trigger/batch", method: "POST" },
        "health": { url: "{base}/health", method: "GET" },
      },
    },
  };

  var current = "prod";

  function resolve(grp, id, params) {
    var ep = grp.endpoints[id];
    if (!ep) return null;
    var url = ep.url.replace("{base}", grp.base);
    if (params) {
      for (var k in params) {
        url = url.replace("{" + k + "}", encodeURIComponent(params[k]));
      }
    }
    return { url: url, method: ep.method };
  }

  return {
    get: function (id, params) {
      var grp = groups[current];
      var r = resolve(grp, id, params);
      if (!r) throw new Error("Endpoint not found: " + id + " in group " + current);
      return r;
    },
    getGroup: function () { return current; },
    getGroups: function () {
      var names = [];
      for (var k in groups) names.push({ id: k, label: groups[k].label });
      return names;
    },
  };
})();
