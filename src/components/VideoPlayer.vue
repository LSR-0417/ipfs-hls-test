<template>
  <div ref="playerShellRef" class="video-player-shell">
    <div data-vjs-player>
      <video
        ref="videoRef"
        class="video-js vjs-big-play-centered"
        crossorigin="anonymous"
        :poster="posterUrl"
        playsinline
        webkit-playsinline
      ></video>
    </div>

    <div
      v-if="showStartupGate"
      class="startup-gate"
      data-testid="video-player-startup-gate"
      role="status"
      aria-live="polite"
    >
      <div class="startup-gate-copy">
        <p class="startup-gate-title">{{ startupGateTitle }}</p>
        <p class="startup-gate-detail">{{ startupGateDetail }}</p>
      </div>
      <button
        v-if="startupGateCanBypass"
        type="button"
        class="startup-gate-action"
        @click="overrideStartupGate"
      >
        立即播放
      </button>
    </div>

    <div
      v-if="isPrimarySubtitleMenuOpen"
      class="primary-subtitle-menu-backdrop"
      data-testid="primary-subtitle-menu-backdrop"
      @click="closePrimarySubtitleMenu"
    >
      <section
        ref="primarySubtitleMenuRef"
        class="primary-subtitle-menu glass-panel"
        :style="primarySubtitleMenuStyle"
        role="menu"
        aria-label="主字幕"
        tabindex="-1"
        data-testid="primary-subtitle-menu"
        @click.stop
      >
        <div v-if="primarySubtitleMenuStatusMessage" class="primary-subtitle-menu-status" data-testid="primary-subtitle-menu-status">
          {{ primarySubtitleMenuStatusMessage }}
        </div>

        <div v-else class="primary-subtitle-menu-body" role="none">
          <div class="primary-subtitle-menu-title" aria-hidden="true">{{ primarySubtitleMenuTitle }}</div>

          <button
            type="button"
            class="primary-subtitle-menu-item"
            :class="{ 'primary-subtitle-menu-item--selected': resolvedSubtitleSelection.mode !== 'showing' }"
            data-testid="primary-subtitle-menu-off"
            @click="selectPrimarySubtitle('')"
          >
            <span class="primary-subtitle-menu-item-main">
              <span class="primary-subtitle-menu-item-label">關閉</span>
              <span
                v-if="resolvedSubtitleSelection.mode !== 'showing'"
                class="primary-subtitle-menu-item-check"
                aria-hidden="true"
              >
                ✓
              </span>
            </span>
          </button>

          <button
            v-for="track in primarySubtitleMenuItems"
            :key="track.menuKey"
            type="button"
            class="primary-subtitle-menu-item"
            :class="{
              'primary-subtitle-menu-item--selected': track.isPrimary,
              'primary-subtitle-menu-item--secondary': track.isSecondary,
            }"
            :disabled="track.isSecondary"
            :data-testid="`primary-subtitle-menu-track-${track.lang}`"
            @click="selectPrimarySubtitle(track.lang)"
          >
            <span class="primary-subtitle-menu-item-main">
              <span class="primary-subtitle-menu-item-label">{{ track.label }}</span>
              <span class="primary-subtitle-menu-item-trailing">
                <span
                  v-if="track.isLocal || track.isPrimary || track.isSecondary"
                  class="primary-subtitle-menu-item-meta"
                  :aria-label="resolvePrimarySubtitleMenuTrackMetaLabel(track)"
                  :title="resolvePrimarySubtitleMenuTrackMetaLabel(track)"
                  role="img"
                >
                  <span
                    v-if="track.isPrimary"
                    class="primary-subtitle-menu-item-meta-icon primary-subtitle-menu-item-meta-icon--primary"
                    aria-hidden="true"
                  ></span>
                  <span
                    v-if="track.isSecondary"
                    class="primary-subtitle-menu-item-meta-icon primary-subtitle-menu-item-meta-icon--secondary"
                    aria-hidden="true"
                  ></span>
                  <span
                    v-if="track.isLocal"
                    class="primary-subtitle-menu-item-meta-icon primary-subtitle-menu-item-meta-icon--local"
                    aria-hidden="true"
                  ></span>
                </span>
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="isHotkeyHelpOpen"
      class="hotkey-help-backdrop"
      data-testid="video-player-hotkey-help-backdrop"
      @click.self="closeHotkeyHelp"
    >
      <div
        ref="hotkeyHelpDialogRef"
        class="hotkey-help-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="videoPlayerHotkeyHelpTitle"
        tabindex="-1"
        data-testid="video-player-hotkey-help-dialog"
      >
        <div class="hotkey-help-header">
          <div class="hotkey-help-copy">
            <p class="hotkey-help-kicker">Keyboard Shortcuts</p>
            <h2 id="videoPlayerHotkeyHelpTitle">播放器快捷鍵</h2>
            <p class="hotkey-help-summary">精簡鍵位表。焦點在輸入框或按鈕上時不會攔截按鍵。</p>
          </div>
          <button class="hotkey-help-close" type="button" @click="closeHotkeyHelp" aria-label="關閉快捷鍵說明">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="hotkey-help-body">
          <section v-for="section in hotkeyHelpSections" :key="section.id" class="hotkey-help-section">
            <div class="hotkey-help-section-header">
              <p class="hotkey-help-section-title">{{ section.title }}</p>
            </div>

            <ul class="hotkey-help-list">
              <li v-for="item in section.items" :key="item.id" class="hotkey-help-row">
                <div class="hotkey-help-keys" :aria-label="`${item.label} 快捷鍵`">
                  <kbd v-for="key in item.keys" :key="key" class="hotkey-chip">{{ key }}</kbd>
                </div>
                <strong class="hotkey-help-label">{{ item.label }}</strong>
                <span class="hotkey-help-detail">{{ item.detail }}</span>
              </li>
            </ul>
          </section>
        </div>

        <p class="hotkey-help-hint">
          按 <kbd class="hotkey-chip hotkey-chip--inline">?</kbd> 或
          <kbd class="hotkey-chip hotkey-chip--inline">Esc</kbd> 關閉
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import {
  fetchGatewayVariantPlaylists,
  gatewayProbePlaybackRateThreshold,
  gatewayProbeSegmentSampleCount,
  isLoopbackGatewayUrl,
  probeGatewayAvailability,
  shouldAutoFallbackGateway,
} from '../utils/gateway';
import {
  applyQualityLevelHeightLock,
  buildMediaHandoffQualitySnapshot,
  isSuccessfulMediaHandoffSegmentResponse,
  mediaHandoffQualityModeAuto,
  mediaHandoffQualityModeManual,
  resumeMediaHandoffPlayback,
  rewriteMediaHandoffRequestUri,
  selectMediaHandoffLockedHeight,
} from '../utils/mediaHandoff';
import { formatTime } from '../utils/time';
import { applyPlaybackHotkey, getPlayerPlaybackSnapshot } from '../utils/playback';
import {
  buildQualityLevelPayload,
  formatQualitySelectorLabel,
  getStartupInitialRenditionCount,
  pickStartupInitialPlaylist,
} from '../utils/startupRenditions';
import { resolveSecondaryCueOffset } from '../utils/subtitleCueLayout';
import {
  resolveDualSubtitleSwapControlState,
  reconcileSubtitlePreference,
  resolvePlayerControlledSubtitlePreference,
  resolveToggledSubtitlePreference,
} from '../utils/subtitles';

// 確保 videojs 綁定到 window，才能讓較舊的擴充套件可以成功註冊
if (typeof window !== 'undefined') {
  window.videojs = videojs;
}

function patchVideoJsTextTrackDisplay() {
  if (typeof videojs.getComponent !== 'function') {
    return;
  }

  const TextTrackDisplay = videojs.getComponent('TextTrackDisplay');
  const prototype = TextTrackDisplay?.prototype;

  if (!prototype || prototype.__safeActiveCuesPatchApplied__) {
    return;
  }

  const originalUpdateForTrack = prototype.updateForTrack;
  const originalUpdateDisplayState = prototype.updateDisplayState;

  if (typeof originalUpdateForTrack !== 'function' || typeof originalUpdateDisplayState !== 'function') {
    return;
  }

  prototype.updateForTrack = function updateForTrackWithSafeActiveCues(tracks) {
    const readyTracks = (Array.isArray(tracks) ? tracks : [tracks]).filter((track) => track?.activeCues);

    if (readyTracks.length === 0) {
      return;
    }

    return originalUpdateForTrack.call(this, readyTracks);
  };

  prototype.updateDisplayState = function updateDisplayStateWithSafeActiveCues(track) {
    if (!track?.activeCues) {
      return;
    }

    return originalUpdateDisplayState.call(this, track);
  };

  prototype.__safeActiveCuesPatchApplied__ = true;
}

patchVideoJsTextTrackDisplay();

const primarySubtitleButtonComponentName = 'PrimarySubtitleControlButton';
const primarySubtitleControlStateEventName = 'primarysubtitlecontrolstatechange';
const primarySubtitleMenuTitle = '主字幕';
const subtitleVisibilityToggleButtonComponentName = 'SubtitleVisibilityToggleButton';
const subtitleVisibilityToggleStateEventName = 'subtitlevisibilitytogglestatechange';
const subtitleVisibilityToggleTitle = '字幕開關';
const subtitleVisibilityToggleLabel = 'CC';
const dualSubtitleSwapButtonComponentName = 'DualSubtitleSwapButton';
const dualSubtitleSwapStateEventName = 'dualsubtitleswapstatechange';
const dualSubtitleSwapTitle = '切換主 / 副字幕';

function createSubtitleControlGlyph(documentLike, options = {}) {
  const { containerClass = '', labelClass = '', labelText = '', dotClass = '', caretClass = '' } = options;
  const glyphEl = documentLike.createElement('span');
  glyphEl.className = containerClass;
  glyphEl.setAttribute('aria-hidden', 'true');

  const labelEl = documentLike.createElement('span');
  labelEl.className = labelClass;
  labelEl.textContent = labelText;
  glyphEl.appendChild(labelEl);

  if (dotClass) {
    const dotEl = documentLike.createElement('span');
    dotEl.className = dotClass;
    dotEl.setAttribute('aria-hidden', 'true');
    glyphEl.appendChild(dotEl);
  }

  if (caretClass) {
    const caretEl = documentLike.createElement('span');
    caretEl.className = caretClass;
    caretEl.setAttribute('aria-hidden', 'true');
    glyphEl.appendChild(caretEl);
  }

  return glyphEl;
}

function createPrimarySubtitleMenuGlyph(documentLike) {
  const glyphEl = documentLike.createElement('span');
  glyphEl.className = 'vjs-primary-subtitle-trigger';
  glyphEl.setAttribute('aria-hidden', 'true');

  const linesEl = documentLike.createElement('span');
  linesEl.className = 'vjs-primary-subtitle-trigger-lines';
  glyphEl.appendChild(linesEl);

  const caretEl = documentLike.createElement('span');
  caretEl.className = 'vjs-primary-subtitle-trigger-caret';
  caretEl.setAttribute('aria-hidden', 'true');
  glyphEl.appendChild(caretEl);

  return glyphEl;
}

