<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <b>{{ home.siteName || "映湾" }}</b>
        <span>OpenWrt Screening Room</span>
      </div>
      <input class="search" v-model="keyword" placeholder="搜影片或频道" @keyup.enter="goSearch" />
    </header>

    <section class="hero">
      <article class="hero-card">
        <div class="kicker">Tonight in the house</div>
        <h1>{{ headline }}</h1>
        <p class="muted">{{ home.featured && home.featured[0] && home.featured[0].blurb || "把云盘挂上路由器，手机直接开播。直播走中兴鉴权与 rtp2http 组播转 HTTP。" }}</p>
        <div class="row" style="margin-top:18px">
          <button class="btn" @click="playFirst">继续放映</button>
          <router-link class="btn ghost" to="/live">打开直播</router-link>
        </div>
      </article>
      <article class="hero-card">
        <div class="kicker">Live now</div>
        <h2 style="margin:10px 0 8px">{{ liveNow }}</h2>
        <p class="muted">{{ liveProgram }}</p>
        <div class="row" style="margin-top:18px">
          <router-link class="btn wine" to="/live">进入导视</router-link>
        </div>
      </article>
    </section>

    <section class="section" v-if="home.history && home.history.length">
      <div class="section-head">
        <h2>胶片还夹着</h2>
        <span class="muted">从上次停下的地方接着</span>
      </div>
      <div class="rail">
        <PosterCard v-for="item in home.history" :key="item.key" :item="item" @open="resume" />
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>片库灯还亮着</h2>
        <router-link class="muted" to="/library">全部片目</router-link>
      </div>
      <div class="grid">
        <PosterCard v-for="item in home.featured" :key="item.path" :item="item" @open="openMovie" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api";
import PosterCard from "../components/PosterCard.vue";

const router = useRouter();
const home = ref({ featured: [], history: [], live: [], siteName: "映湾" });
const keyword = ref("");

const headline = computed(() => {
  const h = home.value.history && home.value.history[0];
  if (h) return h.title;
  const f = home.value.featured && home.value.featured[0];
  return (f && (f.title || f.name)) || "今晚的私人放映";
});

const liveNow = computed(() => (home.value.live && home.value.live[0] && home.value.live[0].name) || "演示直播");
const liveProgram = computed(() => {
  const ch = home.value.live && home.value.live[0];
  if (ch && ch.now) return `正在播出 · ${ch.now.title}`;
  return "导入中兴频道后，这里会显示正在播出的节目";
});

onMounted(async () => {
  home.value = await api.home();
});

function openMovie(item) {
  router.push({ path: "/play", query: { driveId: item.driveId, path: item.path, title: item.title || item.name } });
}
function resume(item) {
  router.push({ path: "/play", query: { driveId: item.driveId, path: item.path, title: item.title, t: item.position || 0 } });
}
function playFirst() {
  if (home.value.history && home.value.history[0]) return resume(home.value.history[0]);
  if (home.value.featured && home.value.featured[0]) return openMovie(home.value.featured[0]);
  router.push("/library");
}
function goSearch() {
  router.push({ path: "/library", query: { q: keyword.value } });
}
</script>
