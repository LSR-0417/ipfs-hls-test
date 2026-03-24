<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '../i18n';
import {
  buildInfoJsonPayload,
  createDefaultVideoInfo,
  formatUploadDate,
  stringifyInfoJson,
} from '../utils/videoInfo';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  initialVideoInfo: {
    type: Object,
    default: () => createDefaultVideoInfo(),
  },
});

const emit = defineEmits(['close']);
const { t } = useI18n();

const dialogRef = ref(null);
const titleInputRef = ref(null);
const copySuccess = ref(false);
const downloadSuccess = ref(false);
const form = reactive(createFormState(props.initialVideoInfo));

let feedbackTimeout = 0;

const generatedPayload = computed(() =>
  buildInfoJsonPayload({
    id: form.id,
    title: form.title,
    uploader: form.uploader,
    channelId: form.channelId,
    uploadDate: form.uploadDate,
    durationString: form.durationString,
    description: form.description,
    tags: parseListInput(form.tags),
    categories: parseListInput(form.categories),
    resolution: form.resolution,
    fps: form.fps,
  })
);
const generatedJson = computed(() => stringifyInfoJson(generatedPayload.value));
const generatedFieldCount = computed(() => Object.keys(generatedPayload.value).length);
const statusText = computed(() => {
  if (copySuccess.value) {
    return t('infoJson.status.copied');
  }

  if (downloadSuccess.value) {
    return t('infoJson.status.downloaded');
  }

  return t('infoJson.preview.summary', { count: generatedFieldCount.value });
});

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      resetFeedback();
      return;
    }

    syncForm(props.initialVideoInfo);
    resetFeedback();
    await nextTick();
    dialogRef.value?.focus();
    titleInputRef.value?.focus();
  }
);

onBeforeUnmount(() => {
  clearFeedbackTimeout();
});

function createFormState(videoInfo = createDefaultVideoInfo()) {
  const source = videoInfo && typeof videoInfo === 'object' ? videoInfo : createDefaultVideoInfo();

  return {
    id: source.id || '',
    title: source.title || '',
    uploader: source.uploader || '',
    channelId: source.channelId || '',
    uploadDate: formatUploadDate(source.uploadDate || ''),
    durationString: source.durationString || '',
    description: source.description || '',
    tags: Array.isArray(source.tags) ? source.tags.join(', ') : '',
    categories: Array.isArray(source.categories) ? source.categories.join(', ') : '',
    resolution: source.resolution || '',
    fps: source.fps ? String(source.fps) : '',
  };
}

function syncForm(videoInfo) {
  Object.assign(form, createFormState(videoInfo));
}

function parseListInput(value) {
  return String(value || '')
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function clearFeedbackTimeout() {
  if (!feedbackTimeout) return;

  clearTimeout(feedbackTimeout);
  feedbackTimeout = 0;
}

function scheduleFeedbackReset() {
  clearFeedbackTimeout();
  feedbackTimeout = window.setTimeout(() => {
    copySuccess.value = false;
    downloadSuccess.value = false;
    feedbackTimeout = 0;
  }, 2000);
}

function resetFeedback() {
  clearFeedbackTimeout();
  copySuccess.value = false;
  downloadSuccess.value = false;
}

function closeDialog() {
  emit('close');
}

function clearForm() {
  syncForm(createDefaultVideoInfo());
  resetFeedback();
  nextTick(() => {
    titleInputRef.value?.focus();
  });
}

function markCopySuccess() {
  copySuccess.value = true;
  downloadSuccess.value = false;
  scheduleFeedbackReset();
}

function markDownloadSuccess() {
  downloadSuccess.value = true;
  copySuccess.value = false;
  scheduleFeedbackReset();
}

function copyJson() {
  const text = generatedJson.value;

  const handleSuccess = () => {
    markCopySuccess();
    dialogRef.value?.focus();
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(handleSuccess).catch(() => {
      fallbackCopyText(text, handleSuccess);
    });
    return;
  }

  fallbackCopyText(text, handleSuccess);
}

function fallbackCopyText(text, onSuccess) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (document.execCommand('copy')) {
      onSuccess();
    }
  } finally {
    document.body.removeChild(textArea);
  }
}