function registerPrimarySubtitleControlButton() {
  if (typeof videojs.getComponent !== 'function' || videojs.getComponent(primarySubtitleButtonComponentName)) {
    return;
  }

  const Button = videojs.getComponent('Button');
  if (!Button) {
    return;
  }

  class PrimarySubtitleControlButton extends Button {
    constructor(player, options = {}) {
      super(player, options);
      this.controlText(primarySubtitleMenuTitle);
      this.on(player, primarySubtitleControlStateEventName, () => this.updateState());
      this.updateState();
    }

    buildCSSClass() {
      return `vjs-primary-subtitle-button vjs-subtitle-cluster-button vjs-subtitle-cluster-button--middle ${super.buildCSSClass()}`;
    }

    createEl() {
      const el = super.createEl();
      const iconPlaceholder = el.querySelector('.vjs-icon-placeholder');
      if (iconPlaceholder) {
        iconPlaceholder.setAttribute('aria-hidden', 'true');
        iconPlaceholder.textContent = '';
      }

      const glyphEl = createPrimarySubtitleMenuGlyph(el.ownerDocument);

      const controlTextEl = el.querySelector('.vjs-control-text');
      el.insertBefore(glyphEl, controlTextEl || null);
      return el;
    }

    handleClick() {
      this.player_.primarySubtitleMenuToggle_?.();
    }

    updateState() {
      const state = this.player_.primarySubtitleControlState_ || {};
      const buttonEl = this.el();

      this.show();
      if (buttonEl) {
        buttonEl.setAttribute('title', state.tooltip || primarySubtitleMenuTitle);
        buttonEl.setAttribute('aria-label', state.tooltip || primarySubtitleMenuTitle);
        buttonEl.setAttribute('aria-haspopup', 'menu');
        buttonEl.setAttribute('aria-expanded', state.expanded ? 'true' : 'false');
      }

      if (state.enabled === false) {
        this.disable();
      } else {
        this.enable();
      }

      if (state.expanded) {
        this.addClass('vjs-primary-subtitle-button--active');
      } else {
        this.removeClass('vjs-primary-subtitle-button--active');
      }
    }
  }

  videojs.registerComponent(primarySubtitleButtonComponentName, PrimarySubtitleControlButton);
}

function registerSubtitleVisibilityToggleButton() {
  if (typeof videojs.getComponent !== 'function' || videojs.getComponent(subtitleVisibilityToggleButtonComponentName)) {
    return;
  }

  const Button = videojs.getComponent('Button');
  if (!Button) {
    return;
  }

  class SubtitleVisibilityToggleButton extends Button {
    constructor(player, options = {}) {
      super(player, options);
      this.controlText(subtitleVisibilityToggleTitle);
      this.on(player, subtitleVisibilityToggleStateEventName, () => this.updateState());
      this.updateState();
    }

    buildCSSClass() {
      return `vjs-subtitle-visibility-toggle-button vjs-subtitle-cluster-button vjs-subtitle-cluster-button--first ${super.buildCSSClass()}`;
    }

    createEl() {
      const el = super.createEl();
      const iconPlaceholder = el.querySelector('.vjs-icon-placeholder');
      if (iconPlaceholder) {
        iconPlaceholder.setAttribute('aria-hidden', 'true');
        iconPlaceholder.textContent = '';
      }

      const glyphEl = createSubtitleControlGlyph(el.ownerDocument, {
        containerClass: 'vjs-subtitle-visibility-toggle-indicator',
        labelClass: 'vjs-subtitle-visibility-toggle-label',
        labelText: subtitleVisibilityToggleLabel,
        dotClass: 'vjs-subtitle-visibility-toggle-dot',
      });

      const controlTextEl = el.querySelector('.vjs-control-text');
      el.insertBefore(glyphEl, controlTextEl || null);
      return el;
    }

    handleClick() {
      this.player_.subtitleVisibilityToggleAction_?.();
    }

    updateState() {
      const state = this.player_.subtitleVisibilityToggleState_ || {};
      const buttonEl = this.el();

      this.show();
      if (buttonEl) {
        buttonEl.setAttribute('title', state.tooltip || subtitleVisibilityToggleTitle);
        buttonEl.setAttribute('aria-label', state.tooltip || subtitleVisibilityToggleTitle);
        buttonEl.setAttribute('aria-pressed', state.active ? 'true' : 'false');
      }

      if (state.enabled === false) {
        this.disable();
      } else {
        this.enable();
      }

      if (state.active) {
        this.addClass('vjs-subtitle-visibility-toggle-button--active');
      } else {
        this.removeClass('vjs-subtitle-visibility-toggle-button--active');
      }
    }
  }

  videojs.registerComponent(subtitleVisibilityToggleButtonComponentName, SubtitleVisibilityToggleButton);
}

function registerDualSubtitleSwapButton() {
  if (typeof videojs.getComponent !== 'function' || videojs.getComponent(dualSubtitleSwapButtonComponentName)) {
    return;
  }

  const Button = videojs.getComponent('Button');
  if (!Button) {
    return;
  }

  class DualSubtitleSwapButton extends Button {
    constructor(player, options = {}) {
      super(player, options);
      this.controlText(dualSubtitleSwapTitle);
      this.on(player, dualSubtitleSwapStateEventName, () => this.updateState());
      this.updateState();
    }

    buildCSSClass() {
      return `vjs-dual-subtitle-swap-button vjs-subtitle-cluster-button vjs-subtitle-cluster-button--last ${super.buildCSSClass()}`;
    }

    createEl() {
      const el = super.createEl();
      const iconPlaceholder = el.querySelector('.vjs-icon-placeholder');
      if (iconPlaceholder) {
        iconPlaceholder.setAttribute('aria-hidden', 'true');
        iconPlaceholder.textContent = '';
      }

      const iconEl = createSubtitleControlGlyph(el.ownerDocument, {
        containerClass: 'vjs-dual-subtitle-swap-indicator',
        labelClass: 'vjs-dual-subtitle-swap-icon',
        labelText: 'A/B',
      });

      const controlTextEl = el.querySelector('.vjs-control-text');
      el.insertBefore(iconEl, controlTextEl || null);
      return el;
    }

    handleClick(event) {
      this.player_.dualSubtitleSwapAction_?.();
    }

    updateState() {
      const state = this.player_.dualSubtitleSwapState_ || {};
      const buttonEl = this.el();

      if (state.visible === false) {
        this.hide();
      } else {
        this.show();
      }

      if (buttonEl) {
        buttonEl.setAttribute('title', state.tooltip || dualSubtitleSwapTitle);
        buttonEl.setAttribute('aria-label', state.tooltip || dualSubtitleSwapTitle);
      }

      if (state.enabled === false) {
        this.disable();
      } else {
        this.enable();
      }
    }
  }

  videojs.registerComponent(dualSubtitleSwapButtonComponentName, DualSubtitleSwapButton);
}

const props = defineProps({
  cid: {
    type: String,
    default: '',
  },
  gateway: {
    type: String,
    default: '',
  },
  m3u8Url: {
    type: String,
    required: false,
    default: '',
  },
  posterUrl: {
    type: String,
    required: false,
    default: '',
  },
  subtitles: {
    type: Array,
    default: () => [],
  },
  subtitleCatalogStatus: {
    type: String,
    default: 'idle',
  },
  subtitleSelection: {
    type: Object,
    default: () => ({
      mode: 'off',
      primaryLang: '',
      secondaryLang: '',
    }),
  },
  frameRate: {
    type: Number,
    default: Number.NaN,
  },
  startTime: {
    type: Number,
    default: 0,
  },
  shouldAutoplay: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'status-update',
  'gateway-fallback-request',
  'levels-loaded',
  'playback-snapshot',
  'subtitle-selection-change',
]);

const SOURCE_SWITCH_MODE_DEFAULT = 'direct';
const SOURCE_SWITCH_MODE_GATEWAY_HANDOFF = 'gateway_handoff';
const SEEK_STEP_SECONDS = 5;
const LONG_SEEK_STEP_SECONDS = 10;
const PROGRESS_EMIT_STEP_SECONDS = 5;
const STARTUP_BUFFER_THRESHOLD_SECONDS = 10;

const hotkeyHelpSections = Object.freeze([
  {
    id: 'transport',
    title: '播放控制',
    items: [
      {
        id: 'playback',
        keys: ['Space', 'K'],
        label: '播放 / 暫停',
        detail: '切換播放',
      },
      {
        id: 'seek-short',
        keys: ['←', '→'],
        label: '5 秒微調',
        detail: '左右 5 秒',
      },
      {
        id: 'seek-long',
        keys: ['J', 'L'],
        label: '10 秒跳轉',
        detail: '前後 10 秒',
      },
    ],
  },
  {
    id: 'view',
    title: '觀看狀態',
    items: [
      {
        id: 'mute',
        keys: ['M'],
        label: '靜音',
        detail: '切換聲音',
      },
      {
        id: 'fullscreen',
        keys: ['F'],
        label: '全螢幕',
        detail: '切換畫面',
      },
      {
        id: 'subtitles',
        keys: ['C'],
        label: '字幕',
        detail: '切回上次語言',
      },
    ],
  },
  {
    id: 'precision',
    title: '精準操作',
    items: [
      {
        id: 'frame-step',
        keys: [',', '.'],
        label: '逐幀播放',
        detail: '暫停時前後一格',
      },
      {
        id: 'help',
        keys: ['?'],
        label: '快捷鍵說明',
        detail: '顯示 / 關閉',
      },
    ],
  },
]);

const playerShellRef = ref(null);
const primarySubtitleMenuRef = ref(null);
const isPrimarySubtitleMenuOpen = ref(false);
const primarySubtitleMenuPosition = ref({
  bottom: 56,
  right: 16,
});
const hotkeyHelpDialogRef = ref(null);
const isHotkeyHelpOpen = ref(false);
const videoRef = ref(null);
let player = null;
let sourceSeq = 0;
let isApplyingSubtitlePreference = false;
let textTrackList = null;
let qualityLevelList = null;
let lastFocusedElement = null;
let isSwitchingSource = false;
let lastProgressSnapshotTime = -1;
let sourceSetupRequestSeq = 0;
let subtitleCueRoleSyncFrame = 0;
let subtitleCueDisplayObserver = null;
let subtitleCueDisplayElement = null;
let startupGateSourceSeq = 0;
let startupGateReady = false;
let startupGateWaitingForBuffer = false;
let startupGateBypassed = false;
let startupGateMeasuredPlaybackRate = null;
let startupInitialRenditionCount = null;
let pendingSourceStartTime = 0;
let pendingSourceShouldAutoplay = false;
let lastGatewayFallbackKey = '';
let mediaRequestGateway = '';
let mediaRequestCid = '';
let activeVhsXhr = null;
let activeGatewayHandoff = null;
const showStartupGate = ref(false);
const startupGateTitle = ref('');
const startupGateDetail = ref('');
const startupGateCanBypass = ref(false);
const primarySubtitleCueClass = 'vjs-text-track-cue--primary';
const secondarySubtitleCueClass = 'vjs-text-track-cue--secondary';
const secondarySubtitleOffsetCssVar = '--dual-subtitle-offset-y';
const primarySubtitleControlInsertBefore = ['audioTrackButton', 'pictureInPictureToggle', 'fullscreenToggle'];

const hasAvailableSubtitleTracks = computed(() => Array.isArray(props.subtitles) && props.subtitles.length > 0);
const resolvedSubtitleSelection = computed(() => resolveSubtitlePreference(props.subtitles));
const primarySubtitleMenuStyle = computed(() => ({
  bottom: `${primarySubtitleMenuPosition.value.bottom}px`,
  right: `${primarySubtitleMenuPosition.value.right}px`,
}));
const primarySubtitleMenuStatusMessage = computed(() => {
  if (hasAvailableSubtitleTracks.value) {
    return '';
  }

  if (props.subtitleCatalogStatus === 'loading') {
    return '字幕載入中...';
  }

  if (props.subtitleCatalogStatus === 'error') {
    return '字幕載入失敗';
  }

  return '沒有可用字幕';
});
const primarySubtitleMenuItems = computed(() =>
  props.subtitles.map((track, index) => {
    const trackLocale = normalizeLocale(track?.lang);
    const primaryLocale =
      resolvedSubtitleSelection.value.mode === 'showing'
        ? normalizeLocale(resolvedSubtitleSelection.value.primaryLang)
        : '';
    const secondaryLocale =
      resolvedSubtitleSelection.value.mode === 'showing'
        ? normalizeLocale(resolvedSubtitleSelection.value.secondaryLang)
        : '';

    return {
      ...track,
      menuKey: `${track?.source || 'remote'}:${track?.lang || index}:${track?.order ?? index}`,
      isLocal: track?.source === 'local',
      isPrimary: Boolean(trackLocale) && trackLocale === primaryLocale,
      isSecondary: Boolean(trackLocale) && trackLocale === secondaryLocale,
    };
  })
);

