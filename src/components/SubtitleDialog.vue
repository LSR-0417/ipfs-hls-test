<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { createImportedSubtitleTrack } from '../utils/subtitles';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  remoteSubtitles: {
    type: Array,
    default: () => [],
  },
  importedSubtitles: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'subtitle-import', 'subtitle-remove']);

const subtitleDialogRef = ref(null);
const subtitleFileInputRef = ref(null);
const isImportingSubtitle = ref(false);
const subtitleStatusText = ref('');
const subtitleStatusTone = ref('neutral');

const hasImportedSubtitles = computed(() => props.importedSubtitles.length > 0);
const toolbarStatusLabel = computed(() => {
  if (isImportingSubtitle.value) {
    return 'Importing';
  }

  return hasImportedSubtitles.value ? 'Session active' : 'Ready';
});
const toolbarStatusValue = computed(() => {
  const count = props.importedSubtitles.length;
  return count === 1 ? '1 imported subtitle' : `${count} imported subtitles`;
});
const sessionStatusNote = computed(() => {
  if (isImportingSubtitle.value) {
    return 'Preparing the subtitle file and converting it for instant preview.';
  }

  if (hasImportedSubtitles.value) {
    return 'These local tracks stay in this browser session and override matching CID subtitles.';
  }

  return 'Import a .vtt or .srt file to preview your own subtitle track without changing the CID.';
});

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      clearStatus();
      return;
    }

    await nextTick();
    subtitleDialogRef.value?.focus();
  }
);

function clearStatus() {
  subtitleStatusText.value = '';
  subtitleStatusTone.value = 'neutral';
}

function setStatus(message, tone = 'neutral') {
  subtitleStatusText.value = message;
  subtitleStatusTone.value = tone;
}

function closeDialog() {
  emit('close');
}

function triggerSubtitlePicker() {
  if (isImportingSubtitle.value) {
    return;
  }

  subtitleFileInputRef.value?.click();
}

function normalizeLocale(value) {
  return typeof value === 'string' ? value.trim().replace(/_/g, '-').toLowerCase() : '';
}

function isOverridingCidTrack(track) {
  const targetLocale = normalizeLocale(track?.lang);
  if (!targetLocale) {
    return false;
  }

  return props.remoteSubtitles.some((remoteTrack) => normalizeLocale(remoteTrack?.lang) === targetLocale);
}

function resolveImportedSubtitleOrder(nextTrack) {
  const allTracks = [...props.importedSubtitles, ...props.remoteSubtitles];
  const matchedTrack = allTracks.find((track) => normalizeLocale(track?.lang) === normalizeLocale(nextTrack?.lang));

  if (matchedTrack) {
    return Number.isFinite(Number(matchedTrack.order)) ? Number(matchedTrack.order) : 0;
  }

  return props.remoteSubtitles.length + props.importedSubtitles.length;
}

async function handleSubtitleFileChange(event) {
  const [file] = Array.from(event?.target?.files || []);
  if (event?.target) {
    event.target.value = '';
  }

  if (!file) {
    return;
  }

  isImportingSubtitle.value = true;
  clearStatus();

  try {
    const importedTrack = await createImportedSubtitleTrack(file);
    importedTrack.order = resolveImportedSubtitleOrder(importedTrack);
    emit('subtitle-import', importedTrack);
    setStatus(`已匯入 ${importedTrack.label}`, 'success');
  } catch (error) {
    setStatus(error?.message || '字幕匯入失敗。', 'error');
  } finally {
    isImportingSubtitle.value = false;
  }
}

function handleRemoveImportedSubtitle(track) {
  emit('subtitle-remove', track.id);
  setStatus(`已移除 ${track.label}`, 'success');
}
</script>

