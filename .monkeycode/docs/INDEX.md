# 映湾 YingBay

OpenWrt 家庭影视中心。手机打开路由器上的 Web 页，即可直连播放云盘影片，并收看运营商 IPTV 直播。

## 目标

- 云盘内容尽量走直链，路由器只做目录与鉴权
- IPTV 按中兴/CTC 流程登录，拉取频道与 EPG
- 组播用 rtp2http 转 HTTP MPEG-TS，手机不用组播播放器

## 仓库

- `server/` Node 后端
- `web/` Vue 3 放映厅
- `openwrt/` init 与打包草稿
- `.monkeycode/specs/2026-10-10-openwrt-media-center/` 需求与设计

## 运行

构建前端后执行 `npm start`，默认端口 3000。
