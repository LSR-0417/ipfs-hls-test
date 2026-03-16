<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  isPrivateHostname,
  normalizeGatewayUrl,
  persistCustomGateway,
  probeGatewayAvailability,
  publicGatewayOptions,
  readStoredCustomGateway,
} from '../utils/gateway';

const LOCAL_GATEWAY_ID = 'local';
const CUSTOM_GATEWAY_ID = 'custom';
const isDevMode = import.meta.env.DEV;
const localStorageKey = 'ipfs-hls-local-gateway';
const localGatewayOption = {
  id: LOCAL_GATEWAY_ID,
  label: 'Local Node',
  desc: 'Dev only: localhost or trusted LAN',
};
const builtInGateways = isDevMode ? [localGatewayOption, ...publicGatewayOptions] : publicGatewayOptions;
const builtInGatewayOrder = Object.fromEntries(builtInGateways.map((gateway, index) => [gateway.id, index]));
const gatewayProbeRefreshMs = 180000;

const props = defineProps({
  currentGateway: { type: String, default: '' },
  currentCid: { type: String, default: '' },
});
const emit = defineEmits(['search', 'gateway-change']);

const searchQuery = ref('');
const settingsOpen = ref(false);
const selectedGatewayId = ref(builtInGateways[0].id);
const localHost = ref('127.0.0.1');
const localPort = ref('8080');
const customGateway = ref('');
const gatewayError = ref('');
const gatewayProbeStates = ref({});
const gatewayCooldownUntilByUrl = ref({});

const localGatewayUrl = computed(() => `http://${localHost.value}:${localPort.value}/ipfs/`);
const customGatewayPreview = computed(() => normalizeGatewayUrl(customGateway.value));
const currentGatewayValue = computed(
  () => normalizeGatewayUrl(props.currentGateway, { allowPrivateHosts: isDevMode }) || props.currentGateway
);
const currentCidValue = computed(() => props.currentCid.trim());
const isCurrentCustomGateway = computed(() => {
  const current = currentGatewayValue.value;
  return Boolean(current) && !builtInGateways.some((gateway) => gatewayUrl(gateway) === current);
});
const orderedBuiltInGateways = computed(() =>
  [...builtInGateways].sort((left, right) => {
    const leftState = probeStateFor(left.id);
    const rightState = probeStateFor(right.id);
    const rankDiff = probeSortRank(leftState) - probeSortRank(rightState);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    if (leftState.state === 'ready' && rightState.state === 'ready') {
      const durationDiff = (leftState.durationMs ?? Number.MAX_SAFE_INTEGER) - (rightState.durationMs ?? Number.MAX_SAFE_INTEGER);
      if (durationDiff !== 0) {
        return durationDiff;
      }
    }

    return (builtInGatewayOrder[left.id] ?? 0) - (builtInGatewayOrder[right.id] ?? 0);
  })
);
const recommendedGatewayId = computed(() => {
  const candidates = [
    ...builtInGateways.map((gateway) => ({
      id: gateway.id,
      probeState: probeStateFor(gateway.id),
      order: builtInGatewayOrder[gateway.id] ?? 0,
    })),
    {
      id: CUSTOM_GATEWAY_ID,
      probeState: probeStateFor(CUSTOM_GATEWAY_ID),
      order: Number.MAX_SAFE_INTEGER,
    },
  ];

  const readyCandidates = candidates.filter(({ probeState }) => probeState.state === 'ready');
  if (!readyCandidates.length) return '';

  readyCandidates.sort((left, right) => {
    const durationDiff = (left.probeState.durationMs ?? Number.MAX_SAFE_INTEGER) - (right.probeState.durationMs ?? Number.MAX_SAFE_INTEGER);
    if (durationDiff !== 0) {
      return durationDiff;
    }

    return left.order - right.order;
  });

  return readyCandidates[0].id;
});
const currentGatewayProbeState = computed(() => {
  const current = currentGatewayValue.value;
  const matchedGateway = builtInGateways.find((gateway) => gatewayUrl(gateway) === current);

  if (matchedGateway) {
    return probeStateFor(matchedGateway.id);
  }

  if (current && current === customGatewayPreview.value) {
    return probeStateFor(CUSTOM_GATEWAY_ID);
  }

  return createIdleProbeState();
});

let gatewayProbeSeq = 0;
let gatewayProbeTimer = null;
let gatewayProbeInterval = null;

watch(
  () => props.currentGateway,
  (next) => {
    if (isDevMode) {
      syncLocalFromGateway(next);
    }

    if (!settingsOpen.value) {
      syncSelectionFromGateway(next);
    }
  },
  { immediate: true }
);

