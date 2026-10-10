<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><b>网盘</b><span>Mount · Direct · Relay</span></div>
    </header>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      <article class="drive-card" v-for="d in list" :key="d.id">
        <div class="kicker">{{ d.type }}</div>
        <h3 style="margin:8px 0">{{ d.name }}</h3>
        <p class="muted">{{ d.enabled ? "已挂载" : "已停用" }}</p>
        <div class="row" style="margin-top:12px">
          <button class="btn" @click="$router.push('/library')">进入</button>
          <button class="btn ghost" @click="remove(d.id)">移除</button>
        </div>
      </article>
    </div>

    <section class="section">
      <h2>加一块盘</h2>
      <p class="muted">阿里云盘走 refresh_token 直链；Alist/OpenList 可挂 115 / 夸克 / 天翼；WebDAV 适合坚果云与群晖。</p>
      <form class="form" @submit.prevent="add">
        <label>显示名<input v-model="form.name" placeholder="客厅阿里云盘" /></label>
        <label>类型
          <select v-model="form.type">
            <option value="alist">Alist / OpenList</option>
            <option value="aliyun">阿里云盘</option>
            <option value="webdav">WebDAV</option>
            <option value="local">本地 / USB</option>
            <option value="demo">演示片库</option>
          </select>
        </label>
        <label v-if="needUrl">地址<input v-model="form.config.url" placeholder="http://192.168.1.1:5244" /></label>
        <label v-if="form.type === 'alist' || form.type === 'webdav'">用户名<input v-model="form.config.username" /></label>
        <label v-if="form.type === 'alist' || form.type === 'webdav'">密码<input type="password" v-model="form.config.password" /></label>
        <label v-if="form.type === 'aliyun'">refresh_token<textarea v-model="form.config.refreshToken" placeholder="阿里云盘 refresh_token"></textarea></label>
        <label v-if="form.type === 'local'">本地路径<input v-model="form.config.root" placeholder="/mnt/sda1/video" /></label>
        <button class="btn" type="submit">挂载</button>
        <p class="error" v-if="error">{{ error }}</p>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../api";

const list = ref([]);
const error = ref("");
const form = reactive({ name: "", type: "alist", config: { url: "", username: "", password: "", refreshToken: "", root: "/mnt/sda1/video" } });
const needUrl = computed(() => form.type === "alist" || form.type === "openlist" || form.type === "webdav");

async function refresh() {
  list.value = await api.drives();
}
onMounted(refresh);

async function add() {
  error.value = "";
  try {
    await api.addDrive({ name: form.name || form.type, type: form.type, config: { ...form.config } });
    form.name = "";
    await refresh();
  } catch (err) {
    error.value = err.message;
  }
}
async function remove(id) {
  await api.removeDrive(id);
  await refresh();
}
</script>
