async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: Object.assign({ "Content-Type": "application/json" }, options.headers || {}),
    method: options.method || "GET",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { raw: text };
  }
  if (!res.ok) {
    const error = new Error(data.error || res.statusText);
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  home: () => request("/api/home"),
  config: () => request("/api/config"),
  saveConfig: (body) => request("/api/config", { method: "PUT", body }),
  drives: () => request("/api/drives"),
  addDrive: (body) => request("/api/drives", { method: "POST", body }),
  updateDrive: (id, body) => request(`/api/drives/${encodeURIComponent(id)}`, { method: "PUT", body }),
  removeDrive: (id) => request(`/api/drives/${encodeURIComponent(id)}`, { method: "DELETE" }),
  list: (id, dirPath) => request(`/api/drives/${encodeURIComponent(id)}/list?path=${encodeURIComponent(dirPath || "/")}`),
  file: (id, filePath) => request(`/api/drives/${encodeURIComponent(id)}/file?path=${encodeURIComponent(filePath)}`),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q || "")}`),
  history: () => request("/api/history"),
  saveHistory: (body) => request("/api/history", { method: "POST", body }),
  iptvStatus: () => request("/api/iptv/status"),
  iptvAuth: (body) => request("/api/iptv/auth", { method: "POST", body }),
  iptvM3u: (text) => request("/api/iptv/m3u", { method: "POST", body: { text } }),
  channels: (group) => request(`/api/iptv/channels${group ? `?group=${encodeURIComponent(group)}` : ""}`),
  epg: (channelId) => request(`/api/iptv/epg${channelId ? `?channelId=${encodeURIComponent(channelId)}` : ""}`),
  playLive: (id) => request(`/api/iptv/play/${encodeURIComponent(id)}`),
};
