# 接口

前缀 `/api`，JSON，UTF-8。

## 点播

- `GET /api/home` 继续观看、直播正在播出、演示片目
- `GET /api/drives` 云盘列表
- `POST /api/drives` 新增挂载
- `GET /api/drives/:id/list?path=` 目录
- `GET /api/drives/:id/file?path=` 直链与中转地址
- `GET /api/drives/:id/proxy?path=` Range 中转

## IPTV

- `POST /api/iptv/auth` 中兴鉴权并拉频道
- `POST /api/iptv/m3u` 导入播放列表
- `GET /api/iptv/channels` 频道
- `GET /api/iptv/epg?channelId=` 节目单
- `GET /api/iptv/play/:id` 播放地址 + now/next
- `GET /api/rtp/:group/:port` MPEG-TS
- `GET /api/udp/:group/:port` UDP 负载

## 配置

- `GET/PUT /api/config`
- `GET/POST /api/history`
