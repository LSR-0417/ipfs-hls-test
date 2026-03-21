<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  isDisabledGatewayInput,
  isPrivateHostname,
  normalizeGatewayUrl,
  persistCustomGateway,
  probeGatewayAvailability,
  publicGatewayOptions,
  readStoredCustomGateway,
} from '../utils/gateway';
import { formatGatewayPlaybackText } from '../utils/gatewayStatus';

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
  currentLoadSequence: { type: Number, default: 0 },
});
const emit = defineEmits(['search', 'gateway-change']);

const searchQuery = ref('');
const isCompactHeader = ref(false);
const settingsOpen = ref(false);
const gatewayButtonRef = ref(null);
const gatewayDialogRef = ref(null);
const selectedGatewayId = ref(builtInGateways[0].id);
const localHost = ref('127.0.0.1');
const localPort = ref('8080');
const customGateway = ref('');
const gatewayError = ref('');
const gatewayProbeStates = ref({});
const gatewayCooldownUntilByUrl = ref({});
const isGatewayProbeRunning = ref(false);
const lastFocusedGatewayTrigger = ref(null);

const localGatewayUrl = computed(() => `http://${localHost.value}:${localPort.value}/ipfs/`);
const customGatewayPreview = computed(() => normalizeGatewayUrl(customGateway.value));
const currentGatewayValue = computed(
  () => normalizeGatewayUrl(props.currentGateway, { allowPrivateHosts: isDevMode }) || props.currentGateway
);
const currentCidValue = computed(() => props.currentCid.trim());
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
const gatewaySelectionCaption = computed(() =>
  currentCidValue.value ? 'Fastest healthy gateway appears first.' : 'Choose a gateway now, or load a CID to compare health.'
);
const selectedGatewayValue = computed(() => {
  if (selectedGatewayId.value === LOCAL_GATEWAY_ID) {
    return isDevMode ? localGatewayUrl.value : gatewayUrl(builtInGateways[0]);
  }

  if (selectedGatewayId.value === CUSTOM_GATEWAY_ID) {
    return customGatewayPreview.value;
  }

  const selectedGateway = builtInGateways.find((gateway) => gateway.id === selectedGatewayId.value);
  return selectedGateway ? gatewayUrl(selectedGateway) : '';
});
const currentGatewayName = computed(() => {
  const current = currentGatewayValue.value;
  if (!current) return 'Not set';

  const matchedGateway = builtInGateways.find((gateway) => gatewayUrl(gateway) === current);
  if (matchedGateway) {
    return matchedGateway.label;
  }

  try {
    const parsed = new URL(current);
    return parsed.hostname || parsed.host || 'Custom Gateway';
  } catch (_) {
    return 'Custom Gateway';
  }
});
const searchPlaceholder = computed(() => (isCompactHeader.value ? 'Search CID' : 'Search IPFS CID (e.g. Qm...)'));
const currentGatewayId = computed(() => {
  const current = currentGatewayValue.value;
  if (!current) return '';

  const matchedGateway = builtInGateways.find((gateway) => gatewayUrl(gateway) === current);
  if (matchedGateway) {
    return matchedGateway.id;
  }

  return CUSTOM_GATEWAY_ID;
});
const selectedGatewayName = computed(() => {
  if (selectedGatewayId.value === CUSTOM_GATEWAY_ID) {
    const preview = customGatewayPreview.value;
    if (!preview) return 'Custom Gateway';

    try {
      const parsed = new URL(preview);
      return parsed.hostname || parsed.host || 'Custom Gateway';
    } catch (_) {
      return 'Custom Gateway';
    }
  }

  const selectedGateway = builtInGateways.find((gateway) => gateway.id === selectedGatewayId.value);
  return selectedGateway?.label || builtInGateways[0]?.label || 'Gateway';
});
const hasPendingGatewayChange = computed(() => {
  const selected = selectedGatewayValue.value;
  const current = currentGatewayValue.value;

  if (selected && selected !== current) return true;

  return selectedGatewayId.value !== currentGatewayId.value;
});
const gatewayChangeSummary = computed(() => {
  if (!hasPendingGatewayChange.value) return '';

  if (!currentGatewayValue.value) {
    return `Use ${selectedGatewayName.value}`;
  }

  return `Switch from ${currentGatewayName.value} to ${selectedGatewayName.value}`;
});
const currentGatewayKind = computed(() => {
  const current = currentGatewayValue.value;
  if (!current) return 'public';

  const matchedGateway = builtInGateways.find((gateway) => gatewayUrl(gateway) === current);
  if (matchedGateway) {
    return matchedGateway.id === LOCAL_GATEWAY_ID ? 'local' : 'public';
  }

  try {
    const parsed = new URL(current);
    return isPrivateHostname(parsed.hostname) ? 'local' : 'custom';
  } catch (_) {
    return 'custom';
  }
});
const currentGatewayIconPath = computed(() => {
  if (currentGatewayKind.value === 'local') {
    return 'M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v5.5A2.75 2.75 0 0 1 17.25 14H13.5v2H15a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h1.5v-2H6.75A2.75 2.75 0 0 1 4 11.25Zm2.75-.75A.75.75 0 0 0 6 5.75v5.5c0 .41.34.75.75.75h10.5a.75.75 0 0 0 .75-.75v-5.5a.75.75 0 0 0-.75-.75Zm9.75 2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z';
  }

  if (currentGatewayKind.value === 'custom') {
    return 'M14.75 5A3.25 3.25 0 0 1 18 8.25v1a1 1 0 1 1-2 0v-1A1.25 1.25 0 0 0 14.75 7H13a1 1 0 1 1 0-2ZM9 7a1 1 0 0 1 0 2H7.25A1.25 1.25 0 0 0 6 10.25v5.5A1.25 1.25 0 0 0 7.25 17H9a1 1 0 1 1 0 2H7.25A3.25 3.25 0 0 1 4 15.75v-5.5A3.25 3.25 0 0 1 7.25 7Zm7.03 3.22a1 1 0 0 1 0 1.41l-3.4 3.4a3 3 0 0 1-4.24 0 1 1 0 0 1 1.41-1.41 1 1 0 0 0 1.42 0l3.4-3.4a1 1 0 0 1 1.41 0Zm-1.83-2.83a3 3 0 0 1 4.24 0 1 1 0 0 1-1.41 1.41 1 1 0 0 0-1.42 0l-3.4 3.4a1 1 0 0 1-1.41-1.41Z';
  }

  return 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm6.92 8h-3.1a14.9 14.9 0 0 0-1.14-4.33A7.02 7.02 0 0 1 18.92 11ZM12 5c.82 0 2.17 2.07 2.72 6H9.28C9.83 7.07 11.18 5 12 5ZM9.32 6.67A14.9 14.9 0 0 0 8.18 11h-3.1a7.02 7.02 0 0 1 4.24-4.33ZM5.08 13h3.1a14.9 14.9 0 0 0 1.14 4.33A7.02 7.02 0 0 1 5.08 13ZM12 19c-.82 0-2.17-2.07-2.72-6h5.44C14.17 16.93 12.82 19 12 19Zm2.68-1.67A14.9 14.9 0 0 0 15.82 13h3.1a7.02 7.02 0 0 1-4.24 4.33Z';
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

watch(settingsOpen, async (isOpen) => {
  if (typeof document === 'undefined') return;

  if (isOpen) {
    lastFocusedGatewayTrigger.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    gatewayDialogRef.value?.focus();
    document.addEventListener('keydown', handleGatewayDialogKeydown);
    return;
  }

  document.removeEventListener('keydown', handleGatewayDialogKeydown);
  await nextTick();

  const nextFocusTarget = gatewayButtonRef.value || lastFocusedGatewayTrigger.value;
  if (nextFocusTarget && typeof nextFocusTarget.focus === 'function') {
    nextFocusTarget.focus();
  }
});

watch(
  () => [currentCidValue.value, props.currentLoadSequence],
  ([cid]) => {
    gatewayProbeSeq += 1;
    isGatewayProbeRunning.value = false;
    cancelScheduledGatewayProbe();

    if (!cid) {
      stopGatewayProbeLoop();
      resetGatewayProbeStates();
      return;
    }

    restartGatewayProbeLoop();
    resetGatewayProbeStates();
    scheduleGatewayProbe(0);
  },
  { immediate: true }
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

function formatGatewayEndpoint(urlStr) {
  if (!urlStr) return '';

  try {
    const parsed = new URL(urlStr);
    return `${parsed.host}${parsed.pathname}`;
  } catch (_) {
    return urlStr.replace(/^https?:\/\//, '');
  }
}

function openSettings() {
  if (isDevMode) {
    restoreLocalGateway();
    syncLocalFromGateway(props.currentGateway);
  }
  customGateway.value = readStoredCustomGateway(window) || customGateway.value;
  if (isDisabledGatewayInput(customGateway.value)) {
    customGateway.value = '';
    persistCustomGateway('', window);
  }
  syncSelectionFromGateway(props.currentGateway);
  gatewayError.value = '';
  settingsOpen.value = true;
}

function closeSettings() {
  settingsOpen.value = false;
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
    if (isDisabledGatewayInput(customGateway.value)) {
      gatewayError.value = 'Pinata gateway has been removed. Please choose another gateway.';
      return;
    }
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
  closeSettings();
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
    detail: detail || (currentCidValue.value ? '等待檢查播放清單與媒體片段' : '載入 CID 後可檢查'),
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
      : createIdleProbeState(customGatewayPreview.value ? '等待檢查播放清單與媒體片段' : '輸入 HTTPS gateway 後可檢查');

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

function restartGatewayProbeLoop() {
  stopGatewayProbeLoop();
  startGatewayProbeLoop();
}

function stopGatewayProbeLoop() {
  if (!gatewayProbeInterval) return;
  clearInterval(gatewayProbeInterval);
  gatewayProbeInterval = null;
}

async function runGatewayProbe() {
  const cid = currentCidValue.value;
  const seq = ++gatewayProbeSeq;
  if (!cid) {
    isGatewayProbeRunning.value = false;
    return;
  }

  isGatewayProbeRunning.value = true;

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

    setGatewayProbeState(id, 'probing', '正在驗證播放清單與片段');
    activeCandidates.push({ id, url });
  });

  if (!activeCandidates.length) {
    if (seq === gatewayProbeSeq) {
      isGatewayProbeRunning.value = false;
    }
    return;
  }

  try {
    const results = await Promise.all(
      activeCandidates.map(async ({ id, url }) => ({
        id,
        url,
        result: await probeGatewayAvailability(url, cid, {
          onProgress(progressState) {
            if (seq !== gatewayProbeSeq) return;

            setGatewayProbeState(id, progressState.state, progressState.detail, progressState.durationMs, {
              httpStatus: progressState.httpStatus,
              retryAfterMs: progressState.retryAfterMs,
              nextProbeAt: progressState.nextProbeAt ?? null,
            });
          },
        }),
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
  } finally {
    if (seq === gatewayProbeSeq) {
      isGatewayProbeRunning.value = false;
    }
  }
}

function forceGatewayProbe() {
  if (!currentCidValue.value || isGatewayProbeRunning.value) return;

  cancelScheduledGatewayProbe();
  restartGatewayProbeLoop();
  void runGatewayProbe();
}

function gatewaySignalClass(id) {
  return `is-${probeStateFor(id).state}`;
}

function gatewaySignalText(id) {
  return formatProbeStateText(probeStateFor(id));
}

function formatProbeStateText(probeState) {
  return formatGatewayPlaybackText(probeState);
}

function isRecommendedGateway(id) {
  return recommendedGatewayId.value === id && probeStateFor(id).state === 'ready';
}

function getGatewayDialogFocusableElements() {
  if (!gatewayDialogRef.value) return [];

  return Array.from(
    gatewayDialogRef.value.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

function handleGatewayDialogKeydown(event) {
  if (!settingsOpen.value) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeSettings();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusableElements = getGatewayDialogFocusableElements();
  if (!focusableElements.length) {
    event.preventDefault();
    gatewayDialogRef.value?.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey) {
    if (activeElement === firstElement || !gatewayDialogRef.value?.contains(activeElement)) {
      event.preventDefault();
      lastElement.focus();
    }
    return;
  }

  if (activeElement === lastElement || !gatewayDialogRef.value?.contains(activeElement)) {
    event.preventDefault();
    firstElement.focus();
  }
}

function probeSortRank(probeState) {
  if (probeState.state === 'ready') return 0;
  if (probeState.state === 'playlist_ready') return 1;
  if (probeState.state === 'probing') return 2;
  if (probeState.state === 'degraded') return 3;
  if (probeState.state === 'idle') return 4;
  if (probeState.state === 'redirected') return 5;
  if (probeState.state === 'rate_limited') return 6;
  return 7;
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

function syncCompactHeaderViewport() {
  if (typeof window === 'undefined') return;
  isCompactHeader.value = window.innerWidth <= 480;
}

onMounted(() => {
  syncCompactHeaderViewport();
  window.addEventListener('resize', syncCompactHeaderViewport);
  if (isDevMode) {
    restoreLocalGateway();
  }
  customGateway.value = readStoredCustomGateway(window);
  if (isDisabledGatewayInput(customGateway.value)) {
    customGateway.value = '';
    persistCustomGateway('', window);
  }
  resetGatewayProbeStates();
});

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', handleGatewayDialogKeydown);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncCompactHeaderViewport);
  }
  stopGatewayProbeLoop();
  cancelScheduledGatewayProbe();
  isGatewayProbeRunning.value = false;
  gatewayProbeSeq += 1;
});
</script>

<template>
  <header class="header glass-panel" data-testid="app-header">
    <div class="logo-area" data-testid="header-logo-area">
      <div class="hamburger">
        <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
      </div>
      <div class="logo">
        <span class="logo-icon">▲</span>
        <span class="logo-text">Astra<span class="neon-text">Stream</span></span>
      </div>
    </div>

    <div class="search-area" data-testid="header-search-area">
      <div class="search-bar" data-testid="header-search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input 
          type="text" 
          v-model="searchQuery" 
          :placeholder="searchPlaceholder"
          @keyup.enter="onSearch"
        />
        <button class="icon-btn search-submit-btn" @click="onSearch" aria-label="Search">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M22 12l-4-4v3H3v2h15v3z"/></svg>
        </button>
      </div>
    </div>

    <div class="actions-area" data-testid="header-actions-area">
      <button
        ref="gatewayButtonRef"
        type="button"
        class="action-btn gateway-btn"
        @click="openSettings"
        aria-haspopup="dialog"
        :aria-expanded="settingsOpen ? 'true' : 'false'"
        :aria-label="`Switch gateway. Current gateway: ${currentGatewayName}`"
        :title="currentGatewayValue || currentGatewayName"
        data-testid="gateway-button"
      >
        <span class="action-btn-visual gateway-btn-visual" :class="`is-${currentGatewayKind}`" aria-hidden="true">
          <span class="gateway-btn-status-ring" :class="`is-${currentGatewayProbeState.state}`"></span>
          <svg class="gateway-btn-icon" viewBox="0 0 24 24">
            <path fill="currentColor" :d="currentGatewayIconPath" />
          </svg>
        </span>
        <span class="action-btn-copy">
          <span class="action-btn-label">Gateway</span>
          <span class="action-btn-title">{{ currentGatewayName }}</span>
        </span>
      </button>
      <button
        type="button"
        class="action-btn account-btn"
        aria-label="Sign in to your account"
        title="Sign in"
        data-testid="account-button"
      >
        <span class="action-btn-visual account-btn-visual" aria-hidden="true">
          <svg class="account-btn-icon" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5z"
            />
          </svg>
        </span>
        <span class="action-btn-copy">
          <span class="action-btn-label">Account</span>
          <span class="action-btn-title">Sign In</span>
        </span>
      </button>
    </div>
  </header>

  <div v-if="settingsOpen" class="gateway-backdrop" data-testid="gateway-backdrop" @click.self="closeSettings()">
    <div
      ref="gatewayDialogRef"
      class="gateway-dialog gateway-dialog--form"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gatewayTitle"
      aria-describedby="gatewaySubtitle"
      tabindex="-1"
      data-testid="gateway-dialog"
    >
      <div class="gateway-header">
        <div class="gateway-header-copy">
          <h3 id="gatewayTitle">Switch Gateway</h3>
          <p id="gatewaySubtitle" class="gateway-subtitle">
            Choose the best route to your IPFS content without leaving the current session.
          </p>
        </div>
      </div>

      <div class="gateway-dialog-body" data-testid="gateway-dialog-body">
        <section class="gateway-section">
          <div class="gateway-section-header">
            <div class="gateway-section-heading">
              <h4>Available Gateways</h4>
              <p class="gateway-section-caption">{{ gatewaySelectionCaption }}</p>
            </div>
            <button class="ghost-btn gateway-refresh-btn" :disabled="!currentCidValue || isGatewayProbeRunning" @click="forceGatewayProbe">
              {{ isGatewayProbeRunning ? 'Checking...' : 'Recheck Now' }}
            </button>
          </div>

          <div class="gateway-list">
            <label
              v-for="g in orderedBuiltInGateways"
              :key="g.id"
              class="gateway-option"
              :class="{ selected: selectedGatewayId === g.id, current: currentGatewayId === g.id }"
              :data-testid="`gateway-option-${g.id}`"
              :title="gatewayUrl(g)"
            >
              <input type="radio" name="gateway" :value="g.id" v-model="selectedGatewayId" />
              <span class="gateway-selector" aria-hidden="true">
                <span class="gateway-selector-dot"></span>
              </span>
              <div class="gateway-option-main">
                <div class="gateway-option-header">
                  <span class="gateway-title-main">
                    <span class="gateway-signal" :class="gatewaySignalClass(g.id)" aria-hidden="true"></span>
                    <span>{{ g.label }}</span>
                  </span>
                  <span class="gateway-badges">
                    <span
                      v-if="currentGatewayId === g.id && selectedGatewayId === g.id"
                      class="badge badge-current-selection"
                    >
                      Current Selection
                    </span>
                    <template v-else>
                      <span v-if="selectedGatewayId === g.id" class="badge badge-selected">Selected</span>
                      <span v-if="currentGatewayId === g.id" class="badge badge-current">Current</span>
                    </template>
                    <span v-if="isRecommendedGateway(g.id)" class="badge badge-recommended">Recommended</span>
                  </span>
                </div>
                <div class="gateway-desc">{{ g.desc }}</div>
                <div class="gateway-meta-row">
                  <div class="gateway-endpoint">{{ formatGatewayEndpoint(gatewayUrl(g)) }}</div>
                  <div class="gateway-status-text">{{ gatewaySignalText(g.id) }}</div>
                </div>
              </div>
            </label>

            <label
              class="gateway-option"
              :class="{ selected: selectedGatewayId === CUSTOM_GATEWAY_ID, current: currentGatewayId === CUSTOM_GATEWAY_ID }"
              data-testid="gateway-option-custom"
              :title="customGatewayPreview || 'https://friend-gateway.example/ipfs/'"
            >
              <input type="radio" name="gateway" :value="CUSTOM_GATEWAY_ID" v-model="selectedGatewayId" />
              <span class="gateway-selector" aria-hidden="true">
                <span class="gateway-selector-dot"></span>
              </span>
              <div class="gateway-option-main">
                <div class="gateway-option-header">
                  <span class="gateway-title-main">
                    <span class="gateway-signal" :class="gatewaySignalClass(CUSTOM_GATEWAY_ID)" aria-hidden="true"></span>
                    <span>Custom Gateway</span>
                  </span>
                  <span class="gateway-badges">
                    <span
                      v-if="currentGatewayId === CUSTOM_GATEWAY_ID && selectedGatewayId === CUSTOM_GATEWAY_ID"
                      class="badge badge-current-selection"
                    >
                      Current Selection
                    </span>
                    <template v-else>
                      <span v-if="selectedGatewayId === CUSTOM_GATEWAY_ID" class="badge badge-selected">Selected</span>
                      <span v-if="currentGatewayId === CUSTOM_GATEWAY_ID" class="badge badge-current">Current</span>
                    </template>
                    <span v-if="isRecommendedGateway(CUSTOM_GATEWAY_ID)" class="badge badge-recommended">Recommended</span>
                  </span>
                </div>
                <div class="gateway-desc">Use a public HTTPS gateway that is not in the default list</div>
                <div class="gateway-meta-row">
                  <div class="gateway-endpoint">
                    {{ formatGatewayEndpoint(customGatewayPreview) || 'friend-gateway.example/ipfs/' }}
                  </div>
                  <div class="gateway-status-text">{{ gatewaySignalText(CUSTOM_GATEWAY_ID) }}</div>
                </div>
              </div>
            </label>
          </div>
        </section>

        <section
          v-if="selectedGatewayId === CUSTOM_GATEWAY_ID"
          class="gateway-section"
          data-testid="gateway-custom-config"
        >
          <div class="gateway-section-header">
            <div>
              <h4>Custom Gateway</h4>
              <p class="gateway-section-caption">Public HTTPS gateway only.</p>
            </div>
          </div>

          <div class="custom-config active">
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
        </section>

        <section
          v-if="isDevMode && selectedGatewayId === LOCAL_GATEWAY_ID"
          class="gateway-section"
          data-testid="gateway-local-config"
        >
          <div class="gateway-section-header">
            <div>
              <h4>Local Node Settings</h4>
              <p class="gateway-section-caption">Only shown when the local gateway is selected.</p>
            </div>
          </div>

          <div class="local-config">
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
        </section>

        <div v-if="gatewayError" class="gateway-error" role="status" aria-live="assertive">
          {{ gatewayError }}
        </div>
      </div>

      <div class="gateway-footer" data-testid="gateway-dialog-footer">
        <div v-if="hasPendingGatewayChange" class="gateway-transition-note" data-testid="gateway-transition-note">
          {{ gatewayChangeSummary }}
        </div>
        <button class="ghost-btn" @click="closeSettings()">Cancel</button>
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
  gap: 6px;
  width: auto;
  flex: 0 0 auto;
  min-width: 0;
  justify-content: flex-end;
}

.action-btn {
  position: relative;
  overflow: hidden;
  min-height: 46px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid transparent;
  border-radius: 16px;
  padding: 6px 8px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    background 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
  box-shadow: none;
}

.action-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
  transform: translateY(-1px);
}

.action-btn:hover::before,
.action-btn:focus-visible::before {
  opacity: 1;
}

.action-btn:focus-visible {
  outline: none;
  background: rgba(255, 255, 255, 0.045);
  border-color: rgba(162, 82, 255, 0.26);
  box-shadow:
    0 0 0 1px rgba(162, 82, 255, 0.18),
    0 0 0 4px rgba(162, 82, 255, 0.08);
}

.gateway-btn {
  flex: 0 1 196px;
  width: auto;
  max-width: 196px;
}

.action-btn-visual {
  position: relative;
  z-index: 1;
  --action-chip-radius: 12px;
  width: 34px;
  height: 34px;
  border-radius: var(--action-chip-radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.gateway-btn-visual.is-local {
  color: rgba(120, 233, 196, 0.92);
  background: rgba(56, 211, 159, 0.09);
}

.gateway-btn-visual.is-public {
  color: rgba(164, 228, 255, 0.9);
  background: rgba(0, 210, 255, 0.08);
}

.gateway-btn-visual.is-custom {
  color: rgba(221, 193, 255, 0.92);
  background: rgba(162, 82, 255, 0.09);
}

.gateway-btn-icon {
  position: relative;
  z-index: 1;
  width: 18px;
  height: 18px;
  transform-origin: center;
  transition: transform 0.22s ease;
}

.gateway-btn-visual.is-local .gateway-btn-icon {
  transform: scale(1.14);
}

.gateway-btn-visual.is-public .gateway-btn-icon {
  transform: scale(1.06);
}

.gateway-btn-visual.is-custom .gateway-btn-icon {
  transform: scale(1.1);
}

.gateway-btn-status-ring {
  position: absolute;
  inset: 1px;
  border-radius: calc(var(--action-chip-radius) - 1px);
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  opacity: 0.72;
  transition: box-shadow 0.22s ease, opacity 0.22s ease;
}

.gateway-btn-status-ring.is-idle {
  box-shadow: inset 0 0 0 1px rgba(127, 139, 153, 0.24);
  opacity: 0.52;
}

.gateway-btn-status-ring.is-probing {
  box-shadow: inset 0 0 0 1px rgba(255, 209, 102, 0.76);
  animation: gateway-ring-pulse 1.1s ease-in-out infinite;
}

.gateway-btn-status-ring.is-playlist_ready {
  box-shadow: inset 0 0 0 1px rgba(255, 209, 102, 0.7);
}

.gateway-btn-status-ring.is-ready {
  box-shadow: inset 0 0 0 1px rgba(56, 211, 159, 0.78);
}

.gateway-btn-status-ring.is-degraded {
  box-shadow: inset 0 0 0 1px rgba(255, 159, 67, 0.76);
}

.gateway-btn-status-ring.is-rate_limited {
  box-shadow: inset 0 0 0 1px rgba(255, 179, 71, 0.74);
}

.gateway-btn-status-ring.is-redirected {
  box-shadow: inset 0 0 0 1px rgba(124, 200, 255, 0.72);
}

.gateway-btn-status-ring.is-failed {
  box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.8);
}

.action-btn-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 2px;
  flex: 1;
  width: 100%;
  min-width: 0;
}

.action-btn-label {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.62rem;
  letter-spacing: 0.09em;
  line-height: 1;
  text-transform: uppercase;
}

.action-btn-title {
  display: block;
  width: 100%;
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgba(255, 255, 255, 0.9);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-btn {
  flex: 0 1 152px;
  width: auto;
  max-width: 152px;
}

.account-btn-visual {
  color: rgba(214, 238, 255, 0.92);
  background: linear-gradient(135deg, rgba(0, 210, 255, 0.12), rgba(162, 82, 255, 0.16));
  border-color: rgba(160, 214, 255, 0.18);
}

.account-btn-icon {
  width: 18px;
  height: 18px;
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
    gap: 4px;
  }
  .actions-area .icon-btn,
  .account-btn {
    display: none;
  }
  .gateway-btn {
    width: auto;
    min-width: 0;
    max-width: 152px;
    padding: 4px 6px;
  }
  .action-btn-title {
    font-size: 0.88rem;
  }
}
@media (max-width: 480px) {
  .header {
    padding: 0 12px;
  }
  .logo-area {
    gap: 10px;
  }
  .hamburger {
    padding: 6px;
  }
  .logo-text {
    display: none; /* Only show logo icon on tiny screens */
  }
  .search-area {
    margin: 0 6px;
  }
  .search-bar {
    padding: 6px 10px;
  }
  .search-bar input {
    font-size: 0.85rem;
  }
  .search-submit-btn {
    margin-left: 4px;
  }
  .gateway-btn {
    flex: 0 0 46px;
    width: 46px;
    max-width: 46px;
    gap: 0;
    padding: 0;
    justify-content: center;
  }
  .gateway-btn .action-btn-copy {
    display: none;
  }
  .action-btn-visual {
    --action-chip-radius: 10px;
    width: 30px;
    height: 30px;
    border-radius: var(--action-chip-radius);
  }
  .gateway-btn-icon {
    width: 16px;
    height: 16px;
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
  padding: 24px;
  z-index: 200;
}

.gateway-dialog {
  width: min(640px, calc(100vw - 48px));
  max-height: min(84dvh, 960px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: rgba(16, 18, 32, 0.94);
  border: 1px solid var(--panel-border);
  border-radius: 24px;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  color: var(--text-primary);
}

.gateway-dialog:focus {
  outline: none;
}

.gateway-header {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--panel-border);
}

.gateway-header-copy {
  min-width: 0;
  max-width: 48ch;
}

.gateway-header h3 {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.15;
}

.gateway-subtitle {
  color: var(--text-secondary);
  font-size: 0.92rem;
  margin-top: 6px;
  line-height: 1.5;
}

.gateway-summary-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.gateway-endpoint {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.gateway-refresh-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.gateway-dialog-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 24px 24px;
  display: grid;
  gap: 20px;
}

.gateway-section {
  display: grid;
  gap: 12px;
}

.gateway-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.gateway-section-heading {
  min-width: 0;
}

.gateway-section h4 {
  margin: 0;
  font-size: 0.96rem;
  line-height: 1.2;
}

.gateway-section-caption {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 0.82rem;
  line-height: 1.45;
}

.gateway-list {
  display: grid;
  gap: 12px;
}

.gateway-option {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.gateway-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.gateway-option:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
}

.gateway-option.current {
  border-color: rgba(0, 210, 255, 0.42);
  background:
    linear-gradient(180deg, rgba(0, 210, 255, 0.1), rgba(0, 210, 255, 0.04)),
    rgba(255, 255, 255, 0.035);
  box-shadow:
    inset 4px 0 0 rgba(0, 210, 255, 0.9),
    0 0 0 1px rgba(0, 210, 255, 0.14),
    0 0 22px rgba(0, 210, 255, 0.14);
}

.gateway-selector {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.gateway-selector-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: transparent;
  opacity: 0;
  transform: scale(0.5);
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

.gateway-option.selected .gateway-selector {
  border-color: rgba(0, 210, 255, 0.72);
  background: rgba(0, 210, 255, 0.14);
  box-shadow: 0 0 0 4px rgba(0, 210, 255, 0.08);
}

.gateway-option.selected .gateway-selector-dot {
  background: var(--accent-cyan);
  opacity: 1;
  transform: scale(1);
}

.gateway-option-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.gateway-option-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 12px;
  flex-wrap: wrap;
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
  line-height: 1.45;
}

.gateway-meta-row {
  display: grid;
  gap: 6px;
}

.gateway-status-text {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.8rem;
  line-height: 1.45;
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

.gateway-signal.is-playlist_ready {
  background: #ffd166;
  box-shadow: 0 0 12px rgba(255, 209, 102, 0.72);
}

.gateway-signal.is-ready {
  background: #38d39f;
  box-shadow: 0 0 12px rgba(56, 211, 159, 0.75);
}

.gateway-signal.is-degraded {
  background: #ff9f43;
  box-shadow: 0 0 12px rgba(255, 159, 67, 0.72);
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

.badge-current {
  background: rgba(0, 210, 255, 0.16);
  color: #b7f4ff;
  border-color: rgba(0, 210, 255, 0.44);
}

.badge-selected {
  background: rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.22);
}

.badge-current-selection {
  background: linear-gradient(135deg, rgba(0, 210, 255, 0.22), rgba(255, 255, 255, 0.12));
  color: #f5fdff;
  border-color: rgba(0, 210, 255, 0.5);
}

.gateway-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
  border-top: 1px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(16, 18, 32, 0.72), rgba(16, 18, 32, 0.98));
}

.gateway-transition-note {
  flex: 1 0 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(0, 210, 255, 0.18);
  background: rgba(0, 210, 255, 0.08);
  color: rgba(228, 250, 255, 0.9);
  font-size: 0.82rem;
  line-height: 1.45;
}

.ghost-btn,
.primary-btn {
  border-radius: 12px;
  min-height: 44px;
  padding: 11px 18px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.ghost-btn {
  background: transparent;
  min-width: 124px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-secondary);
}

.ghost-btn:hover {
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.4);
}

.ghost-btn:disabled,
.primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}

.primary-btn {
  background: rgba(0, 210, 255, 0.18);
  min-width: 148px;
  border: 1px solid rgba(0, 210, 255, 0.4);
  color: var(--text-primary);
}

.primary-btn:hover {
  box-shadow: 0 0 18px rgba(0, 210, 255, 0.25);
}

.ghost-btn:focus-visible,
.primary-btn:focus-visible,
.gateway-option:focus-within,
.local-config input:focus-visible,
.custom-config input:focus-visible {
  outline: 2px solid rgba(0, 210, 255, 0.65);
  outline-offset: 2px;
}

.local-config {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--panel-border);
  background: rgba(0, 0, 0, 0.24);
  display: grid;
  gap: 12px;
}

.custom-config {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--panel-border);
  background: rgba(0, 0, 0, 0.24);
  display: grid;
  gap: 12px;
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

@keyframes gateway-ring-pulse {
  0%,
  100% {
    box-shadow: inset 0 0 0 1px rgba(255, 209, 102, 0.58);
    opacity: 0.62;
  }
  50% {
    box-shadow: inset 0 0 0 1.5px rgba(255, 209, 102, 0.88);
    opacity: 0.9;
  }
}

@media (max-width: 768px) {
  .gateway-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .gateway-dialog {
    width: 100%;
    max-height: min(92dvh, 100dvh);
    border-radius: 24px 24px 0 0;
  }

  .gateway-header {
    align-items: flex-start;
    padding: 18px 16px 14px;
  }

  .gateway-header h3 {
    font-size: 1.18rem;
  }

  .gateway-subtitle {
    font-size: 0.82rem;
  }

  .gateway-dialog-body {
    padding: 14px 16px 18px;
    gap: 16px;
  }

  .gateway-option {
    grid-template-columns: auto 1fr;
    gap: 10px;
    padding: 14px 12px;
  }

  .gateway-option-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .gateway-title-main {
    font-size: 0.95rem;
  }

  .gateway-status-text {
    font-size: 0.74rem;
  }

  .gateway-desc {
    font-size: 0.8rem;
  }

  .gateway-endpoint {
    font-size: 0.72rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gateway-footer {
    flex-direction: row;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
  }

  .gateway-transition-note {
    font-size: 0.78rem;
  }

  .ghost-btn,
  .primary-btn {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    justify-content: center;
    padding: 12px 14px;
    font-size: 0.9rem;
  }

  .local-config {
    padding: 12px;
  }

  .custom-config {
    padding: 12px;
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
