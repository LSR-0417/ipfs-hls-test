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

    const infoRowIndex = template.indexOf('<div class="info-row">');
    const creatorInfoIndex = template.indexOf('<div class="creator-info">');
    const actionsIndex = template.indexOf('<div class="actions">');
    const descriptionIndex = template.indexOf('<div class="description glass-panel">');

    expect(template).toContain('<div class="video-info">');
    expect(template).not.toContain('<div class="video-info glass-panel">');
    expect(infoRowIndex).toBeGreaterThan(-1);
    expect(creatorInfoIndex).toBeGreaterThan(infoRowIndex);
    expect(actionsIndex).toBeGreaterThan(creatorInfoIndex);
    expect(descriptionIndex).toBeGreaterThan(actionsIndex);

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
