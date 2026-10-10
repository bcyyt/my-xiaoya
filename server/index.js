const http = require("http");
const path = require("path");
const fs = require("fs");
const store = require("./store");
const rtp2http = require("./rtp2http");
const drives = require("./drives");
const iptv = require("./iptv");
const { sendJson, readBody, publicOrigin } = require("./util");

const PORT = Number(process.env.PORT || 3000);
const DIST = path.join(__dirname, "..", "web", "dist");

function findDrive(state, id) {
  return (state.drives || []).find((d) => d.id === id);
}

function mimeStatic(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("YingBay API is running. Build the web UI with: cd web && npm install && npm run build");
    return;
  }
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(DIST, urlPath.replace(/^\/+/, "")));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": mimeStatic(file) });
    fs.createReadStream(file).pipe(res);
    return;
  }
  const fallback = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  fs.createReadStream(fallback).pipe(res);
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const pathname = url.pathname;
  const q = url.searchParams;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Ying-Pin",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    });
    res.end();
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, name: "yingbay", rtp: rtp2http.stats() });
  }

  if (pathname === "/api/home" && method === "GET") {
    const state = iptv.seedDemo(store.read());
    const history = (state.history || []).slice(0, 12);
    const channels = iptv.withPlayUrls(req, state.iptv, state.channels).slice(0, 8);
    const live = channels.map((ch) => {
      const nn = iptv.nowNext(state.epg[ch.id]);
      return Object.assign({}, ch, { now: nn.current, next: nn.next });
    });
    let featured = [];
    try {
      const demo = state.drives.find((d) => d.type === "demo") || state.drives[0];
      if (demo) {
        const listed = await drives.listDrive(demo, "/");
        featured = listed.items.filter((i) => i.playable).slice(0, 8).map((it) => Object.assign({ driveId: demo.id, driveName: demo.name }, it));
      }
    } catch (err) {}
    return sendJson(res, 200, {
      siteName: state.siteName || "映湾",
      history,
      live,
      featured,
      drives: state.drives.map((d) => ({ id: d.id, name: d.name, type: d.type, enabled: d.enabled })),
    });
  }

  if (pathname === "/api/config" && method === "GET") {
    const state = store.read();
    const iptvCfg = Object.assign({}, state.iptv);
    if (iptvCfg.password) iptvCfg.password = iptvCfg.password ? "******" : "";
    return sendJson(res, 200, {
      siteName: state.siteName,
      pinSet: !!state.pin,
      iptv: iptvCfg,
      origin: publicOrigin(req),
    });
  }

  if (pathname === "/api/config" && method === "PUT") {
    const body = await readBody(req);
    const state = store.update((s) => {
      if (body.siteName) s.siteName = body.siteName;
      if (body.pin !== undefined) s.pin = body.pin;
      if (body.iptv) {
        const next = Object.assign({}, s.iptv, body.iptv);
        if (next.password === "******") next.password = s.iptv.password;
        s.iptv = next;
      }
      return s;
    });
    return sendJson(res, 200, { ok: true, iptv: state.iptv });
  }

  if (pathname === "/api/drives" && method === "GET") {
    const state = store.read();
    return sendJson(res, 200, state.drives.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      enabled: d.enabled,
      config: sanitizeDriveConfig(d),
    })));
  }

  if (pathname === "/api/drives" && method === "POST") {
    const body = await readBody(req);
    const drive = drives.createDrive(body);
    store.update((s) => {
      s.drives.push(drive);
      return s;
    });
    return sendJson(res, 200, drive);
  }

  const driveOne = pathname.match(/^\/api\/drives\/([^/]+)$/);
  if (driveOne && method === "PUT") {
    const body = await readBody(req);
    const state = store.update((s) => {
      const d = findDrive(s, decodeURIComponent(driveOne[1]));
      if (!d) return s;
      if (body.name) d.name = body.name;
      if (body.type) d.type = body.type;
      if (body.enabled !== undefined) d.enabled = body.enabled;
      if (body.config) d.config = Object.assign({}, d.config, body.config);
      return s;
    });
    const d = findDrive(state, decodeURIComponent(driveOne[1]));
    if (!d) return sendJson(res, 404, { error: "云盘不存在" });
    return sendJson(res, 200, d);
  }

  if (driveOne && method === "DELETE") {
    store.update((s) => {
      s.drives = s.drives.filter((d) => d.id !== decodeURIComponent(driveOne[1]));
      return s;
    });
    return sendJson(res, 200, { ok: true });
  }

  const driveList = pathname.match(/^\/api\/drives\/([^/]+)\/list$/);
  if (driveList && method === "GET") {
    const state = store.read();
    const drive = findDrive(state, decodeURIComponent(driveList[1]));
    if (!drive) return sendJson(res, 404, { error: "云盘不存在" });
    try {
      const listed = await drives.listDrive(drive, q.get("path") || "/");
      return sendJson(res, 200, listed);
    } catch (err) {
      return sendJson(res, err.status || 500, { error: err.message || String(err) });
    }
  }

  const driveFile = pathname.match(/^\/api\/drives\/([^/]+)\/file$/);
  if (driveFile && method === "GET") {
    const state = store.read();
    const drive = findDrive(state, decodeURIComponent(driveFile[1]));
    if (!drive) return sendJson(res, 404, { error: "云盘不存在" });
    try {
      const file = await drives.statFile(drive, q.get("path") || "/");
      return sendJson(res, 200, drives.playPayload(req, drive, file));
    } catch (err) {
      return sendJson(res, err.status || 500, { error: err.message || String(err) });
    }
  }

  const driveProxy = pathname.match(/^\/api\/drives\/([^/]+)\/proxy$/);
  if (driveProxy && method === "GET") {
    const state = store.read();
    const drive = findDrive(state, decodeURIComponent(driveProxy[1]));
    if (!drive) return sendJson(res, 404, { error: "云盘不存在" });
    try {
      const file = await drives.statFile(drive, q.get("path") || "/");
      if (file.absPath) return drives.pipeLocal(req, res, file);
      if (file.directUrl) return drives.pipeRemote(req, res, file);
      return sendJson(res, 404, { error: "无法中转该文件" });
    } catch (err) {
      return sendJson(res, err.status || 500, { error: err.message || String(err) });
    }
  }

  if (pathname === "/api/search" && method === "GET") {
    const keyword = (q.get("q") || "").trim().toLowerCase();
    const state = store.read();
    const hits = [];
    for (const drive of state.drives.filter((d) => d.enabled)) {
      try {
        const listed = await drives.listDrive(drive, "/");
        for (const it of listed.items) {
          if (!keyword || it.name.toLowerCase().includes(keyword) || String(it.title || "").toLowerCase().includes(keyword)) {
            hits.push(Object.assign({ driveId: drive.id, driveName: drive.name }, it));
          }
        }
      } catch (err) {}
    }
    const liveHits = (state.channels || []).filter((c) => !keyword || c.name.toLowerCase().includes(keyword));
    return sendJson(res, 200, { items: hits, channels: liveHits });
  }

  if (pathname === "/api/history" && method === "GET") {
    return sendJson(res, 200, store.read().history || []);
  }

  if (pathname === "/api/history" && method === "POST") {
    const body = await readBody(req);
    const state = store.update((s) => {
      const key = body.key || `${body.driveId}:${body.path}`;
      s.history = (s.history || []).filter((h) => h.key !== key);
      s.history.unshift({
        key,
        title: body.title,
        driveId: body.driveId,
        path: body.path,
        poster: body.poster || "",
        position: Number(body.position || 0),
        duration: Number(body.duration || 0),
        at: Date.now(),
      });
      s.history = s.history.slice(0, 40);
      return s;
    });
    return sendJson(res, 200, { ok: true, history: state.history });
  }

  if (pathname === "/api/iptv/status" && method === "GET") {
    const state = iptv.seedDemo(store.read());
    return sendJson(res, 200, {
      iptv: maskIptv(state.iptv),
      channels: iptv.withPlayUrls(req, state.iptv, state.channels),
      rtp: rtp2http.stats(),
      lastAuth: state.iptv.lastAuth,
    });
  }

  if (pathname === "/api/iptv/auth" && method === "POST") {
    const body = await readBody(req);
    const state = store.update((s) => {
      if (body && Object.keys(body).length) {
        const next = Object.assign({}, s.iptv, body);
        if (next.password === "******") next.password = s.iptv.password;
        s.iptv = next;
      }
      return s;
    });
    try {
      const auth = await iptv.authenticate(state.iptv);
      let channels = await iptv.fetchChannels(state.iptv, auth);
      if (!channels.length && state.m3uText) channels = iptv.parseM3u(state.m3uText);
      if (!channels.length) channels = state.channels && state.channels.length ? state.channels : iptv.DEMO_CHANNELS;
      const epg = await iptv.fetchEpg(state.iptv, auth, channels);
      store.update((s) => {
        s.iptv.lastAuth = { ok: true, at: auth.at, epgUrl: auth.epgUrl, userToken: auth.userToken, logs: auth.logs };
        s.iptv.epgUrl = s.iptv.epgUrl || auth.epgUrl;
        s.channels = channels;
        s.epg = epg;
        return s;
      });
      return sendJson(res, 200, {
        ok: true,
        logs: auth.logs,
        channels: iptv.withPlayUrls(req, state.iptv, channels),
      });
    } catch (err) {
      store.update((s) => {
        s.iptv.lastAuth = { ok: false, at: Date.now(), error: err.message, logs: err.logs || [], body: err.body || "" };
        return s;
      });
      return sendJson(res, 400, { ok: false, error: err.message, logs: err.logs || [], body: err.body || "" });
    }
  }

  if (pathname === "/api/iptv/m3u" && method === "POST") {
    const body = await readBody(req);
    const text = body.text || body.raw || "";
    const channels = iptv.parseM3u(text);
    if (!channels.length) return sendJson(res, 400, { error: "没有解析到频道" });
    store.update((s) => {
      s.m3uText = text;
      s.channels = channels;
      s.epg = iptv.demoEpg(channels);
      return s;
    });
    const state = store.read();
    return sendJson(res, 200, { ok: true, channels: iptv.withPlayUrls(req, state.iptv, channels) });
  }

  if (pathname === "/api/iptv/channels" && method === "GET") {
    const state = iptv.seedDemo(store.read());
    const group = q.get("group") || "";
    let channels = iptv.withPlayUrls(req, state.iptv, state.channels);
    if (group) channels = channels.filter((c) => c.group === group);
    const groups = Array.from(new Set(state.channels.map((c) => c.group)));
    return sendJson(res, 200, { groups, channels });
  }

  if (pathname === "/api/iptv/epg" && method === "GET") {
    const state = iptv.seedDemo(store.read());
    const channelId = q.get("channelId") || "";
    if (channelId) return sendJson(res, 200, iptv.nowNext(state.epg[channelId]));
    const all = {};
    for (const ch of state.channels) all[ch.id] = iptv.nowNext(state.epg[ch.id]);
    return sendJson(res, 200, all);
  }

  const livePlay = pathname.match(/^\/api\/iptv\/play\/([^/]+)$/);
  if (livePlay && method === "GET") {
    const state = iptv.seedDemo(store.read());
    const ch = state.channels.find((c) => c.id === decodeURIComponent(livePlay[1]));
    if (!ch) return sendJson(res, 404, { error: "频道不存在" });
    const playUrl = iptv.playUrlFor(req, state.iptv, ch);
    const nn = iptv.nowNext(state.epg[ch.id]);
    return sendJson(res, 200, Object.assign({}, ch, { playUrl, now: nn.current, next: nn.next, events: nn.events }));
  }

  const rtp = pathname.match(/^\/api\/(rtp|udp)\/([^/]+)\/(\d+)$/);
  if (rtp && method === "GET") {
    rtp2http.handle(rtp[1], req, res, rtp[2], Number(rtp[3]));
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function sanitizeDriveConfig(drive) {
  const cfg = Object.assign({}, drive.config || {});
  if (cfg.password) cfg.password = "******";
  if (cfg.refreshToken) cfg.refreshToken = cfg.refreshToken.slice(0, 6) + "******";
  if (cfg.accessToken) delete cfg.accessToken;
  return cfg;
}

function maskIptv(iptvCfg) {
  const c = Object.assign({}, iptvCfg);
  if (c.password) c.password = "******";
  if (c.lastAuth && c.lastAuth.userToken) c.lastAuth = Object.assign({}, c.lastAuth, { userToken: "******" });
  return c;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    serveStatic(req, res);
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`YingBay listening on http://0.0.0.0:${PORT}`);
});
