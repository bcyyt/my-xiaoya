const crypto = require("crypto");
const { URL } = require("url");

const VIDEO_EXT = new Set([
  "mp4", "mkv", "ts", "m2ts", "webm", "avi", "mov", "flv", "m4v", "m3u8", "iso", "rmvb", "wmv",
]);

function md5(text) {
  return crypto.createHash("md5").update(String(text), "utf8").digest("hex");
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function extOf(name) {
  const i = String(name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isVideo(name) {
  return VIDEO_EXT.has(extOf(name));
}

function guessMime(name) {
  const ext = extOf(name);
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "mkv") return "video/x-matroska";
  if (ext === "ts" || ext === "m2ts") return "video/mp2t";
  if (ext === "m3u8") return "application/vnd.apple.mpegurl";
  return "application/octet-stream";
}

function pick(text, re) {
  const m = String(text || "").match(re);
  return m ? decodeURIComponent(m[1]) : "";
}

function safeJoin(base, rel) {
  const left = String(base || "").replace(/\/+$/, "");
  const right = String(rel || "").replace(/^\/+/, "");
  if (!right) return left || "/";
  return `${left}/${right}`;
}

function publicOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function isMulticast(host) {
  const p = String(host || "").split(".");
  if (p.length !== 4) return false;
  const n = Number(p[0]);
  return n >= 224 && n <= 239;
}

function parseMediaUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const cleaned = text.replace(/^igmp:\/\//i, "rtp://").replace(/^udp:\/\//i, "udp://");
  try {
    if (/^https?:\/\//i.test(cleaned) || cleaned.includes(".m3u8")) {
      return { proto: cleaned.includes(".m3u8") ? "hls" : "http", url: cleaned, address: "", port: 0 };
    }
    const u = new URL(cleaned.includes("://") ? cleaned : `rtp://${cleaned}`);
    return {
      proto: u.protocol.replace(":", "") || "rtp",
      url: cleaned,
      address: u.hostname,
      port: Number(u.port || 0),
    };
  } catch (err) {
    const m = cleaned.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
    if (!m) return null;
    return { proto: "rtp", url: cleaned, address: m[1], port: Number(m[2]) };
  }
}

function sendJson(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve({ raw });
      }
    });
    req.on("error", reject);
  });
}

module.exports = {
  md5,
  sha256,
  uid,
  extOf,
  isVideo,
  guessMime,
  pick,
  safeJoin,
  publicOrigin,
  isMulticast,
  parseMediaUrl,
  sendJson,
  readBody,
  VIDEO_EXT,
};
