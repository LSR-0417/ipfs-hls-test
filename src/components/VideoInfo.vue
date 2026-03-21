<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  buildSidecarAssetUrl,
  createDefaultVideoInfo,
  extractDescriptionHashtags,
  formatRelativeUploadTime,
  formatUploadDate,
  formatUploadDateTooltip,
  linkifyDescription,
} from '../utils/videoInfo';

const defaultDescription =
  'Playing decentralized video content from IPFS. Ensuring censorship resistance and high availability through peer-to-peer networking.';
const defaultTags = ['IPFS', 'Web3', 'Decentralized'];

const props = defineProps({
  cid: { type: String, default: '' },
  ipfsBaseUrl: { type: String, default: '' },
  videoInfo: {
    type: Object,
    default: () => createDefaultVideoInfo(),
  },
});

const shareSuccess = ref(false);
const avatarLoadFailed = ref(false);
const isDescriptionExpanded = ref(false);
const collapsedDescription = ref('');
const descriptionMeasureText = ref('');
const descriptionMeasureRef = ref(null);
const descriptionMeasureTextRef = ref(null);
const infoRowRef = ref(null);
const creatorInfoRef = ref(null);
const avatarRef = ref(null);
const creatorTextMeasureRef = ref(null);
const subscribeButtonRef = ref(null);
const actionsRef = ref(null);
const actionGroupRef = ref(null);
const shareMeasureRef = ref(null);
const moreMenuRef = ref(null);
const hiddenActionIds = ref([]);
const actionsWrapped = ref(false);
const isMoreMenuOpen = ref(false);
const creatorTextHidden = ref(false);
let layoutObserver = null;
let layoutFrame = 0;
let syncInProgress = false;
let syncPending = false;

const shareActionId = 'share';
const downloadActionId = 'download';
const responsiveActionOrder = [shareActionId];
const overflowActionOrder = [shareActionId, downloadActionId];

const displayUploader = computed(() => props.videoInfo.uploader || 'IPFS Node');
const displayChannelText = computed(() => {
  if (props.videoInfo.channelId) {
    return `Channel ID: ${props.videoInfo.channelId}`;
  }

  if (props.videoInfo.categories.length > 0) {
    return props.videoInfo.categories.join(' • ');
  }

  return 'Decentralized Network';
});
const fallbackAvatarUrl = computed(() => {
  const seed = props.videoInfo.channelId || props.videoInfo.uploader || props.cid || 'IPFS';
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
});
const avatarUrl = computed(() => {
  if (avatarLoadFailed.value) {
    return fallbackAvatarUrl.value;
  }

  return buildSidecarAssetUrl(props.ipfsBaseUrl, 'avatar.jpg') || fallbackAvatarUrl.value;
});
const displayUploadDateTooltip = computed(() => formatUploadDateTooltip(props.videoInfo.uploadDate));
const displayRelativeUploadTime = computed(() => {
  return formatRelativeUploadTime(props.videoInfo.uploadDate) || formatUploadDate(props.videoInfo.uploadDate);
});
const showShareButton = computed(() => !hiddenActionIds.value.includes(shareActionId));
const downloadUrl = computed(() => buildSidecarAssetUrl(props.ipfsBaseUrl, 'index.m3u8'));
const overflowMenuItems = computed(() => {
  return overflowActionOrder
    .filter((actionId) => actionId === downloadActionId || hiddenActionIds.value.includes(actionId))
    .map((actionId) => ({
      id: actionId,
      label: actionId === shareActionId ? (shareSuccess.value ? 'Copied!' : 'Share') : 'Download',
      disabled: actionId === downloadActionId && !downloadUrl.value,
    }));
});
const displayDescription = computed(() => props.videoInfo.description || defaultDescription);
const descriptionHashtags = computed(() => extractDescriptionHashtags(displayDescription.value, { limit: 3 }));
const displayTags = computed(() => {
  const tags = props.videoInfo.tags.length > 0 ? props.videoInfo.tags : defaultTags;
  return tags;
});
const metadataItems = computed(() => {
  const items = [
    { label: 'IPFS CID', value: props.cid },
    { label: 'Video ID', value: props.videoInfo.id },
    { label: 'Uploader', value: props.videoInfo.uploader },
    { label: 'Channel ID', value: props.videoInfo.channelId },
    { label: 'Duration', value: props.videoInfo.durationString },
    { label: 'Frame Rate', value: props.videoInfo.fps ? `${props.videoInfo.fps} fps` : '' },
  ];

  return items.filter((item) => item.value);
});
const hasExpandableDescription = computed(() => {
  const description = displayDescription.value;

  return (
    metadataItems.value.length > 0 ||
    props.videoInfo.tags.length > 0 ||
    description.length > 180 ||
    description.includes('\n')
  );
});
const showFullDescription = computed(() => isDescriptionExpanded.value || !hasExpandableDescription.value);
const showStatsPanel = computed(() => Boolean(displayRelativeUploadTime.value) || descriptionHashtags.value.length > 0);
const fullDescriptionSegments = computed(() => linkifyDescription(displayDescription.value));
const collapsedDescriptionSegments = computed(() => linkifyDescription(collapsedDescription.value));
let descriptionMeasureSeq = 0;

