<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import SubtitleRoleIcon from './SubtitleRoleIcon.vue';
import { createImportedSubtitleTrack, downloadSubtitleTrack, revokeImportedSubtitleTracks } from '../utils/subtitles';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  subtitles: {
    type: Array,
    default: () => [],
  },
  subtitleSelection: {
    type: Object,
    default: () => ({
      mode: 'off',
      primaryLang: '',
      secondaryLang: '',
    }),
  },
  remoteSubtitleStatus: {
    type: String,
    default: 'idle',
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

const emit = defineEmits(['close', 'subtitle-import', 'subtitle-remove', 'subtitle-selection-change']);

const subtitleDialogRef = ref(null);
const subtitleFileInputRef = ref(null);
const isImportingSubtitle = ref(false);
const downloadingTrackKey = ref('');
const subtitleStatusText = ref('');
const subtitleStatusTone = ref('neutral');

const hasImportedSubtitles = computed(() => props.importedSubtitles.length > 0);
const visibleTracks = computed(() => props.subtitles);
const currentPrimaryTrack = computed(() => findTrackByLanguage(props.subtitleSelection.primaryLang));
const hasPrimarySubtitle = computed(() => Boolean(currentPrimaryTrack.value));
const hasAvailableTracks = computed(() => props.subtitles.length > 0);
const selectionEmptyStateText = computed(() => {
  if (hasAvailableTracks.value) {
    return '';
  }

  if (props.remoteSubtitleStatus === 'loading') {
    return '正在載入字幕清單...';
  }

  if (props.remoteSubtitleStatus === 'error') {
    return '字幕清單載入失敗。你仍可匯入本機字幕。';
  }

  return '這支影片目前沒有可用字幕。';
});
const importSessionSummary = computed(() => {
  if (isImportingSubtitle.value) {
    return '正在整理字幕格式';
  }

  if (hasImportedSubtitles.value) {
    return `本次暫存 ${props.importedSubtitles.length} 條本機字幕`;
  }

  return '尚未匯入本機字幕';
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

function findTrackByLanguage(lang) {
  const targetLocale = normalizeLocale(lang);
  if (!targetLocale) {
    return null;
  }

  return props.subtitles.find((track) => normalizeLocale(track?.lang) === targetLocale) || null;
}

function isOverridingCidTrack(track) {
  const targetLocale = normalizeLocale(track?.lang);
  if (!targetLocale) {
    return false;
  }

  return props.remoteSubtitles.some((remoteTrack) => normalizeLocale(remoteTrack?.lang) === targetLocale);
}

function getTrackActionKey(track) {
  return `${track?.source || 'remote'}:${normalizeLocale(track?.lang) || 'und'}:${track?.fileName || track?.label || 'subtitle'}`;
}

function resolveTrackFileName(track) {
  return track?.fileName || `${track?.lang || 'subtitle'}.vtt`;
}

function resolveTrackDisplayName(track) {
  const label = track?.label || track?.lang || '字幕';
  return `${label}(${resolveTrackFileName(track)})`;
}

function isTrackPrimary(track) {
  return normalizeLocale(track?.lang) === normalizeLocale(props.subtitleSelection.primaryLang);
}

function isTrackSecondary(track) {
  return normalizeLocale(track?.lang) === normalizeLocale(props.subtitleSelection.secondaryLang);
}

function resolveImportedSubtitleOrder(nextTrack, pendingTracks = []) {
  const allTracks = [...pendingTracks, ...props.importedSubtitles, ...props.remoteSubtitles];
  const matchedTrack = allTracks.find((track) => normalizeLocale(track?.lang) === normalizeLocale(nextTrack?.lang));

  if (matchedTrack) {
    return Number.isFinite(Number(matchedTrack.order)) ? Number(matchedTrack.order) : 0;
  }

  return props.remoteSubtitles.length + props.importedSubtitles.length + pendingTracks.length;
}

function emitSubtitleSelectionChange(nextSelection) {
  emit('subtitle-selection-change', nextSelection);
}

function clearSecondarySubtitle() {
  emitSubtitleSelectionChange({
    mode: hasPrimarySubtitle.value ? 'showing' : 'off',
    primaryLang: props.subtitleSelection.primaryLang,
    secondaryLang: '',
  });
  setStatus('已清除次要字幕。', 'success');
}

function isPrimaryActionDisabled(track) {
  return isTrackPrimary(track);
}

function getPrimaryActionLabel(track) {
  return isTrackPrimary(track) ? '主字幕中' : '設為主字幕';
}

function getPrimaryActionTestId(track) {
  const source = normalizeLocale(track?.source) || 'track';
  const locale = normalizeLocale(track?.lang) || 'und';
  return `subtitle-dialog-primary-action-${source}-${locale}`;
}

function handleTrackPrimaryAction(track) {
  if (!track || isPrimaryActionDisabled(track)) {
    return;
  }

  emitSubtitleSelectionChange({
    mode: 'showing',
    primaryLang: track.lang,
    secondaryLang: isTrackSecondary(track) ? '' : props.subtitleSelection.secondaryLang,
  });
  setStatus(`主字幕已切換為 ${track.label || track.lang}`, 'success');
}

function isSecondaryActionDisabled(track) {
  return !hasPrimarySubtitle.value || isTrackPrimary(track);
}

function getSecondaryActionLabel(track) {
  if (isTrackSecondary(track)) {
    return '取消次字幕';
  }

  if (isTrackPrimary(track)) {
    return '主字幕中';
  }

  if (!hasPrimarySubtitle.value) {
    return '先選主字幕';
  }

  return '設為次字幕';
}

function getSecondaryActionTestId(track) {
  const source = normalizeLocale(track?.source) || 'track';
  const locale = normalizeLocale(track?.lang) || 'und';
  return `subtitle-dialog-secondary-action-${source}-${locale}`;
}

function getTrackRowTestId(track) {
  const source = normalizeLocale(track?.source) || 'track';
  const locale = normalizeLocale(track?.lang) || 'und';
  return `subtitle-dialog-track-${source}-${locale}`;
}

function handleTrackSecondaryAction(track) {
  if (!track || isSecondaryActionDisabled(track)) {
    return;
  }

  if (isTrackSecondary(track)) {
    clearSecondarySubtitle();
    return;
  }

  emitSubtitleSelectionChange({
    mode: 'showing',
    primaryLang: props.subtitleSelection.primaryLang,
    secondaryLang: track.lang,
  });
  setStatus(`次字幕已切換為 ${track.label || track.lang}`, 'success');
}

function upsertPendingImportedTrack(pendingTracks, nextTrack) {
  const nextLocale = normalizeLocale(nextTrack?.lang);
  const existingIndex = pendingTracks.findIndex((track) => normalizeLocale(track?.lang) === nextLocale);

  if (existingIndex >= 0) {
    revokeImportedSubtitleTracks([pendingTracks[existingIndex]]);
    pendingTracks.splice(existingIndex, 1, nextTrack);
    return;
  }

  pendingTracks.push(nextTrack);
}

function formatImportStatus(successfulTracks, failedImports) {
  if (successfulTracks.length === 0) {
    return failedImports[0]?.message || '字幕匯入失敗。';
  }

  if (failedImports.length === 0) {
    if (successfulTracks.length === 1) {
      return `已匯入 ${successfulTracks[0].label}`;
    }

    return `已匯入 ${successfulTracks.length} 條字幕`;
  }

  return `成功匯入 ${successfulTracks.length} 條字幕，${failedImports.length} 條失敗。`;
}

async function handleSubtitleFileChange(event) {
  const files = Array.from(event?.target?.files || []);
  if (event?.target) {
    event.target.value = '';
  }

  if (files.length === 0) {
    return;
  }

  isImportingSubtitle.value = true;
  clearStatus();

  try {
    const successfulTracks = [];
    const failedImports = [];

    for (const file of files) {
      try {
        const importedTrack = await createImportedSubtitleTrack(file);
        importedTrack.order = resolveImportedSubtitleOrder(importedTrack, successfulTracks);
        upsertPendingImportedTrack(successfulTracks, importedTrack);
      } catch (error) {
        failedImports.push({
          fileName: typeof file?.name === 'string' ? file.name : 'subtitle',
          message: error?.message || '字幕匯入失敗。',
        });
      }
    }

    if (successfulTracks.length > 0) {
      emit('subtitle-import', successfulTracks);
    }

    setStatus(formatImportStatus(successfulTracks, failedImports), successfulTracks.length > 0 ? 'success' : 'error');
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

async function handleDownloadSubtitle(track) {
  const trackKey = getTrackActionKey(track);
  downloadingTrackKey.value = trackKey;
  clearStatus();

  try {
    await downloadSubtitleTrack(track);
    setStatus(`已開始下載 ${track?.label || track?.lang || '字幕'}`, 'success');
  } catch (error) {
    setStatus(error?.message || '字幕下載失敗。', 'error');
  } finally {
    if (downloadingTrackKey.value === trackKey) {
      downloadingTrackKey.value = '';
    }
  }
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
            <div class="subtitle-dialog-heading-row">
              <h3 id="subtitleDialogTitle">字幕</h3>
              <span class="subtitle-toolbar-pill">{{ importSessionSummary }}</span>
            </div>
            <p id="subtitleDialogSubtitle" class="subtitle-dialog-subtitle">
            匯入、下載與主 / 次字幕切換都在這裡快速完成。
            </p>
          </div>

        <div class="subtitle-dialog-toolbar">
          <span class="subtitle-toolbar-hint">支援 .vtt / .srt</span>
          <div class="subtitle-toolbar-actions">
            <input
              ref="subtitleFileInputRef"
              class="subtitle-file-input"
              type="file"
              multiple
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
              <span>{{ isImportingSubtitle ? '匯入中…' : '匯入字幕' }}</span>
            </button>
            <button
              type="button"
              class="subtitle-dialog-close"
              aria-label="關閉字幕控制台"
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
        </div>
      </div>

      <div class="subtitle-dialog-body">
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

        <section class="subtitle-section subtitle-library-panel">
          <h4 class="subtitle-section-title">字幕清單</h4>

          <ul
            v-if="hasAvailableTracks"
            class="subtitle-track-list"
            data-testid="subtitle-dialog-track-list"
          >
              <li
                v-for="track in visibleTracks"
                :key="getTrackActionKey(track)"
                class="subtitle-track-row"
                :class="{
                  'subtitle-track-row--primary': isTrackPrimary(track),
                  'subtitle-track-row--secondary': isTrackSecondary(track),
                }"
                :data-testid="getTrackRowTestId(track)"
              >
                <div class="subtitle-track-main">
                  <div class="subtitle-track-title-row">
                    <span class="subtitle-track-title" :title="resolveTrackDisplayName(track)">
                      {{ track.label }}
                      <span class="subtitle-track-file">({{ resolveTrackFileName(track) }})</span>
                    </span>
                    <div class="subtitle-track-badge-row">
                      <span v-if="track.source === 'local'" class="subtitle-badge subtitle-badge-local">本機</span>
                      <span v-else class="subtitle-badge subtitle-badge-muted">影片</span>
                      <span v-if="track.source === 'local' && isOverridingCidTrack(track)" class="subtitle-badge subtitle-badge-muted">
                        覆蓋影片字幕
                      </span>
                    </div>
                  </div>
                </div>
                <div class="subtitle-track-actions">
                  <button
                    type="button"
                    class="glass-btn subtitle-row-btn subtitle-row-btn--icon"
                    :class="{ 'subtitle-row-btn--selected': isTrackPrimary(track) }"
                    :disabled="isPrimaryActionDisabled(track)"
                    :aria-pressed="isTrackPrimary(track) ? 'true' : 'false'"
                    :aria-label="getPrimaryActionLabel(track)"
                    :title="getPrimaryActionLabel(track)"
                    :data-testid="getPrimaryActionTestId(track)"
                    @click="handleTrackPrimaryAction(track)"
                  >
                    <SubtitleRoleIcon class="subtitle-role-icon subtitle-role-icon--primary" variant="primary" />
                  </button>
                  <button
                    type="button"
                    class="glass-btn subtitle-row-btn subtitle-row-btn--icon"
                    :class="{ 'subtitle-row-btn--selected subtitle-row-btn--secondary': isTrackSecondary(track) }"
                    :disabled="isSecondaryActionDisabled(track)"
                    :aria-pressed="isTrackSecondary(track) ? 'true' : 'false'"
                    :aria-label="getSecondaryActionLabel(track)"
                    :title="getSecondaryActionLabel(track)"
                    :data-testid="getSecondaryActionTestId(track)"
                    @click="handleTrackSecondaryAction(track)"
                  >
                    <SubtitleRoleIcon class="subtitle-role-icon subtitle-role-icon--secondary" variant="secondary" />
                  </button>
                  <button
                    type="button"
                    class="glass-btn subtitle-row-btn subtitle-row-btn--icon"
                    :disabled="downloadingTrackKey === getTrackActionKey(track)"
                    :aria-label="downloadingTrackKey === getTrackActionKey(track) ? '下載中…' : '下載字幕'"
                    :title="downloadingTrackKey === getTrackActionKey(track) ? '下載中…' : '下載字幕'"
                    :data-testid="`subtitle-dialog-download-${track.lang}`"
                    @click="handleDownloadSubtitle(track)"
                  >
                    <svg class="subtitle-row-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path fill="currentColor" d="M12 3v9.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V3h1ZM5 19h14v2H5v-2Z"/>
                    </svg>
                  </button>
                  <button
                    v-if="track.source === 'local'"
                    type="button"
                    class="glass-btn subtitle-row-btn subtitle-row-btn--icon subtitle-row-btn-danger"
                    aria-label="移除字幕"
                    title="移除字幕"
                    :data-testid="`subtitle-dialog-remove-${track.lang}`"
                    @click="handleRemoveImportedSubtitle(track)"
                  >
                    <svg class="subtitle-row-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Z"/>
                    </svg>
                  </button>
                </div>
              </li>
          </ul>

          <p v-else class="subtitle-empty-state" data-testid="subtitle-dialog-empty">
            {{ selectionEmptyStateText }}
          </p>
        </section>
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
  padding: 20px;
  background:
    radial-gradient(circle at top, rgba(76, 176, 255, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(4, 8, 14, 0.72), rgba(4, 8, 14, 0.88));
  backdrop-filter: blur(20px);
}

.subtitle-dialog {
  position: relative;
  width: min(920px, calc(100vw - 32px));
  max-height: min(720px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(16, 21, 33, 0.96), rgba(8, 12, 20, 0.98)),
    radial-gradient(circle at top right, rgba(92, 169, 255, 0.1), transparent 36%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.48);
}

.subtitle-dialog::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(138, 227, 255, 0.78), transparent);
  pointer-events: none;
}

.subtitle-dialog:focus {
  outline: none;
}

.subtitle-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.subtitle-dialog-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 320px;
  min-width: 0;
}

.subtitle-dialog-heading-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.subtitle-dialog-copy h3 {
  margin: 0;
  font-size: clamp(1.28rem, 1.8vw, 1.55rem);
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.subtitle-dialog-subtitle {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
  max-width: 34rem;
  font-size: 0.94rem;
}

.subtitle-dialog-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex: 0 1 auto;
  flex-wrap: wrap;
}

.subtitle-toolbar-pill {
  min-height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(103, 188, 255, 0.1);
  color: #d3efff;
  font-size: 0.76rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}

.subtitle-toolbar-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.82rem;
  white-space: nowrap;
}

.subtitle-dialog-close {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.18s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.subtitle-dialog-close:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(138, 223, 255, 0.28);
  transform: translateY(-1px);
}

.subtitle-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 24px 24px;
  min-height: 0;
  overflow: hidden;
}

