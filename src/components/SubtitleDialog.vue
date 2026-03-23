<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { createImportedSubtitleTrack, downloadSubtitleTrack } from '../utils/subtitles';

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
const activeLibraryTab = ref('download');

const hasImportedSubtitles = computed(() => props.importedSubtitles.length > 0);
const downloadableTracks = computed(() => props.subtitles);
const currentPrimaryTrack = computed(() => findTrackByLanguage(props.subtitleSelection.primaryLang));
const currentSecondaryTrack = computed(() => findTrackByLanguage(props.subtitleSelection.secondaryLang));
const hasPrimarySubtitle = computed(() => Boolean(currentPrimaryTrack.value));
const hasAvailableTracks = computed(() => props.subtitles.length > 0);
const secondarySubtitleOptions = computed(() =>
  props.subtitles.filter((track) => normalizeLocale(track?.lang) !== normalizeLocale(props.subtitleSelection.primaryLang))
);
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

watch(
  () => [hasImportedSubtitles.value, hasAvailableTracks.value],
  ([nextHasImported, nextHasAvailable]) => {
    if (activeLibraryTab.value === 'imported' && !nextHasImported && nextHasAvailable) {
      activeLibraryTab.value = 'download';
      return;
    }

    if (activeLibraryTab.value === 'download' && !nextHasAvailable && nextHasImported) {
      activeLibraryTab.value = 'imported';
    }
  },
  { immediate: true }
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

function setLibraryTab(nextTab) {
  activeLibraryTab.value = nextTab === 'imported' ? 'imported' : 'download';
}

function normalizeLocale(value) {
  return typeof value === 'string' ? value.trim().replace(/_/g, '-').toLowerCase() : '';
}

function normalizeSelectionLanguage(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function isTrackPrimary(track) {
  return normalizeLocale(track?.lang) === normalizeLocale(props.subtitleSelection.primaryLang);
}

function isTrackSecondary(track) {
  return normalizeLocale(track?.lang) === normalizeLocale(props.subtitleSelection.secondaryLang);
}

function resolveImportedSubtitleOrder(nextTrack) {
  const allTracks = [...props.importedSubtitles, ...props.remoteSubtitles];
  const matchedTrack = allTracks.find((track) => normalizeLocale(track?.lang) === normalizeLocale(nextTrack?.lang));

  if (matchedTrack) {
    return Number.isFinite(Number(matchedTrack.order)) ? Number(matchedTrack.order) : 0;
  }

  return props.remoteSubtitles.length + props.importedSubtitles.length;
}

function emitSubtitleSelectionChange(nextSelection) {
  emit('subtitle-selection-change', nextSelection);
}

function handleSecondarySubtitleChange(event) {
  const nextSecondaryLang = normalizeSelectionLanguage(event?.target?.value);

  if (!hasPrimarySubtitle.value) {
    return;
  }

  emitSubtitleSelectionChange({
    mode: 'showing',
    primaryLang: props.subtitleSelection.primaryLang,
    secondaryLang: nextSecondaryLang,
  });
  setStatus(
    nextSecondaryLang
      ? `次要字幕已切換為 ${findTrackByLanguage(nextSecondaryLang)?.label || nextSecondaryLang}`
      : '已清除次要字幕。',
    'success'
  );
}

function clearSecondarySubtitle() {
  emitSubtitleSelectionChange({
    mode: hasPrimarySubtitle.value ? 'showing' : 'off',
    primaryLang: props.subtitleSelection.primaryLang,
    secondaryLang: '',
  });
  setStatus('已清除次要字幕。', 'success');
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
          <h3 id="subtitleDialogTitle">字幕控制台</h3>
          <p id="subtitleDialogSubtitle" class="subtitle-dialog-subtitle">
            主字幕請用播放器控制列切換。這裡專心處理匯入字幕、次字幕和字幕檔管理。
          </p>
        </div>

        <div class="subtitle-dialog-toolbar">
          <div class="subtitle-toolbar-meta">
            <span class="subtitle-toolbar-pill">{{ importSessionSummary }}</span>
            <span class="subtitle-toolbar-pill">支援 .vtt / .srt</span>
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

        <div class="subtitle-section">
          <div class="subtitle-section-header">
            <div class="subtitle-section-copy">
              <h4>次字幕</h4>
              <p class="subtitle-section-caption">選擇第二條較小字體的字幕。主字幕仍由播放器控制列決定。</p>
            </div>
            <button
              type="button"
              class="glass-btn subtitle-row-btn"
              :disabled="!subtitleSelection.secondaryLang"
              data-testid="subtitle-dialog-clear-secondary"
              @click="clearSecondarySubtitle"
            >
              清除次字幕
            </button>
          </div>

          <div
            v-if="hasAvailableTracks"
            class="subtitle-selection-grid"
            data-testid="subtitle-dialog-selection-grid"
          >
            <label class="subtitle-select-field">
              <span class="subtitle-select-label">選擇次字幕</span>
              <select
                class="subtitle-select-input"
                data-testid="subtitle-dialog-secondary-select"
                :value="subtitleSelection.secondaryLang"
                :disabled="!hasPrimarySubtitle"
                @change="handleSecondarySubtitleChange"
              >
                <option value="">不顯示</option>
                <option
                  v-for="track in secondarySubtitleOptions"
                  :key="`secondary-${track.lang}`"
                  :value="track.lang"
                >
                  {{ track.label }}
                </option>
              </select>
            </label>
          </div>

          <div v-if="hasAvailableTracks" class="subtitle-role-summary">
            <div class="subtitle-role-card subtitle-role-card-primary">
              <span class="subtitle-role-label">主字幕</span>
              <strong class="subtitle-role-value">{{ currentPrimaryTrack?.label || '已關閉' }}</strong>
            </div>
            <div class="subtitle-role-card subtitle-role-card-secondary">
              <span class="subtitle-role-label">次字幕</span>
              <strong class="subtitle-role-value">{{ currentSecondaryTrack?.label || '未設定' }}</strong>
            </div>
          </div>

          <p
            v-if="hasAvailableTracks && !hasPrimarySubtitle"
            class="subtitle-empty-state"
            data-testid="subtitle-dialog-primary-helper"
          >
            先用播放器上的字幕按鈕選一個主字幕，才能開啟次要字幕。
          </p>

          <p
            v-else-if="!hasAvailableTracks"
            class="subtitle-empty-state"
            data-testid="subtitle-dialog-selection-empty"
          >
            {{ selectionEmptyStateText }}
          </p>
        </div>

        <div class="subtitle-section">
          <div class="subtitle-section-header">
            <div class="subtitle-section-copy">
              <h4>字幕清單</h4>
              <p class="subtitle-section-caption">管理你剛匯入的字幕，或下載目前播放器可用的字幕檔。</p>
            </div>
            <div class="subtitle-library-tabs" role="tablist" aria-label="字幕清單分類" data-testid="subtitle-dialog-library-tabs">
              <button
                type="button"
                class="subtitle-library-tab"
                :class="{ 'subtitle-library-tab--active': activeLibraryTab === 'imported' }"
                role="tab"
                :aria-selected="activeLibraryTab === 'imported' ? 'true' : 'false'"
                data-testid="subtitle-dialog-tab-imported"
                @click="setLibraryTab('imported')"
              >
                已匯入
              </button>
              <button
                type="button"
                class="subtitle-library-tab"
                :class="{ 'subtitle-library-tab--active': activeLibraryTab === 'download' }"
                role="tab"
                :aria-selected="activeLibraryTab === 'download' ? 'true' : 'false'"
                data-testid="subtitle-dialog-tab-download"
                @click="setLibraryTab('download')"
              >
                可下載
              </button>
            </div>
          </div>

          <p v-if="activeLibraryTab === 'imported'" class="subtitle-library-note">
            本機字幕只保留在這次瀏覽器工作階段；如果和影片內建同語系，會先以本機版本覆蓋顯示。
          </p>
          <p v-else class="subtitle-library-note">
            這裡列出目前播放器可見的字幕來源，包含影片內建字幕和本機匯入字幕。
          </p>

          <ul
            v-if="activeLibraryTab === 'imported' && hasImportedSubtitles"
            class="subtitle-track-list"
            data-testid="subtitle-dialog-imported-list"
          >
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
                    <span class="subtitle-track-state">{{ isOverridingCidTrack(track) ? '覆蓋影片字幕' : '僅本機使用' }}</span>
                  </div>
                  <div class="subtitle-track-meta">
                    <span class="subtitle-badge subtitle-badge-local">本機</span>
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
                <span>移除</span>
              </button>
            </li>
          </ul>

          <p
            v-else-if="activeLibraryTab === 'imported'"
            class="subtitle-empty-state"
            data-testid="subtitle-dialog-imported-empty"
          >
            先匯入第一條本機字幕，這裡就會開始顯示暫存中的字幕清單。
          </p>

          <ul
            v-else-if="hasAvailableTracks"
            class="subtitle-track-list"
            data-testid="subtitle-dialog-download-list"
          >
            <li
              v-for="track in downloadableTracks"
              :key="`download-${getTrackActionKey(track)}`"
              class="subtitle-track-row"
            >
              <div class="subtitle-track-leading">
                <div class="subtitle-track-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M12 3v9.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V3h1ZM5 19h14v2H5v-2Z"/>
                  </svg>
                </div>
                <div class="subtitle-track-copy">
                  <div class="subtitle-track-headline">
                    <div class="subtitle-track-title">{{ track.label }}</div>
                    <span class="subtitle-track-state">{{ track.source === 'local' ? '本機字幕' : '影片字幕' }}</span>
                  </div>
                  <div class="subtitle-track-meta">
                    <span v-if="track.source === 'local'" class="subtitle-badge subtitle-badge-local">本機</span>
                    <span v-if="isTrackPrimary(track)" class="subtitle-badge subtitle-badge-role">主字幕</span>
                    <span v-if="isTrackSecondary(track)" class="subtitle-badge subtitle-badge-role">次字幕</span>
                    <span>{{ track.fileName || `${track.lang}.vtt` }}</span>
                  </div>
                </div>
              </div>
              <div class="subtitle-track-actions">
                <button
                  type="button"
                  class="glass-btn subtitle-row-btn"
                  :disabled="downloadingTrackKey === getTrackActionKey(track)"
                  :data-testid="`subtitle-dialog-download-${track.lang}`"
                  @click="handleDownloadSubtitle(track)"
                >
                  <svg class="subtitle-row-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M12 3v9.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V3h1ZM5 19h14v2H5v-2Z"/>
                  </svg>
                  <span>{{ downloadingTrackKey === getTrackActionKey(track) ? '下載中…' : '下載' }}</span>
                </button>
              </div>
            </li>
          </ul>

          <p v-else class="subtitle-empty-state" data-testid="subtitle-dialog-download-empty">
            目前沒有可下載的字幕。
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
  background:
    radial-gradient(circle at top, rgba(76, 176, 255, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(4, 8, 14, 0.72), rgba(4, 8, 14, 0.88));
  backdrop-filter: blur(20px);
}

.subtitle-dialog {
  position: relative;
  width: min(760px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 48px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(19, 25, 40, 0.94), rgba(9, 13, 22, 0.98)),
    radial-gradient(circle at top right, rgba(92, 169, 255, 0.12), transparent 34%);
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
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  padding: 28px 28px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.subtitle-dialog-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 300px;
}

.subtitle-dialog-copy h3 {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 1.85rem);
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.subtitle-dialog-subtitle {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
  max-width: 36rem;
}

.subtitle-dialog-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 1 1 320px;
  flex-wrap: wrap;
}

.subtitle-toolbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.subtitle-toolbar-pill {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.8rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
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
  display: grid;
  gap: 16px;
  padding: 22px 28px 28px;
  overflow-y: auto;
}

.subtitle-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.subtitle-selection-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.subtitle-select-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtitle-select-label {
  color: rgba(255, 255, 255, 0.66);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.subtitle-select-input {
  width: 100%;
  min-height: 52px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 12, 20, 0.9);
  color: var(--text-primary);
  padding: 0 14px;
  font: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.subtitle-select-input:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.subtitle-role-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.subtitle-role-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 86px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02)),
    rgba(255, 255, 255, 0.015);
}

