<template>
  <article class="poster" @click="$emit('open', item)">
    <div class="badge">{{ item.genre || item.driveName || "FILM" }}</div>
    <div class="art" :style="artStyle"></div>
    <div class="meta">
      <b>{{ item.title || item.name }}</b>
      <span>{{ item.year || item.driveName || "直连可播" }}</span>
    </div>
  </article>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ item: { type: Object, required: true } });
defineEmits(["open"]);

const artStyle = computed(() => {
  const seed = String(props.item.name || "x");
  const hue = 18 + (seed.charCodeAt(0) % 40);
  if (props.item.poster) {
    return {
      backgroundImage: `linear-gradient(180deg, transparent, rgba(16,14,12,0.55)), url(${props.item.poster})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: `linear-gradient(160deg, hsl(${hue} 48% 42%), #1a140f)` };
});
</script>