watch(
  () => [props.cid, props.ipfsBaseUrl],
  () => {
    avatarLoadFailed.value = false;
    isDescriptionExpanded.value = false;
    isMoreMenuOpen.value = false;
    void updateCollapsedDescription();
    scheduleActionLayoutSync();
  },
  { immediate: true }
);

watch(
  [displayDescription, metadataItems, () => props.videoInfo.tags.join('|')],
  () => {
    void updateCollapsedDescription();
  },
  { immediate: true }
);

watch([displayUploader, displayChannelText], () => {
  scheduleActionLayoutSync();
});

function scheduleActionLayoutSync() {
  if (typeof window === 'undefined') return;

  if (layoutFrame) {
    window.cancelAnimationFrame(layoutFrame);
  }

  layoutFrame = window.requestAnimationFrame(() => {
    layoutFrame = 0;
    void syncActionLayout();
  });
}

function getElementWidth(element) {
  if (!element) return 0;
  return element.getBoundingClientRect().width;
}

function getElementMarginLeft(element) {
  if (!element || typeof window === 'undefined') return 0;

  const styles = window.getComputedStyle(element);
  return Number.parseFloat(styles.marginLeft || '0') || 0;
}

function getFlexGap(element) {
  if (!element || typeof window === 'undefined') return 0;

  const styles = window.getComputedStyle(element);
  return Number.parseFloat(styles.columnGap || styles.gap || '0') || 0;
}

function sumWidthsWithGap(widths, gap) {
  return widths.reduce((total, width, index) => total + width + (index > 0 ? gap : 0), 0);
}

function areActionIdsEqual(currentIds, nextIds) {
  if (currentIds.length !== nextIds.length) {
    return false;
  }

  return currentIds.every((id, index) => id === nextIds[index]);
}

