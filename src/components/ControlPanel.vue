<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  currentGateway: { type: String, default: 'http://127.0.0.1:8080/ipfs/' }
});
const emit = defineEmits(['gateway-change']);

const localGateway = ref(props.currentGateway);
const settingsOpen = ref(false);

const gateways = [
  { url: 'http://127.0.0.1:8080/ipfs/', label: '本地 (最穩定/測試首選)' },
  { url: 'https://gateway.pinata.cloud/ipfs/', label: 'Pinata (速度快/推薦)' },
  { url: 'https://dweb.link/ipfs/', label: 'DWeb.link (官方推薦)' },
  { url: 'https://ipfs.io/ipfs/', label: 'IPFS.io (標準網關)' },
];

watch(() => props.currentGateway, (newVal) => {
  localGateway.value = newVal;
});

watch(localGateway, (newVal) => {
  emit('gateway-change', newVal);
});
</script>

<template>
  <div class="control-panel">
    <div class="input-row compact">
      <span class="gateway-label">Current Gateway: <span class="highlight">{{ localGateway }}</span></span>
      <button
        class="action-btn settings-btn"
        title="設定"
        @click="settingsOpen = true"
        aria-label="開啟設定"
      >
        <span class="btn-text"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg></span>
        <span class="btn-icon"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg></span>
      </button>
    </div>

    <div v-if="settingsOpen" class="dialog-backdrop" @click.self="settingsOpen = false">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <div class="dialog-header">
          <h3 id="settingsTitle">設定</h3>
          <button class="dialog-close" @click="settingsOpen = false" aria-label="關閉設定">
            ✕
          </button>
        </div>

        <div class="dialog-body">
          <label for="gatewaySelect">選擇網關</label>
          <select id="gatewaySelect" v-model="localGateway">
            <option v-for="g in gateways" :key="g.url" :value="g.url">
              {{ g.label }}
            </option>
          </select>
        </div>

        <div class="dialog-footer">
          <button class="action-btn" @click="settingsOpen = false">完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ControlPanel.css"></style>