function downloadJson() {
  const BlobImpl = globalThis.Blob;
  const createObjectURL = window.URL?.createObjectURL;

  if (typeof BlobImpl !== 'function' || typeof createObjectURL !== 'function') {
    return;
  }

  const blob = new BlobImpl([generatedJson.value], {
    type: 'application/json;charset=utf-8',
  });
  const href = createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  link.download = 'info.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  markDownloadSuccess();
  window.setTimeout(() => {
    window.URL?.revokeObjectURL?.(href);
  }, 0);
}
</script>

<template>
  <div
    v-if="open"
    class="info-json-backdrop"
    data-testid="info-json-backdrop"
    @click.self="closeDialog"
  >
    <div
      ref="dialogRef"
      class="info-json-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="infoJsonTitle"
      aria-describedby="infoJsonSubtitle"
      tabindex="-1"
      data-testid="info-json-dialog"
      @keydown.esc.prevent="closeDialog"
    >
      <div class="info-json-header">
        <div class="info-json-header-copy">
          <h3 id="infoJsonTitle">{{ t('infoJson.title') }}</h3>
          <p id="infoJsonSubtitle" class="info-json-subtitle">{{ t('infoJson.subtitle') }}</p>
        </div>
        <button
          type="button"
          class="info-json-close"
          :aria-label="t('infoJson.actions.close')"
          @click="closeDialog"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z"
            />
          </svg>
        </button>
      </div>

      <div class="info-json-body">
        <section class="info-json-panel info-json-form-panel">
          <div class="panel-header">
            <div>
              <h4>{{ t('infoJson.form.title') }}</h4>
              <p>{{ t('infoJson.form.caption') }}</p>
            </div>
            <button type="button" class="ghost-btn" @click="clearForm">
              {{ t('infoJson.actions.clear') }}
            </button>
          </div>

          <div class="field-grid">
            <label class="field field--span-2">
              <span>{{ t('infoJson.fields.title.label') }}</span>
              <input
                ref="titleInputRef"
                v-model="form.title"
                type="text"
                :placeholder="t('infoJson.fields.title.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.uploader.label') }}</span>
              <input
                v-model="form.uploader"
                type="text"
                :placeholder="t('infoJson.fields.uploader.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.id.label') }}</span>
              <input
                v-model="form.id"
                type="text"
                :placeholder="t('infoJson.fields.id.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.channelId.label') }}</span>
              <input
                v-model="form.channelId"
                type="text"
                :placeholder="t('infoJson.fields.channelId.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.uploadDate.label') }}</span>
              <input
                v-model="form.uploadDate"
                type="text"
                :placeholder="t('infoJson.fields.uploadDate.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.durationString.label') }}</span>
              <input
                v-model="form.durationString"
                type="text"
                :placeholder="t('infoJson.fields.durationString.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.resolution.label') }}</span>
              <input
                v-model="form.resolution"
                type="text"
                :placeholder="t('infoJson.fields.resolution.placeholder')"
              />
            </label>

            <label class="field">
              <span>{{ t('infoJson.fields.fps.label') }}</span>
              <input
                v-model="form.fps"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                :placeholder="t('infoJson.fields.fps.placeholder')"
              />
            </label>

            <label class="field field--span-2">
              <span>{{ t('infoJson.fields.description.label') }}</span>
              <textarea
                v-model="form.description"
                rows="6"
                :placeholder="t('infoJson.fields.description.placeholder')"
              ></textarea>
            </label>

            <label class="field field--span-2">
              <span>{{ t('infoJson.fields.tags.label') }}</span>
              <textarea
                v-model="form.tags"
                rows="3"
                :placeholder="t('infoJson.fields.tags.placeholder')"
              ></textarea>
              <small>{{ t('infoJson.fields.tags.hint') }}</small>
            </label>

            <label class="field field--span-2">
              <span>{{ t('infoJson.fields.categories.label') }}</span>
              <textarea
                v-model="form.categories"
                rows="3"
                :placeholder="t('infoJson.fields.categories.placeholder')"
              ></textarea>
              <small>{{ t('infoJson.fields.categories.hint') }}</small>
            </label>
          </div>
        </section>

        <section class="info-json-panel info-json-preview-panel">
          <div class="panel-header panel-header--stacked">
            <div>
              <h4>{{ t('infoJson.preview.title') }}</h4>
              <p>{{ t('infoJson.preview.caption') }}</p>
            </div>
            <span class="preview-badge">info.json</span>
          </div>

          <div class="preview-meta">
            <span>{{ statusText }}</span>
            <span>{{ t('infoJson.preview.omitEmpty') }}</span>
          </div>

          <pre class="json-preview"><code>{{ generatedJson }}</code></pre>
        </section>
      </div>

      <div class="info-json-footer">
        <div class="footer-status" aria-live="polite">{{ statusText }}</div>
        <div class="footer-actions">
          <button type="button" class="ghost-btn" @click="closeDialog">
            {{ t('infoJson.actions.close') }}
          </button>
          <button type="button" class="ghost-btn" @click="copyJson">
            {{ t('infoJson.actions.copy') }}
          </button>
          <button type="button" class="primary-btn" @click="downloadJson">
            {{ t('infoJson.actions.download') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-json-backdrop {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(7, 9, 16, 0.78);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.info-json-dialog {
  width: min(1080px, calc(100vw - 48px));
  max-height: min(88dvh, 960px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(0, 210, 255, 0.12), transparent 38%),
    radial-gradient(circle at top right, rgba(255, 209, 102, 0.1), transparent 34%),
    rgba(14, 16, 28, 0.96);
  box-shadow: 0 34px 80px rgba(0, 0, 0, 0.55);
  color: var(--text-primary);
}

.info-json-dialog:focus {
  outline: none;
}

.info-json-header,
.info-json-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.info-json-footer {
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
}

.info-json-header-copy {
  min-width: 0;
  max-width: 60ch;
}

.info-json-header h3 {
  margin: 0;
  font-size: 1.4rem;
  line-height: 1.15;
}

.info-json-subtitle {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.94rem;
  line-height: 1.5;
}

.info-json-close {
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.84);
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.info-json-close:hover,
.info-json-close:focus-visible {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
  outline: none;
}

.info-json-body {
  min-height: 0;
  overflow: auto;
  padding: 22px 24px 24px;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  gap: 20px;
}

.info-json-panel {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header--stacked {
  align-items: center;
}

.panel-header h4 {
  margin: 0;
  font-size: 1rem;
}

.panel-header p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.84rem;
  line-height: 1.45;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field--span-2 {
  grid-column: 1 / -1;
}

.field span {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.field input,
.field textarea {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(7, 9, 16, 0.44);
  color: var(--text-primary);
  padding: 12px 14px;
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.field textarea {
  resize: vertical;
  min-height: 88px;
}

.field input::placeholder,
.field textarea::placeholder {
  color: rgba(255, 255, 255, 0.34);
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: rgba(0, 210, 255, 0.48);
  box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.08);
  background: rgba(7, 9, 16, 0.58);
}

.field small {
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.74rem;
  line-height: 1.45;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 210, 255, 0.12);
  border: 1px solid rgba(0, 210, 255, 0.26);
  color: rgba(180, 240, 255, 0.95);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.78rem;
  line-height: 1.45;
}

.json-preview {
  min-height: 0;
  margin: 0;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02)),
    rgba(4, 6, 12, 0.8);
  padding: 18px;
  overflow: auto;
  color: #d7f7ff;
  font-size: 0.86rem;
  line-height: 1.6;
}

.footer-status {
  min-width: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.84rem;
  line-height: 1.45;
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.ghost-btn,
.primary-btn {
  border: none;
  border-radius: 14px;
  padding: 11px 16px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.ghost-btn {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
}

.ghost-btn:hover,
.ghost-btn:focus-visible {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
  outline: none;
}

.primary-btn {
  background: linear-gradient(135deg, rgba(0, 210, 255, 0.9), rgba(80, 152, 255, 0.92));
  color: #06111a;
  box-shadow: 0 10px 24px rgba(0, 210, 255, 0.2);
}

.primary-btn:hover,
.primary-btn:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px rgba(0, 210, 255, 0.24);
  outline: none;
}

@media (max-width: 960px) {
  .info-json-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .info-json-backdrop {
    padding: 12px;
  }

  .info-json-dialog {
    width: min(100vw - 24px, 960px);
    max-height: min(92dvh, 960px);
  }

  .info-json-header,
  .info-json-footer,
  .info-json-body {
    padding-left: 16px;
    padding-right: 16px;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .panel-header,
  .info-json-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .footer-actions {
    justify-content: stretch;
  }

  .footer-actions button {
    width: 100%;
  }
}
</style>
