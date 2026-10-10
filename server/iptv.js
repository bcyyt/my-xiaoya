const { XMLParser } = require("fast-xml-parser");
const { md5, pick, parseMediaUrl, uid, publicOrigin } = require("./util");
const http = require("http");
const https = require("https");

const DEMO_CHANNELS = [
  {
    id: "demo-bbb",
    no: 1,
    name: "演示·开源电影",
    group: "演示",
    proto: "hls",
    address: "",
    port: 0,
    source: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
  {
    id: "demo-bipbop",
    no: 2,
    name: "演示·多码率",
    group: "演示",
    proto: "hls",
    address: "",
    port: 0,
    source: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
  },
  {
    id: "demo-mp4",
    no: 3,
    name: "演示·短片循环",
    group: "演示",
    proto: "http",
    address: "",
    port: 0,
    source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "demo-rtp",
    no: 8,
    name: "组播示例 239.1.1.1",
    group: "组播",
    proto: "rtp",
    address: "239.1.1.1",
    port: 5000,
    source: "rtp://239.1.1.1:5000",
  },
];

function requestText(url, options = {}) {
  const u = new URL(url);
  const lib = u.protocol === "https:" ? https : http;
  const headers = Object.assign(
    { "User-Agent": "Mozilla/5.0 YingBay-IPTV", Accept: "*/*" },
    options.headers || {}
  );
  const body = options.body || null;
  if (body && !headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (body) headers["Content-Length"] = Buffer.byteLength(body);
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: options.method || (body ? "POST" : "GET"),
        headers,
        timeout: options.timeout || 12000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
            location: res.headers.location || "",
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("IPTV 请求超时")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function ztePassword(vendor, encryToken, userPwd, userId) {
  const token = encryToken || "";
  const pwd = userPwd || "";
  const id = userId || "";
  if (vendor === "hwctc") {
    return Buffer.from(md5(token + "$$$" + pwd), "hex").toString("base64");
  }
  if (vendor === "zte-sha") {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(`${token}$${pwd}$${token}$${id}`).digest("hex").toUpperCase();
  }
  return md5(`${token}$${pwd}$${token}$${id}`).toUpperCase();
}

function extractToken(payload) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return (
    pick(text, /Encryp?tToken["'=\s:]+([A-Za-z0-9+/=._-]+)/i) ||
    pick(text, /UserToken["'=\s:]+([A-Za-z0-9+/=._-]+)/i) ||
    pick(text, /token["'=\s:]+([A-Za-z0-9+/=._-]+)/i)
  );
}

function form(data) {
  return Object.keys(data)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k] == null ? "" : data[k]))
    .join("&");
}

async function authenticate(iptv) {
  const logs = [];
  const authUrl = String(iptv.authUrl || "").trim();
  if (!authUrl) throw new Error("请填写中兴/EDS 鉴权地址 AuthenticationURL");
  if (!iptv.userId) throw new Error("请填写 IPTV UserID");

  const step1Url = authUrl.includes("?")
    ? `${authUrl}&UserID=${encodeURIComponent(iptv.userId)}&Action=Login`
    : `${authUrl}?UserID=${encodeURIComponent(iptv.userId)}&Action=Login`;
  logs.push("GET " + step1Url);
  const first = await requestText(step1Url);
  logs.push("status " + first.status);
  const combined = first.location + "\n" + first.text;
  let encryToken = extractToken(combined);
  let epgUrl = iptv.epgUrl;
  const loc = first.location || pick(combined, /(https?:\/\/[^"'\s]+)/i);
  if (loc) {
    try {
      const u = new URL(loc, authUrl);
      epgUrl = epgUrl || `${u.protocol}//${u.host}`;
      encryToken = encryToken || u.searchParams.get("EncryptToken") || u.searchParams.get("EncryToken") || "";
    } catch (err) {}
  }
  if (!encryToken) encryToken = pick(first.text, /[A-Fa-f0-9]{16,}/) || "";
  if (!encryToken) {
    throw Object.assign(new Error("未拿到 EncryToken，请检查鉴权地址与 UserID"), { logs, body: first.text.slice(0, 400) });
  }

  const password = ztePassword(iptv.vendor, encryToken, iptv.password, iptv.userId);
  const base = String(epgUrl || iptv.epgUrl || authUrl).replace(/\/+$/, "");
  const loginCandidates = [
    base + "/iptvepg/platform/index.jsp",
    base + "/iptvepg/platform/auth.jsp",
    base + "/EPG/jsp/ValidAuthenticationHWCTC.jsp",
    base + "/EPG/jsp/Authentication.jsp",
  ];

  const fields = {
    UserID: iptv.userId,
    UserPwd: password,
    Password: password,
    STBID: iptv.stbId || "",
    MAC: iptv.mac || "",
    IP: iptv.userIp || "",
    lang: "1",
    EncryptToken: encryToken,
    EncryToken: encryToken,
  };

  let userToken = "";
  let cookie = "";
  let lastBody = "";
  for (const url of loginCandidates) {
    logs.push("POST " + url);
    try {
      const res = await requestText(url, { method: "POST", body: form(fields) });
      lastBody = res.text;
      cookie = (res.headers["set-cookie"] || []).map((c) => String(c).split(";")[0]).join("; ");
      userToken = extractToken(res.text) || pick(res.text, /UserToken=([^&<\s]+)/);
      if (res.status < 400 && (userToken || /success|true|UserToken/i.test(res.text))) {
        if (!userToken) userToken = encryToken;
        return {
          ok: true,
          vendor: iptv.vendor,
          encryToken,
          userToken,
          cookie,
          epgUrl: base,
          logs,
          at: Date.now(),
        };
      }
      logs.push("reject " + res.status);
    } catch (err) {
      logs.push(String(err.message || err));
    }
  }

  throw Object.assign(new Error("中兴鉴权未成功，请核对密码、MAC、STBID 与平台地址"), {
    logs,
    body: lastBody.slice(0, 500),
  });
}

function channelFrom(row, index) {
  const source = row.ChannelURL || row.channelUrl || row.url || row.Source || "";
  const parsed = parseMediaUrl(source) || { proto: "rtp", url: source, address: "", port: 0 };
  const name = row.ChannelName || row.channelName || row.name || "频道 " + (index + 1);
  const no = Number(row.UserChannelID || row.channelNumber || row.no || index + 1);
  return {
    id: String(row.ChannelID || row.channelId || row.id || uid("ch")),
    no,
    name: String(name).trim(),
    group: row.ChannelType || row.group || row.category || "全部",
    proto: parsed.proto,
    address: parsed.address,
    port: parsed.port,
    source: parsed.url || source,
  };
}

function parseChannelPayload(text) {
  const channels = [];
  const trimmed = String(text || "").trim();
  if (!trimmed) return channels;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed);
      const list = json.channels || json.list || json.data || json.ChannelList || json;
      const arr = Array.isArray(list) ? list : list.channel || [];
      arr.forEach((row, i) => channels.push(channelFrom(row, i)));
      return channels;
    } catch (err) {}
  }
  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const doc = parser.parse(trimmed);
    const found = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.ChannelName || node.channelName || node.ChannelURL) found.push(node);
      for (const v of Object.values(node)) {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") walk(v);
      }
    };
    walk(doc);
    found.forEach((row, i) => channels.push(channelFrom(row, i)));
  } catch (err) {}
  return channels;
}

async function fetchChannels(iptv, auth) {
  const base = String((auth && auth.epgUrl) || iptv.epgUrl || "").replace(/\/+$/, "");
  if (!base) return [];
  const headers = {};
  if (auth && auth.cookie) headers.Cookie = auth.cookie;
  if (auth && auth.userToken) headers.Authorization = auth.userToken;
  const urls = [
    `${base}/iptvepg/function/getchannellist.jsp?UserToken=${encodeURIComponent((auth && auth.userToken) || "")}`,
    `${base}/EPG/jsp/getchannellistHWCTC.jsp`,
    `${base}/epg/api/getAllChannelList`,
    `${base}/iptvepg/frame1038/getChannelList.jsp`,
  ];
  for (const url of urls) {
    try {
      const res = await requestText(url, { headers });
      const list = parseChannelPayload(res.text);
      if (list.length) return list;
    } catch (err) {}
  }
  return [];
}

function parseM3u(text) {
  const lines = String(text || "").split(/\r?\n/);
  const channels = [];
  let meta = {};
  let no = 1;
  for (const line of lines) {
    if (!line || line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF:")) {
      const name = line.split(",").slice(1).join(",").trim();
      const group = pick(line, /group-title="([^"]+)"/i) || "导入";
      const tvg = pick(line, /tvg-id="([^"]+)"/i);
      const chno = pick(line, /tvg-chno="([^"]+)"/i);
      meta = { name, group, tvg, chno };
      continue;
    }
    if (line.startsWith("#")) continue;
    const parsed = parseMediaUrl(line.trim());
    if (!parsed) continue;
    channels.push({
      id: meta.tvg || uid("m3u"),
      no: Number(meta.chno || no),
      name: meta.name || "频道 " + no,
      group: meta.group || "导入",
      proto: parsed.proto,
      address: parsed.address,
      port: parsed.port,
      source: parsed.url || line.trim(),
    });
    no += 1;
    meta = {};
  }
  return channels;
}