watch(
  () => currentCidValue.value,
  (cid) => {
    gatewayProbeSeq += 1;
    cancelScheduledGatewayProbe();

    if (!cid) {
      stopGatewayProbeLoop();
      resetGatewayProbeStates();
      return;
    }

    startGatewayProbeLoop();
    resetGatewayProbeStates();
    scheduleGatewayProbe(0);
  },
  { immediate: true }
);

watch(
  () => [localGatewayUrl.value, customGatewayPreview.value],
  () => {
    if (!currentCidValue.value) {
      resetGatewayProbeStates();
      return;
    }

    scheduleGatewayProbe();
  }
);

function onSearch() {
  const trimmed = searchQuery.value.trim();
  if (trimmed) {
    emit('search', trimmed);
  }
}

function syncLocalFromGateway(urlStr) {
  if (!isDevMode) return;

  try {
    const parsed = new URL(urlStr);
    if (!normalizeGatewayUrl(parsed.toString(), { allowPrivateHosts: true })) return;
    if (!isPrivateHostname(parsed.hostname)) return;
    localHost.value = parsed.hostname;
    localPort.value = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch (_) {
    // ignore invalid URLs
  }
}

function normalizeLocalHost(value) {
  return value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

function normalizeLocalPort(value) {
  const digits = value.trim().replace(/[^0-9]/g, '');
  return digits || '8080';
}

function gatewayUrl(gateway) {
  return gateway.id === LOCAL_GATEWAY_ID ? localGatewayUrl.value : gateway.url;
}

function openSettings() {
  if (isDevMode) {
    restoreLocalGateway();
    syncLocalFromGateway(props.currentGateway);
  }
  customGateway.value = readStoredCustomGateway(window) || customGateway.value;
  syncSelectionFromGateway(props.currentGateway);
  gatewayError.value = '';
  settingsOpen.value = true;

  if (currentCidValue.value) {
    scheduleGatewayProbe(0);
  }
}

function applyGateway() {
  gatewayError.value = '';

  let nextGateway = '';

  if (selectedGatewayId.value === LOCAL_GATEWAY_ID) {
    if (!isDevMode) {
      selectedGatewayId.value = builtInGateways[0].id;
      nextGateway = gatewayUrl(builtInGateways[0]);
    } else {
      localHost.value = normalizeLocalHost(localHost.value);
      localPort.value = normalizeLocalPort(localPort.value);
      nextGateway = localGatewayUrl.value;
      persistLocalGateway();
    }
  } else if (selectedGatewayId.value === CUSTOM_GATEWAY_ID) {
    nextGateway = normalizeGatewayUrl(customGateway.value);
    if (!nextGateway) {
      gatewayError.value = 'Enter a valid public HTTPS gateway URL that ends with /ipfs/.';
      return;
    }
    customGateway.value = nextGateway;
    persistCustomGateway(nextGateway, window);
  } else {
    const selectedGateway = builtInGateways.find((gateway) => gateway.id === selectedGatewayId.value);
    nextGateway = selectedGateway ? gatewayUrl(selectedGateway) : gatewayUrl(builtInGateways[0]);
  }

  emit('gateway-change', nextGateway);
  settingsOpen.value = false;
}

function syncSelectionFromGateway(urlStr) {
  const normalized = normalizeGatewayUrl(urlStr, { allowPrivateHosts: isDevMode });

  if (!normalized) {
    selectedGatewayId.value = builtInGateways[0].id;
    return;
  }

  const matchedGateway = builtInGateways.find((gateway) => gatewayUrl(gateway) === normalized);
  if (matchedGateway) {
    selectedGatewayId.value = matchedGateway.id;
    return;
  }

  selectedGatewayId.value = CUSTOM_GATEWAY_ID;
  customGateway.value = normalized;
}

function createIdleProbeState(detail = '') {
  return {
    state: 'idle',
    detail: detail || (currentCidValue.value ? '等待檢查 index.m3u8' : '載入 CID 後可檢查'),
    durationMs: null,
    httpStatus: null,
    retryAfterMs: null,
    nextProbeAt: null,
  };
}

function probeStateFor(id) {
  return gatewayProbeStates.value[id] || createIdleProbeState();
}

function setGatewayProbeState(id, state, detail, durationMs = null, extras = {}) {
  gatewayProbeStates.value = {
    ...gatewayProbeStates.value,
    [id]: {
      state,
      detail,
      durationMs,
      httpStatus: null,
      retryAfterMs: null,
      nextProbeAt: null,
      ...extras,
    },
  };
}

function resetGatewayProbeStates() {
  const nextStates = {};
  const now = Date.now();

  builtInGateways.forEach((gateway) => {
    const cooldownUntil = readGatewayCooldown(gatewayUrl(gateway));
    nextStates[gateway.id] =
      currentCidValue.value && cooldownUntil > now
        ? createRateLimitedProbeState(cooldownUntil)
        : createIdleProbeState();
  });

  const customCooldownUntil = readGatewayCooldown(customGatewayPreview.value);
  nextStates[CUSTOM_GATEWAY_ID] =
    currentCidValue.value && customCooldownUntil > now
      ? createRateLimitedProbeState(customCooldownUntil)
      : createIdleProbeState(customGatewayPreview.value ? '等待檢查 index.m3u8' : '輸入 HTTPS gateway 後可檢查');

  gatewayProbeStates.value = nextStates;
}

function scheduleGatewayProbe(delay = 250) {
  cancelScheduledGatewayProbe();
  gatewayProbeTimer = window.setTimeout(() => {
    gatewayProbeTimer = null;
    void runGatewayProbe();
  }, delay);
}

function cancelScheduledGatewayProbe() {
  if (gatewayProbeTimer) {
    clearTimeout(gatewayProbeTimer);
    gatewayProbeTimer = null;
  }
}

function startGatewayProbeLoop() {
  if (gatewayProbeInterval || !currentCidValue.value) return;

  gatewayProbeInterval = window.setInterval(() => {
    void runGatewayProbe();
  }, gatewayProbeRefreshMs);
}

function stopGatewayProbeLoop() {
  if (!gatewayProbeInterval) return;
  clearInterval(gatewayProbeInterval);
  gatewayProbeInterval = null;
}

async function runGatewayProbe() {
  const cid = currentCidValue.value;
  const seq = ++gatewayProbeSeq;
  if (!cid) return;

  const candidates = builtInGateways.map((gateway) => ({
    id: gateway.id,
    url: gatewayUrl(gateway),
  }));

  if (customGatewayPreview.value) {
    candidates.push({
      id: CUSTOM_GATEWAY_ID,
      url: customGatewayPreview.value,
    });
  }

  const now = Date.now();
  const activeCandidates = [];

  candidates.forEach(({ id, url }) => {
    const cooldownUntil = readGatewayCooldown(url);

    if (cooldownUntil > now) {
      setGatewayProbeState(id, 'rate_limited', formatRateLimitedDetail(cooldownUntil), null, {
        httpStatus: 429,
        retryAfterMs: cooldownUntil - now,
        nextProbeAt: cooldownUntil,
      });
      return;
    }

    if (cooldownUntil) {
      clearGatewayCooldown(url);
    }

    setGatewayProbeState(id, 'probing', '正在尋找 index.m3u8');
    activeCandidates.push({ id, url });
  });

  if (!activeCandidates.length) {
    return;
  }

  const results = await Promise.all(
    activeCandidates.map(async ({ id, url }) => ({
      id,
      url,
      result: await probeGatewayAvailability(url, cid),
    }))
  );

  if (seq !== gatewayProbeSeq) return;

  results.forEach(({ id, url, result }) => {
    if (result.state === 'rate_limited') {
      const nextProbeAt = setGatewayCooldown(url, result.retryAfterMs);
      setGatewayProbeState(id, result.state, formatRateLimitedDetail(nextProbeAt), result.durationMs, {
        httpStatus: result.httpStatus,
        retryAfterMs: result.retryAfterMs,
        nextProbeAt,
      });
      return;
    }

    clearGatewayCooldown(url);
    setGatewayProbeState(id, result.state, result.detail, result.durationMs, {
      httpStatus: result.httpStatus,
      retryAfterMs: result.retryAfterMs,
    });
  });
}

function gatewaySignalClass(id) {
  return `is-${probeStateFor(id).state}`;
}

function gatewaySignalText(id) {
  return formatProbeStateText(probeStateFor(id));
}

function formatProbeStateText(probeState) {
  if (probeState.state === 'ready') {
    return probeState.durationMs != null ? `可用 · ${probeState.durationMs} ms` : '可用';
  }

  if (probeState.state === 'probing') {
    return '檢查中';
  }

  if (probeState.state === 'rate_limited') {
    return probeState.detail || '暫時限流';
  }

  if (probeState.state === 'redirected') {
    return probeState.detail || '重新導向';
  }

  return probeState.detail;
}

function isRecommendedGateway(id) {
  return recommendedGatewayId.value === id && probeStateFor(id).state === 'ready';
}

function probeSortRank(probeState) {
  if (probeState.state === 'ready') return 0;
  if (probeState.state === 'probing') return 1;
  if (probeState.state === 'idle') return 2;
  if (probeState.state === 'redirected') return 3;
  if (probeState.state === 'rate_limited') return 4;
  return 5;
}

function createRateLimitedProbeState(nextProbeAt) {
  return {
    state: 'rate_limited',
    detail: formatRateLimitedDetail(nextProbeAt),
    durationMs: null,
    httpStatus: 429,
    retryAfterMs: Math.max(0, nextProbeAt - Date.now()),
    nextProbeAt,
  };
}

function formatRateLimitedDetail(nextProbeAt) {
  const remainingMs = Math.max(0, nextProbeAt - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);

  if (seconds >= 120) {
    return `限流中 · 約 ${Math.ceil(seconds / 60)} 分後重試`;
  }

  if (seconds > 0) {
    return `限流中 · 約 ${seconds} 秒後重試`;
  }

  return '限流中 · 即將重試';
}

function readGatewayCooldown(url) {
  if (!url) return 0;
  return gatewayCooldownUntilByUrl.value[url] ?? 0;
}

function setGatewayCooldown(url, retryAfterMs) {
  if (!url || !(retryAfterMs > 0)) return 0;

  const nextProbeAt = Date.now() + retryAfterMs;
  gatewayCooldownUntilByUrl.value = {
    ...gatewayCooldownUntilByUrl.value,
    [url]: nextProbeAt,
  };

  return nextProbeAt;
}

function clearGatewayCooldown(url) {
  if (!url || !(url in gatewayCooldownUntilByUrl.value)) return;

  const nextCooldowns = { ...gatewayCooldownUntilByUrl.value };
  delete nextCooldowns[url];
  gatewayCooldownUntilByUrl.value = nextCooldowns;
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
  if (isDevMode) {
    restoreLocalGateway();
  }
  customGateway.value = readStoredCustomGateway(window);
  resetGatewayProbeStates();
});

onBeforeUnmount(() => {
  stopGatewayProbeLoop();
  cancelScheduledGatewayProbe();
  gatewayProbeSeq += 1;
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
        <span class="gateway-signal gateway-btn-signal" :class="`is-${currentGatewayProbeState.state}`" aria-hidden="true"></span>
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
        <div class="gateway-current-row">
          <span class="gateway-signal" :class="`is-${currentGatewayProbeState.state}`" aria-hidden="true"></span>
          <span class="value">{{ currentGateway }}</span>
        </div>
        <span class="gateway-status-text">{{ formatProbeStateText(currentGatewayProbeState) }}</span>
      </div>

      <div class="gateway-list">
        <label
          v-for="g in orderedBuiltInGateways"
          :key="g.id"
          class="gateway-option"
          :class="{ selected: selectedGatewayId === g.id }"
        >
          <input type="radio" name="gateway" :value="g.id" v-model="selectedGatewayId" />
          <div class="gateway-meta">
            <div class="gateway-title">
              <span class="gateway-title-main">
                <span class="gateway-signal" :class="gatewaySignalClass(g.id)" aria-hidden="true"></span>
                <span>{{ g.label }}</span>
              </span>
              <span class="gateway-badges">
                <span v-if="isRecommendedGateway(g.id)" class="badge badge-recommended">Recommended</span>
                <span v-if="gatewayUrl(g) === currentGatewayValue" class="badge">Active</span>
              </span>
            </div>
            <div class="gateway-desc">{{ g.desc }}</div>
            <div class="gateway-status-text">{{ gatewaySignalText(g.id) }}</div>
            <div class="gateway-url">{{ gatewayUrl(g) }}</div>
          </div>
          <div class="gateway-check">✓</div>
        </label>
      </div>

      <label class="gateway-option" :class="{ selected: selectedGatewayId === CUSTOM_GATEWAY_ID }">
        <input type="radio" name="gateway" :value="CUSTOM_GATEWAY_ID" v-model="selectedGatewayId" />
        <div class="gateway-meta">
          <div class="gateway-title">
            <span class="gateway-title-main">
              <span class="gateway-signal" :class="gatewaySignalClass(CUSTOM_GATEWAY_ID)" aria-hidden="true"></span>
              <span>Custom Gateway</span>
            </span>
            <span class="gateway-badges">
              <span v-if="isRecommendedGateway(CUSTOM_GATEWAY_ID)" class="badge badge-recommended">Recommended</span>
              <span v-if="isCurrentCustomGateway" class="badge">Active</span>
            </span>
          </div>
          <div class="gateway-desc">Use a public HTTPS gateway that is not in the default list</div>
          <div class="gateway-status-text">{{ gatewaySignalText(CUSTOM_GATEWAY_ID) }}</div>
          <div class="gateway-url">{{ customGatewayPreview || 'https://friend-gateway.example/ipfs/' }}</div>
        </div>
        <div class="gateway-check">✓</div>
      </label>

      <div class="custom-config" :class="{ active: selectedGatewayId === CUSTOM_GATEWAY_ID }">
        <div class="local-title">Custom Public Gateway</div>
        <label for="customGateway">HTTPS Gateway URL</label>
        <input
          id="customGateway"
          type="text"
          v-model="customGateway"
          placeholder="https://friend-gateway.example/ipfs/"
          @focus="selectedGatewayId = CUSTOM_GATEWAY_ID"
          @input="gatewayError = ''"
        />
        <div class="local-preview">
          <span class="label">Preview</span>
          <span class="value">{{ customGatewayPreview || 'https://friend-gateway.example/ipfs/' }}</span>
        </div>
      </div>

      <div v-if="isDevMode" class="local-config">
        <div class="local-title">Local Node Settings</div>
        <div class="local-fields">
          <div class="field">
            <label for="localHost">Host / IP</label>
            <input
              id="localHost"
              type="text"
              v-model="localHost"
              placeholder="127.0.0.1"
              @focus="selectedGatewayId = LOCAL_GATEWAY_ID"
            />
          </div>
          <div class="field">
            <label for="localPort">Port</label>
            <input
              id="localPort"
              type="text"
              v-model="localPort"
              placeholder="8080"
              @focus="selectedGatewayId = LOCAL_GATEWAY_ID"
            />
          </div>
        </div>
        <div class="local-preview">
          <span class="label">Preview</span>
          <span class="value">{{ localGatewayUrl }}</span>
        </div>
      </div>

      <div v-if="gatewayError" class="gateway-error">{{ gatewayError }}</div>

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

.gateway-btn-signal {
  width: 8px;
  height: 8px;
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

.gateway-current-row {
  display: flex;
  align-items: center;
  gap: 10px;
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
  justify-content: space-between;
  font-weight: 600;
}

.gateway-title-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.gateway-badges {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.gateway-desc {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 4px;
}

.gateway-status-text {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.78rem;
  margin-top: 6px;
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

.gateway-signal {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.gateway-signal.is-idle {
  background: #7f8b99;
  box-shadow: 0 0 0 1px rgba(127, 139, 153, 0.25);
}

.gateway-signal.is-probing {
  background: #ffd166;
  box-shadow: 0 0 10px rgba(255, 209, 102, 0.7);
  animation: gateway-pulse 1.1s ease-in-out infinite;
}

.gateway-signal.is-ready {
  background: #38d39f;
  box-shadow: 0 0 12px rgba(56, 211, 159, 0.75);
}

.gateway-signal.is-rate_limited {
  background: #ffb347;
  box-shadow: 0 0 12px rgba(255, 179, 71, 0.72);
}

.gateway-signal.is-redirected {
  background: #7cc8ff;
  box-shadow: 0 0 12px rgba(124, 200, 255, 0.68);
}

.gateway-signal.is-failed {
  background: #ff6b6b;
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.7);
}

.badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 210, 255, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(0, 210, 255, 0.4);
}

.badge-recommended {
  background: rgba(56, 211, 159, 0.14);
  color: #7be7c1;
  border-color: rgba(56, 211, 159, 0.45);
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

.custom-config {
  margin-top: 16px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: rgba(0, 0, 0, 0.25);
  display: grid;
  gap: 10px;
}

.custom-config.active {
  border-color: rgba(0, 210, 255, 0.45);
  box-shadow: 0 0 18px rgba(0, 210, 255, 0.12);
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

.local-config label,
.custom-config label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.local-config input,
.custom-config input {
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

.local-config input:focus,
.custom-config input:focus {
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

.gateway-error {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 107, 129, 0.35);
  background: rgba(255, 107, 129, 0.08);
  color: #ffd0d7;
  font-size: 0.85rem;
}

@keyframes gateway-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
  }
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
  .gateway-status-text {
    font-size: 0.74rem;
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
  .custom-config {
    padding: 10px;
  }
  .local-fields {
    grid-template-columns: 1fr;
  }
  .local-config input,
  .custom-config input {
    padding: 9px 10px;
    font-size: 0.85rem;
  }
  .local-title {
    font-size: 0.9rem;
  }
}
</style>
