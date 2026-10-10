<template>
  <div class="player-box" @click="toggle" @dblclick="seekSide">
    <video ref="videoEl" playsinline webkit-playsinline></video>
    <div class="overlay-ui" v-if="ui">
      <div class="row">
        <button class="btn ghost" type="button" @click.stop="$emit('back')">返回</button>
        <div>
          <div class="kicker">{{ modeLabel }}</div>
          <h3>{{ title }}</h3>
        </div>
      </div>
      <div>
        <div class="row" style="margin-bottom:10px">
          <button class="btn" type="button" @click.stop="toggle">{{ paused ? "播放" : "暂停" }}</button>
          <button class="btn ghost" type="button" @click.stop="cycleRate">{{ rate }}x</button>
          <button class="btn ghost" type="button" @click.stop="goFullscreen">全屏</button>
        </div>
        <div class="progress" @click.stop="seekBar">
          <i :style="{ width: percent + '%' }"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Hls from "hls.js";
import mpegts from "mpegts.js";

const props = defineProps({
  src: String,
  title: { type: String, default: "" },
  live: { type: Boolean, default: false },
  mode: { type: String, default: "direct" },
  startAt: { type: Number, default: 0 },
});
const emit = defineEmits(["back", "progress", "error"]);

const videoEl = ref(null);
const paused = ref(true);
const percent = ref(0);
const rate = ref(1);
const ui = ref(true);
let hls = null;
let tsPlayer = null;
let hideTimer = null;

const modeLabel = computed(() => {
  if (props.live) return props.mode === "direct" ? "LIVE DIRECT" : "LIVE RTP2HTTP";
  return props.mode === "direct" ? "CLOUD DIRECT" : "RELAY";
});

function kind(url) {
  const u = String(url || "");
  if (u.includes(".m3u8")) return "hls";
  if (u.includes("/api/rtp/") || u.includes("/api/udp/") || u.endsWith(".ts")) return "ts";
  return "mp4";
}

function destroy() {
  if (hls) { hls.destroy(); hls = null; }
  if (tsPlayer) { tsPlayer.destroy(); tsPlayer = null; }
}

async function attach() {
  destroy();
  const video = videoEl.value;
  if (!video || !props.src) return;
  const type = kind(props.src);
  video.pause();
  video.removeAttribute("src");
  if (type === "hls") {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = props.src;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(props.src);
      hls.attachMedia(video);
    }
  } else if (type === "ts" && mpegts.isSupported()) {
    tsPlayer = mpegts.createPlayer({
      type: "mse",
      isLive: true,
      url: props.src,
      hasAudio: true,
      hasVideo: true,
    });
    tsPlayer.attachMediaElement(video);
    tsPlayer.load();
  } else {
    video.src = props.src;
  }
  try {
    await video.play();
    paused.value = false;
    if (props.startAt && !props.live) video.currentTime = props.startAt;
  } catch (err) {
    paused.value = true;
  }
}

function toggle() {
  const video = videoEl.value;
  if (!video) return;
  if (video.paused) { video.play(); paused.value = false; }
  else { video.pause(); paused.value = true; }
  flash();
}

function seekSide(e) {
  if (props.live) return;
  const video = videoEl.value;
  if (!video) return;
  const mid = e.currentTarget.getBoundingClientRect().width / 2;
  video.currentTime += e.offsetX > mid ? 10 : -10;
}

function seekBar(e) {
  if (props.live) return;
  const video = videoEl.value;
  if (!video || !video.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
}

function cycleRate() {
  const next = [1, 1.25, 1.5, 2, 0.75];
  rate.value = next[(next.indexOf(rate.value) + 1) % next.length];
  if (videoEl.value) videoEl.value.playbackRate = rate.value;
}

function goFullscreen() {
  const box = videoEl.value && videoEl.value.parentElement;
  if (box && box.requestFullscreen) box.requestFullscreen();
}

function flash() {
  ui.value = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { if (!paused.value) ui.value = false; }, 2800);
}

function onTime() {
  const video = videoEl.value;
  if (!video || !video.duration) return;
  percent.value = (video.currentTime / video.duration) * 100;
  emit("progress", { position: video.currentTime, duration: video.duration });
}

onMounted(() => {
  const video = videoEl.value;
  video.addEventListener("timeupdate", onTime);
  video.addEventListener("play", () => { paused.value = false; flash(); });
  video.addEventListener("pause", () => { paused.value = true; ui.value = true; });
  video.addEventListener("error", () => emit("error", "播放失败，可在片库改用中转"));
  attach();
});

watch(() => props.src, attach);
onBeforeUnmount(() => {
  destroy();
  clearTimeout(hideTimer);
});
</script>
