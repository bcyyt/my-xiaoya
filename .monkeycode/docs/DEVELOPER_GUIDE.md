# 开发指南

## 启动

```bash
npm install
npm --prefix web install
npm --prefix web run build
PORT=3000 npm start
```

开发时也可先起后端 `node server/index.js`，再在 `web/` 里 `npm run dev`（Vite 把 `/api` 代理到 3000）。

## 目录

- `server/drives.js` 云盘适配
- `server/iptv.js` 鉴权、M3U、EPG
- `server/rtp2http.js` 组播转 HTTP
- `web/src/views` 放映厅页面

## 约定

- 配置只写 `data/state.json`
- 直链字段名 `directUrl`，中转 `relayUrl`
- 组播 URL 保持 udpxy 风格
