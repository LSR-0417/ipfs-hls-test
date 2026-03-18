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

    const playerTitleIndex = template.indexOf('<div v-if="currentVideoTitle" class="player-title">');
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

    expect(template).toContain('<div v-if="metadataItems.length > 0" class="metadata-grid">');
    expect(template).toContain('<p class="tag-list">');
    expect(template).toContain('<div v-if="displayStatsItems.length > 0" class="stats-panel">');
    expect(template).toContain('<span v-if="displayUploadDateTooltip" class="stats-tooltip">{{ displayUploadDateTooltip }}</span>');
    expect(script).toContain('formatRelativeUploadTime');
    expect(script).toContain("{ label: 'IPFS CID', value: props.cid }");
    expect(style).toContain('.stats-panel');
    expect(style).toContain('width: 100%;');
    expect(style).toContain('background: transparent;');
    expect(style).toContain('.stats-tooltip');
    expect(style).toContain('border-radius: 12px;');
    expect(style).toContain('.stats-panel:hover .stats-tooltip');
  });
});