.subtitle-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  min-width: 150px;
  height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(116, 228, 255, 0.98), rgba(70, 179, 255, 0.94));
  color: #06111b;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(72, 196, 255, 0.18);
}

.subtitle-import-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 26px rgba(72, 196, 255, 0.24);
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
  padding: 11px 13px;
  border-radius: 14px;
  font-size: 0.92rem;
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
  min-height: 0;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 14, 22, 0.74);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.subtitle-library-panel {
  flex: 1 1 auto;
  min-height: 0;
}

.subtitle-section-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.subtitle-track-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.subtitle-track-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.subtitle-track-row:hover {
  transform: translateY(-1px);
  border-color: rgba(138, 223, 255, 0.2);
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.16);
}

.subtitle-track-row--primary {
  border-color: rgba(78, 198, 255, 0.62);
  background: linear-gradient(180deg, rgba(42, 97, 145, 0.2), rgba(255, 255, 255, 0.03));
  box-shadow:
    inset 0 0 0 1px rgba(120, 224, 255, 0.28),
    0 0 0 1px rgba(63, 171, 255, 0.12);
}

.subtitle-track-row--secondary {
  border-color: rgba(212, 170, 104, 0.24);
  background: linear-gradient(180deg, rgba(120, 88, 34, 0.08), rgba(255, 255, 255, 0.02));
  box-shadow: inset 0 0 0 1px rgba(212, 170, 104, 0.12);
}

