import { readFileSync } from 'node:fs';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

describe('LocalEnvironmentPanel contract', () => {
  it('renders the local environment summary, refresh action, and capability list', () => {
    const source = readFileSync(new URL('./LocalEnvironmentPanel.vue', import.meta.url), 'utf8');
    const descriptor = parse(source).descriptor;
    const template = descriptor.template?.content || '';
    const script = descriptor.scriptSetup?.content || '';
    const style = descriptor.styles.map((block) => block.content).join('\n');

    expect(template).toContain('data-testid="local-environment-panel"');
    expect(template).toContain('data-testid="local-environment-refresh"');
    expect(template).toContain('data-testid="local-environment-api-host"');
    expect(template).toContain('data-testid="local-environment-api-port"');
    expect(template).toContain('data-testid="local-environment-status"');
    expect(template).toContain('data-testid="local-environment-summary"');
    expect(template).toContain('data-testid="local-environment-capabilities"');
    expect(template).toContain("v-for=\"capability in state.capabilities\"");
    expect(template).toContain("@click=\"onRefresh\"");
    expect(template).toContain("@input=\"onApiHostInput\"");
    expect(template).toContain("@input=\"onApiPortInput\"");

    expect(script).toContain("import { formatCapabilityStatusText, formatEnvironmentStateLabel } from '../utils/environmentCheck';");
    expect(script).toContain("const emit = defineEmits(['refresh', 'update:apiHost', 'update:apiPort']);");
    expect(script).toContain("const actionLabel = computed(() => (props.state?.checkedAt ? '重新檢測' : '環境檢測'));");
    expect(script).toContain("const targetEndpoint = computed(() => `${props.targetHost}:${props.targetPort}`);");
    expect(script).toContain("const gatewayBaseUrl = computed(() => `http://${props.targetHost}:${props.targetPort}/`);");
    expect(script).toContain("function onApiHostInput(event) {");
    expect(script).toContain("function onApiPortInput(event) {");
    expect(script).toContain("emit('refresh');");

    expect(style).toContain('.environment-panel');
    expect(style).toContain('.environment-refresh-btn');
    expect(style).toContain('.environment-api-config');
    expect(style).toContain('.environment-field input');
    expect(style).toContain('.environment-meta-grid');
    expect(style).toContain('.environment-capabilities');
  });
});