function isHelpHotkeyEvent(event) {
  return event?.key === '?' || (event?.code === 'Slash' && event?.shiftKey === true);
}

function isEscapeKey(event) {
  return event?.key === 'Escape' || event?.key === 'Esc' || event?.code === 'Escape';
}

function resolveSubtitlePreference(subtitles) {
  const target = typeof window !== 'undefined' ? window : null;
  return reconcileSubtitlePreference(props.subtitleSelection, subtitles, target?.navigator);
}

function normalizeLocale(value) {
  return typeof value === 'string' ? value.trim().replace(/_/g, '-').toLowerCase() : '';
}

function findSubtitleTrackByLanguage(lang) {
  const targetLocale = normalizeLocale(lang);
  if (!targetLocale) {
    return null;
  }

  return props.subtitles.find((track) => normalizeLocale(track?.lang) === targetLocale) || null;
}

function resolvePrimarySubtitleMenuTrackMetaLabel(track) {
  const labels = [];

  if (track?.isPrimary) {
    labels.push('主字幕');
  }

  if (track?.isSecondary) {
    labels.push('副字幕');
  }

  if (track?.isLocal) {
    labels.push('本機字幕');
  }

  return labels.join(' / ');
}

function resolvePrimarySubtitleControlState() {
  if (hasAvailableSubtitleTracks.value) {
    return {
      enabled: true,
      tooltip: primarySubtitleMenuTitle,
      mode: 'ready',
    };
  }

  if (props.subtitleCatalogStatus === 'loading') {
    return {
      enabled: true,
      tooltip: '字幕載入中...',
      mode: 'loading',
    };
  }

  if (props.subtitleCatalogStatus === 'error') {
    return {
      enabled: true,
      tooltip: '字幕載入失敗',
      mode: 'error',
    };
  }

  return {
    enabled: false,
    tooltip: '沒有可用字幕',
    mode: props.subtitleCatalogStatus === 'idle' ? 'idle' : 'empty',
  };
}

function resolveSubtitleVisibilityToggleState() {
  if (hasAvailableSubtitleTracks.value) {
    const isActive =
      resolvedSubtitleSelection.value.mode === 'showing' && Boolean(resolvedSubtitleSelection.value.primaryLang);

    return {
      enabled: true,
      active: isActive,
      tooltip: isActive ? '關閉字幕' : '開啟字幕',
    };
  }

  return {
    enabled: false,
    active: false,
    tooltip:
      props.subtitleCatalogStatus === 'loading'
        ? '字幕載入中...'
        : props.subtitleCatalogStatus === 'error'
          ? '字幕載入失敗'
          : '沒有可用字幕',
  };
}

function updateSubtitleVisibilityToggleControl() {
  if (!player) {
    return;
  }

  player.subtitleVisibilityToggleState_ = resolveSubtitleVisibilityToggleState();
  player.trigger(subtitleVisibilityToggleStateEventName);
}

function updatePrimarySubtitleControl() {
  if (!player) {
    return;
  }

  player.primarySubtitleControlState_ = {
    ...resolvePrimarySubtitleControlState(),
    expanded: isPrimarySubtitleMenuOpen.value,
  };
  player.trigger(primarySubtitleControlStateEventName);
  updateSubtitleVisibilityToggleControl();
}

function updatePrimarySubtitleMenuPosition() {
  const shellElement = playerShellRef.value;
  const controlBar = player?.getChild?.('controlBar');
  const buttonElement = controlBar?.getChild?.(primarySubtitleButtonComponentName)?.el?.();

  if (!shellElement) {
    return;
  }

  if (!buttonElement) {
    primarySubtitleMenuPosition.value = {
      bottom: 56,
      right: 16,
    };
    return;
  }

  const shellRect = shellElement.getBoundingClientRect();
  const buttonRect = buttonElement.getBoundingClientRect();

  primarySubtitleMenuPosition.value = {
    bottom: Math.max(56, shellRect.bottom - buttonRect.top + 8),
    right: Math.max(12, shellRect.right - buttonRect.right),
  };
}

function closePrimarySubtitleMenu() {
  if (!isPrimarySubtitleMenuOpen.value) {
    updatePrimarySubtitleControl();
    return;
  }

  isPrimarySubtitleMenuOpen.value = false;
  updatePrimarySubtitleControl();
}

function openPrimarySubtitleMenu() {
  if (!resolvePrimarySubtitleControlState().enabled) {
    return;
  }

  updatePrimarySubtitleMenuPosition();
  isPrimarySubtitleMenuOpen.value = true;
  updatePrimarySubtitleControl();
  void nextTick(() => {
    primarySubtitleMenuRef.value?.focus?.();
  });
}

function togglePrimarySubtitleMenu() {
  if (isPrimarySubtitleMenuOpen.value) {
    closePrimarySubtitleMenu();
    return;
  }

  openPrimarySubtitleMenu();
}

function selectPrimarySubtitle(lang) {
  const subtitlePreference = resolveSubtitlePreference(props.subtitles);
  const nextTrack = findSubtitleTrackByLanguage(lang);
  const nextPrimaryLang = nextTrack?.lang || '';
  const nextSelection = nextPrimaryLang
    ? {
        mode: 'showing',
        primaryLang: nextPrimaryLang,
        secondaryLang:
          normalizeLocale(subtitlePreference.secondaryLang) === normalizeLocale(nextPrimaryLang)
            ? ''
            : subtitlePreference.secondaryLang,
      }
    : {
        mode: 'off',
        primaryLang: subtitlePreference.primaryLang,
        secondaryLang: subtitlePreference.secondaryLang,
      };

  emit('subtitle-selection-change', nextSelection);
  emit('status-update', formatSubtitleSelectionStatus(nextSelection));
  closePrimarySubtitleMenu();
}

function getSubtitleTracks() {
  return player && typeof player.remoteTextTracks === 'function' ? player.remoteTextTracks() : null;
}

function getSubtitleTrackLanguage(track) {
  return track?.language || track?.srclang || '';
}

function getActiveSubtitleLanguages() {
  const tracks = getSubtitleTracks();
  if (!tracks) return [];

  const activeLanguages = [];

  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (track.mode === 'showing') {
      const language = getSubtitleTrackLanguage(track);
      if (!language) {
        continue;
      }

      if (activeLanguages.some((value) => normalizeLocale(value) === normalizeLocale(language))) {
        continue;
      }

      activeLanguages.push(language);
    }
  }

  return activeLanguages.slice(0, 2);
}

function getOrderedActiveSubtitleLanguages(selection = props.subtitleSelection) {
  const activeLanguages = getActiveSubtitleLanguages();
  if (activeLanguages.length <= 1) {
    return activeLanguages;
  }

  const orderedLanguages = [];
  const activeLanguageMap = new Map(activeLanguages.map((language) => [normalizeLocale(language), language]));

  getShowingSubtitleLanguages(selection).forEach((language) => {
    const matchedLanguage = activeLanguageMap.get(normalizeLocale(language));
    if (!matchedLanguage) {
      return;
    }

    if (orderedLanguages.some((value) => normalizeLocale(value) === normalizeLocale(matchedLanguage))) {
      return;
    }

    orderedLanguages.push(matchedLanguage);
  });

  activeLanguages.forEach((language) => {
    if (orderedLanguages.some((value) => normalizeLocale(value) === normalizeLocale(language))) {
      return;
    }

    orderedLanguages.push(language);
  });

  return orderedLanguages.slice(0, 2);
}

function getShowingSubtitleLanguages(selection = props.subtitleSelection) {
  const target = typeof window !== 'undefined' ? window : null;
  const subtitlePreference = reconcileSubtitlePreference(selection, props.subtitles, target?.navigator);

  if (subtitlePreference.mode !== 'showing') {
    return [];
  }

  const showingLanguages = [];
  [subtitlePreference.primaryLang, subtitlePreference.secondaryLang].forEach((language) => {
    if (!language) {
      return;
    }

    if (showingLanguages.some((value) => normalizeLocale(value) === normalizeLocale(language))) {
      return;
    }

    showingLanguages.push(language);
  });

  return showingLanguages;
}

function scheduleSubtitleCueRoleClassSync() {
  if (!player || typeof window === 'undefined') {
    return;
  }

  observeSubtitleCueDisplay();

  if (typeof window.requestAnimationFrame !== 'function') {
    syncSubtitleCueRoleClasses();
    return;
  }

  if (subtitleCueRoleSyncFrame) {
    window.cancelAnimationFrame(subtitleCueRoleSyncFrame);
  }

  subtitleCueRoleSyncFrame = window.requestAnimationFrame(() => {
    subtitleCueRoleSyncFrame = 0;
    syncSubtitleCueRoleClasses();
  });
}

function syncSubtitleCueRoleClasses() {
  const playerElement = player?.el?.();
  if (!playerElement) {
    return;
  }

  const activeLanguages = getOrderedActiveSubtitleLanguages();
  const primaryLang = normalizeLocale(activeLanguages[0]);
  const secondaryLang = normalizeLocale(activeLanguages[1]);
  const cueElements = playerElement.querySelectorAll('.vjs-text-track-cue');
  const primaryCueElements = [];
  const secondaryCueElements = [];

  cueElements.forEach((cueElement) => {
    cueElement.classList.remove(primarySubtitleCueClass, secondarySubtitleCueClass);
    cueElement.style.removeProperty(secondarySubtitleOffsetCssVar);

    const cueLang = normalizeLocale(cueElement.getAttribute('lang'));
    if (!cueLang) {
      return;
    }

    if (secondaryLang && cueLang === secondaryLang) {
      cueElement.classList.add(secondarySubtitleCueClass);
      secondaryCueElements.push(cueElement);
      return;
    }

    if (primaryLang && cueLang === primaryLang) {
      cueElement.classList.add(primarySubtitleCueClass);
      primaryCueElements.push(cueElement);
    }
  });

  syncSecondaryCueOffsets(primaryCueElements, secondaryCueElements);
}

function syncSecondaryCueOffsets(primaryCueElements, secondaryCueElements) {
  if (primaryCueElements.length === 0 || secondaryCueElements.length === 0) {
    return;
  }

  const offset = resolveSecondaryCueOffset(
    primaryCueElements.map((cueElement) => cueElement.getBoundingClientRect()),
    secondaryCueElements.map((cueElement) => cueElement.getBoundingClientRect())
  );

  if (offset <= 0) {
    return;
  }

  secondaryCueElements.forEach((cueElement) => {
    cueElement.style.setProperty(secondarySubtitleOffsetCssVar, `${offset}px`);
  });
}

function setActiveSubtitleLanguages(selection = props.subtitleSelection) {
  const tracks = getSubtitleTracks();
  if (!tracks || tracks.length === 0) return false;

  const targetLanguages = getShowingSubtitleLanguages(selection);
  const targetLanguageSet = new Set(targetLanguages.map((language) => normalizeLocale(language)));
  const targetPrimaryLang = normalizeLocale(targetLanguages[0]);
  const targetSecondaryLang = normalizeLocale(targetLanguages[1]);
  let matchedPrimary = targetLanguages.length === 0;
  let matchedSecondary = !targetSecondaryLang;
  isApplyingSubtitlePreference = true;

  try {
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i];
      const trackLanguage = normalizeLocale(getSubtitleTrackLanguage(track));
      const shouldShow = Boolean(trackLanguage) && targetLanguageSet.has(trackLanguage);
      if (shouldShow) {
        if (trackLanguage === targetPrimaryLang) {
          matchedPrimary = true;
        }
        if (trackLanguage === targetSecondaryLang) {
          matchedSecondary = true;
        }
      }
      track.mode = shouldShow ? 'showing' : 'disabled';
    }
  } finally {
    isApplyingSubtitlePreference = false;
  }

  scheduleSubtitleCueRoleClassSync();
  return matchedPrimary && matchedSecondary;
}

