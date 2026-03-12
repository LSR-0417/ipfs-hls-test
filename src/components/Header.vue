<script setup>
import { ref } from 'vue';

const emit = defineEmits(['search']);
const searchQuery = ref('');

function onSearch() {
  const trimmed = searchQuery.value.trim();
  if (trimmed) {
    emit('search', trimmed);
  }
}
</script>

<template>
  <header class="header glass-panel">
    <div class="logo-area">
      <div class="hamburger">
        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
      </div>
      <div class="logo">
        <span class="logo-icon">▲</span>
        <span class="logo-text">Astra<span class="neon-text">Stream</span></span>
      </div>
    </div>

    <div class="search-area">
      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search IPFS CID (e.g. Qm...)" 
          @keyup.enter="onSearch"
        />
        <button class="icon-btn search-submit-btn" @click="onSearch" aria-label="Search">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M22 12l-4-4v3H3v2h15v3z"/></svg>
        </button>
      </div>
    </div>

    <div class="actions-area">
      <button class="action-btn icon-btn">
        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
      </button>
      <div class="avatar">
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4" alt="User" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 250px;
}

.hamburger {
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.hamburger:hover {
  background: var(--interactive-hover);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.logo-icon {
  color: var(--accent-cyan);
  font-size: 1.5rem;
  filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.6));
}

.neon-text {
  color: var(--accent-neon);
}

.search-area {
  flex: 1;
  max-width: 600px;
  display: flex;
  justify-content: center;
}

.search-bar {
  width: 100%;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--panel-border);
  border-radius: 24px;
  padding: 8px 16px;
  transition: all 0.3s ease;
}

.search-bar:focus-within {
  border-color: var(--accent-neon);
  box-shadow: 0 0 12px rgba(162, 82, 255, 0.3);
  background: rgba(0, 0, 0, 0.5);
}

.search-icon {
  color: var(--text-secondary);
  margin-right: 12px;
}

.search-bar input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  width: 100%;
}

.search-bar input::placeholder {
  color: var(--text-secondary);
}

.search-submit-btn {
  padding: 4px;
  margin-left: 8px;
  color: var(--text-secondary);
}
.search-submit-btn:hover {
  color: var(--accent-neon);
  background: rgba(255, 255, 255, 0.05);
}

.actions-area {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 250px;
  justify-content: flex-end;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.icon-btn:hover {
  background: var(--interactive-hover);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--accent-cyan);
  cursor: pointer;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 768px) {
  .logo-area {
    width: auto;
  }
  .search-area {
    flex: 1;
    margin: 0 12px;
  }
  .search-bar {
    padding: 6px 12px;
  }
  .search-bar input {
    font-size: 0.9rem;
  }
  .search-icon {
    display: none; /* hide standard icon to save space on mobile */
  }
  .actions-area {
    display: none; /* Hide profile/actions on very small screens or move to sidebar */
  }
}
@media (max-width: 480px) {
  .logo-text {
    display: none; /* Only show logo icon on tiny screens */
  }
}
</style>