.subtitle-role-card-primary {
  border-color: rgba(72, 196, 255, 0.24);
}

.subtitle-role-card-secondary {
  border-color: rgba(255, 183, 76, 0.22);
}

.subtitle-role-label {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.subtitle-role-value {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.02em;
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
  height: 50px;
  padding: 0 18px;
  border-radius: 999px;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(135deg, rgba(116, 228, 255, 0.98), rgba(70, 179, 255, 0.94));
  color: #06111b;
  font-weight: 700;
  box-shadow: 0 14px 28px rgba(72, 196, 255, 0.2);
}

.subtitle-import-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 30px rgba(72, 196, 255, 0.26);
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02)),
    rgba(11, 16, 26, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.subtitle-section::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(138, 223, 255, 0.32), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.subtitle-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.subtitle-section-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subtitle-section-copy h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.08rem;
  letter-spacing: -0.02em;
}

.subtitle-section-caption {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.45;
}

.subtitle-library-tabs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.subtitle-library-tab {
  min-height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.subtitle-library-tab--active {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.subtitle-library-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.55;
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
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
    rgba(10, 14, 22, 0.84);
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.subtitle-track-row::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, rgba(116, 228, 255, 0.92), rgba(255, 183, 76, 0.56));
  opacity: 0.72;
}

