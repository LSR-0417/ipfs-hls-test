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
  it('renders the player title row before VideoInfo and no longer uses the old status message slot', () => {
    const descriptor = readDescriptor(new URL('../App.vue', import.meta.url));
    const template = descriptor.template?.content || '';

    const playerTitleIndex = template.indexOf('<div v-if="currentVideoInfo.title" class="player-title">');
    const videoInfoIndex = template.indexOf('<VideoInfo');

    expect(playerTitleIndex).toBeGreaterThan(-1);
    expect(videoInfoIndex).toBeGreaterThan(playerTitleIndex);
    expect(template).not.toContain('id="status"');
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

    expect(script).toContain("const responsiveActionOrder = [shareActionId];");
    expect(script).toContain("const overflowActionOrder = [shareActionId, downloadActionId];");
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

    // Verify the overflow action order array places share before download
    expect(script).toContain("const overflowActionOrder = [shareActionId, downloadActionId];");
  });

  it('collapses the description by default and exposes explicit expand and collapse controls', () => {
    const descriptor = readDescriptor(new URL('./VideoInfo.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getFirstStyleContent(descriptor);
    const tagListIndex = template.indexOf('<p v-if="showFullDescription" class="tag-list">');
    const collapseButtonIndex = template.indexOf('class="description-toggle description-toggle-bottom"');

    expect(template).toContain('<div class="description-shell">');
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

    expect(style).toContain('.description-shell');
    expect(style).toContain('.desc-text-collapsed-inline');
    expect(style).toContain('.desc-inline-ellipsis');
    expect(style).toContain('.desc-text-measure');
    expect(style).toContain('.description-toggle-inline-text');
    expect(style).toContain('.description-toggle-bottom');
    expect(style).toContain('align-self: flex-start;');
  });
});