function resolveLayout() {
  const infoRowWidth = getElementWidth(infoRowRef.value);
  const creatorWidth = getElementWidth(creatorInfoRef.value);
  const avatarWidth = getElementWidth(avatarRef.value);
  const creatorTextWidth = getElementWidth(creatorTextMeasureRef.value);
  const subscribeButtonWidth = getElementWidth(subscribeButtonRef.value);
  const subscribeButtonMarginLeft = getElementMarginLeft(subscribeButtonRef.value);
  const creatorGap = getFlexGap(creatorInfoRef.value);
  const actionGroupWidth = getElementWidth(actionGroupRef.value);
  const moreActionsWidth = getElementWidth(moreMenuRef.value);
  const shareWidth = getElementWidth(shareMeasureRef.value);
  const infoGap = getFlexGap(infoRowRef.value);
  const actionsGap = getFlexGap(actionsRef.value);

  if (!infoRowWidth || !creatorWidth || !actionGroupWidth || !moreActionsWidth) {
    return {
      hiddenActionIds: hiddenActionIds.value,
      actionsWrapped: actionsWrapped.value,
      creatorTextHidden: creatorTextHidden.value,
    };
  }

  const fullCreatorWidth =
    avatarWidth && creatorTextWidth && subscribeButtonWidth
      ? sumWidthsWithGap([avatarWidth, creatorTextWidth, subscribeButtonWidth], creatorGap) + subscribeButtonMarginLeft
      : creatorWidth;
  const compactCreatorWidth =
    avatarWidth && subscribeButtonWidth
      ? sumWidthsWithGap([avatarWidth, subscribeButtonWidth], creatorGap)
      : creatorWidth;
  const nextCreatorTextHidden = fullCreatorWidth > infoRowWidth + 1;
  const nextCreatorWidth = nextCreatorTextHidden ? compactCreatorWidth : fullCreatorWidth;
  const availableActionsWidth = Math.max(0, infoRowWidth - nextCreatorWidth - infoGap);
  const visibleActionWidths = [actionGroupWidth];
  const nextHiddenActionIds = [];

  for (const actionId of responsiveActionOrder) {
    const actionWidth = actionId === shareActionId ? shareWidth : 0;
    const nextVisibleWidths = [...visibleActionWidths, actionWidth, moreActionsWidth];

    if (sumWidthsWithGap(nextVisibleWidths, actionsGap) <= availableActionsWidth + 1) {
      visibleActionWidths.push(actionWidth);
      continue;
    }

    nextHiddenActionIds.push(actionId);
  }

  let totalVisibleWidth = actionGroupWidth;
  for (const actionId of responsiveActionOrder) {
    if (!nextHiddenActionIds.includes(actionId)) {
      totalVisibleWidth += actionsGap + (actionId === shareActionId ? shareWidth : 0);
    }
  }
  // The 'more' menu is always present because 'download' is always in the overflow menu
  totalVisibleWidth += actionsGap + moreActionsWidth;

  const isWrapped = totalVisibleWidth > availableActionsWidth + 1;

  return {
    hiddenActionIds: nextHiddenActionIds,
    actionsWrapped: isWrapped,
    creatorTextHidden: nextCreatorTextHidden,
  };
}

async function syncActionLayout() {
  if (!infoRowRef.value || !actionsRef.value) return;

  if (syncInProgress) {
    syncPending = true;
    return;
  }

  syncInProgress = true;
  const layout = resolveLayout();
  let layoutChanged = false;

  if (!areActionIdsEqual(hiddenActionIds.value, layout.hiddenActionIds)) {
    hiddenActionIds.value = layout.hiddenActionIds;
    layoutChanged = true;
  }

  if (actionsWrapped.value !== layout.actionsWrapped) {
    actionsWrapped.value = layout.actionsWrapped;
    layoutChanged = true;
  }

  if (creatorTextHidden.value !== layout.creatorTextHidden) {
    creatorTextHidden.value = layout.creatorTextHidden;
    layoutChanged = true;
  }

  if (layoutChanged) {
    await nextTick();
  }

  syncInProgress = false;

  if (syncPending) {
    syncPending = false;
    scheduleActionLayoutSync();
  }
}

function closeMoreMenu() {
  isMoreMenuOpen.value = false;
}

function toggleMoreMenu() {
  isMoreMenuOpen.value = !isMoreMenuOpen.value;
}

function handleDocumentPointerDown(event) {
  if (moreMenuRef.value?.contains(event.target)) {
    return;
  }

  closeMoreMenu();
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    closeMoreMenu();
  }
}

