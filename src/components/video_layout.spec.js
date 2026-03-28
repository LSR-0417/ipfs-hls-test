import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

function readDescriptor(fileUrl) {
  const source = readFileSync(fileUrl, 'utf8');
  return parse(source).descriptor;
}

function getFirstStyleContent(descriptor) {
  return descriptor.styles.map((style) => style.content).join('\n');
}

describe('App layout contract', () => {
  it('renders watch and recommendations directly inside main-content and no longer uses the old status message slot', () => {
    const descriptor = readDescriptor(new URL('../App.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const appStyle = readFileSync(new URL('../App.css', import.meta.url), 'utf8');

    const watchPageIndex = template.indexOf('<WatchPage');
    const recommendationsPageIndex = template.indexOf('<RecommendationsPage');

    expect(template).toContain('<main class="main-content" data-testid="main-content">');
    expect(watchPageIndex).toBeGreaterThan(-1);
    expect(recommendationsPageIndex).toBeGreaterThan(watchPageIndex);
    expect(template).not.toContain('id="status"');
    expect(template).not.toContain('class="video-layout"');
    expect(template).not.toContain('data-testid="primary-column"');
    expect(template).not.toContain('data-testid="secondary-column"');
    expect(template).not.toContain('data-testid="page-shell"');
    expect(template).toContain('@gateway-fallback-request="onGatewayFallbackRequest"');
    expect(script).toContain('defaultPublicGateway');
    expect(script).toContain('function onGatewayFallbackRequest(payload = {}) {');
    expect(appStyle).toContain('.main-content');
    expect(appStyle).toContain('padding: 0;');
    expect(appStyle).toContain('flex-direction: column;');
    expect(appStyle).toContain('gap: 0;');
    expect(appStyle).toContain('@media (min-width: 1024px)');
    expect(appStyle).toContain('align-items: flex-start;');
  });
});

describe('WatchPage layout contract', () => {
  it('keeps the player, title, and video info inside a dedicated watch page container', () => {
    const descriptor = readDescriptor(new URL('./WatchPage.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    const playerContainerIndex = template.indexOf('<VideoPlayer');
    const playerTitleIndex = template.indexOf('<h1 v-if="videoInfo.title" class="player-title">{{ videoInfo.title }}</h1>');
    const videoInfoIndex = template.indexOf('<VideoInfo');

    expect(template).toContain('<section class="watch-page" data-testid="watch-page">');
    expect(template).toContain('class="player-container glass-panel"');
    expect(template).toContain('data-testid="player-container"');
    expect(template).toContain(':frame-rate="videoInfo.fps"');
    expect(template).toContain(':avatar-url="avatarUrl"');
    expect(playerContainerIndex).toBeGreaterThan(-1);
    expect(playerTitleIndex).toBeGreaterThan(playerContainerIndex);
    expect(videoInfoIndex).toBeGreaterThan(playerTitleIndex);
    expect(script).toContain("'gateway-fallback-request'");
    expect(template).toContain('@gateway-fallback-request="handleGatewayFallbackRequest"');
    expect(script).toContain("'subtitle-selection-change'");
    expect(template).toContain(':subtitle-selection="subtitleSelection"');
    expect(template).toContain(':subtitle-catalog-status="remoteSubtitleStatus"');
    expect(template).toContain(':remote-subtitle-status="remoteSubtitleStatus"');
    expect(script).toContain("import VideoPlayer from './VideoPlayer.vue';");
    expect(script).toContain("import VideoInfo from './VideoInfo.vue';");
    expect(template).toContain('@playback-snapshot="handlePlaybackSnapshot"');
    expect(template).toContain(':remote-subtitles="remoteSubtitles"');
    expect(template).toContain(':imported-subtitles="importedSubtitles"');
    expect(template).toContain('@subtitle-import="handleSubtitleImport"');
    expect(template).toContain('@subtitle-remove="handleSubtitleRemove"');
    expect(script).toContain("function handleGatewayFallbackRequest(payload) {");
    expect(template).toContain('@subtitle-selection-change="handleSubtitleSelectionChange"');
    expect(script).toContain("function handlePlaybackSnapshot(snapshot) {");
    expect(script).toContain("function handleSubtitleImport(importedTrack) {");
    expect(script).toContain("function handleSubtitleRemove(trackId) {");
    expect(script).toContain("function handleSubtitleSelectionChange(nextSelection) {");
    expect(style).toContain('.watch-page');
    expect(style).toContain('flex: 1;');
    expect(style).toContain('min-width: 0;');
    expect(style).toContain('margin: 0 0 0 16px;');
    expect(style).toContain('padding: 12px 16px 0 0;');
    expect(style).toContain('.watch-page > *');
    expect(style).toContain('width: 100%;');
    expect(style).toContain('.player-container');
    expect(style).toContain('.player-title');
    expect(style).toContain('padding: 0;');
  });
});

describe('VideoPlayer hotkey contract', () => {
  it('keeps the expanded shortcut map and the help dialog in the player template', () => {
    const descriptor = readDescriptor(new URL('./VideoPlayer.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).toContain('data-testid="video-player-hotkey-help-dialog"');
    expect(template).toContain('v-if="isHotkeyHelpOpen"');
    expect(template).toContain('v-for="section in hotkeyHelpSections"');
    expect(template).toContain('v-for="item in section.items"');
    expect(template).toContain('class="hotkey-help-list"');
    expect(template).toContain('class="hotkey-help-row"');
    expect(template).toContain('class="hotkey-help-hint"');
    expect(script).toContain('const LONG_SEEK_STEP_SECONDS = 10;');
    expect(script).toContain('const hotkeyHelpSections = Object.freeze([');
    expect(script).toContain('frameRate: {');
    expect(script).toContain('resolveToggledSubtitlePreference');
    expect(script).toContain('onToggleHelp: toggleHotkeyHelp');
    expect(script).toContain('onToggleSubtitles: toggleSubtitleVisibility');
    expect(script).toContain("const subtitleVisibilityToggleButtonComponentName = 'SubtitleVisibilityToggleButton';");
    expect(script).toContain('function registerSubtitleVisibilityToggleButton() {');
    expect(script).toContain('function ensureSubtitleVisibilityToggleControl() {');
    expect(script).toContain('function updateSubtitleVisibilityToggleControl() {');
    expect(style).toContain('position: fixed;');
    expect(style).toContain('.hotkey-help-dialog');
    expect(style).toContain('.hotkey-help-list');
    expect(style).toContain('.hotkey-help-row');
    expect(style).toContain('.hotkey-help-detail');
    expect(style).toContain('.hotkey-chip');
  });
});

describe('VideoPlayer playback persistence contract', () => {
  it('emits player-driven playback snapshots on key lifecycle events', () => {
    const descriptor = readDescriptor(new URL('./VideoPlayer.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(script).toContain("const emit = defineEmits([");
    expect(script).toContain("'gateway-fallback-request'");
    expect(script).toContain('shouldAutoFallbackGateway');
    expect(script).toContain('isLoopbackGatewayUrl');
    expect(script).toContain('function requestGatewayFallback(reason = null, options = {}) {');
    expect(script).toContain('dedupeKey: `source:${seq}`');
    expect(script).toContain("import { applyPlaybackHotkey, getPlayerPlaybackSnapshot } from '../utils/playback';");
    expect(script).toContain('function patchVideoJsTextTrackDisplay() {');
    expect(script).toContain("if (!prototype || prototype.__safeActiveCuesPatchApplied__) {");
    expect(script).toContain('prototype.updateForTrack = function updateForTrackWithSafeActiveCues(tracks) {');
    expect(script).toContain("const readyTracks = (Array.isArray(tracks) ? tracks : [tracks]).filter((track) => track?.activeCues);");
    expect(script).toContain('prototype.updateDisplayState = function updateDisplayStateWithSafeActiveCues(track) {');
    expect(script).toContain('patchVideoJsTextTrackDisplay();');
    expect(script).toContain("const PROGRESS_EMIT_STEP_SECONDS = 5;");
    expect(script).toContain("'subtitle-selection-change'");
    expect(script).toContain('allowMultipleShowingTracks: true');
    expect(script).toContain('subsCapsButton: false');
    expect(script).toContain("const primarySubtitleButtonComponentName = 'PrimarySubtitleControlButton';");
    expect(script).toContain("const subtitleVisibilityToggleButtonComponentName = 'SubtitleVisibilityToggleButton';");
    expect(script).toContain("const primarySubtitleControlInsertBefore = ['audioTrackButton', 'pictureInPictureToggle', 'fullscreenToggle'];");
    expect(script).toContain("import SubtitleRoleIcon from './SubtitleRoleIcon.vue';");
    expect(script).toContain('function registerPrimarySubtitleControlButton() {');
    expect(script).toContain('function registerSubtitleVisibilityToggleButton() {');
    expect(script).toContain('function ensurePrimarySubtitleControl() {');
    expect(script).toContain('function ensureSubtitleVisibilityToggleControl() {');
    expect(script).toContain('function createSubtitleControlGlyph(documentLike, options = {}) {');
    expect(script).toContain('function repositionSubtitleControlCluster() {');
    expect(script).toContain('function resolvePrimarySubtitleControlState() {');
    expect(script).toContain('function updatePrimarySubtitleControl() {');
    expect(script).toContain('function resolveSubtitleVisibilityToggleState() {');
    expect(script).toContain('function updateSubtitleVisibilityToggleControl() {');
    expect(script).toContain('function togglePrimarySubtitleMenu() {');
    expect(script).toContain('function selectPrimarySubtitle(lang) {');
    expect(script).toContain('function createPrimarySubtitleMenuGlyph(documentLike) {');
    expect(script).toContain('function resolvePrimarySubtitleMenuTrackMetaLabel(track) {');
    expect(script).toContain('player.primarySubtitleMenuToggle_ = togglePrimarySubtitleMenu;');
    expect(script).toContain('player.subtitleVisibilityToggleAction_ = toggleSubtitleVisibility;');
    expect(script).toContain('subtitleCatalogStatus: {');
    expect(template).toContain('data-testid="primary-subtitle-menu"');
    expect(template).toContain('data-testid="primary-subtitle-menu-off"');
    expect(template).toContain('關閉');
    expect(template).toContain('<SubtitleRoleIcon class="primary-subtitle-menu-item-icon-svg" variant="primary" />');
    expect(template).toContain('<SubtitleRoleIcon class="primary-subtitle-menu-item-icon-svg" variant="secondary" />');
    expect(template).toContain('<SubtitleRoleIcon class="primary-subtitle-menu-item-icon-svg" variant="local" />');
    expect(script).toContain("const dualSubtitleSwapButtonComponentName = 'DualSubtitleSwapButton';");
    expect(script).toContain('function registerDualSubtitleSwapButton() {');
    expect(script).toContain('function ensureDualSubtitleSwapControl() {');
    expect(script).toContain('function swapSubtitleRoles() {');
    expect(script).toContain('resolveDualSubtitleSwapControlState');
    expect(script).toContain('function resolveDualSubtitleSwapButtonState(selection = props.subtitleSelection) {');
    expect(script).toContain("buttonEl.setAttribute('title', state.tooltip || dualSubtitleSwapTitle);");
    expect(script).toContain("player.on('pause', handlePauseSnapshot);");
    expect(script).toContain("player.on('ended', handleEndedSnapshot);");
    expect(script).toContain("player.on('seeked', handleSeekedSnapshot);");
    expect(script).toContain("player.on('timeupdate', handleTimeupdateSnapshot);");
    expect(script).toContain("player.one('error', () => {");
    expect(script).toContain("player.on('playerresize', () => {");
    expect(script).toContain("player.on('fullscreenchange', () => {");
    expect(script).toContain('updatePrimarySubtitleMenuPosition();');
    expect(script).toContain('function syncSecondaryCueOffsets(primaryCueElements, secondaryCueElements) {');
    expect(script).toContain("import { resolveSecondaryCueOffset } from '../utils/subtitleCueLayout';");
    expect(script).toContain('let subtitleCueDisplayObserver = null;');
    expect(script).toContain('function observeSubtitleCueDisplay() {');
    expect(script).toContain('function disconnectSubtitleCueDisplayObserver() {');
    expect(script).toContain("const nextDisplayElement = playerElement?.querySelector?.('.vjs-text-track-display') || null;");
    expect(script).toContain("subtitleCueDisplayObserver = new window.MutationObserver(() => {");
    expect(script).toContain("attributeFilter: ['class', 'style', 'lang'],");
    expect(script).toContain("emit('playback-snapshot', {");
    expect(style).toContain('.vjs-text-track-cue--secondary');
    expect(style).toContain('.vjs-subtitle-visibility-toggle-button');
    expect(style).toContain('.vjs-subtitle-visibility-toggle-label');
    expect(style).toContain('.vjs-subtitle-visibility-toggle-dot');
    expect(style).toContain('.vjs-primary-subtitle-trigger-lines');
    expect(style).toContain('.vjs-primary-subtitle-trigger-caret');
    expect(style).toContain('.vjs-primary-subtitle-button--active');
    expect(style).toContain('.vjs-subtitle-cluster-button--first');
    expect(style).toContain('.vjs-subtitle-cluster-button--middle');
    expect(style).toContain('.vjs-subtitle-cluster-button--last');
    expect(style).toContain('.vjs-quality-selector');
    expect(style).toContain('.primary-subtitle-menu');
    expect(style).toContain('.primary-subtitle-menu-status');
    expect(style).toContain('.primary-subtitle-menu-item-meta');
    expect(style).toContain('.primary-subtitle-menu-item-meta-icon--primary');
    expect(style).toContain('.primary-subtitle-menu-item-meta-icon--secondary');
    expect(style).toContain('.primary-subtitle-menu-item-meta-icon--local');
    expect(style).toContain('.primary-subtitle-menu-item-icon-svg');
    expect(style).toContain('.primary-subtitle-menu-item-check');
    expect(style).toContain('.primary-subtitle-menu-item--secondary');
    expect(style).toContain('.vjs-dual-subtitle-swap-button');
    expect(style).toContain('.vjs-dual-subtitle-swap-icon');
    expect(script).toContain('function orderSubtitleTracksForDisplay(subtitles, selection = props.subtitleSelection) {');
    expect(script).toContain('function hasPreferredShowingTrackOrder(selection = props.subtitleSelection) {');
    expect(script).toContain('function resolveLatestSourceSubtitles(fallbackSubtitles = []) {');
    expect(script).toContain('applySubtitleTracks(resolveLatestSourceSubtitles(subtitles), seq);');
    expect(style).toContain('transform: translateY(var(--dual-subtitle-offset-y, 0px)) scale(0.76);');
    expect(style).toContain('transform-origin: center bottom;');
  });
});

describe('HistoryPage status contract', () => {
  it('renders clear visual states for new, in-progress, and completed entries', () => {
    const descriptor = readDescriptor(new URL('./HistoryPage.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);
    expect(template).toContain('class="history-status-badge"');
    expect(template).toContain('class="history-open-label"');
    expect(template).toContain(':class="`is-${item.playbackState.id}`"');
    expect(template).toContain('{{ item.playbackState.statusLabel }}');
    expect(template).toContain('{{ item.playbackState.actionLabel }}');
    expect(template).toContain('{{ item.playbackState.progressLabel }}');

    expect(script).toContain('const HISTORY_COMPLETED_MIN_PERCENT = 95;');
    expect(script).toContain('const HISTORY_COMPLETED_MAX_REMAINING_SECONDS = 5;');
    expect(script).toContain('function getPlaybackState(item) {');
    expect(script).toContain("statusLabel: '已看完'");
    expect(script).toContain("statusLabel: '繼續觀看'");
    expect(script).toContain("statusLabel: '尚未開始'");

    expect(style).toContain('.history-state-row');
    expect(style).toContain('.history-status-badge.is-resume');
    expect(style).toContain('.history-status-badge.is-completed');
    expect(style).toContain('.history-progress.is-completed');
    expect(style).toContain('.history-item.is-completed .history-progress-bar span');
  });
});

describe('RecommendationsPage layout contract', () => {
  it('keeps the recommendations list inside its own page container', () => {
    const descriptor = readDescriptor(new URL('./RecommendationsPage.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).toContain('<section class="recommendations-page" data-testid="recommendations-page">');
    expect(template).toContain("<h2 class=\"recommendations-title\" data-testid=\"recommendations-title\">{{ t('recommendations.title') }}</h2>");
    expect(template).toContain('<VideoGrid />');
    expect(script).toContain("import VideoGrid from './VideoGrid.vue';");
    expect(script).toContain("import { useI18n } from '../i18n';");
    expect(script).toContain("const { t } = useI18n();");
    expect(style).toContain('.recommendations-page');
    expect(style).toContain('flex-direction: column;');
    expect(style).toContain('margin: 0 0 0 16px;');
    expect(style).toContain('padding: 12px 16px 0 0;');
    expect(style).toContain('.recommendations-page > *');
    expect(style).toContain('width: 100%;');
    expect(style).toContain('flex: 0 0 380px;');
    expect(style).toContain('.recommendations-title');
  });
});

describe('VideoInfo layout contract', () => {
  it('keeps uploader info on the left, actions on the right, and description in a separate panel', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const style = getFirstStyleContent(descriptor);

    const infoRowIndex = template.indexOf('<div ref="infoRowRef" class="info-row" data-testid="video-info-row">');
    const creatorInfoIndex = template.indexOf('ref="creatorInfoRef"');
    const actionsIndex = template.indexOf('<div ref="actionsRef" class="actions" :class="{ \'actions-wrapped\': actionsWrapped }" data-testid="video-info-actions">');
    const descriptionIndex = template.indexOf('<div class="description glass-panel">');

    expect(template).toContain('<div class="video-info" data-testid="video-info">');
    expect(template).not.toContain('<div class="video-info glass-panel">');
    expect(infoRowIndex).toBeGreaterThan(-1);
    expect(creatorInfoIndex).toBeGreaterThan(infoRowIndex);
    expect(actionsIndex).toBeGreaterThan(creatorInfoIndex);
    expect(descriptionIndex).toBeGreaterThan(actionsIndex);
    expect(template).toContain("'creator-info-compact': creatorTextHidden");
    expect(template).toContain('data-testid="video-info-follow-button"');

    expect(style).toContain('justify-content: space-between;');
    expect(style).toContain('justify-content: flex-end;');
    expect(style).toContain('margin-left: auto;');
  });

  it('keeps the description panel responsible for metadata and tags', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).toContain('<div v-if="showFullDescription && metadataItems.length > 0" class="metadata-grid">');
    expect(template).toContain('<p v-if="showFullDescription" class="tag-list">');
    expect(template).toContain('<div v-if="showStatsPanel" class="stats-panel">');
    expect(template).toContain('class="stats-hashtag"');
    expect(template).toContain('<span v-if="displayUploadDateTooltip" class="stats-tooltip">{{ displayUploadDateTooltip }}</span>');
    expect(script).toContain('formatRelativeUploadTime');
    expect(script).toContain('extractDescriptionHashtags');
    expect(script).toContain("{ label: 'IPFS CID', value: props.cid }");
    expect(style).toContain('.stats-panel');
    expect(style).toContain('width: 100%;');
    expect(style).toContain('background: transparent;');
    expect(style).toContain('.stats-tooltip');
    expect(style).toContain('.stats-hashtag');
    expect(style).toContain('text-overflow: ellipsis;');
    expect(style).toContain('border-radius: 12px;');
    expect(style).toContain('.stats-panel:hover .stats-tooltip');
  });

  it('shows the uploader secondary text without a Channel ID prefix while keeping metadata labels unchanged', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const script = descriptor.scriptSetup?.content || '';

    expect(script).toContain('return props.videoInfo.channelId;');
    expect(script).not.toContain('Channel ID: ${props.videoInfo.channelId}');
    expect(script).toContain("{ label: 'Channel ID', value: props.videoInfo.channelId }");
  });

  it('moves download into an overflow menu and lets share collapse before like or dislike', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).toContain('<div ref="moreMenuRef" class="more-actions" data-action-item data-testid="video-info-more-actions">');
    expect(template).toContain('class="actions-menu glass-panel" role="menu"');
    expect(template).toContain('v-for="item in overflowMenuItems"');
    expect(template).toContain("v-if=\"showShareButton\"");
    expect(template).toContain('class="action-group glass-btn" data-action-item');
    expect(template).toContain('item.id === subtitleActionId');
    expect(template).toContain('<SubtitleDialog');

    expect(script).toContain("const responsiveActionOrder = [shareActionId];");
    expect(script).toContain("const overflowActionOrder = [shareActionId, subtitleActionId, downloadActionId];");
    expect(script).toContain("const showShareButton = computed(() => !hiddenActionIds.value.includes(shareActionId));");
    expect(script).toContain('function resolveLayout()');
    expect(script).toContain('const nextCreatorTextHidden = fullCreatorWidth > infoRowWidth + 1;');
    expect(script).toContain('const nextCreatorWidth = nextCreatorTextHidden ? compactCreatorWidth : fullCreatorWidth;');
    expect(script).toContain('const availableActionsWidth = Math.max(0, infoRowWidth - nextCreatorWidth - infoGap);');

    expect(style).toContain('.actions-wrapped');
    expect(style).toContain('.action-measure');
    expect(style).toContain('.actions-menu');
    expect(style).toContain('border-radius: 20px;');
    expect(style).toContain('justify-content: flex-start;');
  });

  it('opens a share dialog with a link field, current time snapshot, and start-at toggle', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).toContain('data-testid="video-info-share-dialog"');
    expect(template).toContain('data-testid="video-info-share-url-input"');
    expect(template).toContain('data-testid="video-info-share-copy-button"');
    expect(template).toContain('data-testid="video-info-share-current-time"');
    expect(template).toContain('data-testid="video-info-share-start-at-toggle"');
    expect(template).toContain('aria-haspopup="dialog"');
    expect(template).toContain('@click="openShareDialog"');
    expect(template).toContain('v-model="shareIncludeTime"');
    expect(template).toContain('class="share-url-field"');
    expect(template).toContain('class="share-dialog-footer"');
    expect(template).toContain('class="share-time-inline-label">開始處</span>');
    expect(template).toContain("{{ shareCopySuccess ? 'Copied!' : 'Copy' }}");

    expect(script).toContain('const isShareDialogOpen = ref(false);');
    expect(script).toContain('const shareIncludeTime = ref(false);');
    expect(script).toContain('const sharePlaybackTime = ref(0);');
    expect(script).toContain("const shareUrlText = ref('');");
    expect(script).toContain('const shareUrlInputRef = ref(null);');
    expect(script).toContain('const shareTimeLabel = computed(() => formatShareStartTime(sharePlaybackTime.value));');
    expect(script).toContain('watch([() => props.cid, shareIncludeTime, sharePlaybackTime, isShareDialogOpen], () => {');
    expect(script).toContain('syncShareUrl();');
    expect(script).toContain("}, { immediate: true, flush: 'sync' });");
    expect(script).toContain('function syncShareUrl() {');
    expect(script).toContain('function openShareDialog() {');
    expect(script).toContain('sharePlaybackTime.value = getCurrentPlaybackTime(window);');
    expect(script).toContain('shareIncludeTime.value = sharePlaybackTime.value > 0;');
    expect(script).toContain('function copyShareUrl() {');

    expect(style).toContain('.share-backdrop');
    expect(style).toContain('.share-dialog');
    expect(style).toContain('.share-url-field');
    expect(style).toContain('.share-url-input');
    expect(style).toContain('.share-dialog-footer');
    expect(style).toContain('.share-time-inline');
  });

  it('hides uploader text before the follow button wraps and keeps a compact measurement copy offscreen', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).toContain('v-if="!creatorTextHidden" class="creator-text" data-testid="video-info-creator-text"');
    expect(template).toContain('ref="creatorTextMeasureRef"');
    expect(template).toContain('class="creator-text creator-text-measure"');
    expect(script).toContain('const creatorTextHidden = ref(false);');
    expect(script).toContain('const creatorTextMeasureRef = ref(null);');
    expect(script).toContain('const subscribeButtonRef = ref(null);');
    expect(script).toContain('const compactCreatorWidth =');
    expect(style).toContain('.creator-text-measure');
    expect(style).toContain('.creator-info-compact .subscribe-btn');
  });

  it('places dynamically collapsed items at the top of the overflow menu (e.g. share before download)', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const script = descriptor.scriptSetup?.content || '';

    // Verify the overflow action order array places share before subtitles and download
    expect(script).toContain("const overflowActionOrder = [shareActionId, subtitleActionId, downloadActionId];");
  });

  it('collapses the description by default and exposes explicit expand and collapse controls', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);
    const tagListIndex = template.indexOf('<p v-if="showFullDescription" class="tag-list">');
    const collapseButtonIndex = template.indexOf('class="description-toggle description-toggle-bottom"');

    expect(template).not.toContain('<div class="description-shell">');
    expect(template).toContain("v-if=\"hasExpandableDescription && !isDescriptionExpanded\"");
    expect(template).toContain("v-if=\"hasExpandableDescription && isDescriptionExpanded\"");
    expect(template).toContain('<span class="desc-inline-ellipsis">...</span>');
    expect(template).toContain('class="description-toggle description-toggle-inline-text"');
    expect(template).toContain('ref="descriptionMeasureRef"');
    expect(template).toContain('更多資訊');
    expect(template).toContain('只顯示部分資訊');
    expect(collapseButtonIndex).toBeGreaterThan(tagListIndex);

    expect(script).toContain('const isDescriptionExpanded = ref(false);');
    expect(script).toContain('const collapsedDescription = ref(\'\');');
    expect(script).toContain('const descriptionMeasureRef = ref(null);');
    expect(script).toContain('const hasExpandableDescription = computed(() => {');
    expect(script).toContain(
      'const showFullDescription = computed(() => isDescriptionExpanded.value || !hasExpandableDescription.value);'
    );
    expect(script).toContain('isDescriptionExpanded.value = false;');
    expect(script).toContain('async function updateCollapsedDescription() {');
    expect(script).toContain('function normalizeCollapsedDescription(text) {');
    expect(script).toContain(".replace(/\\r\\n?/g, '\\n')");
    expect(script).toContain(".split('\\n')");
    expect(script).toContain('function expandDescription() {');
    expect(script).toContain('function collapseDescription() {');

    expect(style).toContain('.desc-text-collapsed-inline');
    expect(style).toContain('.desc-inline-ellipsis');
    expect(style).toContain('.desc-text-measure');
    expect(style).toContain('.description-toggle-inline-text');
    expect(style).toContain('.description-toggle-bottom');
    expect(style).toContain('align-self: flex-start;');
  });
});

