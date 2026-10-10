# Requirements Document

## Introduction

映湾（my-xiaoya）是运行在 OpenWrt 路由器上的家庭影视中心。用户在手机浏览器中浏览已挂载的云盘影片并以直连方式播放，同时收看运营商 IPTV 直播（含组播转 HTTP）、自动完成中兴平台鉴权，并拉取节目单与 EPG。

## Glossary

- **System**: 映湾影视中心，包含路由器后端服务与手机 Web 前端。
- **Cloud Drive**: 用户添加的网盘或远程存储，包括 WebDAV、Alist/OpenList、阿里云盘、本地/USB 目录。
- **Direct Play**: 播放器使用云盘返回的临时直链（HTTP 302 或 raw URL）拉流，媒体数据尽量不经过路由器中转。
- **Relay Play**: 当直链受 Referer、CORS 或 Range 限制时，由路由器代理并转发字节流。
- **ZTE Platform**: 运营商 IPTV 中兴中间件，提供鉴权、频道列表与 EPG。
- **rtp2http**: 将 RTP/UDP 组播节目转换为 HTTP MPEG-TS，供手机播放。
- **EPG**: 电子节目单，含频道当前/即将播出节目与按时段列表。

## Requirements

### Requirement 1: 云盘挂载与直连播放

**User Story:** AS 家庭用户, I want 在路由器上挂载常用云盘并在手机上直接播放影片, so that 不用把文件下载到路由器或电脑。

#### Acceptance Criteria

1. WHEN 用户添加 WebDAV、Alist/OpenList、阿里云盘 refresh_token 或本地目录, the System SHALL 保存挂载配置并在片库中列出该云盘的目录与视频文件。
2. WHEN 用户点选一个视频文件, the System SHALL 优先返回云盘直链供播放器拉流。
3. IF 直链请求失败或云盘要求特定请求头, the System SHALL 提供中转播放地址并支持 HTTP Range。
4. WHILE 片库处于打开状态, the System SHALL 允许用户在目录间前进、返回，并按名称搜索当前已挂载内容。

### Requirement 2: 手机放映厅

**User Story:** AS 手机用户, I want 用接近本地播放器的界面看片, so that 在局域网里随时接着看。

#### Acceptance Criteria

1. WHEN 用户打开首页, the System SHALL 展示继续观看、直播正在播出、以及片库最近目录。
2. WHEN 播放器开始播放, the System SHALL 支持播放/暂停、进度拖动、倍速、全屏，并在移动端支持左右双击快进快退。
3. WHILE 视频正在播放, the System SHALL 每隔 5 秒记录播放进度。
4. WHEN 用户再次打开同一影片, the System SHALL 从上次进度继续播放。

### Requirement 3: 中兴 IPTV 鉴权与频道

**User Story:** AS 开通了运营商 IPTV 的用户, I want 系统自动完成中兴平台鉴权并拿到频道, so that 手机可以当机顶盒用。

#### Acceptance Criteria

1. WHEN 用户保存 UserID、密码、MAC、STBID 与平台地址并触发鉴权, the System SHALL 按中兴/CTC 流程获取 EncryToken、提交鉴权并保存 UserToken。
2. WHEN 鉴权成功, the System SHALL 拉取频道列表（频道号、名称、组播/单播地址、分类）。
3. IF 鉴权失败, the System SHALL 返回平台响应摘要，并允许用户改用 M3U 播放列表导入频道。
4. WHEN 用户选择一个组播频道, the System SHALL 给出 rtp2http 播放地址；单播/HLS 频道则直接给出源地址。

### Requirement 4: EPG 节目单

**User Story:** AS 直播观众, I want 看到每个频道现在播什么、待会播什么, so that 不用来回切台。

#### Acceptance Criteria

1. WHEN 鉴权成功或用户导入 XMLTV/平台 EPG 地址, the System SHALL 拉取当天节目单。
2. WHILE 直播页打开, the System SHALL 展示当前频道的正在播出与下一档节目。
3. WHEN 用户点选频道列表中的一个频道, the System SHALL 刷新该频道的分时段节目单。
4. IF 平台 EPG 不可用, the System SHALL 仍提供频道列表播放，节目单区域显示暂无节目信息。

### Requirement 5: 组播与 rtp2http

**User Story:** AS OpenWrt 用户, I want 组播 IPTV 转成手机能播的 HTTP 流, so that 不安装组播播放器也能看直播。

#### Acceptance Criteria

1. WHEN 播放器请求 `/api/rtp/{group}/{port}`, the System SHALL 加入该组播组，剥离 RTP 头，并以 `video/mp2t` 输出 MPEG-TS。
2. WHEN 播放器请求 `/api/udp/{group}/{port}`, the System SHALL 转发 UDP 负载（兼容 udpxy 习惯路径）。
3. WHILE 至少一个客户端在观看某组播, the System SHALL 保持 IGMP 成员关系；WHEN 最后一个客户端断开, the System SHALL 关闭对应套接字。
4. WHEN 用户在设置中填写已有 udpxy 地址, the System SHALL 允许直播播放走外部 udpxy 而不是内置 rtp2http。

### Requirement 6: OpenWrt 部署

**User Story:** AS 路由器官理员, I want 用较小内存跑起来这套服务, so that 家用 OpenWrt 能长期挂着。

#### Acceptance Criteria

1. WHEN 管理员执行启动脚本或 init.d 服务, the System SHALL 在局域网端口提供 Web 界面与 API。
2. THE System SHALL 将配置保存在本地 JSON 文件，重启后恢复挂载与 IPTV 参数。
3. THE System SHALL 提供 IPTV VLAN、igmpproxy/omcproxy 与防火墙的说明，便于组播进入路由器。

### Requirement 7: LuCI 插件与 apk 包

**User Story:** AS OpenWrt 管理员, I want 在 LuCI 里管理映湾并安装 apk 插件包, so that 不用改命令行也能配云盘和 IPTV。

#### Acceptance Criteria

1. WHEN 管理员安装 luci-app-yingbay, the System SHALL 在 LuCI「服务 -> 映湾影视」提供总览、服务、网盘、IPTV 四个页面。
2. WHEN 管理员在 LuCI 保存 UCI 配置, the System SHALL 把端口、网盘、中兴鉴权参数写入 `/etc/config/yingbay`，并在服务重启后生效。
3. WHEN 管理员执行打包脚本, the System SHALL 生成 `yingbay_*.apk` 与 `luci-app-yingbay_*.apk`。
4. WHEN 总览页打开, the System SHALL 显示服务运行状态、端口，并提供打开放映厅、启动、重启按钮。
