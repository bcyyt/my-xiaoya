<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><b>直播</b><span>ZTE · EPG · rtp2http</span></div>
    </header>
    <div class="live-layout">
      <div>
        <VideoStage
          :src="current.playUrl"
          :title="current.name"
          :live="true"
          :mode="isMulticast ? 'relay' : 'direct'"
          @back="$router.push('/')"
        />
        <div class="panel" style="padding:16px;margin-top:12px">
          <div class="kicker">EPG</div>
          <h2 style="margin:8px 0">{{ current.name || "选择频道" }}</h2>
          <p class="muted">正在播出 · {{ (epg.current && epg.current.title) || "暂无节目信息" }}</p>
          <p class="muted">下一档 · {{ (epg.next && epg.next.title) || "—" }}</p>
          <div style="margin-top:12px">
            <div v-for="ev in epg.events" :key="ev.start" class="epg-now">
              {{ fmt(ev.start) }} - {{ fmt(ev.end) }}　{{ ev.title }}
            </div>
          </div>
        </div>
      </div>
      <div class="panel channel-list">
        <div class="row" style="padding:8px">
          <button
            v-for="g in groups"
            :key="g"
            class="btn"
            :class="g === group ? '' : 'ghost'"
            @click="group = g"
          >{{ g }}</button>
        </div>
        <article
          v-for="ch in filtered"
          :key="ch.id"
          class="channel"
          :class="{ on: ch.id === current.id }"
          @click="select(ch)"
        >
          <div class="chno">{{ String(ch.no).padStart(2, "0") }}</div>
          <div>
            <b>{{ ch.name }}</b>
            <div class="epg-now">{{ ch.group }} · {{ ch.proto.toUpperCase() }}</div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { api } from "../api";
import VideoStage from "../components/VideoStage.vue";

const groups = ref(["全部"]);
const group = ref("全部");
const channels = ref([]);
const current = ref({});
const epg = ref({ events: [] });

const filtered = computed(() => {
  if (group.value === "全部") return channels.value;
  return channels.value.filter((c) => c.group === group.value);
});
const isMulticast = computed(() => current.value.proto === "rtp" || current.value.proto === "udp");

function fmt(v) {
  if (!v) return "";
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function select(ch) {
  current.value = await api.playLive(ch.id);
  epg.value = { current: current.value.now, next: current.value.next, events: current.value.events || [] };
}

onMounted(async () => {
  const data = await api.channels();
  channels.value = data.channels || [];
  groups.value = ["全部"].concat(data.groups || []);
  if (channels.value[0]) await select(channels.value[0]);
});
</script>