<template>
  <div
    v-if="open"
    class="subtitle-backdrop"
    data-testid="subtitle-dialog-backdrop"
    @click.self="closeDialog"
  >
    <section
      ref="subtitleDialogRef"
      class="subtitle-dialog glass-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subtitleDialogTitle"
      aria-describedby="subtitleDialogSubtitle"
      tabindex="-1"
      data-testid="subtitle-dialog"
    >
      <div class="subtitle-dialog-header">
        <div class="subtitle-dialog-copy">
          <h3 id="subtitleDialogTitle">Subtitles</h3>
          <p id="subtitleDialogSubtitle" class="subtitle-dialog-subtitle">
            Import the subtitle track you already trust and preview it instantly on this video.
          </p>
        </div>
        <button
          type="button"
          class="subtitle-dialog-close"
          aria-label="Close subtitle dialog"
          data-testid="subtitle-dialog-close"
          @click="closeDialog"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z"
            />
          </svg>
        </button>
      </div>

      <div class="subtitle-dialog-body">
        <div class="subtitle-hero">
          <section class="subtitle-panel subtitle-import-panel">
            <div class="subtitle-panel-copy">
              <span class="subtitle-panel-eyebrow">Local Import</span>
              <h4>Bring your own subtitles</h4>
              <p>Use the subtitle file you already trust. We will convert it when needed and preview it instantly.</p>
            </div>
            <div class="subtitle-format-list" aria-label="Supported subtitle formats">
              <span class="subtitle-format-pill">.vtt</span>
              <span class="subtitle-format-pill">.srt</span>
            </div>
            <div class="subtitle-toolbar-actions">
              <input
                ref="subtitleFileInputRef"
                class="subtitle-file-input"
                type="file"
                accept=".vtt,.srt,text/vtt,application/x-subrip"
                data-testid="subtitle-dialog-file-input"
                @change="handleSubtitleFileChange"
              />
              <button
                type="button"
                class="glass-btn subtitle-import-btn"
                :disabled="isImportingSubtitle"
                data-testid="subtitle-dialog-import-button"
                @click="triggerSubtitlePicker"
              >
                <svg class="subtitle-btn-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M5 20h14v-2H5v2zm7-18-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/>
                </svg>
                <span>{{ isImportingSubtitle ? 'Importing…' : 'Import subtitle' }}</span>
              </button>
            </div>
            <p class="subtitle-toolbar-hint">Imported subtitles disappear after refresh or when you switch to another CID.</p>
          </section>

          <section class="subtitle-panel subtitle-session-panel" data-testid="subtitle-dialog-session-status">
            <span class="subtitle-panel-eyebrow">Session Status</span>
            <div class="subtitle-session-metric">{{ importedSubtitles.length }}</div>
            <div class="subtitle-toolbar-status">
              <span class="subtitle-toolbar-status-label">{{ toolbarStatusLabel }}</span>
              <span class="subtitle-toolbar-status-value">{{ toolbarStatusValue }}</span>
            </div>
            <p class="subtitle-session-note">{{ sessionStatusNote }}</p>
          </section>
        </div>

        <p
          v-if="subtitleStatusText"
          class="subtitle-status"
          :class="`subtitle-status-${subtitleStatusTone}`"
          data-testid="subtitle-dialog-status"
        >
          <svg class="subtitle-status-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm-1 14-4-4 1.41-1.41L11 13.17l4.59-4.58L17 10Z"
            />
          </svg>
          <span>{{ subtitleStatusText }}</span>
        </p>

        <div class="subtitle-section">
          <div class="subtitle-section-header">
            <div class="subtitle-section-copy">
              <h4>Imported in this browser</h4>
              <p class="subtitle-section-caption">Local subtitles temporarily override same-language CID tracks.</p>
            </div>
          </div>

          <ul v-if="hasImportedSubtitles" class="subtitle-track-list" data-testid="subtitle-dialog-imported-list">
            <li v-for="track in importedSubtitles" :key="track.id" class="subtitle-track-row">
              <div class="subtitle-track-leading">
                <div class="subtitle-track-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M4 5h16v10H7.17L4 18.17V5zm2 2v6.34L6.34 13H18V7H6zm2 1h8v2H8V8zm0 3h5v2H8v-2z"/>
                  </svg>
                </div>
                <div class="subtitle-track-copy">
                  <div class="subtitle-track-headline">
                    <div class="subtitle-track-title">{{ track.label }}</div>
                    <span class="subtitle-track-state">{{ isOverridingCidTrack(track) ? 'Overriding CID' : 'Local only' }}</span>
                  </div>
                  <div class="subtitle-track-meta">
                    <span class="subtitle-badge subtitle-badge-local">Local</span>
                    <span>{{ track.fileName }}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="glass-btn subtitle-row-btn subtitle-row-btn-danger"
                :data-testid="`subtitle-dialog-remove-${track.lang}`"
                @click="handleRemoveImportedSubtitle(track)"
              >
                <svg class="subtitle-row-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Z"/>
                </svg>
                <span>Remove</span>
              </button>
            </li>
          </ul>

          <p v-else class="subtitle-empty-state" data-testid="subtitle-dialog-imported-empty">
            Import your first subtitle to create a temporary local override for this video.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.subtitle-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(6, 11, 18, 0.7);
  backdrop-filter: blur(18px);
}

.subtitle-dialog {
  width: min(700px, calc(100vw - 32px));
  max-height: min(720px, calc(100vh - 48px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 24px;
  background: rgba(16, 18, 32, 0.94);
  border: 1px solid var(--panel-border);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
}

.subtitle-dialog:focus {
  outline: none;
}

.subtitle-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--panel-border);
}

.subtitle-dialog-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtitle-dialog-copy h3 {
  margin: 0;
  font-size: 1.45rem;
  color: var(--text-primary);
}

.subtitle-dialog-subtitle {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.subtitle-dialog-close {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease, color 0.2s ease;
}

.subtitle-dialog-close:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.12);
}