function demoEpg(channels, dateStr) {
  const templates = [
    ["晨间新闻", "纪录·城市", "午间剧场", "体育精华", "晚间放映", "夜间重播"],
    ["音乐现场", "短片联播", "科幻特辑", "开源影院", "导演访谈", "循环放映"],
    ["少儿动画", "自然地理", "历史档案", "美食地图", "夜间剧场", "测试信号"],
  ];
  const epg = {};
  const day = dateStr || new Date().toISOString().slice(0, 10);
  channels.forEach((ch, idx) => {
    const names = templates[idx % templates.length];
    const events = names.map((title, i) => {
      const start = new Date(`${day}T${String(6 + i * 3).padStart(2, "0")}:00:00`);
      const end = new Date(start.getTime() + 3 * 3600 * 1000);
      return { channelId: ch.id, title, start: start.toISOString(), end: end.toISOString() };
    });
    epg[ch.id] = events;
  });
  return epg;
}

function nowNext(events) {
  const now = Date.now();
  const list = (events || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const current = list.find((e) => new Date(e.start).getTime() <= now && now < new Date(e.end).getTime()) || null;
  const next = list.find((e) => new Date(e.start).getTime() > now) || null;
  return { current, next, events: list };
}

async function fetchEpg(iptv, auth, channels) {
  if (iptv.epgXmlUrl) {
    try {
      const res = await requestText(iptv.epgXmlUrl);
      return parseXmltv(res.text, channels);
    } catch (err) {}
  }
  const base = String((auth && auth.epgUrl) || iptv.epgUrl || "").replace(/\/+$/, "");
  if (base && auth) {
    const headers = {};
    if (auth.cookie) headers.Cookie = auth.cookie;
    const urls = [
      `${base}/epg/api/getAllChannelProgram`,
      `${base}/iptvepg/function/epg.jsp`,
    ];
    for (const url of urls) {
      try {
        const res = await requestText(url, { headers });
        const parsed = parsePlatformEpg(res.text);
        if (Object.keys(parsed).length) return parsed;
      } catch (err) {}
    }
  }
  return demoEpg(channels);
}

function parsePlatformEpg(text) {
  const out = {};
  try {
    const json = JSON.parse(text);
    const list = json.data || json.programs || json.list || [];
    for (const row of list) {
      const id = String(row.channelId || row.ChannelID || "");
      if (!id) continue;
      if (!out[id]) out[id] = [];
      out[id].push({
        channelId: id,
        title: row.title || row.programName || row.name || "节目",
        start: row.start || row.beginTime,
        end: row.end || row.endTime,
      });
    }
  } catch (err) {}
  return out;
}

function parseXmltv(text, channels) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(text);
  const programs = (((doc.tv || {}).programme) || []);
  const arr = Array.isArray(programs) ? programs : [programs];
  const byName = new Map(channels.map((c) => [c.name, c.id]));
  const out = {};
  for (const p of arr) {
    const ch = p["@_channel"];
    const id = byName.get(ch) || ch;
    if (!out[id]) out[id] = [];
    const title = (p.title && (p.title["#text"] || p.title)) || "节目";
    out[id].push({
      channelId: id,
      title: String(title),
      start: xmltvTime(p["@_start"]),
      end: xmltvTime(p["@_stop"]),
    });
  }
  return out;
}