function subtitleLabelForLanguage(lang) {
  const matchedSubtitle = Array.isArray(props.subtitles)
    ? props.subtitles.find((subtitle) => subtitle.lang === lang)
    : null;

  return matchedSubtitle?.label || lang || '字幕';
}

function formatSubtitleSelectionStatus(selection) {
  if (selection.mode !== 'showing') {
    return '字幕已關閉';
  }

  const labels = getShowingSubtitleLanguages(selection).map((language) => subtitleLabelForLanguage(language));
  return labels.length > 0 ? `字幕已開啟：${labels.join(' / ')}` : '字幕已關閉';
}

function resolveDualSubtitleSwapButtonState(selection = props.subtitleSelection) {
  const target = typeof window !== 'undefined' ? window : null;
  return resolveDualSubtitleSwapControlState(selection, props.subtitles, target?.navigator);
}

function canSwapSubtitleRoles(selection = props.subtitleSelection) {
  return resolveDualSubtitleSwapButtonState(selection).enabled;
}

function updateDualSubtitleSwapControl(selection = props.subtitleSelection) {
  if (!player) {
    return;
  }

  player.dualSubtitleSwapState_ = resolveDualSubtitleSwapButtonState(selection);
  player.trigger(dualSubtitleSwapStateEventName);
}

function swapSubtitleRoles() {
  if (!canSwapSubtitleRoles(props.subtitleSelection)) {
    return false;
  }

  const subtitlePreference = resolveSubtitlePreference(props.subtitles);
  const nextPreference = {
    mode: 'showing',
    primaryLang: subtitlePreference.secondaryLang,
    secondaryLang: subtitlePreference.primaryLang,
  };

  emit('subtitle-selection-change', nextPreference);
  emit('status-update', formatSubtitleSelectionStatus(nextPreference));
  return true;
}

function toggleSubtitleVisibility() {
  if (!player || !Array.isArray(props.subtitles) || props.subtitles.length === 0) {
    return false;
  }

  bindSubtitleTrackChangeListener();

  const target = typeof window !== 'undefined' ? window : null;
  const nextPreference = resolveToggledSubtitlePreference(
    props.subtitleSelection,
    props.subtitles,
    target?.navigator,
    getOrderedActiveSubtitleLanguages()
  );

  if (!setActiveSubtitleLanguages(nextPreference)) {
    return false;
  }

  emit('subtitle-selection-change', nextPreference);
  emit('status-update', formatSubtitleSelectionStatus(nextPreference));
  updatePrimarySubtitleControl();

  return true;
}

function openHotkeyHelp() {
  if (isHotkeyHelpOpen.value) return;

  closePrimarySubtitleMenu();
  lastFocusedElement = typeof document !== 'undefined' ? document.activeElement : null;
  isHotkeyHelpOpen.value = true;
  void nextTick(() => {
    hotkeyHelpDialogRef.value?.focus?.();
  });
}

function ensureDualSubtitleSwapControl() {
  if (!player) {
    return;
  }

  registerDualSubtitleSwapButton();
  player.dualSubtitleSwapAction_ = swapSubtitleRoles;

  const controlBar = player.getChild('controlBar');
  if (!controlBar) {
    return;
  }

  if (!controlBar.getChild(dualSubtitleSwapButtonComponentName)) {
    const children = typeof controlBar.children === 'function' ? controlBar.children() : [];
    const subtitleButtonIndex = children.findIndex((child) =>
      [primarySubtitleButtonComponentName, 'SubsCapsButton'].includes(String(child?.name?.() || ''))
    );
    const insertIndex = subtitleButtonIndex >= 0 ? subtitleButtonIndex + 1 : children.length;
    controlBar.addChild(dualSubtitleSwapButtonComponentName, {}, insertIndex);
  }

  repositionSubtitleControlCluster();
  updateDualSubtitleSwapControl();
}

function ensureSubtitleVisibilityToggleControl() {
  if (!player) {
    return;
  }

  registerSubtitleVisibilityToggleButton();
  player.subtitleVisibilityToggleAction_ = toggleSubtitleVisibility;

  const controlBar = player.getChild('controlBar');
  if (!controlBar) {
    return;
  }

  if (!controlBar.getChild(subtitleVisibilityToggleButtonComponentName)) {
    const children = typeof controlBar.children === 'function' ? controlBar.children() : [];
    const primaryButtonIndex = children.findIndex(
      (child) => String(child?.name?.() || '') === primarySubtitleButtonComponentName
    );
    const fallbackInsertIndex = children.findIndex((child) =>
      primarySubtitleControlInsertBefore.includes(String(child?.name?.() || ''))
    );
    const insertIndex =
      primaryButtonIndex >= 0
        ? primaryButtonIndex
        : fallbackInsertIndex >= 0
          ? fallbackInsertIndex
          : children.length;

    if (videojs.getComponent(subtitleVisibilityToggleButtonComponentName)) {
      controlBar.addChild(
        subtitleVisibilityToggleButtonComponentName,
        {
          name: subtitleVisibilityToggleButtonComponentName,
          title: subtitleVisibilityToggleTitle,
        },
        insertIndex
      );
    }
  }

  repositionSubtitleControlCluster();
  updateSubtitleVisibilityToggleControl();
}

function ensurePrimarySubtitleControl() {
  if (!player) {
    return;
  }

  registerPrimarySubtitleControlButton();
  player.primarySubtitleMenuToggle_ = togglePrimarySubtitleMenu;

  const controlBar = player.getChild('controlBar');
  if (!controlBar) {
    return;
  }

  if (!controlBar.getChild(primarySubtitleButtonComponentName)) {
    const children = typeof controlBar.children === 'function' ? controlBar.children() : [];
    const defaultSubtitleButton = controlBar.getChild('SubsCapsButton');
    const subtitleButtonIndex = children.findIndex((child) => String(child?.name?.() || '') === 'SubsCapsButton');
    const fallbackInsertIndex = children.findIndex((child) =>
      primarySubtitleControlInsertBefore.includes(String(child?.name?.() || ''))
    );

    if (defaultSubtitleButton) {
      controlBar.removeChild(defaultSubtitleButton);
      defaultSubtitleButton.dispose?.();
    }

    const insertIndex =
      subtitleButtonIndex >= 0
        ? subtitleButtonIndex
        : fallbackInsertIndex >= 0
          ? fallbackInsertIndex
          : children.length;
    if (videojs.getComponent(primarySubtitleButtonComponentName)) {
      controlBar.addChild(
        primarySubtitleButtonComponentName,
        {
          name: primarySubtitleButtonComponentName,
          title: primarySubtitleMenuTitle,
        },
        insertIndex
      );
    }
  }

  repositionSubtitleControlCluster();
  updatePrimarySubtitleControl();
}

function repositionSubtitleControlCluster() {
  if (!player) {
    return;
  }

  const controlBar = player.getChild('controlBar');
  const controlBarEl = controlBar?.el?.();
  if (!controlBar || !controlBarEl) {
    return;
  }

  const clusterComponents = [
    controlBar.getChild(subtitleVisibilityToggleButtonComponentName),
    controlBar.getChild(primarySubtitleButtonComponentName),
    controlBar.getChild(dualSubtitleSwapButtonComponentName),
  ].filter(Boolean);

  if (clusterComponents.length === 0) {
    return;
  }

  const anchorComponent =
    controlBar.getChild('QualityButton') ||
    controlBar.getChild('PictureInPictureToggle') ||
    controlBar.getChild('FullscreenToggle') ||
    null;
  const anchorEl = anchorComponent?.el?.() || null;

  clusterComponents.forEach((component) => {
    const componentEl = component?.el?.();
    if (!componentEl) {
      return;
    }

    controlBarEl.insertBefore(componentEl, anchorEl);
  });
}

function closeHotkeyHelp() {
  const nextFocusTarget = lastFocusedElement;
  lastFocusedElement = null;
  isHotkeyHelpOpen.value = false;
  void nextTick(() => {
    nextFocusTarget?.focus?.();
  });
}

function toggleHotkeyHelp() {
  if (isHotkeyHelpOpen.value) {
    closeHotkeyHelp();
    return true;
  }

  openHotkeyHelp();
  return true;
}

function resolveSourceSwitchMode(nextUrl, previous = {}) {
  const { oldUrl = '', oldCid = '', oldGateway = '' } = previous;

  if (!oldUrl || !nextUrl) {
    return SOURCE_SWITCH_MODE_DEFAULT;
  }

  if (props.cid && props.cid === oldCid && props.gateway && props.gateway !== oldGateway) {
    return SOURCE_SWITCH_MODE_GATEWAY_HANDOFF;
  }

  return SOURCE_SWITCH_MODE_DEFAULT;
}

function shouldRunStartupWarmup(options = {}) {
  const {
    switchMode = SOURCE_SWITCH_MODE_DEFAULT,
    startTime = props.startTime,
    cid = props.cid,
    gateway = props.gateway,
    m3u8Url = props.m3u8Url,
  } = options;

  return Boolean(cid && gateway && m3u8Url && (switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF || !(startTime > 0)));
}

function getCurrentSourceSwitchSnapshot() {
  if (!player) {
    return {
      time: props.startTime > 0 ? props.startTime : 0,
      shouldAutoplay: props.shouldAutoplay,
    };
  }

  const currentTime = Number.isFinite(player.currentTime?.()) ? Math.max(0, player.currentTime()) : 0;
  const isReady = player.readyState?.() > 0;

  return {
    time: isReady ? currentTime : props.startTime > 0 ? props.startTime : 0,
    shouldAutoplay: isReady ? !player.paused() : props.shouldAutoplay,
  };
}

function resetStartupGate(seq = sourceSeq) {
  startupGateSourceSeq = seq;
  startupGateReady = false;
  startupGateWaitingForBuffer = false;
  startupGateBypassed = false;
  startupGateMeasuredPlaybackRate = null;
  startupInitialRenditionCount = null;
  showStartupGate.value = false;
  startupGateTitle.value = '';
  startupGateDetail.value = '';
  startupGateCanBypass.value = false;
}

function updateStartupGate(title, detail, options = {}) {
  const { canBypass = false } = options;
  showStartupGate.value = true;
  startupGateTitle.value = title;
  startupGateDetail.value = detail;
  startupGateCanBypass.value = canBypass;
}

function emitQualityLevels() {
  if (!player || typeof player.qualityLevels !== 'function') return;

  emit('levels-loaded', buildQualityLevelPayload(player.qualityLevels()));
}

function syncQualitySelectorButtonLabel() {
  if (!player) return;

  repositionSubtitleControlCluster();

  const labelEl =
    player.el()?.querySelector?.('.vjs-quality-selector .vjs-icon-placeholder') || null;

  if (!labelEl || typeof player.qualityLevels !== 'function') {
    return;
  }

  labelEl.textContent = formatQualitySelectorLabel(player.qualityLevels());
}

function syncMediaRequestRouting(cid = props.cid, gateway = props.gateway) {
  mediaRequestCid = typeof cid === 'string' ? cid.trim() : '';
  mediaRequestGateway = typeof gateway === 'string' ? gateway.trim() : '';
}

function clearGatewayHandoffState() {
  activeGatewayHandoff = null;
}

function applyHandoffQualityLock(targetHeight) {
  if (!player || typeof player.qualityLevels !== 'function' || !Number.isFinite(targetHeight)) {
    return false;
  }

  const didLock = applyQualityLevelHeightLock(player.qualityLevels(), targetHeight);
  if (didLock) {
    emitQualityLevels();
    syncQualitySelectorButtonLabel();
  }
  return didLock;
}

function handleVhsRequest(options) {
  const nextOptions = options ? { ...options } : {};
  const rewrittenUri = rewriteMediaHandoffRequestUri(nextOptions.uri, {
    cid: mediaRequestCid,
    gateway: mediaRequestGateway,
  });

  if (rewrittenUri) {
    nextOptions.uri = rewrittenUri;
  }

  return nextOptions;
}

