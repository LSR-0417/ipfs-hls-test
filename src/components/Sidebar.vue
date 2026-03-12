<script setup>
const menuItems = [
  { id: 'home', label: 'Home', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
  { id: 'explore', label: 'Explore', icon: 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z' },
  { id: 'library', label: 'Library', icon: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z' },
  { id: 'history', label: 'History', icon: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' },
];
</script>

<template>
  <nav class="sidebar glass-panel">
    <div class="menu">
      <div 
        v-for="item in menuItems" 
        :key="item.id" 
        class="menu-item"
        :class="{ active: item.id === 'home' }"
      >
        <div class="icon-container">
          <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" :d="item.icon"/></svg>
        </div>
        <span class="label">{{ item.label }}</span>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-collapsed-width); /* Default collapsed for sleek look, can expand on hover or click */
  height: 100%;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  transition: width 0.3s ease;
  z-index: 90;
}

@media (min-width: 1200px) {
  .sidebar {
    width: var(--sidebar-width);
    align-items: stretch;
    padding: 16px 12px;
  }
  .menu-item {
    flex-direction: row !important;
    justify-content: flex-start !important;
    padding: 12px 16px !important;
    border-radius: 12px !important;
  }
  .label {
    display: block !important;
    margin-left: 16px;
    font-size: 1rem !important;
  }
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  border-radius: 8px;
  margin: 0 8px;
}

.menu-item:hover {
  background: var(--interactive-hover);
  color: var(--text-primary);
}

.menu-item.active {
  color: var(--accent-cyan);
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
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
  font-size: 0.7rem;
  display: block; /* always block for collapsed view but smaller */
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 60px;
    flex-direction: row;
    padding: 0;
    border-right: none;
    border-top: 1px solid var(--panel-border);
    justify-content: center;
    background: rgba(13, 15, 26, 0.9);
    backdrop-filter: blur(20px);
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
  
  .label {
    font-size: 0.65rem;
  }
}
</style>