.subtitle-dialog-body {
  display: grid;
  gap: 16px;
  padding: 20px 24px 24px;
  overflow-y: auto;
}

.subtitle-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.95fr);
  gap: 16px;
}

.subtitle-panel {
  position: relative;
  overflow: hidden;
  min-height: 218px;
  padding: 20px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.subtitle-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(0, 210, 255, 0.16), transparent 38%);
  pointer-events: none;
}

.subtitle-import-panel {
  justify-content: space-between;
}

.subtitle-session-panel {
  background:
    radial-gradient(circle at top left, rgba(162, 82, 255, 0.2), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
}

.subtitle-panel-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtitle-panel-copy h4 {
  margin: 0;
  font-size: 1.18rem;
  line-height: 1.2;
  color: var(--text-primary);
}

.subtitle-panel-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.subtitle-panel-eyebrow {
  color: var(--accent-cyan);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.subtitle-format-list {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.subtitle-format-pill {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

.subtitle-toolbar-actions {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.subtitle-toolbar-hint {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.55;
}

.subtitle-toolbar-status {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subtitle-toolbar-status-label {
  color: rgba(255, 255, 255, 0.66);
  font-size: 0.76rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.subtitle-toolbar-status-value {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.subtitle-session-metric {
  position: relative;
  z-index: 1;
  font-size: clamp(2.4rem, 4vw, 3.25rem);
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.subtitle-session-note {
  position: relative;
  z-index: 1;
  margin: auto 0 0;
  color: var(--text-secondary);
  font-size: 0.93rem;
  line-height: 1.55;
}

.subtitle-file-input {
  display: none;
}

.subtitle-import-btn,
.subtitle-row-btn {
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.subtitle-import-btn {
  min-width: 184px;
  height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(135deg, rgba(0, 210, 255, 0.96), rgba(92, 117, 255, 0.92));
  color: #06111b;
  font-weight: 700;
  box-shadow: 0 14px 28px rgba(0, 210, 255, 0.2);
}

.subtitle-import-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 30px rgba(0, 210, 255, 0.26);
}

.subtitle-btn-icon {
  flex: 0 0 auto;
}

.subtitle-import-btn:disabled {
  cursor: wait;
  opacity: 0.78;
  box-shadow: none;
}

.subtitle-status {
  margin: 0;
  padding: 12px 14px;
  border-radius: 16px;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.subtitle-status-success {
  background: rgba(82, 196, 26, 0.14);
  color: #d6ffb0;
}

.subtitle-status-error {
  background: rgba(255, 109, 109, 0.14);
  color: #ffd0d0;
}

.subtitle-status-icon {
  flex: 0 0 auto;
}

.subtitle-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 2px 0;
}

.subtitle-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.subtitle-section-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subtitle-section-copy h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.subtitle-section-caption {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.45;
}

.subtitle-track-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subtitle-track-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03)),
    rgba(17, 21, 36, 0.68);
}

.subtitle-track-leading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.subtitle-track-glyph {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 210, 255, 0.16), rgba(162, 82, 255, 0.16));
  color: var(--accent-cyan);
}

.subtitle-track-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subtitle-track-headline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.subtitle-track-title {
  color: var(--text-primary);
  font-weight: 600;
}

.subtitle-track-state {
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}

.subtitle-track-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.subtitle-badge {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.76rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.subtitle-badge-local {
  background: rgba(93, 234, 196, 0.14);
  color: #a9ffe8;
}

.subtitle-row-btn {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.subtitle-row-btn:hover {
  transform: translateY(-1px);
}

.subtitle-row-btn-icon {
  flex: 0 0 auto;
}

.subtitle-row-btn-danger {
  border-color: rgba(255, 122, 122, 0.22);
  background: rgba(255, 122, 122, 0.08);
  color: #ffd0d0;
}

.subtitle-row-btn-danger:hover {
  background: rgba(255, 122, 122, 0.14);
  box-shadow: 0 12px 24px rgba(255, 122, 122, 0.12);
}

.subtitle-empty-state {
  margin: 0;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  line-height: 1.55;
}

@media (max-width: 768px) {
  .subtitle-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .subtitle-dialog {
    width: 100vw;
    max-height: min(88vh, 720px);
    border-radius: 24px 24px 0 0;
  }

  .subtitle-dialog-header {
    padding: 20px 18px 14px;
  }

  .subtitle-dialog-body {
    padding: 18px;
  }

  .subtitle-hero {
    grid-template-columns: 1fr;
  }

  .subtitle-toolbar-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .subtitle-import-btn {
    width: 100%;
  }

  .subtitle-track-row {
    flex-direction: column;
    align-items: stretch;
  }

  .subtitle-track-leading {
    width: 100%;
  }
}
</style>