function handleVhsResponse(request, error, response) {
  if (
    !activeGatewayHandoff ||
    !isSuccessfulMediaHandoffSegmentResponse(request, error, response, {
      cid: activeGatewayHandoff.cid,
      gateway: activeGatewayHandoff.targetGateway,
    })
  ) {
    return;
  }

  emit('status-update', '新 gateway 已接手後續片段');
  clearGatewayHandoffState();
}

function bindVhsXhrHooks() {
  if (!player) return;

  const xhr = player.tech()?.vhs?.xhr;
  if (!xhr || activeVhsXhr === xhr) {
    return;
  }

  if (activeVhsXhr?.offRequest) {
    activeVhsXhr.offRequest(handleVhsRequest);
  }
  if (activeVhsXhr?.offResponse) {
    activeVhsXhr.offResponse(handleVhsResponse);
  }

  xhr.onRequest?.(handleVhsRequest);
  xhr.onResponse?.(handleVhsResponse);
  activeVhsXhr = xhr;
}

function createStartupInitialPlaylistSelector(maxInitialRenditions) {
  return function selectStartupInitialPlaylist() {
    return pickStartupInitialPlaylist(this?.playlists?.main?.playlists, maxInitialRenditions);
  };
}

function configureStartupRenditionStrategy(warmupResult, options = {}) {
  const vhs = player?.tech_?.vhs;
  const { runStartupWarmup = false } = options;

  startupInitialRenditionCount = runStartupWarmup ? getStartupInitialRenditionCount(warmupResult?.playbackRate) : null;

  if (vhs?.playlistController_) {
    if (Number.isFinite(startupInitialRenditionCount)) {
      vhs.playlistController_.enableLowInitialPlaylist = true;
      vhs.playlistController_.selectInitialPlaylist = createStartupInitialPlaylistSelector(
        startupInitialRenditionCount
      ).bind(vhs);
    } else if (videojs.Vhs?.INITIAL_PLAYLIST_SELECTOR) {
      vhs.playlistController_.enableLowInitialPlaylist = false;
      vhs.playlistController_.selectInitialPlaylist = videojs.Vhs.INITIAL_PLAYLIST_SELECTOR.bind(vhs);
    }
  }
}

function formatPlaybackRateLabel(playbackRate) {
  if (!Number.isFinite(playbackRate)) {
    return '';
  }

  return `${playbackRate.toFixed(1)}x`;
}

function formatBufferedAheadLabel(bufferedAheadSeconds) {
  if (!(bufferedAheadSeconds > 0)) {
    return '0.0';
  }

  return bufferedAheadSeconds.toFixed(1);
}

function getBufferedAheadSeconds() {
  if (!player) return 0;

  const buffered = player.buffered?.();
  if (!buffered || buffered.length === 0) return 0;

  const currentTime = Number.isFinite(player.currentTime?.()) ? player.currentTime() : 0;

  for (let index = 0; index < buffered.length; index += 1) {
    const start = buffered.start(index);
    const end = buffered.end(index);

    if (currentTime >= start && currentTime <= end) {
      return Math.max(0, end - currentTime);
    }

    if (currentTime < start) {
      return Math.max(0, end - start);
    }
  }

  return 0;
}

function emitReadyStatus() {
  if (pendingSourceStartTime > 0) {
    const formattedTime = formatTime(pendingSourceStartTime);
    emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
    return;
  }

  emit('status-update', '播放器已就緒');
}

async function unlockStartupGate(seq = startupGateSourceSeq) {
  if (!player || seq !== sourceSeq || startupGateReady) return;

  startupGateReady = true;
  startupGateWaitingForBuffer = false;
  startupGateCanBypass.value = false;
  showStartupGate.value = false;

  if (pendingSourceShouldAutoplay) {
    if (player.readyState() >= 3) {
      await resumePlaybackIfNeeded();
      return;
    }

    player.one('canplay', () => {
      if (!player || seq !== sourceSeq) return;
      void resumePlaybackIfNeeded();
    });
    return;
  }

  emitReadyStatus();
}

function overrideStartupGate() {
  startupGateBypassed = true;
  void unlockStartupGate();
}

function updateStartupGateFromBuffer() {
  if (!player || !startupGateWaitingForBuffer || startupGateBypassed) return;

  const bufferedAheadSeconds = getBufferedAheadSeconds();
  const playbackRatePrefix = Number.isFinite(startupGateMeasuredPlaybackRate)
    ? `預載速度約 ${formatPlaybackRateLabel(startupGateMeasuredPlaybackRate)}，`
    : '';

  updateStartupGate(
    '正在累積可播緩衝',
    `${playbackRatePrefix}已緩衝 ${formatBufferedAheadLabel(bufferedAheadSeconds)} / ${STARTUP_BUFFER_THRESHOLD_SECONDS} 秒`,
    {
      canBypass: true,
    }
  );

  if (bufferedAheadSeconds >= STARTUP_BUFFER_THRESHOLD_SECONDS) {
    void unlockStartupGate();
  }
}

async function resumePlaybackIfNeeded() {
  if (!player || !pendingSourceShouldAutoplay) return;

  try {
    await player.play();
    emit('status-update', '播放器已就緒，繼續播放中');
  } catch (_) {
    if (pendingSourceStartTime > 0) {
      const formattedTime = formatTime(pendingSourceStartTime);
      emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
    } else {
      emit('status-update', '播放器已就緒，請手動播放');
    }
  }
}

function resolvePlaybackErrorDetail(error) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message) {
    return message;
  }

  const code = Number(error?.code);
  if (Number.isFinite(code)) {
    return `播放器錯誤 (CODE:${code})`;
  }

  return '播放器無法載入來源';
}

function requestGatewayFallback(reason = null, options = {}) {
  const {
    sourceGuard = null,
    dedupeKey = '',
    gateway = props.gateway,
    startTime = props.startTime,
    shouldAutoplay = props.shouldAutoplay,
  } = options;

  if (
    !player ||
    (sourceGuard !== null && sourceGuard !== sourceSeq) ||
    (dedupeKey && lastGatewayFallbackKey === dedupeKey) ||
    !props.cid ||
    !isLoopbackGatewayUrl(gateway)
  ) {
    return false;
  }

  if (dedupeKey) {
    lastGatewayFallbackKey = dedupeKey;
  }
  isSwitchingSource = false;

  const snapshot = getPlayerPlaybackSnapshot(player);
  const fallbackDetail =
    typeof reason?.detail === 'string' && reason.detail.trim() ? reason.detail.trim() : 'Local Node 無法讀取這個 CID';

  updateStartupGate('Local Node 無法讀取這個 CID', `${fallbackDetail}，改用公開 gateway 重試中`);
  emit('status-update', 'Local Node 無法讀取這個 CID，改用公開 gateway 重試中...');
  emit('gateway-fallback-request', {
    cid: props.cid,
    gateway,
    startTime: snapshot.time > 0 ? snapshot.time : startTime,
    shouldAutoplay: shouldAutoplay || snapshot.isPlaying,
    reason,
  });
  return true;
}

function handleSourceError(seq = sourceSeq) {
  if (!player || seq !== sourceSeq) return;

  isSwitchingSource = false;
  const error = typeof player.error === 'function' ? player.error() : null;
  const detail = resolvePlaybackErrorDetail(error);

  if (
    requestGatewayFallback(
      {
        state: 'failed',
        detail,
        code: Number(error?.code),
      },
      {
        sourceGuard: seq,
        dedupeKey: `source:${seq}`,
      }
    )
  ) {
    return;
  }

  if (showStartupGate.value) {
    updateStartupGate('影片載入失敗', detail);
  }

  emit('status-update', `影片載入失敗：${detail}`);
}

function beginSourceSwitch() {
  if (!player) return 0;

  closePrimarySubtitleMenu();
  const seq = ++sourceSeq;
  resetStartupGate(seq);
  isSwitchingSource = true;
  resetSnapshotTracking();
  isApplyingSubtitlePreference = true;
  player.pause();
  clearTracks();
  clearQualityLevels();
  player.reset();
  player.poster(props.posterUrl || '');
  isApplyingSubtitlePreference = false;
  return seq;
}

function bindSubtitleTrackChangeListener() {
  if (!player) return;

  const nextTextTrackList = player.textTracks();
  if (!nextTextTrackList) return;

  if (textTrackList === nextTextTrackList) {
    return;
  }

  if (textTrackList) {
    textTrackList.removeEventListener('change', handleSubtitleTrackChange);
  }

  textTrackList = nextTextTrackList;
  textTrackList.addEventListener('change', handleSubtitleTrackChange);
}

function disconnectSubtitleCueDisplayObserver() {
  subtitleCueDisplayObserver?.disconnect?.();
  subtitleCueDisplayObserver = null;
  subtitleCueDisplayElement = null;
}

function observeSubtitleCueDisplay() {
  if (!player || typeof window === 'undefined' || typeof window.MutationObserver !== 'function') {
    return;
  }

  const playerElement = player.el?.();
  const nextDisplayElement = playerElement?.querySelector?.('.vjs-text-track-display') || null;

  if (!nextDisplayElement) {
    disconnectSubtitleCueDisplayObserver();
    return;
  }

  if (subtitleCueDisplayObserver && subtitleCueDisplayElement === nextDisplayElement) {
    return;
  }

  disconnectSubtitleCueDisplayObserver();
  subtitleCueDisplayElement = nextDisplayElement;
  subtitleCueDisplayObserver = new window.MutationObserver(() => {
    scheduleSubtitleCueRoleClassSync();
  });
  subtitleCueDisplayObserver.observe(nextDisplayElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'lang'],
  });
}

function orderSubtitleTracksForDisplay(subtitles, selection = props.subtitleSelection) {
  if (!Array.isArray(subtitles) || subtitles.length <= 1) {
    return Array.isArray(subtitles) ? subtitles : [];
  }

  const preferredLanguages = getShowingSubtitleLanguages(selection).map((language) => normalizeLocale(language));
  if (preferredLanguages.length === 0) {
    return subtitles;
  }

  const preferredOrder = new Map(preferredLanguages.map((language, index) => [language, index]));

  return subtitles
    .map((subtitle, index) => ({ subtitle, index }))
    .sort((left, right) => {
      const leftLang = normalizeLocale(left.subtitle?.lang);
      const rightLang = normalizeLocale(right.subtitle?.lang);
      const leftPreferred = preferredOrder.has(leftLang) ? preferredOrder.get(leftLang) : Number.MAX_SAFE_INTEGER;
      const rightPreferred = preferredOrder.has(rightLang) ? preferredOrder.get(rightLang) : Number.MAX_SAFE_INTEGER;

      if (leftPreferred !== rightPreferred) {
        return leftPreferred - rightPreferred;
      }

      const leftOrder = Number.isFinite(Number(left.subtitle?.order)) ? Number(left.subtitle.order) : left.index;
      const rightOrder = Number.isFinite(Number(right.subtitle?.order)) ? Number(right.subtitle.order) : right.index;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.subtitle);
}

function hasPreferredShowingTrackOrder(selection = props.subtitleSelection) {
  const preferredLanguages = getShowingSubtitleLanguages(selection).map((language) => normalizeLocale(language));
  if (preferredLanguages.length <= 1) {
    return true;
  }

  const tracks = getSubtitleTracks();
  if (!tracks || tracks.length === 0) {
    return false;
  }

  const currentShowingOrder = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const language = normalizeLocale(getSubtitleTrackLanguage(tracks[i]));
    if (!language || !preferredLanguages.includes(language)) {
      continue;
    }

    if (currentShowingOrder.includes(language)) {
      continue;
    }

    currentShowingOrder.push(language);
  }

  if (currentShowingOrder.length < preferredLanguages.length) {
    return false;
  }

  return preferredLanguages.every((language, index) => currentShowingOrder[index] === language);
}

