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

describe('Header search action button', () => {
  it('keeps a fixed search submit button and only shows a clear button when the query has text', () => {
    const descriptor = readDescriptor(new URL('./Header.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getStyleContent(descriptor);

    expect(template).toContain('ref="searchInputRef"');
    expect(template).toContain('@keyup.enter="onSearch"');
    expect(template).toContain('class="search-actions"');
    expect(template).toContain('v-if="!isSearchQueryEmpty"');
    expect(template).toContain('class="icon-btn search-clear-btn"');
    expect(template).toContain('@click="clearSearchQuery"');
    expect(template).toContain('data-testid="header-search-clear-button"');
    expect(template).toContain('class="icon-btn search-submit-btn"');
    expect(template).toContain('@click="onSearch"');
    expect(template).toContain('aria-label="Search"');
    expect(template).toContain('title="Search CID"');
    expect(template).toContain('data-testid="header-search-submit-button"');

    expect(script).toContain('const searchInputRef = ref(null);');
    expect(script).toContain('const isSearchQueryEmpty = computed(() => searchQuery.value.trim().length === 0);');
    expect(script).toContain('function focusSearchInput() {');
    expect(script).toContain('async function clearSearchQuery() {');
    expect(script).toContain("searchQuery.value = '';");
    expect(script).toContain('await nextTick();');
    expect(script).toContain('focusSearchInput();');
    expect(script).not.toContain('navigator.clipboard');
    expect(script).not.toContain('pasteSearchQueryFromClipboard');
    expect(script).not.toContain('onSearchAction');

    expect(style).toContain('.search-actions');
    expect(style).toContain('.search-clear-btn');
    expect(style).toContain('.search-submit-btn');
  });
});