.subtitle-track-row:hover {
  transform: translateY(-1px);
  border-color: rgba(138, 223, 255, 0.2);
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.18);
}

.subtitle-track-leading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.subtitle-track-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.subtitle-track-glyph {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(116, 228, 255, 0.16), rgba(255, 183, 76, 0.14));
  color: #8fe1ff;
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
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle-track-state {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.74rem;
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
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}

.subtitle-badge-local {
  background: rgba(116, 228, 255, 0.12);
  color: #bceeff;
}

.subtitle-badge-role {
  background: rgba(255, 183, 76, 0.14);
  color: #ffe0ac;
}

.subtitle-row-btn {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
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
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.025);
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
    padding: 22px 18px 16px;
  }

  .subtitle-dialog-body {
    padding: 18px;
  }

  .subtitle-toolbar-actions {
    justify-content: flex-end;
  }

  .subtitle-import-btn {
    min-width: 0;
  }

  .subtitle-selection-grid {
    grid-template-columns: 1fr;
  }

  .subtitle-role-summary {
    grid-template-columns: 1fr;
  }

  .subtitle-track-row {
    flex-direction: column;
    align-items: stretch;
  }

  .subtitle-track-leading {
    width: 100%;
  }

  .subtitle-track-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .subtitle-library-tabs {
    width: 100%;
  }

  .subtitle-library-tab {
    flex: 1 1 0;
  }
}
</style>