function applySubtitleTracks(subtitles, seq = sourceSeq) {
  if (!player || seq !== sourceSeq) return;

  isApplyingSubtitlePreference = true;
  clearTracks();
  bindSubtitleTrackChangeListener();

  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    isApplyingSubtitlePreference = false;
    return;
  }

  const subtitlePreference = resolveSubtitlePreference(subtitles);
  const showingLanguages = new Set(getShowingSubtitleLanguages(subtitlePreference).map((language) => normalizeLocale(language)));
  const orderedSubtitles = orderSubtitleTracksForDisplay(subtitles, subtitlePreference);

  orderedSubtitles.forEach((sub) => {
    const shouldShow = showingLanguages.has(normalizeLocale(sub.lang));
    const trackEl = player.addRemoteTextTrack(
      {
        kind: 'captions',
        label: sub.label,
        srclang: sub.lang,
        src: sub.src,
        default: false,
      },
      false
    );
    if (trackEl && trackEl.track) {
      trackEl.track.mode = shouldShow ? 'showing' : 'disabled';
    }
  });

  isApplyingSubtitlePreference = false;
  updatePrimarySubtitleControl();
  scheduleSubtitleCueRoleClassSync();
}

function resolveLatestSourceSubtitles(fallbackSubtitles = []) {
  return Array.isArray(props.subtitles) && props.subtitles.length > 0 ? props.subtitles : fallbackSubtitles;
}

async function setupSourceAndTracks(m3u8Url, subtitles, options = {}) {
  if (!player) return;

  const {
    switchMode = SOURCE_SWITCH_MODE_DEFAULT,
    requestedStartTime = props.startTime,
  } = options;
  const setupRequestId = ++sourceSetupRequestSeq;
  const handoffSnapshot = switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF ? getCurrentSourceSwitchSnapshot() : null;
  const probeStartTime = switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF ? handoffSnapshot?.time ?? 0 : requestedStartTime;
  const runStartupWarmup = shouldRunStartupWarmup({
    switchMode,
    startTime: requestedStartTime,
    m3u8Url,
  });
  let warmupResult = null;

  if (runStartupWarmup) {
    if (switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF) {
      emit('status-update', '正在為新 gateway 預載目前播放位置...');
    } else {
      updateStartupGate('正在預載影片', `準備下載前 ${gatewayProbeSegmentSampleCount} 個片段`);
      emit('status-update', '正在預載前幾個片段...');
    }

    warmupResult = await probeGatewayAvailability(props.gateway, props.cid, {
      cacheMode: 'default',
      segmentSampleCount: gatewayProbeSegmentSampleCount,
      playbackRateThreshold: gatewayProbePlaybackRateThreshold,
      startTimeSeconds: probeStartTime,
      onProgress(progressState) {
        if (!player || setupRequestId !== sourceSetupRequestSeq || progressState.state !== 'probing') return;

        const progressLabel =
          progressState.sampleSegmentCount > 0
            ? `已完成 ${progressState.completedSampleCount}/${progressState.sampleSegmentCount} 個片段`
            : '正在測速';
        const speedLabel = Number.isFinite(progressState.playbackRate)
          ? `，目前約 ${formatPlaybackRateLabel(progressState.playbackRate)}`
          : '';
        startupGateMeasuredPlaybackRate = Number.isFinite(progressState.playbackRate) ? progressState.playbackRate : null;

        if (switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF) {
          emit('status-update', `新 gateway 預載中：${progressLabel}${speedLabel}`);
          return;
        }

        updateStartupGate('正在預載影片', `${progressLabel}${speedLabel}`);
      },
    });

    if (!player || setupRequestId !== sourceSetupRequestSeq) return;

    if (
      shouldAutoFallbackGateway(props.gateway, warmupResult) &&
      requestGatewayFallback(warmupResult, {
        dedupeKey: `warmup:${setupRequestId}`,
        startTime: probeStartTime,
        shouldAutoplay: handoffSnapshot?.shouldAutoplay ?? props.shouldAutoplay,
      })
    ) {
      return;
    }
  }

  const cutoverSnapshot =
    switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF ? getCurrentSourceSwitchSnapshot() : null;
  pendingSourceStartTime = switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF ? cutoverSnapshot?.time ?? 0 : requestedStartTime;
  pendingSourceShouldAutoplay =
    switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF ? cutoverSnapshot?.shouldAutoplay ?? false : props.shouldAutoplay;

  const seq = beginSourceSwitch();
  clearGatewayHandoffState();
  syncMediaRequestRouting(props.cid, props.gateway);

  if (switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF) {
    updateStartupGate(
      '正在切換網關',
      warmupResult?.state === 'ready' ? '新來源已預載，正在接手播放' : '正在切換到新來源並等待緩衝'
    );
    emit('status-update', '正在切換到新 gateway...');
  } else {
    emit('status-update', '正在載入影片...');
  }

  player.src({
    src: m3u8Url,
    type: 'application/x-mpegURL',
    enableLowInitialPlaylist: runStartupWarmup,
  });
  bindQualityLevelListeners();
  configureStartupRenditionStrategy(warmupResult, { runStartupWarmup });
  player.one('error', () => {
    handleSourceError(seq);
  });
  // Source setup can outlive the initial props snapshot, so always prefer the latest loaded subtitle list.
  applySubtitleTracks(resolveLatestSourceSubtitles(subtitles), seq);

  player.one('loadedmetadata', () => {
    if (!player || seq !== sourceSeq || setupRequestId !== sourceSetupRequestSeq) return;

    if (pendingSourceStartTime > 0) {
      player.currentTime(pendingSourceStartTime);
    }
    isSwitchingSource = false;
    emitPlaybackSnapshot('loadedmetadata', { force: true });
    emitQualityLevels();
    syncQualitySelectorButtonLabel();

    if (!runStartupWarmup) {
      if (pendingSourceShouldAutoplay) {
        player.one('canplay', () => {
          if (!player || seq !== sourceSeq || setupRequestId !== sourceSetupRequestSeq) return;
          void resumePlaybackIfNeeded();
        });
      } else {
        emitReadyStatus();
      }
      return;
    }

    if (warmupResult?.state === 'ready') {
      void unlockStartupGate(seq);
      return;
    }

    startupGateWaitingForBuffer = true;
    startupGateMeasuredPlaybackRate = Number.isFinite(warmupResult?.playbackRate) ? warmupResult.playbackRate : null;
    const warmupSpeedLabel = Number.isFinite(warmupResult?.playbackRate)
      ? `預載速度約 ${formatPlaybackRateLabel(warmupResult.playbackRate)}`
      : '預載速度仍在觀察';
    updateStartupGate('正在累積可播緩衝', `${warmupSpeedLabel}，等待緩衝達到 ${STARTUP_BUFFER_THRESHOLD_SECONDS} 秒`, {
      canBypass: true,
    });
    emit('status-update', '正在累積可播緩衝...');
    updateStartupGateFromBuffer();
  });
}

async function performGatewayMediaHandoff(m3u8Url, options = {}) {
  if (!player) return;

  const {
    requestedStartTime = props.startTime,
  } = options;

  if (!player.currentSrc?.()) {
    await setupSourceAndTracks(m3u8Url, props.subtitles, {
      switchMode: SOURCE_SWITCH_MODE_DEFAULT,
      requestedStartTime,
    });
    return;
  }

  const setupRequestId = ++sourceSetupRequestSeq;
  const handoffSnapshot = getCurrentSourceSwitchSnapshot();
  const probeStartTime = handoffSnapshot?.time ?? 0;
  const qualitySnapshot =
    typeof player.qualityLevels === 'function'
      ? buildMediaHandoffQualitySnapshot(player.qualityLevels())
      : null;
  const variantPlaylistsPromise = fetchGatewayVariantPlaylists(props.gateway, props.cid, {
    cacheMode: 'default',
  });
  const warmupPromise = probeGatewayAvailability(props.gateway, props.cid, {
    cacheMode: 'default',
    segmentSampleCount: gatewayProbeSegmentSampleCount,
    playbackRateThreshold: gatewayProbePlaybackRateThreshold,
    startTimeSeconds: probeStartTime,
    onProgress(progressState) {
      if (!player || setupRequestId !== sourceSetupRequestSeq || progressState.state !== 'probing') return;

      const progressLabel =
        progressState.sampleSegmentCount > 0
          ? `已完成 ${progressState.completedSampleCount}/${progressState.sampleSegmentCount} 個片段`
          : '正在測速';
      const speedLabel = Number.isFinite(progressState.playbackRate)
        ? `，目前約 ${formatPlaybackRateLabel(progressState.playbackRate)}`
        : '';
      emit('status-update', `新 gateway 預載中：${progressLabel}${speedLabel}`);
    },
  });

  emit('status-update', '正在為新 gateway 預載目前播放位置...');

  const variantPlaylists = await variantPlaylistsPromise;
  if (!player || setupRequestId !== sourceSetupRequestSeq) return;

  const availableHeights = variantPlaylists
    .map((playlist) => (Number.isFinite(playlist?.height) ? playlist.height : null))
    .filter((height) => Number.isFinite(height) && height > 0);
  const lockedHeight = selectMediaHandoffLockedHeight(qualitySnapshot, availableHeights);
  applyHandoffQualityLock(lockedHeight);

  activeGatewayHandoff = {
    cid: props.cid,
    targetGateway: props.gateway,
  };
  syncMediaRequestRouting(props.cid, props.gateway);
  const recoveryResult = resumeMediaHandoffPlayback(player, {
    shouldAutoplay: handoffSnapshot?.shouldAutoplay ?? false,
  });

  if (qualitySnapshot?.mode === mediaHandoffQualityModeManual && Number.isFinite(lockedHeight)) {
    emit('status-update', `已切換到新 gateway，沿用 ${lockedHeight}p 接手後續片段`);
  } else if (
    qualitySnapshot?.mode === mediaHandoffQualityModeAuto &&
    Number.isFinite(qualitySnapshot?.activeHeight) &&
    Number.isFinite(lockedHeight) &&
    lockedHeight !== qualitySnapshot.activeHeight
  ) {
    emit('status-update', `已切換到新 gateway，handoff 期間暫時改用 ${lockedHeight}p`);
  } else {
    emit('status-update', handoffSnapshot?.shouldAutoplay ? '已切換到新 gateway，等待後續片段接手' : '新 gateway 已就緒，等待繼續播放');
  }

  if (recoveryResult.didClearError || recoveryResult.reincludedPlaylistCount > 0) {
    emit('status-update', '已清除前一次失敗的下載狀態，重新向目前 gateway 請求片段');
  }

  const warmupResult = await warmupPromise;
  if (!player || setupRequestId !== sourceSetupRequestSeq) return;

  if (
    shouldAutoFallbackGateway(props.gateway, warmupResult) &&
    requestGatewayFallback(warmupResult, {
      dedupeKey: `warmup:${setupRequestId}`,
      startTime: probeStartTime,
      shouldAutoplay: handoffSnapshot?.shouldAutoplay ?? props.shouldAutoplay,
    })
  ) {
    return;
  }

  if (
    activeGatewayHandoff &&
    activeGatewayHandoff.targetGateway === props.gateway &&
    (warmupResult?.state === 'failed' || warmupResult?.state === 'degraded')
  ) {
    emit('status-update', '新 gateway 尚未通過預載檢查，將先沿用既有緩衝並等待下一次請求');
  }
}

function clearTracks() {
  if (!player) return;

  const oldTracks = player.remoteTextTracks();
  if (!oldTracks) return;

  let i = oldTracks.length;
  while (i--) {
    player.removeRemoteTextTrack(oldTracks[i]);
  }
}

function clearQualityLevels() {
  if (!player || typeof player.qualityLevels !== 'function') return;

  const qualityLevels = player.qualityLevels();

  while (qualityLevels?.length > 0) {
    qualityLevels.removeQualityLevel(qualityLevels[0]);
  }

  emitQualityLevels();
}

