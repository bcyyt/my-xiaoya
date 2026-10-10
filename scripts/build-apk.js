#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist", "apk");
const VERSION = "1.1.0";
const RELEASE = "1";
const PKGVER = VERSION + "-r" + RELEASE;

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest, mode) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
  if (mode) fs.chmodSync(dest, mode);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) throw new Error("missing " + src);
  mkdirp(dest);
  for (const name of fs.readdirSync(src)) {
    if (name === "node_modules" || name === ".git") continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else copyFile(from, to, st.mode);
  }
}

function walk(dir, acc) {
  acc = acc || [];
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function installedSize(stage) {
  return walk(stage).reduce((n, f) => {
    const rel = path.relative(stage, f);
    if (rel.startsWith(".")) return n;
    return n + fs.statSync(f).size;
  }, 0);
}

function writePkginfo(stage, info) {
  const lines = [
    "pkgname = " + info.name,
    "pkgver = " + PKGVER,
    "pkgdesc = " + info.desc,
    "url = https://github.com/bcyyt/my-xiaoya",
    "builddate = " + Math.floor(Date.now() / 1000),
    "packager = YingBay",
    "size = " + installedSize(stage),
    "arch = all",
    "origin = " + info.name,
    "maintainer = YingBay <yingbay@local>",
    "license = MIT",
  ];
  (info.depends || []).forEach((d) => lines.push("depend = " + d));
  fs.writeFileSync(path.join(stage, ".PKGINFO"), lines.join("\n") + "\n");
}

function writeScript(stage, name, body) {
  const p = path.join(stage, name);
  fs.writeFileSync(p, body.trim() + "\n");
  fs.chmodSync(p, 0o755);
}

function pack(stage, filename) {
  mkdirp(OUT);
  const out = path.join(OUT, filename);
  const members = fs.readdirSync(stage).sort((a, b) => {
    if (a === ".PKGINFO") return -1;
    if (b === ".PKGINFO") return 1;
    if (a.startsWith(".") && !b.startsWith(".")) return -1;
    if (b.startsWith(".") && !a.startsWith(".")) return 1;
    return a.localeCompare(b);
  });
  execFileSync(
    "tar",
    [
      "--format=ustar",
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "-czf",
      out,
      ...members,
    ],
    { cwd: stage }
  );
  const sha = crypto.createHash("sha256").update(fs.readFileSync(out)).digest("hex");
  fs.writeFileSync(out + ".sha256", sha + "  " + filename + "\n");
  return { out, size: fs.statSync(out).size, sha };
}

function stageYingbay() {
  const stage = fs.mkdtempSync(path.join(require("os").tmpdir(), "yingbay-apk-"));
  copyDir(path.join(ROOT, "server"), path.join(stage, "opt/yingbay/server"));
  copyDir(path.join(ROOT, "web/dist"), path.join(stage, "opt/yingbay/web/dist"));
  copyFile(path.join(ROOT, "package.json"), path.join(stage, "opt/yingbay/package.json"), 0o644);
  copyDir(path.join(ROOT, "node_modules/fast-xml-parser"), path.join(stage, "opt/yingbay/node_modules/fast-xml-parser"));
  copyDir(path.join(ROOT, "node_modules/strnum"), path.join(stage, "opt/yingbay/node_modules/strnum"));
  copyFile(path.join(ROOT, "openwrt/files/yingbay.init"), path.join(stage, "etc/init.d/yingbay"), 0o755);
  copyFile(path.join(ROOT, "openwrt/files/yingbay.config"), path.join(stage, "etc/config/yingbay"), 0o644);
  copyFile(path.join(ROOT, "openwrt/files/yingbay.config"), path.join(stage, "usr/share/yingbay/yingbay.config"), 0o644);
  copyFile(path.join(ROOT, "openwrt/files/yingbay.uci-defaults"), path.join(stage, "etc/uci-defaults/80_yingbay"), 0o755);
  writePkginfo(stage, {
    name: "yingbay",
    desc: "YingBay media center with cloud direct play and ZTE IPTV",
    depends: ["node"],
  });
  writeScript(
    stage,
    ".post-install",
    `#!/bin/sh
[ -f /etc/config/yingbay ] || cp /usr/share/yingbay/yingbay.config /etc/config/yingbay
chmod +x /etc/init.d/yingbay /etc/uci-defaults/80_yingbay 2>/dev/null || true
/etc/init.d/yingbay enable 2>/dev/null || true
/etc/init.d/yingbay restart 2>/dev/null || /etc/init.d/yingbay start 2>/dev/null || true
exit 0`
  );
  writeScript(
    stage,
    ".pre-deinstall",
    `#!/bin/sh
/etc/init.d/yingbay stop 2>/dev/null || true
/etc/init.d/yingbay disable 2>/dev/null || true
exit 0`
  );
  return pack(stage, "yingbay_" + PKGVER + "_all.apk");
}

function stageLuci() {
  const stage = fs.mkdtempSync(path.join(require("os").tmpdir(), "yingbay-luci-"));
  const luci = path.join(ROOT, "openwrt/luci-app-yingbay");
  copyDir(path.join(luci, "htdocs/luci-static"), path.join(stage, "www/luci-static"));
  copyDir(path.join(luci, "root/usr"), path.join(stage, "usr"));
  fs.chmodSync(path.join(stage, "usr/libexec/rpcd/luci.yingbay"), 0o755);
  writePkginfo(stage, {
    name: "luci-app-yingbay",
    desc: "LuCI app for YingBay media center",
    depends: ["yingbay", "luci-base"],
  });
  writeScript(
    stage,
    ".post-install",
    `#!/bin/sh
chmod +x /usr/libexec/rpcd/luci.yingbay 2>/dev/null || true
rm -f /tmp/luci-indexcache* /tmp/luci-modulecache/* 2>/dev/null || true
[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload 2>/dev/null || true
exit 0`
  );
  return pack(stage, "luci-app-yingbay_" + PKGVER + "_all.apk");
}

function main() {
  if (!fs.existsSync(path.join(ROOT, "web/dist/index.html"))) {
    throw new Error("web/dist missing, run: npm --prefix web run build");
  }
  const core = stageYingbay();
  const luci = stageLuci();
  const readme = [
    "YingBay OpenWrt apk plugins " + PKGVER,
    "",
    "Install on OpenWrt 25+ / snapshot (apk):",
    "",
    "  apk add --allow-untrusted ./yingbay_" + PKGVER + "_all.apk",
    "  apk add --allow-untrusted ./luci-app-yingbay_" + PKGVER + "_all.apk",
    "",
    "Then open LuCI: 服务 -> 映湾影视",
    "Phone UI: http://router-ip:3000/",
    "",
    "Need node runtime: apk add node",
    "",
    "SHA256:",
    "  yingbay: " + core.sha,
    "  luci-app-yingbay: " + luci.sha,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "README.txt"), readme);
  console.log(JSON.stringify({ core, luci }, null, 2));
}

main();
