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

describe('Sidebar toggle contract', () => {
  it('wires the header hamburger button to a left drawer sidebar state', () => {
    const appDescriptor = readDescriptor(new URL('../App.vue', import.meta.url));
    const headerDescriptor = readDescriptor(new URL('./Header.vue', import.meta.url));
    const sidebarDescriptor = readDescriptor(new URL('./Sidebar.vue', import.meta.url));

    const appTemplate = appDescriptor.template?.content || '';
    const appScript = appDescriptor.scriptSetup?.content || '';
    const headerTemplate = headerDescriptor.template?.content || '';
    const headerScript = headerDescriptor.scriptSetup?.content || '';
    const headerStyle = getStyleContent(headerDescriptor);
    const sidebarTemplate = sidebarDescriptor.template?.content || '';
    const sidebarScript = sidebarDescriptor.scriptSetup?.content || '';
    const sidebarStyle = getStyleContent(sidebarDescriptor);

    expect(appScript).toContain('const isSidebarOpen = ref(false);');
    expect(appScript).toContain('function toggleSidebar() {');
    expect(appScript).toContain('isSidebarOpen.value = !isSidebarOpen.value;');
    expect(appScript).toContain('function closeSidebar() {');
    expect(appScript).toContain('isSidebarOpen.value = false;');
    expect(appTemplate).toContain('class="sidebar-backdrop"');
    expect(appTemplate).toContain('data-testid="sidebar-backdrop"');
    expect(appTemplate).toContain(':sidebar-open="isSidebarOpen"');
    expect(appTemplate).toContain('@toggle-sidebar="toggleSidebar"');
    expect(appTemplate).toContain('<Sidebar :active-view="activeView" :open="isSidebarOpen" @view-select="onViewSelect" />');

    expect(headerScript).toContain("sidebarOpen: { type: Boolean, default: false },");
    expect(headerScript).toContain("const emit = defineEmits(['search', 'gateway-change', 'toggle-sidebar']);");
    expect(headerScript).toContain('function toggleSidebar() {');
    expect(headerTemplate).toContain('aria-controls="app-sidebar"');
    expect(headerTemplate).toContain('data-testid="header-sidebar-toggle"');
    expect(headerTemplate).toContain('@click="toggleSidebar"');
    expect(headerTemplate).toContain(":aria-expanded=\"sidebarOpen ? 'true' : 'false'\"");
    expect(headerStyle).toContain('.hamburger:focus-visible');

    expect(sidebarScript).toContain("open: {\n    type: Boolean,\n    default: false,\n  },");
    expect(sidebarTemplate).toContain('id="app-sidebar"');
    expect(sidebarTemplate).toContain(":class=\"{ 'is-open': open }\"");
    expect(sidebarStyle).toContain('.sidebar.is-open');
    expect(sidebarStyle).toContain('transform: translateX(calc(-100% - 18px));');
  });
});
