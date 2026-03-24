<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from '../i18n';
import {
  buildSubtitleManifestPayload,
  createImportedSubtitleTrack,
  revokeImportedSubtitleTracks,
  stringifySubtitleManifest,
} from '../utils/subtitles';
import {
  buildInfoJsonPayload,
  createVideoInfoDraftFormSnapshot,
  createVideoInfoDraftFormState,
  createDefaultVideoInfo,
  isVideoInfoDraftFormPristine,
  stringifyInfoJson,
} from '../utils/videoInfo';

const processorResolutionOptionIds = Object.freeze(['4k', '2k', '1080p', '720p', '480p', 'orig']);
const defaultProcessorResolutionSelection = Object.freeze(['1080p', '720p', '480p']);

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

const dialogTabIds = Object.freeze(['metadata', 'subtitles', 'video']);
const dialogRef = ref(null);
const titleInputRef = ref(null);
const subtitleInputRef = ref(null);
const videoInputRef = ref(null);
const activeTab = ref('metadata');
const feedbackMessage = ref('');
const localVideoFile = ref(null);
const localSubtitleTracks = ref([]);
const form = reactive(createVideoInfoDraftFormState(props.initialVideoInfo));
const processorForm = reactive(createProcessorFormState());
const lastSyncedFormSnapshot = ref(createVideoInfoDraftFormSnapshot(form));

let feedbackTimeout = 0;

const generatedPayload = computed(() =>
  buildInfoJsonPayload({
    id: form.id,
    title: form.title,
    uploader: form.uploader,
    channelId: form.channelId,
    uploadDate: form.uploadDate,
    description: form.description,
    tags: parseListInput(form.tags),
    categories: parseListInput(form.categories),
  })
);
const generatedJson = computed(() => stringifyInfoJson(generatedPayload.value));
const generatedFieldCount = computed(() => Object.keys(generatedPayload.value).length);
const hasGeneratedInfoJson = computed(() => generatedFieldCount.value > 0);
const subtitleManifestPayload = computed(() => buildSubtitleManifestPayload(localSubtitleTracks.value));
const subtitleManifestJson = computed(() => stringifySubtitleManifest(localSubtitleTracks.value));
const subtitleTrackCount = computed(() => subtitleManifestPayload.value.tracks.length);
const hasSubtitleManifest = computed(() => subtitleTrackCount.value > 0);
const videoFileInfo = computed(() => describeLocalFile(localVideoFile.value));
const localAssetCount = computed(() => (localVideoFile.value ? 1 : 0) + subtitleTrackCount.value);
const dialogTabs = computed(() =>
  dialogTabIds.map((id, index) => ({
    id,
    step: index + 1,
    label: t(`infoJson.tabs.${id}.label`),
    caption: t(`infoJson.panels.${id}.caption`),
  }))
);
const processorResolutionChoices = computed(() =>
  processorResolutionOptionIds.map((id) => ({
    id,
    label: t(`infoJson.video.resolutionOptions.${id}.label`),
    hint: t(`infoJson.video.resolutionOptions.${id}.hint`),
  }))
);
const selectedProcessorResolutions = computed(() =>
  normalizeProcessorResolutionSelection(processorForm.selectedResolutions)
);
const hasSelectedProcessorResolutions = computed(() => selectedProcessorResolutions.value.length > 0);
const effectiveIncludeInfoJson = computed(
  () => hasGeneratedInfoJson.value && processorForm.includeInfoJson === true
);
const effectiveIncludeSubtitleManifest = computed(
  () => hasSubtitleManifest.value && processorForm.includeSubtitlesJson === true
);
const processorAttachmentCount = computed(
  () => Number(effectiveIncludeInfoJson.value) + Number(effectiveIncludeSubtitleManifest.value)
);
const videoProcessorStatus = computed(() => {
  if (!localVideoFile.value) {
    return {
      tone: 'idle',
      label: t('infoJson.video.pending'),
    };
  }

  if (!hasSelectedProcessorResolutions.value) {
    return {
      tone: 'warning',
      label: t('infoJson.video.missingResolutions'),
    };
  }

  return {
    tone: 'ready',
    label: t('infoJson.video.ready'),
  };
});
const videoProcessorDraft = computed(() =>
  buildLocalVideoProcessorDraft(localVideoFile.value, {
    selectedResolutions: selectedProcessorResolutions.value,
    includeInfoJson: effectiveIncludeInfoJson.value,
    includeSubtitlesJson: effectiveIncludeSubtitleManifest.value,
    infoFieldCount: generatedFieldCount.value,
    subtitleTrackCount: subtitleTrackCount.value,
  })
);
const videoProcessorDraftJson = computed(() =>
  videoProcessorDraft.value ? `${JSON.stringify(videoProcessorDraft.value, null, 2)}\n` : ''
);
const footerStatus = computed(() => {
  if (feedbackMessage.value) {
    return feedbackMessage.value;
  }

  return t('infoJson.status.ready', {
    info: generatedFieldCount.value,
    subtitles: subtitleTrackCount.value,
    assets: localAssetCount.value,
  });
});

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      clearFeedback();
      return;
    }

    activeTab.value = 'metadata';
    syncForm(props.initialVideoInfo);
    clearFeedback();
    await nextTick();
    dialogRef.value?.focus();
    titleInputRef.value?.focus();
  }
);

