import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./views/Home.vue";
import Library from "./views/Library.vue";
import Live from "./views/Live.vue";
import Drives from "./views/Drives.vue";
import Settings from "./views/Settings.vue";
import Player from "./views/Player.vue";
import "./styles.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/library", component: Library },
    { path: "/live", component: Live },
    { path: "/drives", component: Drives },
    { path: "/settings", component: Settings },
    { path: "/play", component: Player },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

createApp(App).use(router).mount("#app");