function downloadCurrentVideo() {
  if (!downloadUrl.value) return;

  const link = document.createElement('a');
  link.href = downloadUrl.value;
  link.target = '_blank';
  link.rel = 'noopener';
  link.download = `${props.videoInfo.id || props.cid || 'video'}.m3u8`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleOverflowAction(actionId) {
  closeMoreMenu();

  if (actionId === shareActionId) {
    shareCurrentTime();
    return;
  }

  if (actionId === downloadActionId) {
    downloadCurrentVideo();
  }
}

function shareCurrentTime() {
  if (!props.cid) {
    alert('無有效的 CID！');
    return;
  }

  let currentTime = 0;
  if (window.videojs && window.videojs.getAllPlayers().length > 0) {
    currentTime = Math.floor(window.videojs.getAllPlayers()[0].currentTime());
  } else {
    const video = document.querySelector('video');
    if (video) {
      currentTime = Math.floor(video.currentTime);
    }
  }

  const shareUrl = new URL(window.location.origin + window.location.pathname);
  shareUrl.searchParams.set('cid', props.cid);
  if (currentTime > 0) {
    shareUrl.searchParams.set('t', currentTime);
  }

  const urlStr = shareUrl.toString();

  const handleSuccess = () => {
    shareSuccess.value = true;
    setTimeout(() => {
      shareSuccess.value = false;
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(urlStr).then(handleSuccess).catch(() => {
      fallbackCopyTextToClipboard(urlStr, handleSuccess);
    });
  } else {
    fallbackCopyTextToClipboard(urlStr, handleSuccess);
  }
}

function fallbackCopyTextToClipboard(text, onSuccess) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    if (document.execCommand('copy')) onSuccess();
  } catch (_) {
    alert(`複製失敗，請手動複製這段網址:\n${text}`);
  }
  document.body.removeChild(textArea);
}

function formatTag(tag) {
  return String(tag || '').trim().replace(/^#+/, '');
}

function handleAvatarError() {
  avatarLoadFailed.value = true;
}

function expandDescription() {
  isDescriptionExpanded.value = true;
}

function collapseDescription() {
  isDescriptionExpanded.value = false;
}

function descriptionSegmentKey(segment, index) {
  return `${segment.type}-${segment.text}-${index}`;
}

function normalizeCollapsedDescription(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trimCollapsedDescription(text, length) {
  const sliced = text.slice(0, length).trimEnd();

  if (length >= text.length) return sliced;

  const boundaryIndex = Math.max(
    sliced.lastIndexOf('\n'),
    sliced.lastIndexOf(' '),
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('，'),
    sliced.lastIndexOf('、'),
    sliced.lastIndexOf(','),
    sliced.lastIndexOf('.'),
    sliced.lastIndexOf('!'),
    sliced.lastIndexOf('?'),
    sliced.lastIndexOf('；'),
    sliced.lastIndexOf(';')
  );

  if (boundaryIndex >= Math.floor(sliced.length * 0.6)) {
    return sliced.slice(0, boundaryIndex).trimEnd();
  }

  return sliced;
}

async function measureCollapsedDescription(text, maxHeight, seq) {
  descriptionMeasureText.value = text;
  await nextTick();

  if (seq !== descriptionMeasureSeq) return false;

  const measureEl = descriptionMeasureRef.value;
  const measureTextEl = descriptionMeasureTextRef.value;
  if (!measureEl || !measureTextEl) return false;

  if (measureEl.scrollHeight > maxHeight) return false;

  const lineRects = getLineRects(measureTextEl);
  if (lineRects.length < 3) return true;

  const lastLineRect = lineRects[lineRects.length - 1];
  return lastLineRect.width <= measureEl.clientWidth / 2 + 1;
}

async function updateCollapsedDescription() {
  const seq = ++descriptionMeasureSeq;
  const normalizedDescription = normalizeCollapsedDescription(displayDescription.value);

  collapsedDescription.value = normalizedDescription;
  descriptionMeasureText.value = normalizedDescription;

  if (!hasExpandableDescription.value) return;

  await nextTick();
  if (seq !== descriptionMeasureSeq) return;

  const measureEl = descriptionMeasureRef.value;
  if (!measureEl) return;

  const lineHeight = parseFloat(window.getComputedStyle(measureEl).lineHeight) || 22;
  const maxHeight = lineHeight * 3 + 1;

  if (await measureCollapsedDescription(normalizedDescription, maxHeight, seq)) {
    collapsedDescription.value = normalizedDescription;
    return;
  }

  let low = 0;
  let high = normalizedDescription.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = trimCollapsedDescription(normalizedDescription, mid);
    const fits = candidate && (await measureCollapsedDescription(candidate, maxHeight, seq));

    if (seq !== descriptionMeasureSeq) return;

    if (fits) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  collapsedDescription.value = best || normalizedDescription.slice(0, 1);
}

function handleWindowResize() {
  void updateCollapsedDescription();
}

function getLineRects(element) {
  const range = document.createRange();
  range.selectNodeContents(element);

  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  const lines = [];

  for (const rect of rects) {
    const existingLine = lines.find((line) => Math.abs(line.top - rect.top) < 1);

    if (existingLine) {
      existingLine.left = Math.min(existingLine.left, rect.left);
      existingLine.right = Math.max(existingLine.right, rect.right);
      existingLine.width = existingLine.right - existingLine.left;
      continue;
    }

    lines.push({
      top: rect.top,
      left: rect.left,
      right: rect.right,
      width: rect.width,
    });
  }

  return lines.sort((a, b) => a.top - b.top);
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize);
  void updateCollapsedDescription();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
});

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  window.addEventListener('resize', scheduleActionLayoutSync);

  const ResizeObserverCtor = window.ResizeObserver;
  if (ResizeObserverCtor) {
    layoutObserver = new ResizeObserverCtor(() => {
      scheduleActionLayoutSync();
    });

    [infoRowRef.value, creatorInfoRef.value, actionsRef.value]
      .filter(Boolean)
      .forEach((element) => layoutObserver.observe(element));
  }

  scheduleActionLayoutSync();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
  document.removeEventListener('keydown', handleDocumentKeydown);
  window.removeEventListener('resize', scheduleActionLayoutSync);

  if (layoutObserver) {
    layoutObserver.disconnect();
    layoutObserver = null;
  }

  if (layoutFrame) {
    window.cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
  }
});
</script>

