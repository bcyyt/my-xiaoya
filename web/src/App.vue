<template>
  <div>
    <router-view />
    <nav class="nav" v-if="showNav">
      <router-link to="/" :class="{ on: $route.path === '/' }"><b>厅</b>放映</router-link>
      <router-link to="/library" :class="{ on: $route.path.startsWith('/library') }"><b>库</b>片库</router-link>
      <router-link to="/live" :class="{ on: $route.path.startsWith('/live') }"><b>播</b>直播</router-link>
      <router-link to="/drives" :class="{ on: $route.path.startsWith('/drives') }"><b>盘</b>网盘</router-link>
      <router-link to="/settings" :class="{ on: $route.path.startsWith('/settings') }"><b>设</b>设置</router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const showNav = computed(() => route.path !== "/play");
</script>
