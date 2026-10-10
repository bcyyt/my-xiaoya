const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const defaultState = () => ({
  pin: "",
  siteName: "映湾",
  drives: [
    {
      id: "demo",
      name: "演示片库",
      type: "demo",
      enabled: true,
      config: {},
    },
  ],
  iptv: {
    vendor: "zte",
    authUrl: "",
    epgUrl: "",
    userId: "",
    password: "",
    mac: "",
    stbId: "",
    userIp: "",
    playMode: "rtp2http",
    udpxyUrl: "",
    epgXmlUrl: "",
    lastAuth: null,
  },
  channels: [],
  epg: {},
  history: [],
  m3uText: "",
});

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(defaultState(), null, 2));
  }
}

function read() {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return Object.assign(defaultState(), raw, {
      iptv: Object.assign(defaultState().iptv, raw.iptv || {}),
      drives: Array.isArray(raw.drives) && raw.drives.length ? raw.drives : defaultState().drives,
    });
  } catch (err) {
    return defaultState();
  }
}

function write(state) {
  ensure();
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function update(mutator) {
  const state = read();
  const next = mutator(state) || state;
  write(next);
  return next;
}

module.exports = { read, write, update, defaultState, DATA_DIR };
