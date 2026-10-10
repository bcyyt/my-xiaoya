const dgram = require("dgram");

const sessions = new Map();

function keyOf(proto, address, port) {
  return `${proto}|${address}|${port}`;
}

function rtpPayloadOffset(buf) {
  if (!buf || buf.length < 12) return 0;
  const version = buf[0] >> 6;
  if (version !== 2) return 0;
  const cc = buf[0] & 0x0f;
  const hasExt = (buf[0] & 0x10) !== 0;
  let offset = 12 + cc * 4;
  if (hasExt && buf.length >= offset + 4) {
    const extLen = buf.readUInt16BE(offset + 2);
    offset += 4 + extLen * 4;
  }
  return offset < buf.length ? offset : 0;
}

function getSession(proto, address, port) {
  const key = keyOf(proto, address, port);
  let session = sessions.get(key);
  if (session) return session;

  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  session = { key, proto, address, port, socket, clients: new Set(), bound: false };
  sessions.set(key, session);

  socket.on("message", (msg) => {
    let payload = msg;
    if (proto === "rtp") {
      const offset = rtpPayloadOffset(msg);
      payload = offset ? msg.subarray(offset) : msg;
    }
    for (const res of session.clients) {
      if (!res.writableEnded) res.write(payload);
    }
  });

  socket.on("error", () => {
    closeSession(session);
  });

  socket.bind(port, () => {
    session.bound = true;
    try {
      socket.addMembership(address);
      socket.setBroadcast(true);
      socket.setMulticastTTL(128);
      socket.setMulticastLoopback(true);
    } catch (err) {
      session.bindError = err.message;
    }
  });

  return session;
}

function closeSession(session) {
  for (const res of session.clients) {
    try { res.end(); } catch (err) {}
  }
  session.clients.clear();
  try { session.socket.dropMembership(session.address); } catch (err) {}
  try { session.socket.close(); } catch (err) {}
  sessions.delete(session.key);
}

function attach(proto, address, port, req, res) {
  const session = getSession(proto, address, port);
  session.clients.add(res);
  const release = () => {
    session.clients.delete(res);
    if (session.clients.size === 0) closeSession(session);
  };
  req.on("close", release);
  req.on("aborted", release);
  res.on("close", release);
  return session;
}

function handle(proto, req, res, address, port) {
  res.writeHead(200, {
    "Content-Type": "video/mp2t",
    "Cache-Control": "no-cache, no-store",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  attach(proto, address, port, req, res);
}

function stats() {
  return Array.from(sessions.values()).map((s) => ({
    key: s.key,
    clients: s.clients.size,
    bound: s.bound,
    error: s.bindError || "",
  }));
}

module.exports = { handle, stats, rtpPayloadOffset };
