const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { XMLParser } = require("fast-xml-parser");
const { isVideo, guessMime, uid, safeJoin, publicOrigin } = require("./util");

const DEMO_MOVIES = [
  {
    name: "Big Buck Bunny",
    file: "BigBuckBunny.mp4",
    size: 158008374,
    year: "2008",
    genre: "动画",
    duration: 596,
    blurb: "一只被捉弄的兔子决定认真回礼。Blender 基金会开源短片。",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_Buck_Bunny_poster_big.jpg/440px-Big_Buck_Bunny_poster_big.jpg",
  },
  {
    name: "Elephant's Dream",
    file: "ElephantsDream.mp4",
    size: 168653849,
    year: "2006",
    genre: "实验",
    duration: 653,
    blurb: "机械世界里两个人的对话。最早的开源电影之一。",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream_s5_both.jpg/440px-Elephants_Dream_s5_both.jpg",
  },
  {
    name: "Sintel",
    file: "Sintel.mp4",
    size: 129241752,
    year: "2010",
    genre: "奇幻",
    duration: 888,
    blurb: "女孩寻找幼龙的短途史诗。Blender 开源电影。",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Sintel_poster.jpg/440px-Sintel_poster.jpg",
  },
  {
    name: "Tears of Steel",
    file: "TearsOfSteel.mp4",
    size: 127897891,
    year: "2012",
    genre: "科幻",
    duration: 734,
    blurb: "阿姆斯特丹码头上的机器人战争。实拍与 CG 混合。",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Tears_of_Steel_poster.jpg/440px-Tears_of_Steel_poster.jpg",
  },
  {
    name: "For Bigger Blazes",
    file: "ForBiggerBlazes.mp4",
    size: 2399821,
    year: "2015",
    genre: "广告",
    duration: 15,
    blurb: "Chromecast 示例片，用来验证直连与 Range。",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    poster: "",
  },
];

function item(entry) {
  return {
    name: entry.name,
    path: entry.path,
    isDir: !!entry.isDir,
    size: entry.size || 0,
    playable: !entry.isDir && isVideo(entry.name),
    mime: entry.isDir ? "" : guessMime(entry.name),
    poster: entry.poster || "",
    year: entry.year || "",
    genre: entry.genre || "",
    blurb: entry.blurb || "",
    duration: entry.duration || 0,
  };
}

function demoList(dirPath) {
  if (dirPath && dirPath !== "/" && dirPath !== "") {
    return { path: dirPath, items: [] };
  }
  return {
    path: "/",
    items: DEMO_MOVIES.map((m) =>
      item({
        name: m.file,
        path: "/" + m.file,
        isDir: false,
        size: m.size,
        poster: m.poster,
        year: m.year,
        genre: m.genre,
        blurb: m.blurb,
        duration: m.duration,
      })
    ).map((it, i) => Object.assign(it, { title: DEMO_MOVIES[i].name })),
  };
}

function demoFile(filePath) {
  const name = path.basename(filePath);
  const m = DEMO_MOVIES.find((x) => x.file === name || "/" + x.file === filePath);
  if (!m) throw Object.assign(new Error("未找到影片"), { status: 404 });
  return {
    name: m.file,
    title: m.name,
    path: "/" + m.file,
    size: m.size,
    mime: "video/mp4",
    directUrl: m.url,
    poster: m.poster,
    year: m.year,
    genre: m.genre,
    blurb: m.blurb,
    duration: m.duration,
  };
}