.subtitle-track-main {
  min-width: 0;
  display: flex;
  align-items: center;
}

.subtitle-track-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: nowrap;
}

.subtitle-row-btn--icon {
  width: 32px;
  min-width: 32px;
  padding: 0;
}

.subtitle-row-btn--selected {
  color: #ffffff;
  border-color: rgba(78, 198, 255, 0.58);
  background: linear-gradient(180deg, rgba(61, 168, 255, 0.3), rgba(33, 87, 142, 0.24));
  box-shadow:
    0 0 0 1px rgba(99, 210, 255, 0.2),
    0 8px 18px rgba(32, 118, 186, 0.22);
}

.subtitle-row-btn--secondary.subtitle-row-btn--selected {
  color: #ffe7bf;
  border-color: rgba(212, 170, 104, 0.28);
  background: linear-gradient(180deg, rgba(168, 122, 53, 0.16), rgba(95, 63, 20, 0.14));
  box-shadow: 0 0 0 1px rgba(212, 170, 104, 0.1);
}

.subtitle-row-btn--icon:disabled.subtitle-row-btn--selected {
  opacity: 1;
}

.subtitle-role-icon {
  display: block;
  width: 0.92rem;
  height: 0.72rem;
  flex: 0 0 auto;
}

.subtitle-track-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  flex-wrap: nowrap;
}