<template>
  <div class="video-info" data-testid="video-info">
    <div ref="infoRowRef" class="info-row" data-testid="video-info-row">
      <div
        ref="creatorInfoRef"
        class="creator-info"
        :class="{ 'creator-info-compact': creatorTextHidden }"
        data-testid="video-info-creator"
      >
        <div ref="avatarRef" class="avatar" data-testid="video-info-avatar">
          <img :src="avatarUrl" :alt="displayUploader" @error="handleAvatarError" />
        </div>
        <div v-if="!creatorTextHidden" class="creator-text" data-testid="video-info-creator-text">
          <div class="creator-name">{{ displayUploader }} <svg viewBox="0 0 24 24" width="16" height="16" class="verified"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
          <div class="subscribers">{{ displayChannelText }}</div>
        </div>
        <button ref="subscribeButtonRef" type="button" class="subscribe-btn glass-btn" data-testid="video-info-follow-button">Follow</button>
      </div>

      <div ref="actionsRef" class="actions" :class="{ 'actions-wrapped': actionsWrapped }" data-testid="video-info-actions">
        <div ref="actionGroupRef" class="action-group glass-btn" data-action-item data-testid="video-info-feedback-group">
          <button type="button" class="like-btn" title="Like" data-testid="video-info-like-button"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg> 1.2M</button>
          <div class="divider"></div>
          <button type="button" class="dislike-btn" title="Dislike" data-testid="video-info-dislike-button"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg></button>
        </div>

        <div ref="shareMeasureRef" class="glass-btn action-btn action-measure" aria-hidden="true">
          <svg v-if="!shareSuccess" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" class="success-icon"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span class="btn-text">{{ shareSuccess ? 'Copied!' : 'Share' }}</span>
        </div>

        <button
          v-if="showShareButton"
          type="button"
          class="glass-btn action-btn"
          data-action-item
          data-testid="video-info-share-button"
          @click="shareCurrentTime"
          :class="{ 'success-text': shareSuccess }"
          title="Share Video (Copy Link)"
        >
          <svg v-if="!shareSuccess" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" class="success-icon"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span class="btn-text">{{ shareSuccess ? 'Copied!' : 'Share' }}</span>
        </button>

        <div ref="moreMenuRef" class="more-actions" data-action-item data-testid="video-info-more-actions">
          <button
            type="button"
            class="glass-btn action-btn overflow-trigger"
            title="More actions"
            aria-haspopup="menu"
            :aria-expanded="isMoreMenuOpen ? 'true' : 'false'"
            data-testid="video-info-overflow-trigger"
            @click.stop="toggleMoreMenu"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
          </button>

          <div v-if="isMoreMenuOpen" class="actions-menu glass-panel" role="menu" data-testid="video-info-overflow-menu">
            <button
              v-for="item in overflowMenuItems"
              :key="item.id"
              type="button"
              class="action-menu-item"
              role="menuitem"
              :disabled="item.disabled"
              :data-testid="`video-info-overflow-item-${item.id}`"
              @click="handleOverflowAction(item.id)"
            >
              <svg v-if="item.id === shareActionId" class="menu-item-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
              <svg v-else class="menu-item-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M5 20h14v-2H5v2zm7-18l-5.5 5.5 1.41 1.41L11 6.83V16h2V6.83l3.09 3.08 1.41-1.41L12 2z"/></svg>
              <span class="menu-item-label">{{ item.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="description glass-panel">
      <div v-if="showStatsPanel" class="stats-panel">
        <div class="stats">
          <span v-if="displayRelativeUploadTime" class="stats-item stats-upload-time">{{ displayRelativeUploadTime }}</span>
          <span v-if="displayRelativeUploadTime && descriptionHashtags.length > 0" class="stats-separator">•</span>
          <span v-if="descriptionHashtags.length > 0" class="stats-tags">
            <span
              v-for="tag in descriptionHashtags"
              :key="tag"
              class="stats-hashtag"
              :title="`#${tag}`"
            >#{{ tag }}</span>
          </span>
        </div>
        <span v-if="displayUploadDateTooltip" class="stats-tooltip">{{ displayUploadDateTooltip }}</span>
      </div>
      <p v-if="showFullDescription" class="desc-text">
        <component
          :is="segment.type === 'link' ? 'a' : 'span'"
          v-for="(segment, index) in fullDescriptionSegments"
          :key="descriptionSegmentKey(segment, index)"
          :class="{ 'desc-link': segment.type === 'link' }"
          :href="segment.type === 'link' ? segment.href : undefined"
          :target="segment.type === 'link' ? '_blank' : undefined"
          :rel="segment.type === 'link' ? 'noopener noreferrer nofollow' : undefined"
        >{{ segment.text }}</component>
      </p>
      <p v-else class="desc-text desc-text-collapsed-inline">
        <component
          :is="segment.type === 'link' ? 'a' : 'span'"
          v-for="(segment, index) in collapsedDescriptionSegments"
          :key="descriptionSegmentKey(segment, index)"
          :class="{ 'desc-link': segment.type === 'link' }"
          :href="segment.type === 'link' ? segment.href : undefined"
          :target="segment.type === 'link' ? '_blank' : undefined"
          :rel="segment.type === 'link' ? 'noopener noreferrer nofollow' : undefined"
        >{{ segment.text }}</component>
        <span class="desc-inline-ellipsis">...</span>
        <button
          type="button"
          class="description-toggle description-toggle-inline-text"
          :aria-expanded="isDescriptionExpanded"
          @click="expandDescription"
        >
          更多資訊
        </button>
      </p>
      <p
        v-if="hasExpandableDescription && !isDescriptionExpanded"
        ref="descriptionMeasureRef"
        aria-hidden="true"
        class="desc-text desc-text-measure"
      >
        <span ref="descriptionMeasureTextRef">{{ descriptionMeasureText }}</span>
        <span class="desc-inline-ellipsis">...</span>
        <span class="description-toggle-inline-text">更多資訊</span>
      </p>
      <div v-if="showFullDescription && metadataItems.length > 0" class="metadata-grid">
        <div v-for="item in metadataItems" :key="item.label" class="metadata-item">
          <span class="metadata-label">{{ item.label }}</span>
          <span class="metadata-value">{{ item.value }}</span>
        </div>
      </div>
      <p v-if="showFullDescription" class="tag-list">
        <span v-for="(tag, index) in displayTags" :key="`${tag}-${index}`" class="hashtag">#{{ formatTag(tag) }}</span>
      </p>
      <button
        v-if="hasExpandableDescription && isDescriptionExpanded"
        type="button"
        class="description-toggle description-toggle-bottom"
        :aria-expanded="isDescriptionExpanded"
        @click="collapseDescription"
      >
        只顯示部分資訊
      </button>
    </div>

    <div ref="creatorTextMeasureRef" class="creator-text creator-text-measure" aria-hidden="true">
      <div class="creator-name">{{ displayUploader }} <svg viewBox="0 0 24 24" width="16" height="16" class="verified"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
      <div class="subscribers">{{ displayChannelText }}</div>
    </div>
  </div>
</template>

<style scoped>
.video-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.info-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #1a1a2e;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creator-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.creator-text-measure {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  left: -9999px;
  top: 0;
}

.creator-name {
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.verified {
  color: var(--accent-cyan);
}

.subscribers {
  font-size: 0.8rem;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.glass-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.glass-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.subscribe-btn {
  margin-left: 12px;
  background: rgba(0, 210, 255, 0.1);
  color: var(--accent-cyan);
  border-color: rgba(0, 210, 255, 0.3);
}

.creator-info-compact .subscribe-btn {
  margin-left: 0;
}

.subscribe-btn:hover {
  background: rgba(0, 210, 255, 0.2);
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  position: relative;
}

.actions-wrapped {
  width: 100%;
  justify-content: flex-start;
  margin-left: 0;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.action-group button {
  background: transparent;
  border: none;
  color: inherit;
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  transition: background 0.2s;
}

.action-group button:hover {
  background: rgba(255, 255, 255, 0.05);
}

.action-btn,
.overflow-trigger {
  white-space: nowrap;
}

.action-measure {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  left: -9999px;
  top: 0;
}

.more-actions {
  position: relative;
  display: flex;
}

.overflow-trigger {
  justify-content: center;
  min-width: 48px;
  padding: 8px 12px;
}

.actions-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 180px;
  border-radius: 20px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(10, 12, 20, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.28);
  z-index: 12;
}

.action-menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  transition: background 0.2s ease, color 0.2s ease;
}

.action-menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.action-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menu-item-icon {
  color: var(--accent-cyan);
  flex-shrink: 0;
}

.menu-item-label {
  min-width: 0;
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.description {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 16px;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.stats-panel {
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  position: relative;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-weight: 400;
  margin: 0;
  line-height: 1.35;
}

.stats-tooltip {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
  z-index: 6;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(10, 12, 20, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
  color: var(--text-primary);
  font-size: 0.85rem;
  line-height: 1.25;
  white-space: nowrap;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.stats-panel:hover .stats-tooltip {
  opacity: 1;
  transform: translateY(0);
}

.stats-item {
  color: inherit;
}

.stats-tags {
  display: inline-flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
}

.stats-hashtag {
  display: inline-block;
  max-width: min(18ch, 28vw);
  color: var(--accent-cyan);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.stats-upload-time {
  text-decoration: none;
}

.stats-separator {
  color: inherit;
}

.desc-text {
  color: var(--text-secondary);
  margin: 12px 0 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.desc-link {
  color: var(--accent-cyan);
  text-decoration: none;
}

.desc-link:hover {
  text-decoration: underline;
}

.description-toggle {
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.description-toggle:hover {
  text-decoration: underline;
}

.description-toggle-bottom {
  margin-top: 16px;
  align-self: flex-start;
}

.description-toggle-inline-text {
  display: inline;
  margin-left: 6px;
  vertical-align: baseline;
}

.desc-text-collapsed-inline {
  line-height: 1.5;
}

.desc-inline-ellipsis {
  display: inline;
}

.desc-text-measure {
  height: 0;
  margin: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.metadata-label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.metadata-value {
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.hashtag {
  color: var(--accent-cyan);
  cursor: pointer;
}

.hashtag:hover {
  text-decoration: underline;
}

.success-text {
  color: var(--accent-cyan);
  border-color: rgba(0, 210, 255, 0.4);
}

.success-icon {
  color: var(--accent-cyan);
}

@media (max-width: 600px) {
  .actions {
    gap: 8px;
  }

  .action-btn {
    padding: 8px 12px;
  }

  .stats-hashtag {
    max-width: min(16ch, 44vw);
  }
}
</style>