async function httpJson(url, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : null;
  const u = new URL(url);
  const lib = u.protocol === "https:" ? https : http;
  const headers = Object.assign(
    { Accept: "application/json", "User-Agent": "YingBay/1.0" },
    options.headers || {}
  );
  if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(body);
  }
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || (body ? "POST" : "GET"),
        headers,
        timeout: options.timeout || 15000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = text ? JSON.parse(text) : {}; } catch (err) { json = { raw: text }; }
          resolve({ status: res.statusCode, headers: res.headers, json, text });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("请求超时")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function httpRaw(url, options = {}) {
  const u = new URL(url);
  const lib = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || "GET",
        headers: Object.assign({ "User-Agent": "YingBay/1.0" }, options.headers || {}),
        timeout: options.timeout || 20000,
      },
      (res) => {
        if (options.asResponse) return resolve(res);
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("请求超时")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function basicAuth(user, pass) {
  return "Basic " + Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
}

async function webdavList(drive, dirPath) {
  const base = String(drive.config.url || "").replace(/\/+$/, "");
  const rel = dirPath && dirPath !== "/" ? dirPath : "/";
  const target = base + (rel.startsWith("/") ? rel : "/" + rel);
  const xml =
    '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:resourcetype/><d:getcontenttype/></d:prop></d:propfind>';
  const res = await httpRaw(target, {
    method: "PROPFIND",
    headers: {
      Depth: "1",
      Authorization: basicAuth(drive.config.username, drive.config.password),
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: xml,
  });
  if (res.status >= 400) throw Object.assign(new Error("WebDAV 列表失败 " + res.status), { status: res.status });
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const doc = parser.parse(res.buffer.toString("utf8"));
  let responses = doc.multistatus && doc.multistatus.response;
  if (!responses) return { path: rel, items: [] };
  if (!Array.isArray(responses)) responses = [responses];
  const items = [];
  for (const row of responses) {
    const href = decodeURIComponent(String(row.href || ""));
    const prop = (row.propstat && row.propstat.prop) || {};
    const name = prop.displayname || path.basename(href.replace(/\/+$/, ""));
    if (!name) continue;
    const isDir = !!(prop.resourcetype && (prop.resourcetype.collection !== undefined || prop.resourcetype === ""));
    const full = href.replace(base, "") || "/" + name;
    if (normalizePath(full) === normalizePath(rel)) continue;
    items.push(
      item({
        name,
        path: normalizePath(full),
        isDir,
        size: Number(prop.getcontentlength || 0),
      })
    );
  }
  return { path: rel, items };
}

function normalizePath(p) {
  const s = "/" + String(p || "").replace(/^\/+/, "").replace(/\/+$/, "");
  return s === "/" ? "/" : s;
}

async function webdavFile(drive, filePath) {
  const base = String(drive.config.url || "").replace(/\/+$/, "");
  const rel = normalizePath(filePath);
  const directUrl = base + rel;
  return {
    name: path.basename(rel),
    path: rel,
    size: 0,
    mime: guessMime(rel),
    directUrl,
    headers: {
      Authorization: basicAuth(drive.config.username, drive.config.password),
    },
  };
}

async function alistToken(drive) {
  if (drive.config.token) return drive.config.token;
  const base = String(drive.config.url || "").replace(/\/+$/, "");
  const res = await httpJson(base + "/api/auth/login", {
    body: { username: drive.config.username, password: drive.config.password },
  });
  const token = res.json && res.json.data && res.json.data.token;
  if (!token) throw new Error((res.json && res.json.message) || "Alist 登录失败");
  return token;
}

async function alistList(drive, dirPath) {
  const base = String(drive.config.url || "").replace(/\/+$/, "");
  const token = await alistToken(drive);
  const res = await httpJson(base + "/api/fs/list", {
    headers: { Authorization: token },
    body: { path: dirPath && dirPath !== "/" ? dirPath : "/", password: drive.config.dirPassword || "" },
  });
  const content = (res.json && res.json.data && res.json.data.content) || [];
  return {
    path: dirPath || "/",
    items: content.map((row) =>
      item({
        name: row.name,
        path: safeJoin(dirPath === "/" ? "" : dirPath, row.name),
        isDir: row.is_dir,
        size: row.size,
        poster: row.thumb || "",
      })
    ),
  };
}

async function alistFile(drive, filePath) {
  const base = String(drive.config.url || "").replace(/\/+$/, "");
  const token = await alistToken(drive);
  const res = await httpJson(base + "/api/fs/get", {
    headers: { Authorization: token },
    body: { path: filePath, password: drive.config.dirPassword || "" },
  });
  const data = (res.json && res.json.data) || {};
  if (!data.raw_url && !data.url) throw new Error((res.json && res.json.message) || "Alist 未返回直链");
  return {
    name: data.name || path.basename(filePath),
    path: filePath,
    size: data.size || 0,
    mime: data.type === 2 || isVideo(data.name) ? guessMime(data.name || filePath) : guessMime(filePath),
    directUrl: data.raw_url || data.url,
    poster: data.thumb || "",
  };
}

async function aliyunToken(drive) {
  const res = await httpJson("https://auth.aliyundrive.com/v2/account/token", {
    body: { grant_type: "refresh_token", refresh_token: drive.config.refreshToken },
  });
  const data = res.json || {};
  if (!data.access_token) throw new Error(data.message || "阿里云盘 refresh_token 无效");
  drive.config.accessToken = data.access_token;
  drive.config.refreshToken = data.refresh_token || drive.config.refreshToken;
  drive.config.driveId = data.default_drive_id || drive.config.driveId;
  return data;
}

async function aliyunList(drive, dirPath) {
  if (!drive.config.accessToken) await aliyunToken(drive);
  const parent = !dirPath || dirPath === "/" ? "root" : dirPath.replace(/^\//, "");
  const res = await httpJson("https://api.aliyundrive.com/adrive/v3/file/list", {
    headers: { Authorization: "Bearer " + drive.config.accessToken },
    body: { drive_id: drive.config.driveId, parent_file_id: parent, limit: 100 },
  });
  if (res.status === 401) {
    await aliyunToken(drive);
    return aliyunList(drive, dirPath);
  }
  const items = (res.json && res.json.items) || [];
  return {
    path: dirPath || "/",
    items: items.map((row) =>
      item({
        name: row.name,
        path: "/" + row.file_id,
        isDir: row.type === "folder",
        size: Number(row.size || 0),
        poster: row.thumbnail || "",
      })
    ),
  };
}

async function aliyunFile(drive, filePath) {
  if (!drive.config.accessToken) await aliyunToken(drive);
  const fileId = String(filePath || "").replace(/^\//, "");
  const res = await httpJson("https://api.aliyundrive.com/v2/file/get_download_url", {
    headers: { Authorization: "Bearer " + drive.config.accessToken },
    body: { drive_id: drive.config.driveId, file_id: fileId, expire_sec: 14400 },
  });
  if (res.status === 401) {
    await aliyunToken(drive);
    return aliyunFile(drive, filePath);
  }
  const url = res.json && (res.json.url || res.json.download_url);
  if (!url) throw new Error((res.json && res.json.message) || "阿里云盘未返回直链");
  return {
    name: (res.json && res.json.file_name) || fileId,
    path: filePath,
    size: 0,
    mime: "video/mp4",
    directUrl: url,
    headers: { Referer: "https://www.aliyundrive.com/" },
  };
}

function localRoot(drive) {
  return path.resolve(drive.config.root || "/mnt/share");
}

function localList(drive, dirPath) {
  const root = localRoot(drive);
  const rel = normalizePath(dirPath);
  const abs = path.resolve(root, "." + rel);
  if (!abs.startsWith(root)) throw Object.assign(new Error("非法路径"), { status: 400 });
  if (!fs.existsSync(abs)) throw Object.assign(new Error("目录不存在"), { status: 404 });
  const names = fs.readdirSync(abs);
  return {
    path: rel,
    items: names.map((name) => {
      const st = fs.statSync(path.join(abs, name));
      return item({
        name,
        path: rel === "/" ? "/" + name : rel + "/" + name,
        isDir: st.isDirectory(),
        size: st.size,
      });
    }),
  };
}

function localFile(drive, filePath) {
  const root = localRoot(drive);
  const rel = normalizePath(filePath);
  const abs = path.resolve(root, "." + rel);
  if (!abs.startsWith(root)) throw Object.assign(new Error("非法路径"), { status: 400 });
  if (!fs.existsSync(abs)) throw Object.assign(new Error("文件不存在"), { status: 404 });
  const st = fs.statSync(abs);
  return {
    name: path.basename(abs),
    path: rel,
    size: st.size,
    mime: guessMime(abs),
    absPath: abs,
    directUrl: "",
  };
}

async function listDrive(drive, dirPath) {
  if (drive.type === "demo") return demoList(dirPath);
  if (drive.type === "webdav") return webdavList(drive, dirPath);
  if (drive.type === "alist" || drive.type === "openlist") return alistList(drive, dirPath);
  if (drive.type === "aliyun") return aliyunList(drive, dirPath);
  if (drive.type === "local") return localList(drive, dirPath);
  throw new Error("不支持的云盘类型: " + drive.type);
}

async function statFile(drive, filePath) {
  if (drive.type === "demo") return demoFile(filePath);
  if (drive.type === "webdav") return webdavFile(drive, filePath);
  if (drive.type === "alist" || drive.type === "openlist") return alistFile(drive, filePath);
  if (drive.type === "aliyun") return aliyunFile(drive, filePath);
  if (drive.type === "local") return localFile(drive, filePath);
  throw new Error("不支持的云盘类型: " + drive.type);
}

function playPayload(req, drive, file) {
  const origin = publicOrigin(req);
  const relayUrl =
    origin +
    "/api/drives/" +
    encodeURIComponent(drive.id) +
    "/proxy?path=" +
    encodeURIComponent(file.path);
  const canDirect = !!file.directUrl && !file.headers;
  return {
    id: drive.id + ":" + file.path,
    driveId: drive.id,
    driveName: drive.name,
    name: file.name,
    title: file.title || file.name,
    path: file.path,
    size: file.size,
    mime: file.mime,
    poster: file.poster || "",
    year: file.year || "",
    genre: file.genre || "",
    blurb: file.blurb || "",
    duration: file.duration || 0,
    directUrl: file.directUrl || "",
    relayUrl,
    playUrl: canDirect ? file.directUrl : relayUrl,
    mode: canDirect ? "direct" : "relay",
  };
}

function pipeRemote(req, res, file) {
  const u = new URL(file.directUrl);
  const lib = u.protocol === "https:" ? https : http;
  const headers = Object.assign(
    { "User-Agent": req.headers["user-agent"] || "YingBay/1.0" },
    file.headers || {}
  );
  if (req.headers.range) headers.Range = req.headers.range;
  const up = lib.request(
    {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: "GET",
      headers,
    },
    (upRes) => {
      const out = {
        "Content-Type": upRes.headers["content-type"] || file.mime || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "private, max-age=60",
      };
      if (upRes.headers["content-length"]) out["Content-Length"] = upRes.headers["content-length"];
      if (upRes.headers["content-range"]) out["Content-Range"] = upRes.headers["content-range"];
      res.writeHead(upRes.statusCode || 200, out);
      upRes.pipe(res);
    }
  );
  up.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("upstream error");
    } else res.end();
  });
  req.on("close", () => up.destroy());
  up.end();
}

function pipeLocal(req, res, file) {
  const st = fs.statSync(file.absPath);
  const range = req.headers.range;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", file.mime || "application/octet-stream");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!range) {
    res.setHeader("Content-Length", st.size);
    fs.createReadStream(file.absPath).pipe(res);
    return;
  }
  const m = range.match(/bytes=(\d*)-(\d*)/);
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : st.size - 1;
  if (end >= st.size) end = st.size - 1;
  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${st.size}`,
    "Content-Length": end - start + 1,
  });
  fs.createReadStream(file.absPath, { start, end }).pipe(res);
}

function createDrive(input) {
  return {
    id: input.id || uid("drv"),
    name: input.name || "未命名云盘",
    type: input.type || "webdav",
    enabled: input.enabled !== false,
    config: input.config || {},
  };
}

module.exports = {
  DEMO_MOVIES,
  listDrive,
  statFile,
  playPayload,
  pipeRemote,
  pipeLocal,
  createDrive,
  aliyunToken,
  alistToken,
};