function handleSubtitleTrackChange() {
  if (!player) return;
  if (isApplyingSubtitlePreference) {
    scheduleSubtitleCueRoleClassSync();
    return;
  }

  const activeLanguages = getOrderedActiveSubtitleLanguages();
  const target = typeof window !== 'undefined' ? window : null;
  const nextPreference = resolvePlayerControlledSubtitlePreference(
    props.subtitleSelection,
    props.subtitles,
    target?.navigator,
    activeLanguages
  );

  emit('subtitle-selection-change', nextPreference);
  emit('status-update', formatSubtitleSelectionStatus(nextPreference));
  scheduleSubtitleCueRoleClassSync();
}

function syncStartTime(startTime) {
  if (!player || !(startTime > 0)) return;

  const applySeek = () => {
    if (player) {
      player.currentTime(startTime);
    }
  };

  if (player.readyState() > 0) {
    applySeek();
  } else {
    player.one('loadedmetadata', applySeek);
  }

  const formattedTime = formatTime(startTime);
  emit('status-update', `✅ 資源就緒！請手動播放 (將從 ${formattedTime} 開始)。`);
}

function handleGlobalKeydown(event) {
  if (showStartupGate.value) {
    return;
  }

  if (isPrimarySubtitleMenuOpen.value) {
    if (isEscapeKey(event)) {
      event.preventDefault?.();
      closePrimarySubtitleMenu();
    }
    return;
  }

  if (isHotkeyHelpOpen.value) {
    if (isEscapeKey(event) || isHelpHotkeyEvent(event)) {
      event.preventDefault?.();
      if (isEscapeKey(event)) {
        closeHotkeyHelp();
      } else {
        toggleHotkeyHelp();
      }
    }
    return;
  }

  applyPlaybackHotkey(event, player, {
    seekStepSeconds: SEEK_STEP_SECONDS,
    longSeekStepSeconds: LONG_SEEK_STEP_SECONDS,
    frameRate: props.frameRate,
    onToggleHelp: toggleHotkeyHelp,
    onToggleSubtitles: toggleSubtitleVisibility,
  });
}

function resetSnapshotTracking() {
  lastProgressSnapshotTime = -1;
}

function emitPlaybackSnapshot(reason, options = {}) {
  if (!player || isSwitchingSource) return;

  const snapshot = getPlayerPlaybackSnapshot(player);
  if (!options.force && reason === 'timeupdate') {
    if (snapshot.hasEnded || snapshot.time <= 0) {
      return;
    }

    if (lastProgressSnapshotTime >= 0 && snapshot.time - lastProgressSnapshotTime < PROGRESS_EMIT_STEP_SECONDS) {
      return;
    }
  }

  if (reason === 'timeupdate') {
    lastProgressSnapshotTime = snapshot.time;
  } else if (snapshot.time > 0 || snapshot.hasEnded) {
    lastProgressSnapshotTime = snapshot.time;
  }

  emit('playback-snapshot', {
    ...snapshot,
  });
}

function handlePauseSnapshot() {
  emitPlaybackSnapshot('pause', { force: true });
}

function handleEndedSnapshot() {
  emitPlaybackSnapshot('ended', { force: true });
}

function handleSeekedSnapshot() {
  emitPlaybackSnapshot('seeked', { force: true });
}

function handleTimeupdateSnapshot() {
  emitPlaybackSnapshot('timeupdate');
}

function bindPlaybackSnapshotListeners() {
  if (!player) return;

  player.on('pause', handlePauseSnapshot);
  player.on('ended', handleEndedSnapshot);
  player.on('seeked', handleSeekedSnapshot);
  player.on('timeupdate', handleTimeupdateSnapshot);
}

function handleQualityLevelsChanged() {
  emitQualityLevels();
  syncQualitySelectorButtonLabel();
}

function bindQualityLevelListeners() {
  if (!player || typeof player.qualityLevels !== 'function') return;

  const nextQualityLevelList = player.qualityLevels();

  if (!nextQualityLevelList || qualityLevelList === nextQualityLevelList) {
    handleQualityLevelsChanged();
    return;
  }

  if (qualityLevelList?.off) {
    qualityLevelList.off('addqualitylevel', handleQualityLevelsChanged);
    qualityLevelList.off('change', handleQualityLevelsChanged);
    qualityLevelList.off('removequalitylevel', handleQualityLevelsChanged);
  }

  qualityLevelList = nextQualityLevelList;
  qualityLevelList.on?.('addqualitylevel', handleQualityLevelsChanged);
  qualityLevelList.on?.('change', handleQualityLevelsChanged);
  qualityLevelList.on?.('removequalitylevel', handleQualityLevelsChanged);
  handleQualityLevelsChanged();
}

function bindStartupGateListeners() {
  if (!player) return;

  player.on('progress', updateStartupGateFromBuffer);
  player.on('canplay', updateStartupGateFromBuffer);
  player.on('loadeddata', updateStartupGateFromBuffer);
}

function syncPoster(posterUrl) {
  if (!player) return;

  player.poster(posterUrl || '');
}

function initPlayer() {
  if (!videoRef.value) return;

  registerPrimarySubtitleControlButton();
  registerSubtitleVisibilityToggleButton();
  registerDualSubtitleSwapButton();
  player = videojs(
    videoRef.value,
    {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      controlBar: {
        subsCapsButton: false,
      },
      textTrackDisplay: {
        allowMultipleShowingTracks: true,
      },
      html5: {
        vhs: {
          overrideNative: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      plugins: {
        hlsQualitySelector: {
          displayCurrentQuality: true,
        },
      },
    },
    () => {
      bindPlaybackSnapshotListeners();
      bindStartupGateListeners();
      bindQualityLevelListeners();
      player.on('xhr-hooks-ready', bindVhsXhrHooks);
      observeSubtitleCueDisplay();
      player.on('texttrackchange', scheduleSubtitleCueRoleClassSync);
      player.on('playerresize', () => {
        scheduleSubtitleCueRoleClassSync();
        if (isPrimarySubtitleMenuOpen.value) {
          updatePrimarySubtitleMenuPosition();
        }
      });
      player.on('fullscreenchange', () => {
        scheduleSubtitleCueRoleClassSync();
        if (isPrimarySubtitleMenuOpen.value) {
          updatePrimarySubtitleMenuPosition();
        }
      });
      ensurePrimarySubtitleControl();
      ensureSubtitleVisibilityToggleControl();
      ensureDualSubtitleSwapControl();
      updatePrimarySubtitleControl();
      syncPoster(props.posterUrl);
      emit('status-update', '播放器已就緒');
      if (props.m3u8Url) {
        syncMediaRequestRouting(props.cid, props.gateway);
        void setupSourceAndTracks(props.m3u8Url, props.subtitles, {
          switchMode: SOURCE_SWITCH_MODE_DEFAULT,
          requestedStartTime: props.startTime,
        });
      }
    }
  );
}

onMounted(() => {
  initPlayer();
  window.addEventListener('keydown', handleGlobalKeydown);
});

watch(
  () => [props.m3u8Url, props.startTime, props.cid, props.gateway],
  ([newUrl, newStartTime, newCid, newGateway], [oldUrl, oldStartTime, oldCid, oldGateway] = []) => {
    if (!player) return;

    if (!newUrl) {
      clearGatewayHandoffState();
      syncMediaRequestRouting('', '');
      pendingSourceStartTime = 0;
      pendingSourceShouldAutoplay = false;
      beginSourceSwitch();
      emit('status-update', '準備就緒');
      return;
    }

    if (newUrl !== oldUrl) {
      const switchMode = resolveSourceSwitchMode(newUrl, {
        oldUrl,
        oldCid,
        oldGateway,
      });

      if (switchMode === SOURCE_SWITCH_MODE_GATEWAY_HANDOFF) {
        void performGatewayMediaHandoff(newUrl, {
          requestedStartTime: newStartTime,
        });
        return;
      }

      void setupSourceAndTracks(newUrl, props.subtitles, {
        switchMode,
        requestedStartTime: newStartTime,
      });
      return;
    }

    if (newStartTime !== oldStartTime) {
      if (newStartTime > 0) {
        syncStartTime(newStartTime);
      } else if (player.readyState() > 0) {
        player.currentTime(0);
        emit('status-update', '播放器已就緒');
      }
    }
  }
);

watch(
  () => props.subtitles,
  (newSubtitles) => {
    if (!player || !props.m3u8Url) return;
    applySubtitleTracks(newSubtitles);
    updatePrimarySubtitleControl();
    updateDualSubtitleSwapControl();
  },
  { deep: true }
);

watch(
  () => [
    props.subtitleSelection?.mode,
    props.subtitleSelection?.primaryLang,
    props.subtitleSelection?.secondaryLang,
  ],
  () => {
    if (!player || !props.m3u8Url) return;
    if (!hasPreferredShowingTrackOrder(props.subtitleSelection)) {
      applySubtitleTracks(props.subtitles);
      updatePrimarySubtitleControl();
      updateDualSubtitleSwapControl(props.subtitleSelection);
      return;
    }

    setActiveSubtitleLanguages(props.subtitleSelection);
    updatePrimarySubtitleControl();
    updateDualSubtitleSwapControl(props.subtitleSelection);
  }
);

watch(
  () => [props.subtitleCatalogStatus, props.cid, props.m3u8Url],
  () => {
    if (!player) return;
    if (!props.m3u8Url || !props.cid) {
      closePrimarySubtitleMenu();
    }
    updatePrimarySubtitleControl();
  }
);

watch(isPrimarySubtitleMenuOpen, async (isOpen) => {
  updatePrimarySubtitleControl();
  if (!isOpen) {
    return;
  }

  await nextTick();
  updatePrimarySubtitleMenuPosition();
  primarySubtitleMenuRef.value?.focus?.();
});

watch(
  () => props.posterUrl,
  (newPosterUrl) => {
    syncPoster(newPosterUrl);
  }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  if (subtitleCueRoleSyncFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(subtitleCueRoleSyncFrame);
    subtitleCueRoleSyncFrame = 0;
  }
  disconnectSubtitleCueDisplayObserver();
  if (textTrackList) {
    textTrackList.removeEventListener('change', handleSubtitleTrackChange);
    textTrackList = null;
  }
  if (qualityLevelList?.off) {
    qualityLevelList.off('addqualitylevel', handleQualityLevelsChanged);
    qualityLevelList.off('change', handleQualityLevelsChanged);
    qualityLevelList.off('removequalitylevel', handleQualityLevelsChanged);
    qualityLevelList = null;
  }
  if (activeVhsXhr?.offRequest) {
    activeVhsXhr.offRequest(handleVhsRequest);
  }
  if (activeVhsXhr?.offResponse) {
    activeVhsXhr.offResponse(handleVhsResponse);
  }
  activeVhsXhr = null;
  clearGatewayHandoffState();
  if (player) {
    player.dualSubtitleSwapAction_ = null;
    player.dualSubtitleSwapState_ = null;
    player.subtitleVisibilityToggleAction_ = null;
    player.subtitleVisibilityToggleState_ = null;
    player.primarySubtitleMenuToggle_ = null;
    player.primarySubtitleControlState_ = null;
    player.off?.('xhr-hooks-ready', bindVhsXhrHooks);
    emitPlaybackSnapshot('before-unmount', { force: true });
    player.dispose();
  }
});
</script>

<style>
.video-player-shell {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-player-shell [data-vjs-player] {
  width: 100%;
  height: 100%;
}

.video-player-shell .vjs-text-track-cue--secondary {
  opacity: 0.92;
  transform: translateY(var(--dual-subtitle-offset-y, 0px)) scale(0.76);
  transform-origin: center bottom;
}

.video-player-shell :deep(.vjs-control-bar) {
  background-color: rgba(27, 33, 41, 0.78);
  backdrop-filter: blur(10px);
}

.video-player-shell .vjs-primary-subtitle-button,
.video-player-shell .vjs-subtitle-visibility-toggle-button,
.video-player-shell .vjs-dual-subtitle-swap-button {
  width: 3.6em;
  padding: 0;
  color: rgba(255, 255, 255, 0.76);
  background: rgba(0, 0, 0, 0.18);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.video-player-shell .vjs-primary-subtitle-button.vjs-disabled,
.video-player-shell .vjs-subtitle-visibility-toggle-button.vjs-disabled,
.video-player-shell .vjs-dual-subtitle-swap-button.vjs-disabled {
  opacity: 0.48;
}

.video-player-shell .vjs-subtitle-visibility-toggle-button {
  order: 72;
}

.video-player-shell .vjs-primary-subtitle-button {
  order: 73;
}

.video-player-shell .vjs-dual-subtitle-swap-button {
  order: 74;
}

.video-player-shell .vjs-quality-selector {
  order: 75;
  margin-left: 0.2em;
}

.video-player-shell .vjs-picture-in-picture-control {
  order: 76;
}

.video-player-shell .vjs-fullscreen-control {
  order: 77;
}

.video-player-shell .vjs-subtitle-cluster-button + .vjs-subtitle-cluster-button {
  margin-left: -1px;
}

.video-player-shell .vjs-subtitle-cluster-button--first {
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px 0 0 999px;
}

.video-player-shell .vjs-subtitle-cluster-button--middle {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.video-player-shell .vjs-subtitle-cluster-button--last {
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0 999px 999px 0;
}

.video-player-shell .vjs-subtitle-cluster-button:hover:not(.vjs-disabled) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.video-player-shell .vjs-primary-subtitle-button .vjs-icon-placeholder,
.video-player-shell .vjs-subtitle-visibility-toggle-button .vjs-icon-placeholder,
.video-player-shell .vjs-dual-subtitle-swap-button .vjs-icon-placeholder {
  display: none;
}

.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger,
.video-player-shell .vjs-subtitle-visibility-toggle-button .vjs-subtitle-visibility-toggle-indicator,
.video-player-shell .vjs-dual-subtitle-swap-button .vjs-dual-subtitle-swap-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 0.24em;
}

.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger-lines {
  position: relative;
  display: inline-flex;
  width: 0.92em;
  height: 0.74em;
}

.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger-lines::before,
.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger-lines::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 0.12em;
  border-radius: 999px;
  background: currentColor;
}

.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger-lines::before {
  top: 0.12em;
}

.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger-lines::after {
  bottom: 0.12em;
}

.video-player-shell .vjs-primary-subtitle-button .vjs-primary-subtitle-trigger-caret {
  width: 0;
  height: 0;
  border-left: 0.22em solid transparent;
  border-right: 0.22em solid transparent;
  border-top: 0.3em solid currentColor;
  opacity: 0.72;
  transform: translateY(0.08em);
}

.video-player-shell .vjs-primary-subtitle-button.vjs-primary-subtitle-button--active {
  color: #ffffff;
  text-shadow: 0 0 0.8em rgba(138, 223, 255, 0.52);
}

.video-player-shell .vjs-subtitle-visibility-toggle-button .vjs-subtitle-visibility-toggle-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.video-player-shell .vjs-subtitle-visibility-toggle-button .vjs-subtitle-visibility-toggle-dot {
  width: 0.36em;
  height: 0.36em;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.video-player-shell .vjs-subtitle-visibility-toggle-button.vjs-subtitle-visibility-toggle-button--active {
  color: #ffffff;
  text-shadow: 0 0 0.8em rgba(138, 223, 255, 0.52);
}

.video-player-shell .vjs-subtitle-visibility-toggle-button.vjs-subtitle-visibility-toggle-button--active
  .vjs-subtitle-visibility-toggle-dot {
  background: #8adfff;
  box-shadow: 0 0 0.55em rgba(138, 223, 255, 0.82);
}

.primary-subtitle-menu-backdrop {
  position: absolute;
  inset: 0;
  z-index: 5;
}

.primary-subtitle-menu {
  position: absolute;
  width: min(12.75rem, calc(100% - 24px));
  padding: 0.28rem 0;
  border-radius: 0.4rem;
  border: none;
  background: rgba(43, 51, 63, 0.88);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
  font-size: 12px;
}

.primary-subtitle-menu-title {
  padding: 0.42rem 0.7rem 0.24rem;
  margin: 0 0 0.15rem;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
}

.primary-subtitle-menu-status {
  padding: 0.68rem 0.7rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 1.4;
}

.primary-subtitle-menu-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.primary-subtitle-menu-item {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  border-style: solid;
  border-color: transparent;
  border-width: 2.4px 0;
  border-radius: 4px;
  background-clip: padding-box;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  padding: 0.44rem 0.7rem;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease, opacity 0.14s ease;
}

.primary-subtitle-menu-item:hover:not(:disabled) {
  background: rgba(114, 133, 159, 0.5);
}

.primary-subtitle-menu-item:disabled {
  cursor: not-allowed;
}

.primary-subtitle-menu-item--selected {
  background: #ffffff;
  color: #2b333f;
}

.primary-subtitle-menu-item--secondary {
  opacity: 0.72;
}

.primary-subtitle-menu-item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-width: 0;
}

.primary-subtitle-menu-item-label {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1.25;
}

.primary-subtitle-menu-item-trailing {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  min-width: 0;
}

.primary-subtitle-menu-item-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  opacity: 0.76;
}

.primary-subtitle-menu-item-meta-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.86rem;
  height: 0.68rem;
  color: currentColor;
  border: 1px solid currentColor;
  border-radius: 0.18rem;
}