.subtitle-track-title {
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: -0.01em;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle-track-file {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 500;
  margin-left: 0.08em;
}

.subtitle-track-title,
.subtitle-track-file {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle-track-title .subtitle-track-file {
  color: var(--text-secondary);
}

.subtitle-track-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  flex-wrap: nowrap;
}

.subtitle-badge {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}

.subtitle-badge-local {
  background: rgba(116, 228, 255, 0.12);
  color: #bceeff;
}


.subtitle-badge-muted {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.76);
}

.subtitle-row-btn {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  font-size: 0.82rem;
}

.subtitle-row-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(138, 223, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
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
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.025);
  color: var(--text-secondary);
  line-height: 1.55;
}

@media (max-width: 900px) {
  .subtitle-library-panel {
    overflow: visible;
  }

  .subtitle-track-list {
    overflow: visible;
  }
}

@media (max-width: 768px) {
  .subtitle-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .subtitle-dialog {
    width: 100vw;
    max-height: min(88vh, 760px);
    border-radius: 24px 24px 0 0;
  }

  .subtitle-dialog-header {
    padding: 18px 18px 14px;
  }

  .subtitle-dialog-body {
    padding: 14px 18px 18px;
    overflow-y: auto;
  }

  .subtitle-toolbar-actions {
    justify-content: flex-end;
  }

  .subtitle-import-btn {
    min-width: 0;
  }

  .subtitle-track-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .subtitle-track-main {
    align-items: flex-start;
  }

  .subtitle-track-title-row {
    flex-wrap: wrap;
  }

  .subtitle-track-file {
    flex-basis: auto;
  }

  .subtitle-track-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}
</style>
