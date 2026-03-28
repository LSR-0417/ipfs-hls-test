<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n';

const props = defineProps({
  activeView: {
    type: String,
    default: 'home',
  },
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['view-select']);
const { t } = useI18n();

const isDevMode = import.meta.env.DEV;
const appVersion = __APP_VERSION__;
const branchName = __APP_BRANCH__;
const worktreeName = __APP_WORKTREE__;

const menuItems = computed(() => [
  { id: 'home', label: t('sidebar.menu.home'), targetView: 'home', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
  { id: 'explore', label: t('sidebar.menu.explore'), targetView: '', icon: 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z' },
  { id: 'library', label: t('sidebar.menu.library'), targetView: 'saved', icon: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z' },
  { id: 'history', label: t('sidebar.menu.history'), targetView: 'history', icon: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' },
]);

const homeBuildItems = computed(() => {
  const items = [
    { label: t('sidebar.build.version'), value: `v${appVersion || t('common.unavailable')}` },
  ];

  if (isDevMode) {
    items.push(
      { label: t('sidebar.build.worktree'), value: worktreeName || t('common.unavailable') },
      { label: t('sidebar.build.branch'), value: branchName || t('common.unavailable') }
    );
  }

  return items;
});

function isMenuItemActive(item) {
  return Boolean(item.targetView) && item.targetView === props.activeView;
}

function handleMenuItemClick(item) {
  if (!item.targetView) return;
  emit('view-select', item.targetView);
}
</script>

<template>
  <nav id="app-sidebar" class="sidebar glass-panel" :class="{ 'is-open': open }" data-testid="app-sidebar">
    <div class="menu" data-testid="sidebar-menu">
      <button
        v-for="item in menuItems" 
        :key="item.id" 
        class="menu-item"
        :class="{ active: isMenuItemActive(item), 'is-disabled': !item.targetView }"
        :data-testid="`sidebar-item-${item.id}`"
        type="button"
        :disabled="!item.targetView"
        @click="handleMenuItemClick(item)"
      >
        <div class="menu-item-main">
          <div class="icon-container">
            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" :d="item.icon"/></svg>
          </div>
          <span class="label">{{ item.label }}</span>
        </div>
      </button>
    </div>

    <div class="sidebar-build-info" :class="{ 'is-dev': isDevMode }">
      <div
        v-for="buildItem in homeBuildItems"
        :key="buildItem.label"
        class="home-build-row"
      >
        <span class="home-build-label">{{ buildItem.label }}</span>
        <span class="home-build-value">{{ buildItem.value }}</span>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: clamp(212px, 20vw, var(--sidebar-width));
  height: calc(100vh - var(--header-height));
  position: fixed;
  top: var(--header-height);
  left: 0;
  border-radius: 0 20px 20px 0;
  border-top: none;
  border-left: none;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 18px 12px 16px;
  z-index: 110;
  overflow: hidden;
  transform: translateX(calc(-100% - 18px));
  opacity: 0;
  pointer-events: none;
  transition:
    transform 0.28s ease,
    opacity 0.2s ease,
    box-shadow 0.24s ease;
}

.sidebar.is-open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
  box-shadow: 0 28px 56px rgba(0, 0, 0, 0.34);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 12px 16px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 12px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  transition: background 0.2s, color 0.2s, padding 0.24s ease;
}

.menu-item:hover {
  background: var(--interactive-hover);
  color: var(--text-primary);
}

.menu-item.active {
  color: var(--accent-cyan);
}

.menu-item.is-disabled {
  cursor: default;
  opacity: 0.46;
}

.menu-item.is-disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}

.menu-item-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.menu-item:hover .icon-container {
  transform: scale(1.1);
  color: var(--accent-neon);
}

.menu-item.active .icon-container {
  color: var(--accent-cyan);
  filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.4));
}

.label {
  display: block;
  font-size: 1rem;
}

.sidebar-build-info {
  margin-top: auto;
  padding: 12px 16px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: grid;
  gap: 10px;
}

.sidebar-build-info.is-dev {
  border-top-color: rgba(162, 82, 255, 0.18);
}

.home-build-row {
  display: grid;
  gap: 4px;
}

.home-build-label {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.48);
}

.home-build-value {
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  word-break: break-word;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    transform: none;
    opacity: 1;
    pointer-events: auto;
    width: 100%;
    height: 60px;
    flex-direction: row;
    padding: 0;
    border-radius: 0;
    border-right: none;
    border-top: 1px solid var(--panel-border);
    justify-content: center;
    background: rgba(13, 15, 26, 0.9);
    backdrop-filter: blur(20px);
    box-shadow: none;
  }

  .menu {
    flex-direction: row;
    justify-content: space-around;
    height: 100%;
    align-items: center;
    margin: 0;
  }

  .menu-item {
    margin: 0;
    padding: 4px;
    flex: 1;
  }

  .menu-item-main {
    flex-direction: column;
    gap: 4px;
  }
  
  .label {
    font-size: 0.65rem;
  }

  .sidebar-build-info {
    display: none;
  }
}
</style>
