<script setup>
import { ref, watch, computed, onMounted } from 'vue';

const props = defineProps({
  currentGateway: { type: String, default: 'http://127.0.0.1:8080/ipfs/' },
});
const emit = defineEmits(['search', 'gateway-change']);

const searchQuery = ref('');
const settingsOpen = ref(false);
const selectedGateway = ref(props.currentGateway);
const localHost = ref('127.0.0.1');
const localPort = ref('8080');

const localGatewayUrl = computed(() => `http://${localHost.value}:${localPort.value}/ipfs/`);
const gateways = [
  {
    id: 'local',
    label: 'Local Node',
    desc: 'Fastest for local dev, no public dependency',
  },
  {
    id: 'pinata',
    url: 'https://gateway.pinata.cloud/ipfs/',
    label: 'Pinata',
    desc: 'Reliable and usually fast',
  },
  {
    id: 'dweb',
    url: 'https://dweb.link/ipfs/',
    label: 'dweb.link',
    desc: 'Official IPFS gateway',
  },
  {
    id: 'ipfsio',
    url: 'https://ipfs.io/ipfs/',
    label: 'ipfs.io',
    desc: 'Standard public gateway',
  },
];

const lastLocalGateway = ref(localGatewayUrl.value);
const localStorageKey = 'ipfs-hls-local-gateway';

watch(
  () => props.currentGateway,
  (next) => {
    if (!settingsOpen.value) {
      selectedGateway.value = next;
    }
  }
);

watch(
  () => localGatewayUrl.value,
  (next) => {
    if (selectedGateway.value === lastLocalGateway.value) {
      selectedGateway.value = next;
    }
    lastLocalGateway.value = next;
    persistLocalGateway();
  }
);

function onSearch() {
  const trimmed = searchQuery.value.trim();
  if (trimmed) {
    emit('search', trimmed);
  }
}

function isPrivateHost(hostname) {
  if (!hostname) return false;
  if (hostname === 'localhost') return true;
  if (hostname.startsWith('127.')) return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function syncLocalFromGateway(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!parsed.pathname.startsWith('/ipfs')) return;
    if (!isPrivateHost(parsed.hostname)) return;
    localHost.value = parsed.hostname;
    localPort.value = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch (_) {
    // ignore invalid URLs
  }
}

function normalizeLocalHost(value) {
  return value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function normalizeLocalPort(value) {
  const digits = value.trim().replace(/[^0-9]/g, '');
  return digits || '8080';
}

function gatewayUrl(gateway) {
  return gateway.id === 'local' ? localGatewayUrl.value : gateway.url;
}

function openSettings() {
  restoreLocalGateway();
  syncLocalFromGateway(props.currentGateway);
  selectedGateway.value = props.currentGateway;
  settingsOpen.value = true;
}

function applyGateway() {
  localHost.value = normalizeLocalHost(localHost.value);
  localPort.value = normalizeLocalPort(localPort.value);
  if (selectedGateway.value === lastLocalGateway.value) {
    selectedGateway.value = localGatewayUrl.value;
  }
  persistLocalGateway();
  emit('gateway-change', selectedGateway.value);
  settingsOpen.value = false;
}

function persistLocalGateway() {
  try {
    const payload = {
      host: localHost.value,
      port: localPort.value,
    };
    localStorage.setItem(localStorageKey, JSON.stringify(payload));
  } catch (_) {
    // ignore storage errors
  }
}

function restoreLocalGateway() {
  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.host === 'string' && typeof parsed.port === 'string') {
      localHost.value = parsed.host;
      localPort.value = parsed.port;
    }
  } catch (_) {
    // ignore storage errors
  }
}

onMounted(() => {
  restoreLocalGateway();
});
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
      <button class="action-btn gateway-btn" @click="openSettings" aria-label="Gateway Settings">
        <span class="btn-icon">⚙</span>
        <span class="btn-text">Gateway</span>
      </button>
      <button class="action-btn icon-btn" title="Notifications">
        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
      </button>
      <div class="avatar">
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4" alt="User" />
      </div>
    </div>
  </header>

  <div v-if="settingsOpen" class="gateway-backdrop" @click.self="settingsOpen = false">
    <div class="gateway-dialog" role="dialog" aria-modal="true" aria-labelledby="gatewayTitle">
      <div class="gateway-header">
        <div>
          <h3 id="gatewayTitle">Gateway Settings</h3>
          <div class="gateway-subtitle">Choose the best route to your IPFS content</div>
        </div>
        <button class="gateway-close" @click="settingsOpen = false" aria-label="Close">
          ✕
        </button>
      </div>

      <div class="gateway-current">
        <span class="label">Current</span>
        <span class="value">{{ currentGateway }}</span>
      </div>

      <div class="gateway-list">
        <label
          v-for="g in gateways"
          :key="g.id"
          class="gateway-option"
          :class="{ selected: selectedGateway === gatewayUrl(g) }"
        >
          <input type="radio" name="gateway" :value="gatewayUrl(g)" v-model="selectedGateway" />
          <div class="gateway-meta">
            <div class="gateway-title">
              {{ g.label }}
              <span v-if="gatewayUrl(g) === currentGateway" class="badge">Active</span>
            </div>
            <div class="gateway-desc">{{ g.desc }}</div>
            <div class="gateway-url">{{ gatewayUrl(g) }}</div>
          </div>
          <div class="gateway-check">✓</div>
        </label>
      </div>

      <div class="local-config">
        <div class="local-title">Local Node Settings</div>
        <div class="local-fields">
          <div class="field">
            <label for="localHost">Host / IP</label>
            <input id="localHost" type="text" v-model="localHost" placeholder="127.0.0.1" />
          </div>
          <div class="field">
            <label for="localPort">Port</label>
            <input id="localPort" type="text" v-model="localPort" placeholder="8080" />
          </div>
        </div>
        <div class="local-preview">
          <span class="label">Preview</span>
          <span class="value">{{ localGatewayUrl }}</span>
        </div>
      </div>

      <div class="gateway-actions">
        <button class="ghost-btn" @click="settingsOpen = false">Cancel</button>
        <button class="primary-btn" @click="applyGateway">Apply</button>
      </div>
    </div>
  </div>
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