watch(
  () => props.initialVideoInfo,
  (nextVideoInfo) => {
    if (!props.open) {
      return;
    }

    if (!isVideoInfoDraftFormPristine(form, lastSyncedFormSnapshot.value)) {
      return;
    }

    syncForm(nextVideoInfo);
  },
  { deep: true }
);

watch(
  hasGeneratedInfoJson,
  (available) => {
    if (!available) {
      processorForm.includeInfoJson = false;
    }
  },
  { immediate: true }
);

watch(
  hasSubtitleManifest,
  (available) => {
    if (!available) {
      processorForm.includeSubtitlesJson = false;
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  clearFeedbackTimeout();
  clearVideoFile({ silent: true });
  clearSubtitleTracks({ silent: true });
});

function createProcessorFormState() {
  return {
    selectedResolutions: [...defaultProcessorResolutionSelection],
    includeInfoJson: true,
    includeSubtitlesJson: true,
  };
}

function syncForm(videoInfo) {
  const nextFormState = createVideoInfoDraftFormState(videoInfo);
  Object.assign(form, nextFormState);
  lastSyncedFormSnapshot.value = createVideoInfoDraftFormSnapshot(nextFormState);
}

function parseListInput(value) {
  return String(value || '')
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeProcessorResolutionSelection(values) {
  const selected = new Set(Array.isArray(values) ? values.map((value) => normalizeString(value)) : []);
  return processorResolutionOptionIds.filter((id) => selected.has(id));
}

function describeLocalFile(file) {
  if (!file) {
    return null;
  }

  return {
    name: normalizeString(file.name) || t('infoJson.file.unknownName'),
    sizeLabel: formatFileSize(file.size),
    typeLabel: normalizeString(file.type) || t('infoJson.file.unknownType'),
    updatedAtLabel: formatTimestamp(file.lastModified),
  };
}

function buildLocalVideoProcessorDraft(file, options = {}) {
  if (!file) {
    return null;
  }

  const selectedResolutions = normalizeProcessorResolutionSelection(options.selectedResolutions);
  const attachments = [];
  const warnings = [];

  if (options.includeInfoJson === true) {
    attachments.push({
      name: 'info.json',
      content_type: 'application/json',
      field_count: Number.isFinite(options.infoFieldCount) ? options.infoFieldCount : 0,
    });
  }

  if (options.includeSubtitlesJson === true) {
    attachments.push({
      name: 'subtitles.json',
      content_type: 'application/json',
      track_count: Number.isFinite(options.subtitleTrackCount) ? options.subtitleTrackCount : 0,
    });
  }

  if (selectedResolutions.length === 0) {
    warnings.push('select_at_least_one_resolution');
  }

  if (attachments.length === 0) {
    warnings.push('no_sidecar_attachment');
  }

  const draft = {
    version: 1,
    mode: 'local-upload-draft',
    status: 'pending-backend-integration',
    pipeline: 'multi-resolution-hls',
    source_video: {
      file_name: normalizeString(file.name) || 'video',
      mime_type: normalizeString(file.type),
      size_bytes: Number.isFinite(file.size) ? Math.max(0, file.size) : 0,
      last_modified:
        Number.isFinite(file.lastModified) && file.lastModified > 0
          ? new Date(file.lastModified).toISOString()
          : '',
    },
    processing_request: {
      target_resolutions: selectedResolutions,
      include_sidecars: {
        info_json: options.includeInfoJson === true,
        subtitles_json: options.includeSubtitlesJson === true,
      },
    },
    attachments,
    validation: {
      has_video: true,
      has_selected_resolutions: selectedResolutions.length > 0,
    },
  };

  if (warnings.length > 0) {
    draft.warnings = warnings;
  }

  return draft;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const normalized = bytes / 1024 ** exponent;
  const precision = normalized >= 100 || exponent === 0 ? 0 : normalized >= 10 ? 1 : 2;

  return `${normalized.toFixed(precision)} ${units[exponent]}`;
}

function formatTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return t('infoJson.file.unknownUpdatedAt');
  }

  return new Date(timestamp).toLocaleString();
}

