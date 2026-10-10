# 映湾 YingBay · my-xiaoya

跑在 OpenWrt 上的家庭影视中心：云盘直连点播、中兴 IPTV 鉴权、EPG、组播 rtp2http，手机浏览器直接看。

## 能做什么

- 挂载 Alist / OpenList、阿里云盘、WebDAV、USB 本地盘
- 点播优先走云盘直链，失败自动改中转（支持 Range）
- 中兴 / 华为 CTC 鉴权，拉频道和节目单
- 内置 rtp2http / udpxy 兼容路径，把组播变成手机可播的 HTTP TS
- 演示片库与公开 HLS，没接盘也能先把界面跑通

## 本地启动

```bash
# 安装依赖并构建前端
npm install
npm --prefix web install
npm --prefix web run build

# 启动（默认 3000 端口）
npm start
```

浏览器打开 `http://路由器IP:3000`。

## OpenWrt 要点

1. 机器建议 256MB 内存以上，并安装 Node.js 18+。
2. IPTV 组播需要独立 VLAN / 光猫桥接，常见做法是 `igmpproxy` 或 `omcproxy` 把 WAN 组播灌进 LAN。
3. 防火墙放行 UDP 组播与本服务 TCP 3000。
4. 把项目拷到 `/opt/yingbay`，用 `openwrt/files/yingbay.init` 做成 `init.d` 服务。

组播播放地址习惯与 udpxy / rtp2httpd 相同：

```text
/api/rtp/239.1.1.1/5000
/api/udp/239.1.1.1/5000
```

若路由器上已经有 udpxy，在「机房」页改成外部 udpxy 地址即可。

## 中兴鉴权填什么

从现网机顶盒或光猫 IPTV 口拿到：

- AuthenticationURL（EDS）
- UserID / 密码
- MAC、STBID、机顶盒 IP

算法按省网选择「中兴 MD5 / 中兴 SHA256 / 华为 CTC」。鉴权失败仍可粘贴 M3U 当频道表。

## 云盘直连

- **Alist/OpenList**：填地址和账号，播放走 `raw_url`
- **阿里云盘**：填 refresh_token，播放走官方 download url
- **WebDAV**：直链带 Basic Auth 时自动改中转

115、夸克、天翼等先在 Alist 里挂好，再把 Alist 接到映湾。