.primary-subtitle-menu-item-meta-icon--primary::before,
.primary-subtitle-menu-item-meta-icon--secondary::before,
.primary-subtitle-menu-item-meta-icon--secondary::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 999px;
  background: currentColor;
}

.primary-subtitle-menu-item-meta-icon--primary::before {
  bottom: 0.12rem;
  width: 0.54rem;
  height: 0.11rem;
}

.primary-subtitle-menu-item-meta-icon--secondary::before {
  top: 0.12rem;
  width: 0.52rem;
  height: 0.09rem;
}

.primary-subtitle-menu-item-meta-icon--secondary::after {
  top: 0.31rem;
  width: 0.36rem;
  height: 0.08rem;
  opacity: 0.72;
}

.primary-subtitle-menu-item-meta-icon--local::before,
.primary-subtitle-menu-item-meta-icon--local::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: currentColor;
}

.primary-subtitle-menu-item-meta-icon--local::before {
  top: 0.12rem;
  width: 0.24rem;
  height: 0.24rem;
  border-radius: 0.08rem;
}

.primary-subtitle-menu-item-meta-icon--local::after {
  bottom: 0.08rem;
  width: 0.46rem;
  height: 0.1rem;
  border-radius: 999px;
}

.primary-subtitle-menu-item-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0.95rem;
  font-size: 12px;
  font-weight: 700;
}

.video-player-shell .vjs-dual-subtitle-swap-icon {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.startup-gate {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
  color: #f6f7fb;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.76), rgba(7, 10, 18, 0.9)),
    radial-gradient(circle at top, rgba(92, 163, 255, 0.18), transparent 48%);
  backdrop-filter: blur(8px);
}

.startup-gate-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 30rem;
}

.startup-gate-title,
.startup-gate-detail {
  margin: 0;
}

.startup-gate-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.startup-gate-detail {
  color: rgba(246, 247, 251, 0.82);
  line-height: 1.5;
}

.startup-gate-action {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  color: #f6f7fb;
  background: rgba(255, 255, 255, 0.14);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 160ms ease, transform 160ms ease;
}

.startup-gate-action:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}

.hotkey-help-backdrop {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(7, 9, 16, 0.54), rgba(7, 9, 16, 0.8)),
    radial-gradient(circle at 18% 14%, rgba(162, 82, 255, 0.14), transparent 30%),
    radial-gradient(circle at 84% 12%, rgba(0, 210, 255, 0.1), transparent 26%);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.hotkey-help-dialog {
  width: min(400px, calc(100vw - 24px));
  max-height: min(500px, calc(100vh - 24px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(18, 21, 36, 0.96), rgba(11, 14, 26, 0.98)),
    radial-gradient(circle at top right, rgba(0, 210, 255, 0.08), transparent 38%);
  color: #f4f7fb;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.48);
}

.hotkey-help-dialog:focus {
  outline: 2px solid rgba(0, 210, 255, 0.45);
  outline-offset: 2px;
}

.hotkey-help-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.hotkey-help-copy {
  min-width: 0;
  max-width: 22rem;
}

.hotkey-help-copy h2 {
  margin: 4px 0 8px;
  font-size: clamp(1.02rem, 0.96rem + 0.32vw, 1.18rem);
  line-height: 1.12;
}

.hotkey-help-kicker {
  margin: 0;
  color: rgba(180, 213, 255, 0.82);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hotkey-help-summary {
  margin: 0;
  color: rgba(232, 238, 246, 0.78);
  font-size: 0.76rem;
  line-height: 1.38;
}

.hotkey-help-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 0;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.hotkey-help-close:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.hotkey-help-body {
  min-height: 0;
  overflow: auto;
  padding: 10px 14px 12px;
  display: grid;
  gap: 12px;
  overscroll-behavior: contain;
}

.hotkey-help-section {
  display: grid;
  gap: 8px;
}

.hotkey-help-section-header {
  margin-bottom: -2px;
}

.hotkey-help-section-title {
  margin: 0;
  color: rgba(244, 247, 251, 0.96);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hotkey-help-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.hotkey-help-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(86px, 102px) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 10px 10px 11px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.hotkey-help-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.hotkey-chip {
  min-width: 28px;
  padding: 4px 7px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #f4f7fb;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.08);
}

.hotkey-chip--inline {
  min-width: auto;
  padding-inline: 8px;
  font-size: 0.74rem;
}

.hotkey-help-label {
  min-width: 0;
  font-size: 0.84rem;
  line-height: 1.25;
  font-weight: 600;
}

.hotkey-help-detail {
  color: rgba(232, 238, 246, 0.62);
  font-size: 0.72rem;
  line-height: 1.2;
  white-space: nowrap;
  text-align: right;
}

.hotkey-help-hint {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(232, 238, 246, 0.72);
  font-size: 0.72rem;
  line-height: 1.2;
}

/* 確保畫質切換圖示正常顯示 */
.vjs-quality-selector .vjs-menu-button-popup .vjs-menu {
  display: block;
}

@media (max-width: 720px) {
  .hotkey-help-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .hotkey-help-dialog {
    width: 100%;
    max-height: min(54vh, calc(100vh - env(safe-area-inset-top, 0px) - 4px));
    border-radius: 18px 18px 0 0;
  }

  .hotkey-help-header {
    padding: 12px 12px 8px;
  }

  .hotkey-help-copy h2 {
    margin-bottom: 6px;
    font-size: 0.96rem;
  }

  .hotkey-help-kicker {
    font-size: 0.64rem;
  }

  .hotkey-help-summary {
    font-size: 0.72rem;
  }

  .hotkey-help-body {
    padding: 8px 12px 10px;
    gap: 10px;
  }

  .hotkey-help-list {
    gap: 5px;
  }

  .hotkey-help-row {
    grid-template-columns: minmax(74px, 88px) minmax(0, 1fr);
    gap: 8px;
    padding: 9px 9px 9px 10px;
  }

  .hotkey-help-label {
    font-size: 0.8rem;
  }

  .hotkey-help-detail {
    grid-column: 2;
    white-space: normal;
    text-align: left;
    font-size: 0.68rem;
  }

  .hotkey-help-hint {
    padding: 8px 12px calc(10px + env(safe-area-inset-bottom, 0px));
    font-size: 0.68rem;
  }
}

@media (max-width: 420px) {
  .hotkey-help-dialog {
    max-height: min(50vh, calc(100vh - env(safe-area-inset-top, 0px) - 2px));
  }

  .hotkey-help-row {
    grid-template-columns: minmax(68px, 82px) minmax(0, 1fr);
  }

  .hotkey-chip {
    min-width: 24px;
    padding: 3px 6px;
    font-size: 0.72rem;
  }
}
</style>