function clearFeedbackTimeout() {
  if (!feedbackTimeout) return;

  clearTimeout(feedbackTimeout);
  feedbackTimeout = 0;
}

function scheduleFeedbackReset() {
  clearFeedbackTimeout();
  feedbackTimeout = window.setTimeout(() => {
    feedbackMessage.value = '';
    feedbackTimeout = 0;
  }, 2600);
}

function setFeedback(message) {
  feedbackMessage.value = message;
  scheduleFeedbackReset();
}

function clearFeedback() {
  clearFeedbackTimeout();
  feedbackMessage.value = '';
}

function setActiveTab(tabId) {
  if (!dialogTabIds.includes(tabId)) {
    return;
  }

  activeTab.value = tabId;

  if (tabId === 'metadata') {
    nextTick(() => {
      titleInputRef.value?.focus();
    });
  }
}

function closeDialog() {
  emit('close');
}

function clearForm() {
  Object.assign(form, createVideoInfoDraftFormState(createDefaultVideoInfo()));
  lastSyncedFormSnapshot.value = null;
  clearFeedback();
  nextTick(() => {
    titleInputRef.value?.focus();
  });
}

function resetInput(refTarget) {
  if (refTarget?.value) {
    refTarget.value.value = '';
  }
}

function normalizeLocalSubtitleOrder(tracks) {
  return [...tracks]
    .sort((left, right) => left.order - right.order)
    .map((track, index) => ({
      ...track,
      order: index,
    }));
}

function upsertLocalSubtitleTrack(existingTracks, nextTrack) {
  const fileName = normalizeString(nextTrack?.fileName);
  const nextTracks = [...existingTracks];
  const duplicateIndex = nextTracks.findIndex((track) => {
    if (track.id && nextTrack.id && track.id === nextTrack.id) {
      return true;
    }

    return fileName && normalizeString(track?.fileName) === fileName;
  });

  if (duplicateIndex >= 0) {
    revokeImportedSubtitleTracks([nextTracks[duplicateIndex]]);
    nextTracks.splice(duplicateIndex, 1, nextTrack);
    return nextTracks;
  }

  nextTracks.push(nextTrack);
  return nextTracks;
}

async function handleSubtitleSelection(event) {
  const files = Array.from(event.target?.files || []);
  event.target.value = '';

  if (files.length === 0) {
    return;
  }

  const baseOrder = localSubtitleTracks.value.length;
  const results = await Promise.allSettled(
    files.map((file, index) => createImportedSubtitleTrack(file, { order: baseOrder + index }))
  );

  let nextTracks = [...localSubtitleTracks.value];
  let successCount = 0;
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      nextTracks = upsertLocalSubtitleTrack(nextTracks, result.value);
      successCount += 1;
      return;
    }

    errors.push(`${files[index]?.name || 'subtitle'}: ${result.reason?.message || t('infoJson.status.subtitlesFailed')}`);
  });

  localSubtitleTracks.value = normalizeLocalSubtitleOrder(nextTracks);

  if (successCount > 0 && errors.length === 0) {
    setFeedback(t('infoJson.status.subtitlesImported', { count: successCount }));
    return;
  }

  if (successCount > 0) {
    setFeedback(`${t('infoJson.status.subtitlesPartial', { count: successCount })} ${errors[0]}`);
    return;
  }

  setFeedback(errors[0] || t('infoJson.status.subtitlesFailed'));
}