describe('SubtitleDialog contract', () => {
  it('keeps primary and secondary subtitle controls alongside the import/session workflow', () => {
    const descriptor = readDescriptor(new URL('./SubtitleDialog.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);

    expect(template).not.toContain('Available in CID');
    expect(template).not.toContain('subtitle-dialog-remote-empty');
    expect(template).not.toContain('主字幕仍由播放器控制列切換');
    expect(template).not.toContain('class="subtitle-role-chip"');
    expect(template).toContain('匯入、下載與主 / 次字幕切換都在這裡快速完成');
    expect(template).not.toContain('data-testid="subtitle-dialog-selection-grid"');
    expect(template).not.toContain('data-testid="subtitle-dialog-slot-grid"');
    expect(template).not.toContain('data-testid="subtitle-dialog-slot-primary"');
    expect(template).not.toContain('data-testid="subtitle-dialog-slot-secondary"');
    expect(template).toContain('multiple');
    expect(template).not.toContain('字幕清單');
    expect(template).not.toContain('data-testid="subtitle-dialog-library-tabs"');
    expect(template).not.toContain('data-testid="subtitle-dialog-tab-imported"');
    expect(template).not.toContain('data-testid="subtitle-dialog-tab-download"');
    expect(template).not.toContain('class="subtitle-section subtitle-library-panel"');
    expect(template).not.toContain('subtitle-library-surface');
    expect(template).toContain('data-testid="subtitle-dialog-track-list"');
    expect(template).toContain('data-testid="subtitle-dialog-empty"');
    expect(template).toContain(':data-testid="getPrimaryActionTestId(track)"');
    expect(template).toContain(':data-testid="getSecondaryActionTestId(track)"');
    expect(template).toContain('class="subtitle-track-title-row"');
    expect(template).not.toContain('用按鈕切換主 / 次字幕，外框會標示目前狀態。');
    expect(template).not.toContain('本機與影片字幕會混合顯示');
    expect(script).toContain("const importSessionSummary = computed(() => {");
    expect(script).toContain('const visibleTracks = computed(() => props.subtitles);');
    expect(script).not.toContain('const subtitleLibraryNote = computed(() => {');
    expect(script).not.toContain("const activeLibraryTab = ref('download');");
    expect(script).not.toContain('function setLibraryTab(nextTab) {');
    expect(script).toContain("const currentPrimaryTrack = computed(() => findTrackByLanguage(props.subtitleSelection.primaryLang));");
    expect(script).toContain("function handleTrackPrimaryAction(track) {");
    expect(script).toContain("function handleTrackSecondaryAction(track) {");
    expect(script).toContain("function getPrimaryActionTestId(track) {");
    expect(script).toContain("function getSecondaryActionTestId(track) {");
    expect(script).toContain("import SubtitleRoleIcon from './SubtitleRoleIcon.vue';");
    expect(script).toContain("function upsertPendingImportedTrack(pendingTracks, nextTrack) {");
    expect(script).toContain("function formatImportStatus(successfulTracks, failedImports) {");
    expect(script).toContain("async function handleDownloadSubtitle(track) {");
    expect(script).toContain("function clearSecondarySubtitle() {");
    expect(script).toContain("return `本次暫存 ${props.importedSubtitles.length} 條本機字幕`;");
    expect(template).toContain('<SubtitleRoleIcon class="subtitle-role-icon subtitle-role-icon--primary" variant="primary" />');
    expect(template).toContain('<SubtitleRoleIcon class="subtitle-role-icon subtitle-role-icon--secondary" variant="secondary" />');
    expect(style).toContain('.subtitle-dialog-toolbar');
    expect(style).toContain('.subtitle-toolbar-pill');
    expect(style).toContain('.subtitle-toolbar-hint');
    expect(style).not.toContain('.subtitle-library-surface');
    expect(style).not.toContain('.subtitle-section');
    expect(style).not.toContain('.subtitle-library-panel');
    expect(style).not.toContain('.subtitle-library-tabs');
    expect(style).not.toContain('.subtitle-library-tab');
    expect(style).toContain('.subtitle-track-row--primary');
    expect(style).toContain('.subtitle-track-row--secondary');
    expect(style).toContain('.subtitle-track-title-row');
    expect(style).toContain('.subtitle-track-badge-row');
    expect(style).toContain('.subtitle-track-actions');
    expect(style).toContain('.subtitle-row-btn--icon');
    expect(style).toContain('.subtitle-role-icon');
    expect(style).not.toContain('.subtitle-section-title');
    expect(style).not.toContain('.subtitle-section-copy');
    expect(style).not.toContain('.subtitle-section-caption');
    expect(style).not.toContain('.subtitle-library-note');
  });
});
