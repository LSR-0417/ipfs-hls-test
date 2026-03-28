<script setup>
import { computed } from 'vue';
import { formatCapabilityStatusText, formatEnvironmentStateLabel } from '../utils/environmentCheck';

const props = defineProps({
  state: {
    type: Object,
    required: true,
  },
  targetHost: {
    type: String,
    default: '127.0.0.1',
  },
  targetPort: {
    type: String,
    default: '8080',
  },
  apiHost: {
    type: String,
    default: '',
  },
  apiPort: {
    type: String,
    default: '',
  },
  apiBase: {
    type: String,
    default: '/api',
  },
  apiModeLabel: {
    type: String,
    default: '前端代理',
  },
  isRunning: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['refresh', 'update:apiHost', 'update:apiPort']);

const actionLabel = computed(() => (props.state?.checkedAt ? '重新檢測' : '環境檢測'));
const hasCapabilities = computed(() => Array.isArray(props.state?.capabilities) && props.state.capabilities.length > 0);
const statusLabel = computed(() => formatEnvironmentStateLabel(props.state?.status));
const targetEndpoint = computed(() => `${props.targetHost}:${props.targetPort}`);
const gatewayBaseUrl = computed(() => `http://${props.targetHost}:${props.targetPort}/`);

function onRefresh() {
  emit('refresh');
}

function onApiHostInput(event) {
  emit('update:apiHost', event?.target?.value || '');
}

function onApiPortInput(event) {
  emit('update:apiPort', event?.target?.value || '');
}
</script>

<template>
  <div class="environment-panel" data-testid="local-environment-panel">
    <div class="environment-panel-header">
      <div>
        <div class="environment-title">本機環境檢測</div>
        <p class="environment-caption">透過本機 Node.js backend 檢查必要工具與本地 IPFS gateway 是否可用。</p>
      </div>
      <button
        type="button"
        class="environment-refresh-btn"
        :disabled="isRunning"
        data-testid="local-environment-refresh"
        @click="onRefresh"
      >
        {{ actionLabel }}
      </button>
    </div>

    <div class="environment-api-config">
      <div class="environment-field">
        <label for="localEnvironmentApiHost">檢測 API Host / IP</label>
        <input
          id="localEnvironmentApiHost"
          type="text"
          :value="apiHost"
          placeholder="留空時使用前端 /api proxy"
          data-testid="local-environment-api-host"
          @input="onApiHostInput"
        />
      </div>
      <div class="environment-field">
        <label for="localEnvironmentApiPort">檢測 API Port</label>
        <input
          id="localEnvironmentApiPort"
          type="text"
          :value="apiPort"
          placeholder="8787"
          data-testid="local-environment-api-port"
          @input="onApiPortInput"
        />
      </div>
    </div>

    <p class="environment-config-hint">
      留空時使用前端 `/api` proxy；若環境檢測 backend 跑在隨機 port，可在這裡指定。
    </p>

    <div class="environment-meta-grid">
      <div class="environment-meta-card">
        <span class="label">檢測目標</span>
        <span class="value">{{ targetEndpoint }}</span>
      </div>
      <div class="environment-meta-card">
        <span class="label">檢測 API</span>
        <span class="value">{{ apiBase }}</span>
      </div>
      <div class="environment-meta-card">
        <span class="label">API 模式</span>
        <span class="value">{{ apiModeLabel }}</span>
      </div>
      <div class="environment-meta-card">
        <span class="label">IPFS Gateway URL</span>
        <span class="value">{{ gatewayBaseUrl }}</span>
      </div>
      <div class="environment-meta-card">
        <span class="label">最近狀態</span>
        <span class="value environment-state" :class="`is-${state.status}`" data-testid="local-environment-status">
          {{ statusLabel }}
        </span>
      </div>
    </div>

    <p class="environment-summary" data-testid="local-environment-summary">{{ state.detail }}</p>

    <div v-if="hasCapabilities" class="environment-capabilities" data-testid="local-environment-capabilities">
      <div
        v-for="capability in state.capabilities"
        :key="capability.id"
        class="environment-capability"
        :class="`is-${capability.status}`"
      >
        <div class="environment-capability-header">
          <span class="environment-capability-label">{{ capability.label }}</span>
          <span class="environment-capability-status">{{ formatCapabilityStatusText(capability) }}</span>
        </div>
        <p class="environment-capability-detail">{{ capability.detail || '沒有補充資訊' }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.environment-panel {
  margin-top: 16px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(12, 18, 32, 0.78), rgba(8, 12, 20, 0.92));
}

.environment-panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.environment-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.96);
}

.environment-caption {
  margin: 6px 0 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.68);
}

.environment-refresh-btn {
  border: 1px solid rgba(91, 211, 255, 0.3);
  border-radius: 999px;
  background: rgba(22, 78, 106, 0.42);
  color: rgba(220, 246, 255, 0.96);
  font-weight: 600;
  padding: 10px 14px;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.environment-refresh-btn:hover:not(:disabled),
.environment-refresh-btn:focus-visible:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(116, 228, 255, 0.46);
  background: rgba(22, 96, 128, 0.52);
}

.environment-refresh-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.environment-api-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.environment-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.environment-field label {
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.84rem;
  font-weight: 600;
}

.environment-field input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.94);
  padding: 12px 14px;
}

.environment-field input::placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.environment-field input:focus-visible {
  outline: none;
  border-color: rgba(116, 228, 255, 0.42);
  box-shadow: 0 0 0 3px rgba(52, 156, 201, 0.18);
}

.environment-config-hint {
  margin: 12px 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.82rem;
  line-height: 1.5;
}

.environment-meta-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.environment-meta-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.48);
}

.value {
  color: rgba(255, 255, 255, 0.94);
  font-weight: 600;
  word-break: break-word;
}

.environment-state.is-idle {
  color: rgba(255, 255, 255, 0.76);
}

.environment-state.is-running {
  color: rgba(117, 223, 255, 0.96);
}

.environment-state.is-success {
  color: rgba(144, 255, 196, 0.96);
}

.environment-state.is-failure {
  color: rgba(255, 168, 168, 0.98);
}

.environment-summary {
  margin: 16px 0 0;
  font-size: 0.92rem;
  color: rgba(245, 247, 255, 0.92);
}

.environment-capabilities {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.environment-capability {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.environment-capability.is-available {
  border-color: rgba(91, 255, 166, 0.18);
}

.environment-capability.is-missing,
.environment-capability.is-unreachable,
.environment-capability.is-error {
  border-color: rgba(255, 132, 132, 0.18);
}

.environment-capability-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.environment-capability-label {
  color: rgba(255, 255, 255, 0.96);
  font-weight: 700;
}

.environment-capability-status {
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.86rem;
}

.environment-capability-detail {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.88rem;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .environment-panel-header {
    flex-direction: column;
  }

  .environment-api-config {
    grid-template-columns: 1fr;
  }

  .environment-refresh-btn {
    width: 100%;
  }

  .environment-meta-grid {
    grid-template-columns: 1fr;
  }

  .environment-capability-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
