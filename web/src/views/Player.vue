<template>
  <div class="player-page">
    <VideoStage
      :src="src"
      :title="title"
      :mode="mode"
      :start-at="startAt"
      @back="$router.back()"
      @progress="onProgress"
      @error="onError"
    />
    <div class="toast" v-if="msg">{{ msg }}</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../api";
import VideoStage from "../components/VideoStage.vue";

const route = useRoute();
const src = ref("");
const title = ref(route.query.title || "");
const mode = ref("direct");
const startAt = ref(Number(route.query.t || 0));
const msg = ref("");
let lastSent = 0;

onMounted(async () => {
  const data = await api.file(route.query.driveId, route.query.path);
  src.value = data.playUrl;
  title.value = data.title || data.name;
  mode.value = data.mode;
});

function onProgress({ position, duration }) {
  const now = Date.now();
  if (now - lastSent < 5000) return;
  lastSent = now;
  api.saveHistory({
    driveId: route.query.driveId,
    path: route.query.path,
    title: title.value,
    position,
    duration,
  });
}

function onError(text) {
  msg.value = text;
  if (mode.value === "direct") {
    const driveId = route.query.driveId;
    const filePath = route.query.path;
    src.value = `/api/drives/${encodeURIComponent(driveId)}/proxy?path=${encodeURIComponent(filePath)}`;
    mode.value = "relay";
  }
}
</script>
