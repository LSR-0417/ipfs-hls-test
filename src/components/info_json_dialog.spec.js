import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

function readDescriptor(fileUrl) {
  const source = readFileSync(fileUrl, 'utf8');
  return parse(source).descriptor;
}

function getStyleContent(descriptor) {
  return descriptor.styles.map((style) => style.content).join('\n');
}

describe('InfoJsonDialog tabbed draft contract', () => {
  it('separates metadata, subtitles, and video processing into independent tabs', () => {
    const descriptor = readDescriptor(new URL('./InfoJsonDialog.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getStyleContent(descriptor);

    expect(script).toContain("const processorForm = reactive(createProcessorFormState());");
    expect(script).toContain("const processorResolutionOptionIds = Object.freeze(['4k', '2k', '1080p', '720p', '480p', 'orig']);");
    expect(script).toContain("const localVideoFile = ref(null);");
    expect(script).toContain("const localSubtitleTracks = ref([]);");
    expect(script).toContain("const activeTab = ref('metadata');");
    expect(script).toContain("const dialogTabIds = Object.freeze(['metadata', 'subtitles', 'video']);");
    expect(script).toContain("const dialogTabs = computed(() =>");
    expect(script).toContain('const lastSyncedFormSnapshot = ref(createVideoInfoDraftFormSnapshot(form));');
    expect(script).toContain('syncForm(props.initialVideoInfo);');
    expect(script).toContain('syncForm(nextVideoInfo);');
    expect(script).toContain("const effectiveIncludeInfoJson = computed(");
    expect(script).toContain("const effectiveIncludeSubtitleManifest = computed(");
    expect(script).toContain("function buildLocalVideoProcessorDraft(file, options = {}) {");
    expect(script).toContain('function setActiveTab(tabId) {');
    expect(script).toContain("async function handleSubtitleSelection(event) {");
    expect(script).toContain("function handleVideoSelection(event) {");
    expect(script).toContain('isVideoInfoDraftFormPristine(form, lastSyncedFormSnapshot.value)');
    expect(script).not.toContain("const localAvatarFile = ref(null);");
    expect(script).not.toContain("function handleAvatarSelection(event) {");

    expect(template).toContain('role="tablist"');
    expect(template).toContain(':data-testid="`info-json-tab-${tab.id}`"');
    expect(template).toContain(`v-show="activeTab === 'metadata'"`);
    expect(template).toContain(`v-show="activeTab === 'subtitles'"`);
    expect(template).toContain(`v-show="activeTab === 'video'"`);
    expect(template).toContain('data-testid="info-json-metadata-panel"');
    expect(template).toContain('data-testid="info-json-subtitles-panel"');
    expect(template).toContain('data-testid="info-json-video-panel"');
    expect(template).toContain('data-testid="info-json-download-info-button"');
    expect(template).toContain('data-testid="info-json-upload-subtitles-button"');
    expect(template).toContain('data-testid="info-json-download-subtitles-button"');
    expect(template).toContain('data-testid="info-json-upload-video-button"');
    expect(template).toContain('data-testid="info-json-video-input"');
    expect(template).toContain('data-testid="info-json-subtitles-input"');
    expect(template).toContain(':data-testid="`info-json-resolution-${option.id}`"');
    expect(template).toContain('data-testid="info-json-attach-info-toggle"');
    expect(template).toContain('data-testid="info-json-attach-subtitles-toggle"');
    expect(template).toContain('v-model="processorForm.selectedResolutions"');
    expect(template).toContain('v-model="processorForm.includeInfoJson"');
    expect(template).toContain('v-model="processorForm.includeSubtitlesJson"');
    expect(template).toContain('v-model="form.uploadDate"');
    expect(template).toContain('type="date"');
    expect(template).toContain('accept=".vtt,.srt,text/vtt,application/x-subrip"');
    expect(template).toContain('accept="video/*"');
    expect(template).toContain("t('infoJson.video.draftBadge')");
    expect(template).toContain('class="panel-actions panel-actions--end"');
    expect(template).toContain('for="infoJsonSubtitleInput"');
    expect(template).toContain('for="infoJsonVideoInput"');
    expect(template).not.toContain('data-testid="info-json-avatar-input"');
    expect(template).not.toContain("t('infoJson.fields.durationString.label')");
    expect(template).not.toContain("t('infoJson.fields.resolution.label')");
    expect(template).not.toContain("t('infoJson.fields.fps.label')");
    expect(template).not.toContain("t('infoJson.fields.categories.label')");
    expect(template).not.toContain('@click="copyInfoJson"');
    expect(template).not.toContain('class="json-preview"><code>{{ generatedJson }}</code></pre>');
    expect(template).not.toContain("t('infoJson.manifests.infoTitle')");
    expect(template).not.toContain("t('infoJson.manifests.subtitlesTitle')");
    expect(template).not.toContain('class="json-preview"><code>{{ subtitleManifestJson }}</code></pre>');

    expect(style).toContain('.info-json-tabbar');
    expect(style).toContain('.info-json-tab');
    expect(style).toContain('.info-json-tab-label');
    expect(style).toContain('.panel-surface');
    expect(style).toContain('.panel-surface--toolbar');
    expect(style).toContain('.panel-actions--end');
    expect(style).toContain('.processor-resolution-grid');
    expect(style).toContain('.processor-toggle-card');
    expect(style).toContain('.processor-section');
    expect(style).toContain('.count-pill');
    expect(style).toContain('.subtitle-track-list');
    expect(style).toContain('.status-pill.is-warning');
    expect(style).not.toContain('.info-json-columns');
    expect(style).not.toContain('.asset-uploader');
  });
});
