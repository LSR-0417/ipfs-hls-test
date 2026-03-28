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

describe('Gateway reset controls', () => {
  it('keeps reset actions independent and Apply-gated', () => {
    const descriptor = readDescriptor(new URL('./Header.vue', import.meta.url));
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = getStyleContent(descriptor);

    expect(template).toContain('data-testid="gateway-custom-reset-button"');
    expect(template).toContain('data-testid="gateway-local-reset-button"');
    expect(template).toContain("t('header.actions.gateway.restoreDefaults')");
    expect(template).toContain('data-testid="gateway-error"');

    expect(script).toContain('const hasPendingLocalGatewayReset = computed(');
    expect(script).toContain('const hasPendingCustomGatewayReset = computed(');
    expect(script).toContain('function restoreCustomGatewayDefaults() {');
    expect(script).toContain('function restoreLocalGatewayDefaults() {');
    expect(script).toContain('persistLocalGatewayConfig(');
    expect(script).toContain('persistCustomGateway(normalizedCustomGateway, window);');
    expect(script).toContain('Choose another gateway or enter a valid custom gateway before applying.');

    expect(style).toContain('.gateway-reset-btn');
  });
});
