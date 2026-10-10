<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><b>机房</b><span>ZTE auth · EPG · multicast</span></div>
    </header>

    <section class="section">
      <h2>中兴 IPTV 鉴权</h2>
      <p class="muted">填写机顶盒同款 UserID / 密码 / MAC / STBID。鉴权成功后自动拉频道和 EPG。组播节目由内置 rtp2http 转成手机可播的 HTTP TS。</p>
      <form class="form" @submit.prevent="saveAndAuth">
        <label>平台算法
          <select v-model="iptv.vendor">
            <option value="zte">中兴 MD5</option>
            <option value="zte-sha">中兴 SHA256</option>
            <option value="hwctc">华为 CTC</option>
          </select>
        </label>
        <label>AuthenticationURL<input v-model="iptv.authUrl" placeholder="http://xxx:8082/EDS/jsp/AuthenticationURL" /></label>
        <label>EPG 根地址<input v-model="iptv.epgUrl" placeholder="http://epg-host:port" /></label>
        <label>UserID<input v-model="iptv.userId" /></label>
        <label>密码<input type="password" v-model="iptv.password" /></label>
        <label>MAC<input v-model="iptv.mac" placeholder="00:11:22:33:44:55" /></label>
        <label>STBID<input v-model="iptv.stbId" /></label>
        <label>机顶盒 IP<input v-model="iptv.userIp" /></label>
        <label>播放通道
          <select v-model="iptv.playMode">
            <option value="rtp2http">内置 rtp2http</option>
            <option value="udpxy">已有 udpxy</option>
          </select>
        </label>
        <label v-if="iptv.playMode === 'udpxy'">udpxy 地址<input v-model="iptv.udpxyUrl" placeholder="http://192.168.1.1:4022" /></label>
        <label>XMLTV / 外部 EPG<input v-model="iptv.epgXmlUrl" placeholder="可选，http://...xmltv.xml" /></label>
        <div class="row">
          <button class="btn" type="submit">保存并鉴权</button>
          <button class="btn ghost" type="button" @click="saveOnly">只保存</button>
        </div>
        <p class="muted" v-if="authMsg">{{ authMsg }}</p>
        <pre class="muted" v-if="logs.length" style="white-space:pre-wrap">{{ logs.join("\n") }}</pre>
      </form>
    </section>

    <section class="section">
      <h2>导入 M3U</h2>
      <form class="form" @submit.prevent="importM3u">
        <label>播放列表<textarea v-model="m3u" placeholder="#EXTM3U"></textarea></label>
        <button class="btn" type="submit">导入频道</button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { api } from "../api";

const iptv = reactive({
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
});
const m3u = ref("");
const authMsg = ref("");
const logs = ref([]);

onMounted(async () => {
  const cfg = await api.config();
  Object.assign(iptv, cfg.iptv || {});
});

async function saveOnly() {
  await api.saveConfig({ iptv });
  authMsg.value = "已保存";
}
async function saveAndAuth() {
  authMsg.value = "正在鉴权…";
  logs.value = [];
  try {
    await api.saveConfig({ iptv });
    const res = await api.iptvAuth(iptv);
    authMsg.value = `鉴权成功，频道 ${res.channels.length} 个`;
    logs.value = res.logs || [];
  } catch (err) {
    authMsg.value = err.message;
    logs.value = (err.data && err.data.logs) || [];
  }
}
async function importM3u() {
  const res = await api.iptvM3u(m3u.value);
  authMsg.value = `已导入 ${res.channels.length} 个频道`;
}
</script>