function xmltvTime(v) {
  const s = String(v || "");
  if (s.length < 12) return new Date().toISOString();
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00`;
  return new Date(iso).toISOString();
}

function playUrlFor(req, iptv, ch) {
  const origin = publicOrigin(req);
  if (ch.proto === "hls" || ch.proto === "http" || ch.proto === "https") return ch.source;
  if (iptv.playMode === "udpxy" && iptv.udpxyUrl) {
    const base = String(iptv.udpxyUrl).replace(/\/+$/, "");
    return `${base}/${ch.proto === "rtp" ? "rtp" : "udp"}/${ch.address}:${ch.port}`;
  }
  return `${origin}/api/${ch.proto === "udp" ? "udp" : "rtp"}/${ch.address}/${ch.port}`;
}

function withPlayUrls(req, iptv, channels) {
  return channels.map((ch) => Object.assign({}, ch, { playUrl: playUrlFor(req, iptv, ch) }));
}

function seedDemo(state) {
  if (!state.channels || !state.channels.length) {
    state.channels = DEMO_CHANNELS.map((c) => Object.assign({}, c));
    state.epg = demoEpg(state.channels);
  }
  return state;
}

module.exports = {
  DEMO_CHANNELS,
  authenticate,
  fetchChannels,
  fetchEpg,
  parseM3u,
  nowNext,
  playUrlFor,
  withPlayUrls,
  seedDemo,
  demoEpg,
  ztePassword,
};
