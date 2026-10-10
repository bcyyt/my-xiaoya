const { execFileSync } = require("child_process");

function hasUci() {
  try {
    execFileSync("uci", ["-h"], { stdio: "ignore" });
    return true;
  } catch (err) {
    return false;
  }
}

function strip(val) {
  let s = String(val == null ? "" : val).trim();
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
  return s.replace(/\\'/g, "'");
}

function parseShow(text) {
  const main = {};
  const iptv = {};
  const drives = [];
  const driveMap = new Map();
  String(text || "")
    .split("\n")
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      const val = strip(line.slice(idx + 1));
      const parts = key.split(".");
      if (parts[0] !== "yingbay" || parts.length < 2) return;
      const section = parts[1];
      const option = parts[2];
      if (section === "main") {
        if (!option) return;
        main[option] = val;
        return;
      }
      if (section === "iptv") {
        if (!option) return;
        iptv[option] = val;
        return;
      }
      if (!option) return;
      if (!driveMap.has(section)) {
        const row = { _section: section };
        driveMap.set(section, row);
        drives.push(row);
      }
      driveMap.get(section)[option] = val;
    });
  return { main, iptv, drives };
}

function applyTo(state) {
  if (!hasUci()) return state;
  let text = "";
  try {
    text = execFileSync("uci", ["-q", "show", "yingbay"], { encoding: "utf8" });
  } catch (err) {
    return state;
  }
  const parsed = parseShow(text);
  if (parsed.main.site_name) state.siteName = parsed.main.site_name;
  if (parsed.main.pin !== undefined && parsed.main.pin !== "") state.pin = parsed.main.pin;
  if (parsed.iptv && Object.keys(parsed.iptv).length) {
    const i = parsed.iptv;
    state.iptv.vendor = i.vendor || state.iptv.vendor;
    state.iptv.authUrl = i.auth_url != null ? i.auth_url : state.iptv.authUrl;
    state.iptv.epgUrl = i.epg_url != null ? i.epg_url : state.iptv.epgUrl;
    state.iptv.userId = i.user_id != null ? i.user_id : state.iptv.userId;
    if (i.password) state.iptv.password = i.password;
    state.iptv.mac = i.mac != null ? i.mac : state.iptv.mac;
    state.iptv.stbId = i.stb_id != null ? i.stb_id : state.iptv.stbId;
    state.iptv.userIp = i.user_ip != null ? i.user_ip : state.iptv.userIp;
    state.iptv.playMode = i.play_mode || state.iptv.playMode;
    state.iptv.udpxyUrl = i.udpxy_url != null ? i.udpxy_url : state.iptv.udpxyUrl;
    state.iptv.epgXmlUrl = i.epg_xml_url != null ? i.epg_xml_url : state.iptv.epgXmlUrl;
  }
  const uciDrives = parsed.drives.filter((d) => d.type || d.name);
  if (uciDrives.length) {
    state.drives = uciDrives.map((d, idx) => ({
      id: d.id || "drv_uci_" + idx,
      name: d.name || d.type || "drive",
      type: d.type || "webdav",
      enabled: d.enabled !== "0",
      config: {
        url: d.url || "",
        username: d.username || "",
        password: d.password || "",
        refreshToken: d.refresh_token || "",
        root: d.root || "",
        token: d.token || "",
        dirPassword: d.dir_password || "",
      },
    }));
  }
  return state;
}

function uciSet(key, value) {
  execFileSync("uci", ["-q", "set", key + "=" + String(value == null ? "" : value)]);
}

function exportFrom(state) {
  if (!hasUci()) return;
  try {
    execFileSync("uci", ["-q", "set", "yingbay.main=service"]);
    uciSet("yingbay.main.enabled", "1");
    uciSet("yingbay.main.port", process.env.PORT || "3000");
    uciSet("yingbay.main.site_name", state.siteName || "映湾");
    uciSet("yingbay.main.pin", state.pin || "");
    execFileSync("uci", ["-q", "set", "yingbay.iptv=iptv"]);
    const i = state.iptv || {};
    uciSet("yingbay.iptv.vendor", i.vendor || "zte");
    uciSet("yingbay.iptv.auth_url", i.authUrl || "");
    uciSet("yingbay.iptv.epg_url", i.epgUrl || "");
    uciSet("yingbay.iptv.user_id", i.userId || "");
    if (i.password && i.password !== "******") uciSet("yingbay.iptv.password", i.password);
    uciSet("yingbay.iptv.mac", i.mac || "");
    uciSet("yingbay.iptv.stb_id", i.stbId || "");
    uciSet("yingbay.iptv.user_ip", i.userIp || "");
    uciSet("yingbay.iptv.play_mode", i.playMode || "rtp2http");
    uciSet("yingbay.iptv.udpxy_url", i.udpxyUrl || "");
    uciSet("yingbay.iptv.epg_xml_url", i.epgXmlUrl || "");

    for (;;) {
      try {
        execFileSync("uci", ["-q", "delete", "yingbay.@drive[0]"]);
      } catch (err) {
        break;
      }
    }
    (state.drives || []).forEach((d) => {
      const sec = String(execFileSync("uci", ["add", "yingbay", "drive"], { encoding: "utf8" })).trim();
      const p = "yingbay." + sec + ".";
      uciSet(p + "id", d.id || "");
      uciSet(p + "name", d.name || "");
      uciSet(p + "type", d.type || "");
      uciSet(p + "enabled", d.enabled === false ? "0" : "1");
      const c = d.config || {};
      uciSet(p + "url", c.url || "");
      uciSet(p + "username", c.username || "");
      if (c.password && c.password !== "******") uciSet(p + "password", c.password);
      uciSet(p + "refresh_token", c.refreshToken || "");
      uciSet(p + "root", c.root || "");
      uciSet(p + "token", c.token || "");
      uciSet(p + "dir_password", c.dirPassword || "");
    });
    execFileSync("uci", ["commit", "yingbay"]);
  } catch (err) {}
}

module.exports = { hasUci, applyTo, exportFrom, parseShow };