.gateway-btn {
  background: rgba(162, 82, 255, 0.12);
  color: var(--text-primary);
  border: 1px solid rgba(162, 82, 255, 0.3);
  border-radius: 18px;
  padding: 8px 14px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.gateway-btn:hover {
  background: rgba(162, 82, 255, 0.2);
  box-shadow: 0 0 14px rgba(162, 82, 255, 0.25);
}

.gateway-btn .btn-icon {
  font-size: 1.1rem;
}

.gateway-btn .btn-text {
  font-weight: 600;
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
    width: auto;
    gap: 8px;
  }
  .actions-area .icon-btn,
  .actions-area .avatar {
    display: none;
  }
  .gateway-btn .btn-text {
    display: none;
  }
}
@media (max-width: 480px) {
  .logo-text {
    display: none; /* Only show logo icon on tiny screens */
  }
}

/* Gateway Dialog */
.gateway-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(7, 9, 16, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 200;
}

.gateway-dialog {
  width: min(520px, 100%);
  background: rgba(16, 18, 32, 0.9);
  border: 1px solid var(--panel-border);
  border-radius: 18px;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  padding: 20px;
  color: var(--text-primary);
  max-height: 80vh;
  overflow: auto;
}

.gateway-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.gateway-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.gateway-subtitle {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 6px;
}

.gateway-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
}

.gateway-current {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gateway-current .label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.gateway-current .value {
  font-size: 0.9rem;
  color: var(--text-primary);
  word-break: break-all;
}

.gateway-list {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.gateway-option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s ease;
}

.gateway-option input {
  accent-color: var(--accent-cyan);
}

.gateway-option:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
}

.gateway-option.selected {
  border-color: rgba(0, 210, 255, 0.5);
  box-shadow: 0 0 18px rgba(0, 210, 255, 0.15);
}

.gateway-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.gateway-desc {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 4px;
}

.gateway-url {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  margin-top: 6px;
  word-break: break-all;
}

.gateway-check {
  color: var(--accent-cyan);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.gateway-option.selected .gateway-check {
  opacity: 1;
}

.badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 210, 255, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(0, 210, 255, 0.4);
}

.gateway-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  position: sticky;
  bottom: 0;
  background: rgba(16, 18, 32, 0.95);
  padding-top: 12px;
}

.ghost-btn,
.primary-btn {
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.ghost-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-secondary);
}

.ghost-btn:hover {
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.4);
}

.primary-btn {
  background: rgba(0, 210, 255, 0.18);
  border: 1px solid rgba(0, 210, 255, 0.4);
  color: var(--text-primary);
}

.primary-btn:hover {
  box-shadow: 0 0 18px rgba(0, 210, 255, 0.25);
}

.local-config {
  margin-top: 16px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: rgba(0, 0, 0, 0.25);
  display: grid;
  gap: 10px;
}

.local-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.local-fields {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
}

.local-config label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.local-config input {
  margin-top: 6px;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 0.9rem;
  outline: none;
}

.local-config input:focus {
  border-color: rgba(0, 210, 255, 0.5);
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.2);
}

.local-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.local-preview .label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.local-preview .value {
  font-size: 0.85rem;
  color: var(--text-primary);
  word-break: break-all;
}

@media (max-width: 768px) {
  .gateway-backdrop {
    align-items: flex-end;
    padding: 0;
  }
  .gateway-dialog {
    width: 100%;
    border-radius: 20px 20px 0 0;
    padding: 14px 16px 12px;
    max-height: 90vh;
  }
  .gateway-header {
    align-items: center;
  }
  .gateway-header h3 {
    font-size: 1.1rem;
  }
  .gateway-subtitle {
    font-size: 0.82rem;
  }
  .gateway-current {
    padding: 8px 10px;
  }
  .gateway-option {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px;
  }
  .gateway-title {
    font-size: 0.95rem;
  }
  .gateway-desc {
    font-size: 0.8rem;
  }
  .gateway-url {
    font-size: 0.7rem;
  }
  .gateway-check {
    display: none;
  }
  .gateway-actions {
    position: sticky;
    bottom: -1px;
    margin-top: 12px;
    padding: 10px 0 4px;
    flex-direction: column;
  }
  .ghost-btn,
  .primary-btn {
    width: 100%;
    justify-content: center;
    padding: 10px 14px;
    font-size: 0.9rem;
  }
  .local-config {
    padding: 10px;
  }
  .local-fields {
    grid-template-columns: 1fr;
  }
  .local-config input {
    padding: 9px 10px;
    font-size: 0.85rem;
  }
  .local-title {
    font-size: 0.9rem;
  }
}
</style>