function removeLocalSubtitle(trackId) {
  const nextTracks = [];

  localSubtitleTracks.value.forEach((track) => {
    if (track.id === trackId) {
      revokeImportedSubtitleTracks([track]);
      return;
    }

    nextTracks.push(track);
  });

  localSubtitleTracks.value = normalizeLocalSubtitleOrder(nextTracks);
}

function clearSubtitleTracks(options = {}) {
  revokeImportedSubtitleTracks(localSubtitleTracks.value);
  localSubtitleTracks.value = [];
  resetInput(subtitleInputRef);

  if (options.silent !== true) {
    setFeedback(t('infoJson.status.subtitlesCleared'));
  }
}

function clearVideoFile(options = {}) {
  localVideoFile.value = null;
  resetInput(videoInputRef);

  if (options.silent !== true) {
    setFeedback(t('infoJson.status.videoCleared'));
  }
}

function handleVideoSelection(event) {
  const file = event.target?.files?.[0] || null;
  event.target.value = '';

  if (!file) {
    return;
  }

  if (normalizeString(file.type) && !file.type.startsWith('video/')) {
    setFeedback(t('infoJson.status.videoRejected'));
    return;
  }

  localVideoFile.value = file;
  setFeedback(t('infoJson.status.videoSelected', { name: file.name }));
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

function copyText(text, message) {
  const handleSuccess = () => {
    setFeedback(message);
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

function downloadTextFile(text, fileName, contentType, successMessage) {
  const BlobImpl = globalThis.Blob;
  const createObjectURL = window.URL?.createObjectURL;

  if (typeof BlobImpl !== 'function' || typeof createObjectURL !== 'function') {
    return;
  }

  const blob = new BlobImpl([text], {
    type: contentType,
  });
  const href = createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setFeedback(successMessage);
  window.setTimeout(() => {
    window.URL?.revokeObjectURL?.(href);
  }, 0);
}

function copyInfoJson() {
  if (!hasGeneratedInfoJson.value) {
    return;
  }

  copyText(generatedJson.value, t('infoJson.status.infoCopied'));
}

function downloadInfoJson() {
  if (!hasGeneratedInfoJson.value) {
    return;
  }

  downloadTextFile(
    generatedJson.value,
    'info.json',
    'application/json;charset=utf-8',
    t('infoJson.status.infoDownloaded')
  );
}

function downloadSubtitleManifestFile() {
  if (!hasSubtitleManifest.value) {
    return;
  }

  downloadTextFile(
    subtitleManifestJson.value,
    'subtitles.json',
    'application/json;charset=utf-8',
    t('infoJson.status.subtitleManifestDownloaded')
  );
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
        <div
          class="info-json-tabbar"
          role="tablist"
          :aria-label="t('infoJson.tabs.ariaLabel')"
        >
          <button
            v-for="tab in dialogTabs"
            :id="`infoJsonTab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            class="info-json-tab"
            :class="{ 'is-active': activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            :aria-controls="`infoJsonPanel-${tab.id}`"
            :tabindex="activeTab === tab.id ? 0 : -1"
            :data-testid="`info-json-tab-${tab.id}`"
            @click="setActiveTab(tab.id)"
          >
            <span class="panel-step info-json-tab-step">{{ tab.step }}</span>
            <span class="info-json-tab-copy">
              <strong>{{ tab.label }}</strong>
              <small>{{ tab.caption }}</small>
            </span>
          </button>
        </div>

        <section
          v-show="activeTab === 'metadata'"
          id="infoJsonPanel-metadata"
          class="info-json-panel info-json-tab-panel"
          role="tabpanel"
          aria-labelledby="infoJsonTab-metadata"
          data-testid="info-json-metadata-panel"
        >
          <div class="panel-header">
            <div class="panel-header-copy">
              <span class="panel-step">1</span>
              <div>
                <h4>{{ t('infoJson.panels.metadata.title') }}</h4>
                <p>{{ t('infoJson.panels.metadata.caption') }}</p>
              </div>
            </div>
            <button type="button" class="ghost-btn ghost-btn--small" @click="clearForm">
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
                type="date"
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

          <div class="preview-card">
            <div class="panel-header panel-header--stacked">
              <div>
                <h4>{{ t('infoJson.manifests.infoTitle') }}</h4>
                <p>{{ t('infoJson.manifests.infoCaption') }}</p>
              </div>
              <span class="preview-badge">info.json</span>
            </div>

            <div v-if="hasGeneratedInfoJson" class="preview-meta">
              <span>{{ t('infoJson.preview.summary', { count: generatedFieldCount }) }}</span>
              <span>{{ t('infoJson.preview.omitEmpty') }}</span>
            </div>

            <pre v-if="hasGeneratedInfoJson" class="json-preview"><code>{{ generatedJson }}</code></pre>
            <div v-else class="empty-state empty-state--preview">
              {{ t('infoJson.manifests.infoEmpty') }}
            </div>

            <div class="panel-actions">
              <button
                type="button"
                class="ghost-btn"
                :disabled="!hasGeneratedInfoJson"
                @click="copyInfoJson"
              >
                {{ t('infoJson.actions.copy') }}
              </button>
              <button
                type="button"
                class="primary-btn"
                data-testid="info-json-download-info-button"
                :disabled="!hasGeneratedInfoJson"
                @click="downloadInfoJson"
              >
                {{ t('infoJson.actions.download') }}
              </button>
            </div>
          </div>
        </section>

          <section
            v-show="activeTab === 'subtitles'"
            id="infoJsonPanel-subtitles"
            class="info-json-panel info-json-tab-panel"
            role="tabpanel"
            aria-labelledby="infoJsonTab-subtitles"
            data-testid="info-json-subtitles-panel"
          >
            <div class="panel-header">
              <div class="panel-header-copy">
                <span class="panel-step">2</span>
                <div>
                  <h4>{{ t('infoJson.panels.subtitles.title') }}</h4>
                  <p>{{ t('infoJson.panels.subtitles.caption') }}</p>
                </div>
              </div>
              <button
                type="button"
                class="ghost-btn ghost-btn--small"
                :disabled="!hasSubtitleManifest"
                @click="clearSubtitleTracks()"
              >
                {{ t('infoJson.actions.clearSubtitles') }}
              </button>
            </div>

            <div class="asset-meta-banner">{{ t('infoJson.assets.localOnly') }}</div>

            <label class="asset-uploader" for="infoJsonSubtitleInput">
              <input
                id="infoJsonSubtitleInput"
                ref="subtitleInputRef"
                class="sr-only"
                type="file"
                accept=".vtt,.srt,text/vtt,application/x-subrip"
                multiple
                data-testid="info-json-subtitles-input"
                @change="handleSubtitleSelection"
              />
              <span class="asset-uploader-copy">
                <strong>{{ t('infoJson.assets.subtitles.title') }}</strong>
                <span>{{ t('infoJson.assets.subtitles.caption') }}</span>
              </span>
              <span class="asset-uploader-action">
                {{ localSubtitleTracks.length > 0 ? t('infoJson.assets.replace') : t('infoJson.assets.upload') }}
              </span>
            </label>

            <div v-if="hasSubtitleManifest" class="subtitle-track-list">
              <article v-for="track in localSubtitleTracks" :key="track.id" class="subtitle-track-item">
                <div class="subtitle-track-copy">
                  <strong>{{ track.label }}</strong>
                  <span>{{ track.fileName }}</span>
                  <span>{{ track.lang }}</span>
                </div>
                <button type="button" class="ghost-btn ghost-btn--small" @click="removeLocalSubtitle(track.id)">
                  {{ t('infoJson.assets.remove') }}
                </button>
              </article>
            </div>
            <div v-else class="empty-state">
              {{ t('infoJson.assets.subtitles.empty') }}
            </div>

            <div class="preview-card">
              <div class="panel-header panel-header--stacked">
                <div>
                  <h4>{{ t('infoJson.manifests.subtitlesTitle') }}</h4>
                  <p>{{ t('infoJson.manifests.subtitlesCaption') }}</p>
                </div>
                <span class="preview-badge">subtitles.json</span>
              </div>

              <div v-if="hasSubtitleManifest" class="preview-meta">
                <span>{{ t('infoJson.assets.subtitles.count', { count: subtitleTrackCount }) }}</span>
                <span>{{ t('infoJson.preview.omitEmpty') }}</span>
              </div>

              <pre v-if="hasSubtitleManifest" class="json-preview"><code>{{ subtitleManifestJson }}</code></pre>
              <div v-else class="empty-state empty-state--preview">
                {{ t('infoJson.manifests.subtitlesEmpty') }}
              </div>

              <div class="panel-actions">
                <button
                  type="button"
                  class="primary-btn"
                  data-testid="info-json-download-subtitles-button"
                  :disabled="!hasSubtitleManifest"
                  @click="downloadSubtitleManifestFile"
                >
                  {{ t('infoJson.assets.subtitles.download') }}
                </button>
              </div>
            </div>
          </section>

          <section
            v-show="activeTab === 'video'"
            id="infoJsonPanel-video"
            class="info-json-panel info-json-tab-panel"
            role="tabpanel"
            aria-labelledby="infoJsonTab-video"
            data-testid="info-json-video-panel"
          >
            <div class="panel-header">
              <div class="panel-header-copy">
                <span class="panel-step">3</span>
                <div>
                  <h4>{{ t('infoJson.panels.video.title') }}</h4>
                  <p>{{ t('infoJson.panels.video.caption') }}</p>
                </div>
              </div>
              <button
                type="button"
                class="ghost-btn ghost-btn--small"
                :disabled="!localVideoFile"
                @click="clearVideoFile()"
              >
                {{ t('infoJson.actions.clearVideo') }}
              </button>
            </div>

            <label class="asset-uploader" for="infoJsonVideoInput">
              <input
                id="infoJsonVideoInput"
                ref="videoInputRef"
                class="sr-only"
                type="file"
                accept="video/*"
                data-testid="info-json-video-input"
                @change="handleVideoSelection"
              />
              <span class="asset-uploader-copy">
                <strong>{{ t('infoJson.assets.video.title') }}</strong>
                <span>{{ t('infoJson.assets.video.caption') }}</span>
              </span>
              <span class="asset-uploader-action">
                {{ localVideoFile ? t('infoJson.assets.replace') : t('infoJson.assets.upload') }}
              </span>
            </label>

            <div class="processor-section">
              <div class="processor-section-header">
                <h5>{{ t('infoJson.video.resolutionsTitle') }}</h5>
                <p>{{ t('infoJson.video.resolutionsCaption') }}</p>
              </div>

              <div class="processor-resolution-grid">
                <label
                  v-for="option in processorResolutionChoices"
                  :key="option.id"
                  class="processor-choice"
                >
                  <input
                    v-model="processorForm.selectedResolutions"
                    type="checkbox"
                    :value="option.id"
                    :data-testid="`info-json-resolution-${option.id}`"
                  />
                  <span class="processor-choice-copy">
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.hint }}</small>
                  </span>
                </label>
              </div>

              <div class="processor-hint">
                {{
                  hasSelectedProcessorResolutions
                    ? t('infoJson.video.selectedResolutions', { count: selectedProcessorResolutions.length })
                    : t('infoJson.video.noResolutionSelected')
                }}
              </div>
              <small class="processor-footnote">{{ t('infoJson.video.resolutionsHint') }}</small>
            </div>

            <div class="processor-section">
              <div class="processor-section-header">
                <h5>{{ t('infoJson.video.attachmentsTitle') }}</h5>
                <p>{{ t('infoJson.video.attachmentsCaption') }}</p>
              </div>

              <div class="processor-toggle-list">
                <label class="processor-toggle-card">
                  <input
                    v-model="processorForm.includeInfoJson"
                    type="checkbox"
                    data-testid="info-json-attach-info-toggle"
                    :disabled="!hasGeneratedInfoJson"
                  />
                  <span class="processor-toggle-copy">
                    <strong>{{ t('infoJson.video.includeInfo') }}</strong>
                    <small>
                      {{
                        hasGeneratedInfoJson
                          ? t('infoJson.video.includeInfoHintReady')
                          : t('infoJson.video.includeInfoHintUnavailable')
                      }}
                    </small>
                  </span>
                </label>

                <label class="processor-toggle-card">
                  <input
                    v-model="processorForm.includeSubtitlesJson"
                    type="checkbox"
                    data-testid="info-json-attach-subtitles-toggle"
                    :disabled="!hasSubtitleManifest"
                  />
                  <span class="processor-toggle-copy">
                    <strong>{{ t('infoJson.video.includeSubtitles') }}</strong>
                    <small>
                      {{
                        hasSubtitleManifest
                          ? t('infoJson.video.includeSubtitlesHintReady')
                          : t('infoJson.video.includeSubtitlesHintUnavailable')
                      }}
                    </small>
                  </span>
                </label>
              </div>
            </div>

            <div class="asset-card">
              <div class="asset-card-header">
                <div>
                  <h5>{{ t('infoJson.assets.video.title') }}</h5>
                  <p class="asset-card-caption">{{ t('infoJson.assets.video.caption') }}</p>
                </div>
                <span
                  class="status-pill"
                  :class="{
                    'is-ready': videoProcessorStatus.tone === 'ready',
                    'is-idle': videoProcessorStatus.tone === 'idle',
                    'is-warning': videoProcessorStatus.tone === 'warning',
                  }"
                >
                  {{ videoProcessorStatus.label }}
                </span>
              </div>

              <div v-if="localVideoFile && videoFileInfo" class="asset-card-content">
                <dl class="file-meta-list">
                  <div>
                    <dt>{{ t('infoJson.file.name') }}</dt>
                    <dd>{{ videoFileInfo.name }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('infoJson.file.size') }}</dt>
                    <dd>{{ videoFileInfo.sizeLabel }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('infoJson.file.type') }}</dt>
                    <dd>{{ videoFileInfo.typeLabel }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('infoJson.file.updatedAt') }}</dt>
                    <dd>{{ videoFileInfo.updatedAtLabel }}</dd>
                  </div>
                </dl>
              </div>

              <div v-else class="empty-state empty-state--compact">
                {{ t('infoJson.assets.video.empty') }}
              </div>
            </div>

            <div class="preview-card">
              <div class="panel-header panel-header--stacked">
                <div>
                  <h4>{{ t('infoJson.video.draftTitle') }}</h4>
                  <p>{{ t('infoJson.video.draftCaption') }}</p>
                </div>
                <span class="preview-badge">processor draft</span>
              </div>

              <div v-if="videoProcessorDraftJson" class="preview-meta">
                <span>
                  {{
                    hasSelectedProcessorResolutions
                      ? t('infoJson.video.selectedResolutions', { count: selectedProcessorResolutions.length })
                      : t('infoJson.video.noResolutionSelected')
                  }}
                </span>
                <span>
                  {{
                    processorAttachmentCount > 0
                      ? t('infoJson.video.summaryAttachments', { count: processorAttachmentCount })
                      : t('infoJson.video.summaryNoAttachments')
                  }}
                </span>
              </div>

              <pre v-if="videoProcessorDraftJson" class="json-preview"><code>{{ videoProcessorDraftJson }}</code></pre>
              <div v-else class="empty-state empty-state--preview">
                {{ t('infoJson.assets.video.empty') }}
              </div>
            </div>
          </section>
      </div>

      <div class="info-json-footer">
        <div class="footer-status" aria-live="polite">{{ footerStatus }}</div>
        <div class="footer-actions">
          <button type="button" class="ghost-btn" @click="closeDialog">
            {{ t('infoJson.actions.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

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
  width: min(1120px, calc(100vw - 48px));
  max-height: min(92dvh, 1080px);
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
  max-width: 72ch;
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
  align-content: start;
  gap: 18px;
}

.info-json-tabbar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.info-json-tab {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.info-json-tab:hover,
.info-json-tab:focus-visible {
  border-color: rgba(0, 210, 255, 0.28);
  background: rgba(0, 210, 255, 0.06);
  transform: translateY(-1px);
  outline: none;
}

.info-json-tab.is-active {
  border-color: rgba(0, 210, 255, 0.34);
  background:
    linear-gradient(180deg, rgba(0, 210, 255, 0.14), rgba(0, 210, 255, 0.05)),
    rgba(255, 255, 255, 0.04);
  box-shadow: 0 14px 30px rgba(0, 210, 255, 0.08);
  color: rgba(255, 255, 255, 0.96);
}

.info-json-tab-step {
  margin-top: 1px;
}

.info-json-tab-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.info-json-tab-copy strong {
  font-size: 0.94rem;
}

.info-json-tab-copy small {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.76rem;
  line-height: 1.45;
}

.info-json-tab.is-active .info-json-tab-copy small {
  color: rgba(220, 248, 255, 0.82);
}

.info-json-tab-panel,
.info-json-panel {
  min-width: 0;
}

.info-json-panel {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  width: min(100%, 980px);
  justify-self: center;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header-copy {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.panel-step {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 210, 255, 0.14);
  border: 1px solid rgba(0, 210, 255, 0.26);
  color: rgba(203, 245, 255, 0.98);
  font-size: 0.78rem;
  font-weight: 700;
}

.panel-header--stacked {
  align-items: center;
}

.panel-header h4,
.asset-card-header h5,
.processor-section-header h5 {
  margin: 0;
  font-size: 1rem;
}

.panel-header p,
.asset-card-caption,
.processor-section-header p {
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

.field small,
.processor-footnote {
  color: rgba(255, 255, 255, 0.52);
  font-size: 0.74rem;
  line-height: 1.45;
}

.asset-meta-banner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 209, 102, 0.12);
  border: 1px solid rgba(255, 209, 102, 0.22);
  color: rgba(255, 230, 185, 0.95);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.asset-uploader {
  min-width: 0;
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.asset-uploader:hover,
.asset-uploader:focus-within {
  border-color: rgba(0, 210, 255, 0.42);
  background: rgba(0, 210, 255, 0.06);
  transform: translateY(-1px);
}

.asset-uploader-copy {
  display: grid;
  gap: 6px;
}

.asset-uploader-copy strong {
  font-size: 0.94rem;
}

.asset-uploader-copy span {
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.78rem;
  line-height: 1.45;
}

.asset-uploader-action {
  justify-self: flex-start;
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.74rem;
  font-weight: 600;
}

.asset-card,
.preview-card,
.processor-section {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.asset-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.asset-card-content {
  display: grid;
  gap: 14px;
}

.file-meta-list {
  margin: 0;
  display: grid;
  gap: 10px;
}

.file-meta-list div {
  display: grid;
  gap: 3px;
}

.file-meta-list dt {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.file-meta-list dd {
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.84rem;
  overflow-wrap: anywhere;
}

.subtitle-track-list {
  display: grid;
  gap: 10px;
}

.subtitle-track-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.subtitle-track-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.subtitle-track-copy strong {
  font-size: 0.88rem;
}

.subtitle-track-copy span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.processor-section-header {
  display: grid;
  gap: 4px;
}

.processor-resolution-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.processor-choice,
.processor-toggle-card {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.processor-choice input,
.processor-toggle-card input {
  margin: 2px 0 0;
}

.processor-choice-copy,
.processor-toggle-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.processor-choice-copy strong,
.processor-toggle-copy strong {
  font-size: 0.85rem;
}

.processor-choice-copy small,
.processor-toggle-copy small,
.processor-hint {
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.76rem;
  line-height: 1.45;
}

.processor-toggle-list {
  display: grid;
  gap: 10px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.status-pill.is-idle {
  background: rgba(255, 179, 71, 0.12);
  color: rgba(255, 214, 153, 0.95);
  border: 1px solid rgba(255, 179, 71, 0.22);
}

.status-pill.is-ready {
  background: rgba(56, 211, 159, 0.14);
  color: rgba(182, 255, 226, 0.96);
  border: 1px solid rgba(56, 211, 159, 0.22);
}

.status-pill.is-warning {
  background: rgba(255, 209, 102, 0.14);
  color: rgba(255, 233, 193, 0.96);
  border: 1px solid rgba(255, 209, 102, 0.24);
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
  font-size: 0.84rem;
  line-height: 1.6;
}

.empty-state {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.84rem;
  line-height: 1.5;
  text-align: center;
}

.empty-state--compact,
.empty-state--preview {
  padding: 16px;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.ghost-btn {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
}

.ghost-btn--small {
  padding: 8px 12px;
  font-size: 0.8rem;
}

.ghost-btn:hover,
.ghost-btn:focus-visible {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
  outline: none;
}

.ghost-btn:disabled,
.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.ghost-btn:disabled:hover,
.ghost-btn:disabled:focus-visible,
.primary-btn:disabled:hover,
.primary-btn:disabled:focus-visible {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
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

@media (max-width: 980px) {
  .info-json-tabbar,
  .processor-resolution-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .info-json-backdrop {
    padding: 12px;
  }

  .info-json-dialog {
    width: min(100vw - 24px, 980px);
    max-height: min(92dvh, 1120px);
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
  .info-json-footer,
  .asset-card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .panel-header-copy {
    flex-direction: column;
  }

  .footer-actions button,
  .panel-actions button {
    width: 100%;
  }
}
</style>
