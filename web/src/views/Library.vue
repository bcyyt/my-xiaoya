<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><b>片库</b><span>Direct from the drive</span></div>
    </header>
    <div class="row" style="margin-bottom:16px">
      <button
        v-for="d in driveList"
        :key="d.id"
        class="btn"
        :class="d.id === driveId ? '' : 'ghost'"
        @click="openDrive(d.id)"
      >{{ d.name }}</button>
    </div>
    <div class="crumbs">
      <a href="#" @click.prevent="openPath('/')">根目录</a>
      <span v-for="c in crumbs" :key="c.path"> / <a href="#" @click.prevent="openPath(c.path)">{{ c.name }}</a></span>
    </div>
    <p class="muted" v-if="error">{{ error }}</p>
    <section class="section">
      <div class="grid">
        <article class="poster" v-for="item in folders" :key="item.path" @click="openPath(item.path)">
          <div class="art" style="background:linear-gradient(180deg,#3a2a1c,#17120e)"></div>
          <div class="meta"><b>{{ item.name }}</b><span>目录</span></div>
        </article>
        <PosterCard v-for="item in videos" :key="item.path" :item="item" @open="play" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api";
import PosterCard from "../components/PosterCard.vue";

const route = useRoute();
const router = useRouter();
const driveList = ref([]);
const driveId = ref("");
const dirPath = ref("/");
const items = ref([]);
const error = ref("");

const folders = computed(() => items.value.filter((i) => i.isDir));
const videos = computed(() => {
  const q = String(route.query.q || "").toLowerCase();
  return items.value.filter((i) => i.playable && (!q || String(i.title || i.name).toLowerCase().includes(q)));
});
const crumbs = computed(() => {
  const parts = dirPath.value.split("/").filter(Boolean);
  const out = [];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    out.push({ name: p, path: acc });
  }
  return out;
});

async function load() {
  error.value = "";
  if (!driveId.value) return;
  try {
    const data = await api.list(driveId.value, dirPath.value);
    items.value = data.items || [];
  } catch (err) {
    error.value = err.message;
    items.value = [];
  }
}

function openDrive(id) {
  driveId.value = id;
  dirPath.value = "/";
  load();
}
function openPath(p) {
  dirPath.value = p || "/";
  load();
}
function play(item) {
  router.push({ path: "/play", query: { driveId: driveId.value, path: item.path, title: item.title || item.name } });
}

onMounted(async () => {
  driveList.value = await api.drives();
  driveId.value = (driveList.value[0] && driveList.value[0].id) || "";
  await load();
});
watch(() => route.query.q, load);
</script>
