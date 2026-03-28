<template>
  <div ref="playerShellRef" class="video-player-shell" :class="playerShellClasses" :style="playerShellStyle">
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
      class="player-control-layer"
      :class="{ 'player-control-layer--idle': isControlBarHidden }"
      :data-controls-visible="isControlBarHidden ? 'false' : 'true'"
      data-testid="video-player-controls"
    >
      <button
        v-if="showBigPlayOverlay"
        type="button"
        class="player-big-play-button"
        data-testid="video-player-big-play-button"
        aria-label="播放影片"
        title="播放影片"
        @click="togglePlayback"
      >
        <span class="player-big-play-icon" aria-hidden="true"></span>
      </button>

      <div
        ref="controlBarRef"
        class="player-control-bar glass-panel"
        :class="{
          'is-disabled': !isControlSurfaceEnabled,
          'is-hidden': isControlBarHidden,
          'player-control-bar--fullscreen': isPlayerFullscreen,
        }"
        @pointerenter="handleControlBarPointerEnter"
        @pointerleave="handleControlBarPointerLeave"
      >
        <div
          class="player-control-stack"
          :class="{
            'player-control-stack--mobile': isMobileViewport,
            'player-control-stack--compact': isCompactPhoneViewport,
            'player-control-stack--fullscreen': isPlayerFullscreen,
          }"
        >
          <label class="player-progress-control player-progress-control--rail" data-testid="video-player-progress-control">
            <span class="player-sr-only">播放進度</span>
            <input
              id="videoPlayerProgressRange"
              class="player-progress-slider"
              data-testid="video-player-progress-slider"
              type="range"
              min="0"
              max="1000"
              step="1"
              :value="progressSliderValue"
              :style="progressSliderStyle"
              :disabled="!canSeek"
              :aria-label="`播放進度，目前 ${formattedCurrentTime} / ${formattedDuration}`"
              @input="handleProgressInput"
              @change="handleProgressInput"
            />
          </label>

          <div
            class="player-control-row"
            :class="{
              'player-control-row--mobile': isMobileViewport,
              'player-control-row--compact': isCompactPhoneViewport,
            }"
          >
            <div class="player-control-group player-control-group--transport" data-testid="video-player-transport-group">
              <button
                type="button"
                class="player-action-btn player-action-btn--play"
                data-testid="video-player-play-toggle"
                :disabled="!isControlSurfaceEnabled"
                :aria-label="isPlayerPlaying ? '暫停播放' : '開始播放'"
                :title="isPlayerPlaying ? '暫停播放' : '開始播放'"
                @click="togglePlayback"
              >
                <span
                  class="player-action-icon"
                  :class="isPlayerPlaying ? 'player-action-icon--pause' : 'player-action-icon--play'"
                  aria-hidden="true"
                ></span>
              </button>

              <div class="player-time-readout" data-testid="video-player-time-display" aria-live="off">
                <span data-testid="video-player-current-time">{{ formattedCurrentTime }}</span>
                <span class="player-time-divider" aria-hidden="true">/</span>
                <span data-testid="video-player-duration">{{ formattedDuration }}</span>
              </div>

              <div
                v-if="!isCompactPhoneViewport"
                class="player-volume-inline player-volume-inline--hover-reveal"
                data-testid="video-player-volume-inline"
              >
                <button
                  type="button"
                  class="player-action-btn player-action-btn--volume"
                  data-testid="video-player-mute-toggle"
                  :disabled="!isVolumeControlEnabled"
                  :aria-pressed="isPlayerMuted ? 'true' : 'false'"
                  :aria-label="volumeMuteTooltip"
                  :title="volumeMuteTooltip"
                  @click="toggleMute"
                >
                  <span
                    class="player-action-chip player-action-glyph"
                    :class="
                      isPlayerMuted || volumeSliderValue === 0
                        ? 'player-action-glyph--volume-muted'
                        : 'player-action-glyph--volume'
                    "
                    aria-hidden="true"
                  ></span>
                </button>

                <label class="player-volume-control player-volume-control--inline" data-testid="video-player-volume-control">
                  <span class="player-sr-only">音量</span>
                  <input
                    id="videoPlayerVolumeRangeInline"
                    class="player-volume-slider"
                    data-testid="video-player-volume-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="volumeSliderValue"
                    :style="volumeSliderStyle"
                    :disabled="!isVolumeControlEnabled"
                    :aria-label="volumeSliderAriaLabel"
                    @input="handleVolumeInput"
                    @change="handleVolumeInput"
                  />
                </label>
              </div>
            </div>

            <div class="player-control-group player-control-group--actions" data-testid="video-player-secondary-actions">
              <button
                v-if="isCompactPhoneViewport"
                ref="compactSettingsTriggerRef"
                type="button"
                class="player-action-btn player-action-btn--settings"
                data-testid="video-player-settings-trigger"
                :aria-expanded="isCompactSettingsOpen ? 'true' : 'false'"
                aria-haspopup="dialog"
                aria-label="開啟播放器設定"
                title="開啟播放器設定"
                @click="toggleCompactSettings"
              >
                <span class="player-action-chip player-action-glyph player-action-glyph--settings" aria-hidden="true"></span>
              </button>

              <template v-else>
                <button
                  type="button"
                  class="player-action-btn"
                  data-testid="video-player-subtitle-toggle"
                  :disabled="!subtitleVisibilityState.enabled"
                  :aria-pressed="subtitleVisibilityState.active ? 'true' : 'false'"
                  :aria-label="subtitleVisibilityState.tooltip"
                  :title="subtitleVisibilityState.tooltip"
                  @click="toggleSubtitleVisibility"
                >
                  <span class="player-action-chip player-action-glyph player-action-glyph--captions" aria-hidden="true"></span>
                </button>

                <button
                  ref="primarySubtitleTriggerRef"
                  type="button"
                  class="player-action-btn"
                  data-testid="video-player-primary-subtitle-trigger"
                  :disabled="!primarySubtitleControlState.enabled"
                  :aria-expanded="isPrimarySubtitleMenuOpen ? 'true' : 'false'"
                  aria-haspopup="menu"
                  :aria-label="primarySubtitleControlState.tooltip"
                  :title="primarySubtitleControlState.tooltip"
                  @click="togglePrimarySubtitleMenu"
                >
                  <span
                    class="player-action-chip player-action-glyph player-action-glyph--captions-primary"
                    aria-hidden="true"
                  ></span>
                </button>

                <button
                  v-if="dualSubtitleSwapState.visible !== false"
                  type="button"
                  class="player-action-btn"
                  data-testid="video-player-dual-subtitle-swap"
                  :disabled="!dualSubtitleSwapState.enabled"
                  :aria-label="dualSubtitleSwapState.tooltip || dualSubtitleSwapTitle"
                  :title="dualSubtitleSwapState.tooltip || dualSubtitleSwapTitle"
                  @click="swapSubtitleRoles"
                >
                  <span class="player-action-chip player-action-glyph player-action-glyph--swap" aria-hidden="true"></span>
                </button>

                <button
                  ref="qualityMenuTriggerRef"
                  type="button"
                  class="player-action-btn player-action-btn--quality"
                  data-testid="video-player-quality-trigger"
                  :disabled="!qualityControlState.enabled"
                  :aria-expanded="isQualityMenuOpen ? 'true' : 'false'"
                  aria-haspopup="menu"
                  :aria-label="qualityControlState.tooltip"
                  :title="qualityControlState.tooltip"
                  @click="toggleQualityMenu"
                >
                  <span class="player-action-chip player-action-glyph player-action-glyph--quality" aria-hidden="true"></span>
                </button>

                <button
                  v-if="isPictureInPictureSupported"
                  type="button"
                  class="player-action-btn"
                  data-testid="video-player-picture-in-picture-toggle"
                  :aria-pressed="isPictureInPictureActive ? 'true' : 'false'"
                  :aria-label="isPictureInPictureActive ? '離開子母畫面' : '進入子母畫面'"
                  :title="isPictureInPictureActive ? '離開子母畫面' : '進入子母畫面'"
                  @click="togglePictureInPicture"
                >
                  <span class="player-action-chip player-action-glyph player-action-glyph--pip" aria-hidden="true"></span>
                </button>

                <button
                  type="button"
                  class="player-action-btn"
                  data-testid="video-player-fullscreen-toggle"
                  :disabled="!isControlSurfaceEnabled"
                  :aria-pressed="isPlayerFullscreen ? 'true' : 'false'"
                  :aria-label="isPlayerFullscreen ? '離開全螢幕' : '進入全螢幕'"
                  :title="isPlayerFullscreen ? '離開全螢幕' : '進入全螢幕'"
                  @click="toggleFullscreen"
                >
                  <span
                    class="player-action-chip player-action-glyph"
                    :class="isPlayerFullscreen ? 'player-action-glyph--fullscreen-exit' : 'player-action-glyph--fullscreen'"
                    aria-hidden="true"
                  ></span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
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
        aria-label="立即播放"
        title="立即播放"
        @click="overrideStartupGate"
      >
        <span class="startup-gate-action-icon" aria-hidden="true"></span>
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
                  >
                    <SubtitleRoleIcon class="primary-subtitle-menu-item-icon-svg" variant="primary" />
                  </span>
                  <span
                    v-if="track.isSecondary"
                    class="primary-subtitle-menu-item-meta-icon primary-subtitle-menu-item-meta-icon--secondary"
                    aria-hidden="true"
                  >
                    <SubtitleRoleIcon class="primary-subtitle-menu-item-icon-svg" variant="secondary" />
                  </span>
                  <span
                    v-if="track.isLocal"
                    class="primary-subtitle-menu-item-meta-icon primary-subtitle-menu-item-meta-icon--local"
                    aria-hidden="true"
                  >
                    <SubtitleRoleIcon class="primary-subtitle-menu-item-icon-svg" variant="local" />
                  </span>
                </span>
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="isCompactPhoneViewport && isCompactSettingsOpen"
      class="compact-settings-backdrop"
      data-testid="video-player-settings-backdrop"
      @click="closeCompactSettings"
    >
      <section
        ref="compactSettingsPanelRef"
        class="compact-settings-panel glass-panel"
        role="dialog"
        aria-modal="true"
        aria-label="播放器設定"
        tabindex="-1"
        data-testid="video-player-settings-panel"
        @click.stop
      >
        <div class="compact-settings-header">
          <div>
            <p class="compact-settings-kicker">Player Settings</p>
            <h2 class="compact-settings-title">播放器設定</h2>
          </div>
          <button
            type="button"
            class="compact-settings-close"
            aria-label="關閉播放器設定"
            @click="closeCompactSettings"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="compact-settings-body">
          <section class="compact-settings-section">
            <p class="compact-settings-section-title">聲音</p>
            <div class="compact-settings-inline compact-settings-inline--volume">
              <div class="player-volume-inline player-volume-inline--panel" data-testid="video-player-volume-inline">
                <button
                  type="button"
                  class="player-action-btn player-action-btn--volume"
                  data-testid="video-player-mute-toggle"
                  :disabled="!isVolumeControlEnabled"
                  :aria-pressed="isPlayerMuted ? 'true' : 'false'"
                  :aria-label="volumeMuteTooltip"
                  :title="volumeMuteTooltip"
                  @click="toggleMute"
                >
                  <span
                    class="player-action-chip player-action-glyph"
                    :class="
                      isPlayerMuted || volumeSliderValue === 0
                        ? 'player-action-glyph--volume-muted'
                        : 'player-action-glyph--volume'
                    "
                    aria-hidden="true"
                  ></span>
                </button>

                <label class="player-volume-control player-volume-control--inline" data-testid="video-player-volume-control">
                  <span class="player-sr-only">音量</span>
                  <input
                    id="videoPlayerVolumeRangeCompact"
                    class="player-volume-slider"
                    data-testid="video-player-volume-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="volumeSliderValue"
                    :style="volumeSliderStyle"
                    :disabled="!isVolumeControlEnabled"
                    :aria-label="volumeSliderAriaLabel"
                    @input="handleVolumeInput"
                    @change="handleVolumeInput"
                  />
                </label>
              </div>

              <p class="compact-settings-value" data-testid="video-player-volume-value">{{ volumeStatusLabel }}</p>
            </div>
          </section>

          <section class="compact-settings-section">
            <p class="compact-settings-section-title">字幕</p>
            <div class="compact-settings-inline">
              <button
                type="button"
                class="player-action-btn"
                data-testid="video-player-subtitle-toggle"
                :disabled="!subtitleVisibilityState.enabled"
                :aria-pressed="subtitleVisibilityState.active ? 'true' : 'false'"
                :aria-label="subtitleVisibilityState.tooltip"
                :title="subtitleVisibilityState.tooltip"
                @click="toggleSubtitleVisibility"
              >
                <span class="player-action-chip player-action-glyph player-action-glyph--captions" aria-hidden="true"></span>
              </button>

              <button
                ref="primarySubtitleTriggerRef"
                type="button"
                class="player-action-btn"
                data-testid="video-player-primary-subtitle-trigger"
                :disabled="!primarySubtitleControlState.enabled"
                :aria-expanded="isPrimarySubtitleMenuOpen ? 'true' : 'false'"
                aria-haspopup="menu"
                :aria-label="primarySubtitleControlState.tooltip"
                :title="primarySubtitleControlState.tooltip"
                @click="togglePrimarySubtitleMenu"
              >
                <span
                  class="player-action-chip player-action-glyph player-action-glyph--captions-primary"
                  aria-hidden="true"
                ></span>
              </button>

              <button
                v-if="dualSubtitleSwapState.visible !== false"
                type="button"
                class="player-action-btn"
                data-testid="video-player-dual-subtitle-swap"
                :disabled="!dualSubtitleSwapState.enabled"
                :aria-label="dualSubtitleSwapState.tooltip || dualSubtitleSwapTitle"
                :title="dualSubtitleSwapState.tooltip || dualSubtitleSwapTitle"
                @click="swapSubtitleRoles"
              >
                <span class="player-action-chip player-action-glyph player-action-glyph--swap" aria-hidden="true"></span>
              </button>
            </div>
          </section>

          <section class="compact-settings-section">
            <p class="compact-settings-section-title">播放</p>
            <div class="compact-settings-inline">
              <button
                ref="qualityMenuTriggerRef"
                type="button"
                class="player-action-btn player-action-btn--quality"
                data-testid="video-player-quality-trigger"
                :disabled="!qualityControlState.enabled"
                :aria-expanded="isQualityMenuOpen ? 'true' : 'false'"
                aria-haspopup="menu"
                :aria-label="qualityControlState.tooltip"
                :title="qualityControlState.tooltip"
                @click="toggleQualityMenu"
              >
                <span class="player-action-chip player-action-glyph player-action-glyph--quality" aria-hidden="true"></span>
              </button>

              <button
                v-if="isPictureInPictureSupported"
                type="button"
                class="player-action-btn"
                data-testid="video-player-picture-in-picture-toggle"
                :aria-pressed="isPictureInPictureActive ? 'true' : 'false'"
                :aria-label="isPictureInPictureActive ? '離開子母畫面' : '進入子母畫面'"
                :title="isPictureInPictureActive ? '離開子母畫面' : '進入子母畫面'"
                @click="togglePictureInPicture"
              >
                <span class="player-action-chip player-action-glyph player-action-glyph--pip" aria-hidden="true"></span>
              </button>

              <button
                type="button"
                class="player-action-btn"
                data-testid="video-player-fullscreen-toggle"
                :disabled="!isControlSurfaceEnabled"
                :aria-pressed="isPlayerFullscreen ? 'true' : 'false'"
                :aria-label="isPlayerFullscreen ? '離開全螢幕' : '進入全螢幕'"
                :title="isPlayerFullscreen ? '離開全螢幕' : '進入全螢幕'"
                @click="toggleFullscreen"
              >
                <span
                  class="player-action-chip player-action-glyph"
                  :class="isPlayerFullscreen ? 'player-action-glyph--fullscreen-exit' : 'player-action-glyph--fullscreen'"
                  aria-hidden="true"
                ></span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>

    <div
      v-if="isQualityMenuOpen"
      class="quality-menu-backdrop"
      data-testid="video-player-quality-menu-backdrop"
      @click="closeQualityMenu"
    >
      <section
        ref="qualityMenuRef"
        class="quality-menu glass-panel"
        :style="qualityMenuStyle"
        role="menu"
        aria-label="畫質"
        tabindex="-1"
        data-testid="video-player-quality-menu"
        @click.stop
      >
        <div class="quality-menu-title" aria-hidden="true">畫質</div>

        <button
          type="button"
          class="quality-menu-item"
          :class="{ 'quality-menu-item--selected': qualityControlState.mode === 'auto' }"
          data-testid="video-player-quality-option-auto"
          @click="selectQualityLevel(mediaHandoffQualityModeAuto)"
        >
          <span class="quality-menu-item-label">Auto</span>
          <span v-if="qualityControlState.mode === 'auto'" class="quality-menu-item-check" aria-hidden="true">✓</span>
        </button>

        <button
          v-for="level in qualityMenuItems"
          :key="`${level.id}:${level.height}`"
          type="button"
          class="quality-menu-item"
          :class="{ 'quality-menu-item--selected': isQualityLevelSelected(level) }"
          :data-testid="getQualityOptionTestId(level)"
          @click="selectQualityLevel(level.height)"
        >
          <span class="quality-menu-item-label">{{ level.label }}</span>
          <span v-if="isQualityLevelSelected(level)" class="quality-menu-item-check" aria-hidden="true">✓</span>
        </button>
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
import SubtitleRoleIcon from './SubtitleRoleIcon.vue';
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
const MOBILE_PLAYER_CONTROLS_MAX_WIDTH = 720;
const COMPACT_PHONE_PLAYER_CONTROLS_MAX_WIDTH = 429;
const PLAYER_CONTROL_POINTER_WAKE_EVENT_NAMES = ['mousemove', 'pointermove', 'pointerdown', 'touchstart'];
const DOCUMENT_FULLSCREEN_CHANGE_EVENT_NAMES = ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'];
const MEDIA_FULLSCREEN_CHANGE_EVENT_NAMES = ['webkitbeginfullscreen', 'webkitendfullscreen'];

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
const controlBarRef = ref(null);
const compactSettingsTriggerRef = ref(null);
const compactSettingsPanelRef = ref(null);
const primarySubtitleTriggerRef = ref(null);
const primarySubtitleMenuRef = ref(null);
const isPrimarySubtitleMenuOpen = ref(false);
const primarySubtitleMenuPosition = ref({
  bottom: 56,
  right: 16,
});
const qualityMenuTriggerRef = ref(null);
const qualityMenuRef = ref(null);
const isQualityMenuOpen = ref(false);
const qualityMenuPosition = ref({
  bottom: 56,
  right: 16,
});
const hotkeyHelpDialogRef = ref(null);
const isHotkeyHelpOpen = ref(false);
const videoRef = ref(null);
const isControlSurfaceReady = ref(false);
const isCompactSettingsOpen = ref(false);
const isPlayerUserActive = ref(true);
const isControlBarHovered = ref(false);
const playerControlSafeAreaPx = ref(88);
const playerShellWidth = ref(0);
const playerReadyState = ref(0);
const isPlayerPlaying = ref(false);
const isPlayerMuted = ref(false);
const playerVolumeLevel = ref(1);
const playerCurrentTimeSeconds = ref(0);
const playerDurationSeconds = ref(0);
const playerBufferedEndSeconds = ref(0);
const isPlayerFullscreen = ref(false);
const isPictureInPictureSupported = ref(false);
const isPictureInPictureActive = ref(false);
const availableQualityLevels = ref([]);
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
let playerShellResizeObserver = null;
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
const isMobileViewport = computed(
  () => playerShellWidth.value > 0 && playerShellWidth.value <= MOBILE_PLAYER_CONTROLS_MAX_WIDTH
);
const isCompactPhoneViewport = computed(
  () => playerShellWidth.value > 0 && playerShellWidth.value <= COMPACT_PHONE_PLAYER_CONTROLS_MAX_WIDTH
);
const playerShellStyle = computed(() => ({
  '--player-control-safe-area': `${playerControlSafeAreaPx.value}px`,
}));
const primarySubtitleMenuStyle = computed(() => ({
  bottom: `${primarySubtitleMenuPosition.value.bottom}px`,
  right: `${primarySubtitleMenuPosition.value.right}px`,
}));
const qualityMenuStyle = computed(() => ({
  bottom: `${qualityMenuPosition.value.bottom}px`,
  right: `${qualityMenuPosition.value.right}px`,
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
const subtitleVisibilityState = computed(() => resolveSubtitleVisibilityToggleState());
const primarySubtitleControlState = computed(() => ({
  ...resolvePrimarySubtitleControlState(),
  expanded: isPrimarySubtitleMenuOpen.value,
}));
const dualSubtitleSwapState = computed(() => resolveDualSubtitleSwapButtonState(props.subtitleSelection));
const isVolumeControlEnabled = computed(() => isControlSurfaceReady.value);
const isControlSurfaceEnabled = computed(() => isControlSurfaceReady.value && Boolean(props.m3u8Url));
const canSeek = computed(() => isControlSurfaceEnabled.value && playerDurationSeconds.value > 0);
const playedPercent = computed(() =>
  playerDurationSeconds.value > 0 ? Math.min(100, (playerCurrentTimeSeconds.value / playerDurationSeconds.value) * 100) : 0
);
const bufferedPercent = computed(() =>
  playerDurationSeconds.value > 0 ? Math.min(100, (playerBufferedEndSeconds.value / playerDurationSeconds.value) * 100) : 0
);
const progressSliderValue = computed(() =>
  playerDurationSeconds.value > 0 ? Math.round((playerCurrentTimeSeconds.value / playerDurationSeconds.value) * 1000) : 0
);
const progressSliderStyle = computed(() => ({
  '--player-progress-played': `${playedPercent.value}%`,
  '--player-progress-buffered': `${Math.max(playedPercent.value, bufferedPercent.value)}%`,
}));
const volumeSliderValue = computed(() => Math.round(Math.max(0, Math.min(1, playerVolumeLevel.value)) * 100));
const volumeSliderStyle = computed(() => ({
  '--player-volume-fill': `${isPlayerMuted.value ? 0 : volumeSliderValue.value}%`,
}));
const volumeMuteTooltip = computed(() =>
  isPlayerMuted.value || volumeSliderValue.value === 0
    ? '取消靜音'
    : `靜音（目前 ${volumeSliderValue.value}%）`
);
const volumeStatusLabel = computed(() =>
  isPlayerMuted.value || volumeSliderValue.value === 0 ? '靜音中' : `音量 ${volumeSliderValue.value}%`
);
const volumeSliderAriaLabel = computed(() => `音量，目前 ${volumeSliderValue.value}%`);
const formattedCurrentTime = computed(() => formatTime(Math.max(0, playerCurrentTimeSeconds.value)));
const formattedDuration = computed(() =>
  playerDurationSeconds.value > 0 ? formatTime(playerDurationSeconds.value) : '00:00'
);
const isControlLayerPinnedOpen = computed(
  () =>
    !isControlSurfaceEnabled.value ||
    showStartupGate.value ||
    isCompactSettingsOpen.value ||
    isPrimarySubtitleMenuOpen.value ||
    isQualityMenuOpen.value ||
    isHotkeyHelpOpen.value ||
    isControlBarHovered.value
);
const isCustomControlLayerVisible = computed(() => isControlLayerPinnedOpen.value || isPlayerUserActive.value);
const showBigPlayOverlay = computed(
  () =>
    isControlSurfaceEnabled.value &&
    isCustomControlLayerVisible.value &&
    playerReadyState.value > 0 &&
    !showStartupGate.value &&
    !isPlayerPlaying.value &&
    !isCompactSettingsOpen.value &&
    !isPrimarySubtitleMenuOpen.value &&
    !isQualityMenuOpen.value &&
    !isHotkeyHelpOpen.value
);
const isControlBarHidden = computed(() => isControlSurfaceEnabled.value && !isCustomControlLayerVisible.value);
const playerShellClasses = computed(() => ({
  'video-player-shell--controls-idle': isControlBarHidden.value,
}));
const qualityMenuItems = computed(() =>
  [...availableQualityLevels.value]
    .filter((level) => Number.isFinite(level?.height) && level.height > 0)
    .sort((left, right) => {
      if (left.height !== right.height) {
        return right.height - left.height;
      }

      return String(left.label || '').localeCompare(String(right.label || ''));
    })
);
const qualityControlState = computed(() => {
  const levels = qualityMenuItems.value;

  if (levels.length === 0) {
    return {
      enabled: false,
      mode: 'empty',
      label: 'Auto',
      tooltip: '沒有可用畫質',
      selectedHeight: null,
    };
  }

  const enabledLevels = levels.filter((level) => level.enabled);
  const isAutoMode = enabledLevels.length !== 1;
  const selectedLevel = enabledLevels[0] || null;

  return {
    enabled: levels.length > 1,
    mode: isAutoMode ? 'auto' : 'manual',
    label: isAutoMode ? 'Auto' : selectedLevel?.label || 'Auto',
    tooltip: isAutoMode ? '切換畫質 (Auto)' : `切換畫質 (${selectedLevel?.label || 'Auto'})`,
    selectedHeight: isAutoMode ? null : selectedLevel?.height ?? null,
  };
});

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

function resolveMediaElement() {
  return videoRef.value || player?.el?.()?.querySelector?.('video') || null;
}

function resolveOwnerDocument() {
  if (playerShellRef.value?.ownerDocument) {
    return playerShellRef.value.ownerDocument;
  }

  if (typeof document !== 'undefined') {
    return document;
  }

  return null;
}

function resolveDocumentFullscreenElement(ownerDocument = resolveOwnerDocument()) {
  if (!ownerDocument) {
    return null;
  }

  return (
    ownerDocument.fullscreenElement ||
    ownerDocument.webkitFullscreenElement ||
    ownerDocument.msFullscreenElement ||
    null
  );
}

function resolvePlayerFullscreenState() {
  const shellElement = playerShellRef.value;
  const fullscreenElement = resolveDocumentFullscreenElement();
  if (shellElement && fullscreenElement) {
    return fullscreenElement === shellElement || shellElement.contains(fullscreenElement);
  }

  const mediaElement = resolveMediaElement();
  if (mediaElement?.webkitDisplayingFullscreen === true || mediaElement?.webkitPresentationMode === 'fullscreen') {
    return true;
  }

  return typeof player?.isFullscreen === 'function' ? player.isFullscreen() === true : false;
}

function resolveBufferedEndTime() {
  if (!player || typeof player.buffered !== 'function') {
    return 0;
  }

  const buffered = player.buffered();
  if (!buffered || buffered.length === 0) {
    return 0;
  }

  try {
    return Math.max(0, buffered.end(buffered.length - 1));
  } catch (_) {
    return 0;
  }
}

function syncPictureInPictureSupport() {
  if (typeof document === 'undefined') {
    isPictureInPictureSupported.value = false;
    return;
  }

  const mediaElement = resolveMediaElement();
  isPictureInPictureSupported.value = Boolean(
    document.pictureInPictureEnabled && mediaElement && typeof mediaElement.requestPictureInPicture === 'function'
  );
}

function syncPictureInPictureState() {
  if (typeof document === 'undefined') {
    isPictureInPictureActive.value = false;
    return;
  }

  const mediaElement = resolveMediaElement();
  isPictureInPictureActive.value = Boolean(mediaElement && document.pictureInPictureElement === mediaElement);
}

function updatePlayerShellWidth() {
  const shellElement = playerShellRef.value;
  const shellWidth = shellElement?.getBoundingClientRect?.().width || shellElement?.clientWidth || 0;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
  const normalizedWidth = Math.round(viewportWidth > 0 ? viewportWidth : shellWidth);
  const isCompactViewport = normalizedWidth > 0 && normalizedWidth <= COMPACT_PHONE_PLAYER_CONTROLS_MAX_WIDTH;

  playerShellWidth.value = normalizedWidth;

  if (!isCompactViewport && isCompactSettingsOpen.value) {
    closeCompactSettings({ restoreFocus: false });
  }

  updatePlayerControlSafeArea();
}

function updatePlayerControlSafeArea() {
  const controlBarHeight = controlBarRef.value?.getBoundingClientRect?.().height || 0;
  const breathingRoom = isCompactPhoneViewport.value ? 24 : 30;
  const minimumSafeArea = isCompactPhoneViewport.value ? 72 : 84;
  playerControlSafeAreaPx.value = Math.max(minimumSafeArea, Math.ceil(controlBarHeight + breathingRoom));
}

function bindPlayerShellResizeObserver() {
  updatePlayerShellWidth();
  updatePlayerControlSafeArea();

  if (typeof window === 'undefined') {
    return;
  }

  const shellElement = playerShellRef.value;
  const controlBarElement = controlBarRef.value;
  if (typeof window.ResizeObserver === 'function' && (shellElement || controlBarElement)) {
    playerShellResizeObserver?.disconnect?.();
    playerShellResizeObserver = new window.ResizeObserver(() => {
      updatePlayerShellWidth();
    });
    shellElement && playerShellResizeObserver.observe(shellElement);
    controlBarElement && playerShellResizeObserver.observe(controlBarElement);
    return;
  }

  window.addEventListener('resize', updatePlayerShellWidth);
}

function disconnectPlayerShellResizeObserver() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updatePlayerShellWidth);
  }

  playerShellResizeObserver?.disconnect?.();
  playerShellResizeObserver = null;
}

function syncControlSurfaceState() {
  if (!player) {
    return;
  }

  const readyState = Number.isFinite(player.readyState?.()) ? player.readyState() : 0;
  const currentTime = Number.isFinite(player.currentTime?.()) ? Math.max(0, player.currentTime()) : 0;
  const duration = Number.isFinite(player.duration?.()) ? Math.max(0, player.duration()) : 0;
  const volume = Number.isFinite(player.volume?.()) ? Math.max(0, Math.min(1, player.volume())) : 1;

  playerReadyState.value = readyState;
  isPlayerPlaying.value = typeof player.paused === 'function' ? player.paused() === false : false;
  isPlayerMuted.value = typeof player.muted === 'function' ? player.muted() === true : false;
  playerVolumeLevel.value = volume;
  playerCurrentTimeSeconds.value = currentTime;
  playerDurationSeconds.value = duration;
  playerBufferedEndSeconds.value = resolveBufferedEndTime();
  isPlayerFullscreen.value = resolvePlayerFullscreenState();
  if (typeof player.userActive === 'function') {
    isPlayerUserActive.value = player.userActive() === true;
  }
  syncPictureInPictureSupport();
  syncPictureInPictureState();
}

function wakeControlSurface() {
  isPlayerUserActive.value = true;
  if (player && typeof player.userActive === 'function') {
    player.userActive(true);
  }
}

function handlePlayerUserActive() {
  isPlayerUserActive.value = true;
  syncControlSurfaceState();
}

function handlePlayerUserInactive() {
  isControlBarHovered.value = false;
  isPlayerUserActive.value = false;
  syncControlSurfaceState();
}

function handlePlayerShellActivity(event) {
  if (event?.type === 'pointermove' && event.pointerType === 'touch') {
    return;
  }

  wakeControlSurface();
}

function handlePlayerShellFocusIn() {
  wakeControlSurface();
}

function hideControlSurface() {
  isControlBarHovered.value = false;
  isPlayerUserActive.value = false;
  if (player && typeof player.userActive === 'function') {
    player.userActive(false);
  }
}

function handlePlayerShellPointerLeave(event) {
  if (event?.type === 'pointerleave' && event.pointerType === 'touch') {
    return;
  }

  hideControlSurface();
}

function handleControlBarPointerEnter() {
  isControlBarHovered.value = true;
  wakeControlSurface();
}

function handleControlBarPointerLeave() {
  isControlBarHovered.value = false;
}

function handleFullscreenStateChange() {
  updatePlayerControlSafeArea();
  if (isPrimarySubtitleMenuOpen.value) {
    updatePrimarySubtitleMenuPosition();
  }
  if (isQualityMenuOpen.value) {
    updateQualityMenuPosition();
  }
  syncControlSurfaceState();
  wakeControlSurface();
}

function bindPlayerShellActivityListeners() {
  const shellElement = playerShellRef.value;
  if (!shellElement) {
    return;
  }

  PLAYER_CONTROL_POINTER_WAKE_EVENT_NAMES.forEach((eventName) => {
    shellElement.addEventListener(eventName, handlePlayerShellActivity, { passive: true });
  });
  shellElement.addEventListener('pointerleave', handlePlayerShellPointerLeave);
  shellElement.addEventListener('mouseleave', handlePlayerShellPointerLeave);
  shellElement.addEventListener('focusin', handlePlayerShellFocusIn);
}

function unbindPlayerShellActivityListeners() {
  const shellElement = playerShellRef.value;
  if (!shellElement) {
    return;
  }

  PLAYER_CONTROL_POINTER_WAKE_EVENT_NAMES.forEach((eventName) => {
    shellElement.removeEventListener(eventName, handlePlayerShellActivity);
  });
  shellElement.removeEventListener('pointerleave', handlePlayerShellPointerLeave);
  shellElement.removeEventListener('mouseleave', handlePlayerShellPointerLeave);
  shellElement.removeEventListener('focusin', handlePlayerShellFocusIn);
}

function bindDocumentFullscreenListeners() {
  const ownerDocument = resolveOwnerDocument();
  if (ownerDocument) {
    DOCUMENT_FULLSCREEN_CHANGE_EVENT_NAMES.forEach((eventName) => {
      ownerDocument.addEventListener(eventName, handleFullscreenStateChange);
    });
  }

  const mediaElement = resolveMediaElement();
  MEDIA_FULLSCREEN_CHANGE_EVENT_NAMES.forEach((eventName) => {
    mediaElement?.addEventListener?.(eventName, handleFullscreenStateChange);
  });
}

function unbindDocumentFullscreenListeners() {
  const ownerDocument = resolveOwnerDocument();
  if (ownerDocument) {
    DOCUMENT_FULLSCREEN_CHANGE_EVENT_NAMES.forEach((eventName) => {
      ownerDocument.removeEventListener(eventName, handleFullscreenStateChange);
    });
  }

  const mediaElement = resolveMediaElement();
  MEDIA_FULLSCREEN_CHANGE_EVENT_NAMES.forEach((eventName) => {
    mediaElement?.removeEventListener?.(eventName, handleFullscreenStateChange);
  });
}

function bindControlSurfaceListeners() {
  if (!player) {
    return;
  }

  [
    'play',
    'pause',
    'loadedmetadata',
    'durationchange',
    'timeupdate',
    'progress',
    'volumechange',
    'fullscreenchange',
    'enterFullWindow',
    'exitFullWindow',
  ].forEach((eventName) => {
    player.on(eventName, syncControlSurfaceState);
  });
  player.on('useractive', handlePlayerUserActive);
  player.on('userinactive', handlePlayerUserInactive);
}

function handlePictureInPictureEntered() {
  syncPictureInPictureState();
}

function handlePictureInPictureLeft() {
  syncPictureInPictureState();
}

function bindPictureInPictureListeners() {
  const mediaElement = resolveMediaElement();
  if (!mediaElement) {
    syncPictureInPictureSupport();
    syncPictureInPictureState();
    return;
  }

  mediaElement.removeEventListener?.('enterpictureinpicture', handlePictureInPictureEntered);
  mediaElement.removeEventListener?.('leavepictureinpicture', handlePictureInPictureLeft);
  mediaElement.addEventListener?.('enterpictureinpicture', handlePictureInPictureEntered);
  mediaElement.addEventListener?.('leavepictureinpicture', handlePictureInPictureLeft);
  syncPictureInPictureSupport();
  syncPictureInPictureState();
}

function unbindPictureInPictureListeners() {
  const mediaElement = resolveMediaElement();
  mediaElement?.removeEventListener?.('enterpictureinpicture', handlePictureInPictureEntered);
  mediaElement?.removeEventListener?.('leavepictureinpicture', handlePictureInPictureLeft);
}

function updateQualityMenuPosition() {
  const shellElement = playerShellRef.value;
  const buttonElement = qualityMenuTriggerRef.value;

  if (!shellElement || !buttonElement) {
    qualityMenuPosition.value = {
      bottom: 56,
      right: 16,
    };
    return;
  }

  const shellRect = shellElement.getBoundingClientRect();
  const buttonRect = buttonElement.getBoundingClientRect();

  qualityMenuPosition.value = {
    bottom: Math.max(56, shellRect.bottom - buttonRect.top + 8),
    right: Math.max(12, shellRect.right - buttonRect.right),
  };
}

function closeQualityMenu() {
  isQualityMenuOpen.value = false;
}

function openQualityMenu() {
  if (!qualityControlState.value.enabled) {
    return;
  }

  closePrimarySubtitleMenu();
  updateQualityMenuPosition();
  isQualityMenuOpen.value = true;
  void nextTick(() => {
    qualityMenuRef.value?.focus?.();
  });
}

function toggleQualityMenu() {
  if (isQualityMenuOpen.value) {
    closeQualityMenu();
    return;
  }

  openQualityMenu();
}

function getQualityOptionTestId(level) {
  const normalizedLabel = String(level?.label || level?.height || 'quality')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `video-player-quality-option-${normalizedLabel || 'quality'}`;
}

function isQualityLevelSelected(level) {
  return qualityControlState.value.mode === 'manual' && qualityControlState.value.selectedHeight === level?.height;
}

function resolveQualityLevelStatusLabel(targetHeight) {
  if (targetHeight === mediaHandoffQualityModeAuto) {
    return 'Auto';
  }

  const matchedLevel = availableQualityLevels.value.find((level) => level.height === targetHeight);
  return matchedLevel?.label || `${targetHeight}p`;
}

function selectQualityLevel(targetHeight) {
  if (!player || typeof player.qualityLevels !== 'function') {
    return false;
  }

  const didApply = applyQualityLevelHeightLock(player.qualityLevels(), targetHeight);
  if (!didApply) {
    return false;
  }

  emitQualityLevels();
  syncQualitySelectorButtonLabel();
  syncControlSurfaceState();
  closeQualityMenu();
  emit(
    'status-update',
    targetHeight === mediaHandoffQualityModeAuto
      ? '畫質已切回 Auto'
      : `畫質已切換為 ${resolveQualityLevelStatusLabel(targetHeight)}`
  );
  return true;
}

function togglePlayback() {
  if (!player || typeof player.paused !== 'function') {
    return false;
  }

  if (player.paused() === true) {
    void player.play();
  } else {
    player.pause();
  }

  syncControlSurfaceState();
  return true;
}

async function requestPlayerShellFullscreen() {
  const shellElement = playerShellRef.value;
  const shellRequestFullscreen =
    shellElement?.requestFullscreen ||
    shellElement?.webkitRequestFullscreen ||
    shellElement?.webkitRequestFullScreen ||
    shellElement?.msRequestFullscreen;

  if (typeof shellRequestFullscreen === 'function') {
    await shellRequestFullscreen.call(shellElement);
    return true;
  }

  const mediaElement = resolveMediaElement();
  if (typeof mediaElement?.webkitEnterFullscreen === 'function') {
    mediaElement.webkitEnterFullscreen();
    return true;
  }

  if (typeof player?.requestFullscreen === 'function') {
    player.requestFullscreen();
    return true;
  }

  if (typeof player?.enterFullWindow === 'function') {
    player.enterFullWindow();
    return true;
  }

  return false;
}

async function exitPlayerShellFullscreen() {
  const ownerDocument = resolveOwnerDocument();
  const fullscreenElement = resolveDocumentFullscreenElement(ownerDocument);
  const documentExitFullscreen =
    ownerDocument?.exitFullscreen ||
    ownerDocument?.webkitExitFullscreen ||
    ownerDocument?.webkitCancelFullScreen ||
    ownerDocument?.msExitFullscreen;

  if (fullscreenElement && typeof documentExitFullscreen === 'function') {
    await documentExitFullscreen.call(ownerDocument);
    return true;
  }

  const mediaElement = resolveMediaElement();
  if (mediaElement?.webkitDisplayingFullscreen === true && typeof mediaElement.webkitExitFullscreen === 'function') {
    mediaElement.webkitExitFullscreen();
    return true;
  }

  if (typeof player?.isFullscreen === 'function' && player.isFullscreen() === true) {
    if (typeof player.exitFullscreen === 'function') {
      player.exitFullscreen();
      return true;
    }

    if (typeof player.exitFullWindow === 'function') {
      player.exitFullWindow();
      return true;
    }
  }

  return false;
}

function toggleMute() {
  if (!player || typeof player.muted !== 'function') {
    return false;
  }

  player.muted(player.muted() !== true);
  syncControlSurfaceState();
  wakeControlSurface();
  return true;
}

function handleVolumeInput(event) {
  if (!player || typeof player.volume !== 'function') {
    return;
  }

  const nextValue = Number(event?.target?.value);
  if (!Number.isFinite(nextValue)) {
    return;
  }

  const normalizedVolume = Math.max(0, Math.min(1, nextValue / 100));
  player.volume(normalizedVolume);
  player.muted(normalizedVolume === 0);
  syncControlSurfaceState();
  wakeControlSurface();
}

function handleProgressInput(event) {
  if (!player || !canSeek.value || typeof player.currentTime !== 'function') {
    return;
  }

  const sliderValue = Number(event?.target?.value);
  if (!Number.isFinite(sliderValue) || playerDurationSeconds.value <= 0) {
    return;
  }

  const nextTime = Math.max(0, Math.min(playerDurationSeconds.value, (sliderValue / 1000) * playerDurationSeconds.value));
  player.currentTime(nextTime);
  syncControlSurfaceState();
}

async function togglePictureInPicture() {
  if (typeof document === 'undefined') {
    return false;
  }

  const mediaElement = resolveMediaElement();
  if (!mediaElement || typeof mediaElement.requestPictureInPicture !== 'function') {
    return false;
  }

  try {
    if (document.pictureInPictureElement === mediaElement) {
      await document.exitPictureInPicture?.();
    } else {
      await mediaElement.requestPictureInPicture();
    }
    syncPictureInPictureState();
    return true;
  } catch (_) {
    syncPictureInPictureState();
    return false;
  }
}

async function toggleFullscreen() {
  if (!playerShellRef.value && !player) {
    return false;
  }

  let didToggle = false;

  try {
    didToggle = resolvePlayerFullscreenState()
      ? await exitPlayerShellFullscreen()
      : await requestPlayerShellFullscreen();
  } catch (_) {
    didToggle = false;
  }

  syncControlSurfaceState();
  if (didToggle) {
    wakeControlSurface();
  }

  return didToggle;
}

function closeCompactSettings(options = {}) {
  const { restoreFocus = true } = options;

  if (!isCompactSettingsOpen.value) {
    return;
  }

  isCompactSettingsOpen.value = false;
  closeQualityMenu();
  closePrimarySubtitleMenu();

  if (!restoreFocus) {
    return;
  }

  void nextTick(() => {
    compactSettingsTriggerRef.value?.focus?.();
  });
}

function openCompactSettings() {
  if (!isCompactPhoneViewport.value) {
    return;
  }

  closeQualityMenu();
  closePrimarySubtitleMenu();
  isCompactSettingsOpen.value = true;
  void nextTick(() => {
    compactSettingsPanelRef.value?.focus?.();
  });
}

function toggleCompactSettings() {
  if (isCompactSettingsOpen.value) {
    closeCompactSettings();
    return;
  }

  openCompactSettings();
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
  const buttonElement = primarySubtitleTriggerRef.value || controlBar?.getChild?.(primarySubtitleButtonComponentName)?.el?.();

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

  closeQualityMenu();
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

  closeCompactSettings({ restoreFocus: false });
  closeQualityMenu();
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
  if (!player || typeof player.qualityLevels !== 'function') {
    availableQualityLevels.value = [];
    return;
  }

  const levels = buildQualityLevelPayload(player.qualityLevels());
  availableQualityLevels.value = levels;
  emit('levels-loaded', levels);
}

function syncQualitySelectorButtonLabel() {
  if (!player) return;

  repositionSubtitleControlCluster();
  syncControlSurfaceState();

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

  closeCompactSettings({ restoreFocus: false });
  closePrimarySubtitleMenu();
  closeQualityMenu();
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
  syncControlSurfaceState();
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

  if (isQualityMenuOpen.value) {
    if (isEscapeKey(event)) {
      event.preventDefault?.();
      wakeControlSurface();
      closeQualityMenu();
    }
    return;
  }

  if (isPrimarySubtitleMenuOpen.value) {
    if (isEscapeKey(event)) {
      event.preventDefault?.();
      wakeControlSurface();
      closePrimarySubtitleMenu();
    }
    return;
  }

  if (isCompactSettingsOpen.value) {
    if (isEscapeKey(event)) {
      event.preventDefault?.();
      wakeControlSurface();
      closeCompactSettings();
    }
    return;
  }

  if (isHotkeyHelpOpen.value) {
    if (isEscapeKey(event) || isHelpHotkeyEvent(event)) {
      event.preventDefault?.();
      wakeControlSurface();
      if (isEscapeKey(event)) {
        closeHotkeyHelp();
      } else {
        toggleHotkeyHelp();
      }
    }
    return;
  }

  const didHandlePlaybackHotkey = applyPlaybackHotkey(event, player, {
    seekStepSeconds: SEEK_STEP_SECONDS,
    longSeekStepSeconds: LONG_SEEK_STEP_SECONDS,
    frameRate: props.frameRate,
    onToggleHelp: toggleHotkeyHelp,
    onToggleFullscreen: toggleFullscreen,
    onToggleSubtitles: toggleSubtitleVisibility,
  });

  if (didHandlePlaybackHotkey) {
    wakeControlSurface();
  }
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
      isControlSurfaceReady.value = true;
      bindPlaybackSnapshotListeners();
      bindStartupGateListeners();
      bindQualityLevelListeners();
      bindControlSurfaceListeners();
      player.on('xhr-hooks-ready', bindVhsXhrHooks);
      observeSubtitleCueDisplay();
      bindPictureInPictureListeners();
      player.on('texttrackchange', scheduleSubtitleCueRoleClassSync);
      player.on('playerresize', () => {
        scheduleSubtitleCueRoleClassSync();
        updatePlayerControlSafeArea();
        if (isPrimarySubtitleMenuOpen.value) {
          updatePrimarySubtitleMenuPosition();
        }
        if (isQualityMenuOpen.value) {
          updateQualityMenuPosition();
        }
        syncControlSurfaceState();
      });
      player.on('fullscreenchange', () => {
        scheduleSubtitleCueRoleClassSync();
        handleFullscreenStateChange();
      });
      ensurePrimarySubtitleControl();
      ensureSubtitleVisibilityToggleControl();
      ensureDualSubtitleSwapControl();
      updatePrimarySubtitleControl();
      syncPoster(props.posterUrl);
      syncControlSurfaceState();
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
  bindPlayerShellResizeObserver();
  bindPlayerShellActivityListeners();
  bindDocumentFullscreenListeners();
  window.addEventListener('keydown', handleGlobalKeydown);
});

watch(
  () => [props.m3u8Url, props.startTime, props.cid, props.gateway],
  ([newUrl, newStartTime, newCid, newGateway], [oldUrl, oldStartTime, oldCid, oldGateway] = []) => {
    if (!player) return;

    if (!newUrl) {
      closeCompactSettings({ restoreFocus: false });
      closeQualityMenu();
      closePrimarySubtitleMenu();
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

watch(isQualityMenuOpen, async (isOpen) => {
  if (!isOpen) {
    return;
  }

  await nextTick();
  updateQualityMenuPosition();
  qualityMenuRef.value?.focus?.();
});

watch(isCompactPhoneViewport, (isCompactViewport) => {
  updatePlayerControlSafeArea();
  if (!isCompactViewport) {
    closeCompactSettings({ restoreFocus: false });
  }
});

watch(isCompactSettingsOpen, async (isOpen) => {
  if (!isOpen) {
    return;
  }

  await nextTick();
  compactSettingsPanelRef.value?.focus?.();
});

watch(
  () => props.posterUrl,
  (newPosterUrl) => {
    syncPoster(newPosterUrl);
  }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  disconnectPlayerShellResizeObserver();
  unbindPlayerShellActivityListeners();
  unbindDocumentFullscreenListeners();
  closeCompactSettings({ restoreFocus: false });
  closeQualityMenu();
  closePrimarySubtitleMenu();
  isControlBarHovered.value = false;
  isPlayerUserActive.value = true;
  isControlSurfaceReady.value = false;
  unbindPictureInPictureListeners();
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
  --player-control-safe-area: 64px;
}

.video-player-shell:fullscreen,
.video-player-shell:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
  max-width: none;
  aspect-ratio: auto;
  border-radius: 0;
  background: #000;
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

.video-player-shell :deep(.vjs-text-track-display),
.video-player-shell .vjs-text-track-display {
  bottom: calc(var(--player-control-safe-area) + env(safe-area-inset-bottom, 0px)) !important;
}

.video-player-shell :deep(.vjs-control-bar),
.video-player-shell :deep(.vjs-big-play-button) {
  display: none !important;
}

.video-player-shell .vjs-control-bar,
.video-player-shell .vjs-big-play-button {
  display: none !important;
}

.player-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.player-control-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
  --player-control-surface-radius: 12px;
  --player-control-button-radius: 10px;
  --player-control-menu-radius: 12px;
}

.player-control-layer--idle {
  pointer-events: none;
}

.player-big-play-button,
.player-control-bar,
.quality-menu,
.quality-menu-item {
  pointer-events: auto;
}

.player-big-play-button {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 86px;
  height: 86px;
  transform: translate(-50%, -54%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(138, 223, 255, 0.34), transparent 62%),
    rgba(12, 18, 26, 0.74);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
  color: #f5fbff;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.player-big-play-button:hover {
  transform: translate(-50%, -54%) scale(1.04);
  background:
    radial-gradient(circle at 30% 30%, rgba(138, 223, 255, 0.42), transparent 62%),
    rgba(16, 24, 35, 0.82);
  box-shadow: 0 22px 56px rgba(0, 0, 0, 0.4);
}

.player-big-play-icon {
  width: 0;
  height: 0;
  margin-left: 6px;
  border-top: 15px solid transparent;
  border-bottom: 15px solid transparent;
  border-left: 24px solid currentColor;
}

.player-control-bar {
  --player-progress-thumb-size: 12px;
  --player-progress-rail-top-space: 4px;
  --player-progress-rail-bottom-space: 1px;
  width: calc(100% - 24px);
  max-width: 1120px;
  margin: 0 12px 8px;
  padding: 6px 10px calc(8px + env(safe-area-inset-bottom, 0px));
  border-radius: var(--player-control-surface-radius);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(16, 23, 31, 0.28), rgba(16, 23, 31, 0.14)),
    rgba(9, 14, 20, 0.58);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.player-control-bar--fullscreen {
  --player-progress-rail-top-space: 5px;
  --player-progress-rail-bottom-space: 2px;
  width: calc(100% - 40px);
  max-width: none;
  margin: 0 20px 16px;
  padding: 8px 14px calc(10px + env(safe-area-inset-bottom, 0px));
}

.player-control-bar.is-disabled {
  opacity: 0.76;
}

.player-control-bar.is-hidden {
  opacity: 0;
  transform: translateY(14px);
  pointer-events: none;
}

.player-progress-slider,
.player-volume-slider {
  width: 100%;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.player-progress-slider {
  height: 4px;
  border-radius: 999px;
  background:
    linear-gradient(
      90deg,
      rgba(138, 223, 255, 0.98) 0,
      rgba(138, 223, 255, 0.98) var(--player-progress-played, 0%),
      rgba(255, 255, 255, 0.36) var(--player-progress-played, 0%),
      rgba(255, 255, 255, 0.36) var(--player-progress-buffered, 0%),
      rgba(255, 255, 255, 0.12) var(--player-progress-buffered, 0%),
      rgba(255, 255, 255, 0.12) 100%
    );
}

.player-control-bar--fullscreen .player-progress-slider {
  height: 5px;
}

.player-volume-slider {
  height: 4px;
  border-radius: 999px;
  background:
    linear-gradient(
      90deg,
      rgba(138, 223, 255, 0.92) 0,
      rgba(138, 223, 255, 0.92) var(--player-volume-fill, 0%),
      rgba(255, 255, 255, 0.16) var(--player-volume-fill, 0%),
      rgba(255, 255, 255, 0.16) 100%
    );
}

.player-progress-slider::-webkit-slider-thumb,
.player-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: var(--player-progress-thumb-size);
  height: var(--player-progress-thumb-size);
  border: none;
  border-radius: 999px;
  background: #f5fbff;
  box-shadow: 0 0 0 2px rgba(138, 223, 255, 0.32);
}

.player-progress-slider::-moz-range-thumb,
.player-volume-slider::-moz-range-thumb {
  width: var(--player-progress-thumb-size);
  height: var(--player-progress-thumb-size);
  border: none;
  border-radius: 999px;
  background: #f5fbff;
  box-shadow: 0 0 0 2px rgba(138, 223, 255, 0.32);
}

.player-control-stack {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.player-control-stack--fullscreen {
  gap: 7px;
}

.player-control-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.player-control-group {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-block: 2px;
  margin-block: -2px;
  min-width: 0;
}

.player-control-group--transport {
  flex: 1 1 auto;
  justify-content: flex-start;
  padding-inline-start: 2px;
  margin-inline-start: -2px;
  min-width: 0;
}

.player-control-group--actions {
  flex: 0 1 auto;
  justify-content: flex-end;
  flex-wrap: nowrap;
  padding-inline: 2px 4px;
  margin-inline: -2px -4px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  scroll-padding-inline: 8px;
  -ms-overflow-style: none;
}

.player-control-group--actions::-webkit-scrollbar {
  display: none;
}

.player-action-btn {
  min-width: 36px;
  height: 32px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--player-control-button-radius);
  background: transparent;
  color: rgba(240, 247, 255, 0.86);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.player-action-btn:hover:not(:disabled),
.player-action-btn:focus-visible:not(:disabled),
.player-action-btn[aria-expanded='true']:not(:disabled),
.player-action-btn[aria-pressed='true']:not(:disabled) {
  background: rgba(138, 223, 255, 0.16);
  border-color: rgba(138, 223, 255, 0.3);
  color: #ffffff;
  transform: translateY(-1px);
}

.player-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.player-action-btn:focus-visible,
.player-progress-slider:focus-visible,
.player-volume-slider:focus-visible,
.quality-menu-item:focus-visible,
.player-big-play-button:focus-visible,
.hotkey-help-close:focus-visible {
  outline: 2px solid rgba(138, 223, 255, 0.82);
  outline-offset: 2px;
}

.player-action-chip {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.player-action-glyph {
  width: 100%;
  height: 100%;
  display: block;
  background-color: currentColor;
  -webkit-mask-image: var(--player-action-icon);
  mask-image: var(--player-action-icon);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.player-action-glyph--volume {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2.5-3.35v6.7A3.5 3.5 0 0 0 15.5 12zm-.2-8a1 1 0 0 1 .55 1.84 7.98 7.98 0 0 1 0 12.32 1 1 0 1 1-1.1-1.68 5.98 5.98 0 0 0 0-8.96A1 1 0 0 1 15.3 4z'/%3E%3C/svg%3E");
}

.player-action-glyph--volume-muted {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 9v6h4l5 4V5L8 9H4zm9.88 1.7 1.42-1.4L18 12l2.7-2.7 1.4 1.42L19.42 13.4l2.68 2.72L20.68 17.5 18 14.82l-2.68 2.68-1.42-1.38 2.72-2.72-2.74-2.7z'/%3E%3C/svg%3E");
}

.player-action-glyph--settings {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98L14.5 2.5a.5.5 0 0 0-.49-.4h-4a.5.5 0 0 0-.49.4l-.38 2.57c-.61.24-1.18.57-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.05.32-.08.65-.08.98s.03.66.08.98L2.48 14.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.51.41 1.08.74 1.69.98l.38 2.57a.5.5 0 0 0 .49.4h4a.5.5 0 0 0 .49-.4l.38-2.57c.61-.24 1.18-.57 1.69-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z'/%3E%3C/svg%3E");
}

.player-action-glyph--captions {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm3 4H5.8a1.8 1.8 0 0 0 0 4H7v-1H5.9a.8.8 0 1 1 0-2H7v-1zm5 0H9v4h3v-1h-2v-2h2v-1zm6 0h-1.2a1.8 1.8 0 0 0 0 4H18v-1h-1.1a.8.8 0 1 1 0-2H18v-1z'/%3E%3C/svg%3E");
}

.player-action-glyph--captions-primary {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 7h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 0 0 0 3H8v-1H6.8v-1H8v-1H6.5zm4 0H9.5v3h1v-1h1v-1h-1v-1zM20 4l2 3h-1.5v4h-1V7H18l2-3z'/%3E%3C/svg%3E");
}

.player-action-glyph--swap {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M7 7h9l-2.5-2.5L15 3l5 5-5 5-1.5-1.5L16 9H7V7zm10 10H8l2.5 2.5L9 21l-5-5 5-5 1.5 1.5L8 15h9v2z'/%3E%3C/svg%3E");
}

.player-action-glyph--quality {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 18h3v-6H4v6zm6 0h4V6h-4v12zm7 0h3v-9h-3v9z'/%3E%3C/svg%3E");
}

.player-action-glyph--pip {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v8h16V8H4zm9 5h5v3h-5v-3z'/%3E%3C/svg%3E");
}

.player-action-glyph--fullscreen {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M4 10V4h6v2H6v4H4zm10-6h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 4v-4h2v6h-6v-2h4z'/%3E%3C/svg%3E");
}

.player-action-glyph--fullscreen-exit {
  --player-action-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M10 10H4V4h2v4h4v2zm10 0h-6V8h4V4h2v6zM10 20H4v-6h2v4h4v2zm10 0h-6v-2h4v-4h2v6z'/%3E%3C/svg%3E");
}

.player-action-btn--quality {
  min-width: 36px;
}

.player-action-btn--volume {
  min-width: 36px;
}

.player-action-btn--settings {
  min-width: 34px;
  padding: 0;
}

.player-action-btn--play {
  min-width: 34px;
  padding: 0;
}

.player-action-btn--mute {
  min-width: 46px;
}

.player-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.player-action-icon--play {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 10px solid currentColor;
}

.player-action-icon--pause {
  position: relative;
  width: 10px;
  height: 11px;
}

.player-action-icon--pause::before,
.player-action-icon--pause::after {
  content: '';
  position: absolute;
  top: 0;
  width: 3px;
  height: 100%;
  border-radius: 999px;
  background: currentColor;
}

.player-action-icon--pause::before {
  left: 1px;
}

.player-action-icon--pause::after {
  right: 1px;
}

.player-progress-control {
  display: flex;
  align-items: center;
  min-height: calc(
    var(--player-progress-thumb-size) + var(--player-progress-rail-top-space) + var(--player-progress-rail-bottom-space)
  );
  padding-block: var(--player-progress-rail-top-space) var(--player-progress-rail-bottom-space);
}

.player-progress-control--rail {
  width: 100%;
  min-width: 0;
}

.player-time-readout {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 88px;
  min-height: 32px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: rgba(232, 238, 246, 0.84);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.player-time-divider {
  opacity: 0.48;
}

.player-control-bar--fullscreen .player-time-readout {
  min-width: 96px;
}

.player-volume-inline {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 0 1 120px;
}

.player-volume-inline--hover-reveal {
  overflow: hidden;
  padding-block: 2px;
  margin-block: -2px;
}

.player-volume-inline--panel {
  width: 100%;
  flex: 1 1 auto;
}

.compact-settings-value {
  margin: 0;
  color: rgba(232, 238, 246, 0.72);
  font-size: 0.72rem;
  font-weight: 600;
}

.player-volume-control--inline {
  width: 78px;
  min-width: 56px;
  display: inline-flex;
  align-items: center;
  flex: 1 1 auto;
}

.player-control-bar--fullscreen .player-volume-control--inline {
  width: 108px;
}

.compact-settings-inline--volume {
  display: grid;
  gap: 8px;
}

@media (hover: hover) and (pointer: fine) {
  .player-volume-inline--hover-reveal {
    --player-inline-volume-expanded-width: 78px;
    flex-basis: 36px !important;
    flex-grow: 0;
    flex-shrink: 0;
    transition: flex-basis 0.18s ease;
  }

  .player-control-bar--fullscreen .player-volume-inline--hover-reveal {
    --player-inline-volume-expanded-width: 108px;
  }

  .player-volume-inline--hover-reveal .player-volume-control--inline {
    width: 0 !important;
    min-width: 0 !important;
    opacity: 0;
    pointer-events: none;
    transition:
      width 0.18s ease,
      min-width 0.18s ease,
      opacity 0.12s ease;
  }

  .player-volume-inline--hover-reveal:hover,
  .player-volume-inline--hover-reveal:focus-within {
    flex-basis: calc(36px + var(--player-inline-volume-expanded-width) + 6px) !important;
  }

  .player-volume-inline--hover-reveal:hover .player-volume-control--inline,
  .player-volume-inline--hover-reveal:focus-within .player-volume-control--inline {
    width: var(--player-inline-volume-expanded-width) !important;
    min-width: var(--player-inline-volume-expanded-width) !important;
    opacity: 1;
    pointer-events: auto;
  }
}

.compact-settings-backdrop {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.08), rgba(7, 10, 18, 0.48)),
    radial-gradient(circle at bottom, rgba(138, 223, 255, 0.08), transparent 52%);
}

.compact-settings-panel {
  width: min(320px, calc(100% - 8px));
  max-height: min(360px, calc(100% - 8px));
  overflow: auto;
  padding: 14px;
  border-radius: calc(var(--player-control-menu-radius) + 2px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(12, 19, 28, 0.96), rgba(8, 13, 22, 0.98)),
    radial-gradient(circle at top right, rgba(138, 223, 255, 0.12), transparent 34%);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.44);
}

.compact-settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.compact-settings-kicker,
.compact-settings-title,
.compact-settings-section-title {
  margin: 0;
}

.compact-settings-kicker {
  color: rgba(180, 213, 255, 0.82);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.compact-settings-title {
  margin-top: 4px;
  color: #f4f7fb;
  font-size: 1rem;
  line-height: 1.2;
}

.compact-settings-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--player-control-button-radius);
  padding: 0;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.compact-settings-close:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}

.compact-settings-body {
  display: grid;
  gap: 12px;
}

.compact-settings-section {
  display: grid;
  gap: 8px;
}

.compact-settings-section-title {
  color: rgba(232, 238, 246, 0.62);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.compact-settings-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.quality-menu-backdrop {
  position: absolute;
  inset: 0;
  z-index: 4;
}

.quality-menu {
  position: absolute;
  min-width: 164px;
  padding: 10px;
  border-radius: var(--player-control-menu-radius);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 16, 23, 0.92);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.36);
}

.quality-menu-title {
  margin-bottom: 8px;
  color: rgba(232, 238, 246, 0.56);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.quality-menu-item {
  width: 100%;
  min-height: 38px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-radius: calc(var(--player-control-button-radius) - 1px);
  background: transparent;
  color: rgba(232, 238, 246, 0.9);
  cursor: pointer;
}

.quality-menu-item:hover {
  background: rgba(138, 223, 255, 0.12);
}

.quality-menu-item--selected {
  background: rgba(138, 223, 255, 0.18);
}

.quality-menu-item-label {
  font-size: 0.84rem;
  font-weight: 600;
}

.quality-menu-item-check {
  color: #8adfff;
  font-size: 0.84rem;
  font-weight: 700;
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
  border-radius: var(--player-control-menu-radius);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.92rem;
  height: 0.72rem;
  color: currentColor;
}

.primary-subtitle-menu-item-icon-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.primary-subtitle-menu-item-meta-icon--primary {
  opacity: 0.92;
}

.primary-subtitle-menu-item-meta-icon--secondary {
  opacity: 0.88;
}

.primary-subtitle-menu-item-meta-icon--local {
  opacity: 0.82;
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
  border-radius: var(--player-control-button-radius);
  width: 46px;
  height: 46px;
  padding: 0;
  color: #f6f7fb;
  background: rgba(255, 255, 255, 0.14);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 160ms ease, transform 160ms ease;
}

.startup-gate-action:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}

.startup-gate-action-icon {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-top: 9px solid transparent;
  border-bottom: 9px solid transparent;
  border-left: 14px solid currentColor;
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

@media (hover: hover) and (pointer: fine) {
  .video-player-shell--controls-idle,
  .video-player-shell--controls-idle :deep(.video-js),
  .video-player-shell--controls-idle .video-js,
  .video-player-shell--controls-idle video {
    cursor: none;
  }
}

@media (max-width: 720px) {
  .video-player-shell {
    --player-control-safe-area: 58px;
  }

  .player-big-play-button {
    width: 74px;
    height: 74px;
  }

  .player-control-bar {
    --player-progress-rail-top-space: 3px;
    --player-progress-rail-bottom-space: 1px;
    width: calc(100% - 16px);
    margin: 0 8px 6px;
    padding: 6px 8px calc(7px + env(safe-area-inset-bottom, 0px));
  }

  .player-control-bar--fullscreen {
    --player-progress-rail-top-space: 4px;
    --player-progress-rail-bottom-space: 1px;
    width: calc(100% - 20px);
    margin: 0 10px 10px;
    padding: 7px 10px calc(8px + env(safe-area-inset-bottom, 0px));
  }

  .player-control-stack {
    gap: 5px;
  }

  .player-control-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 38%);
    gap: 7px;
  }

  .player-progress-slider {
    height: 4px;
  }

  .player-control-group--transport {
    gap: 6px;
  }

  .player-action-btn--play {
    min-width: 34px;
  }

  .player-action-btn--volume {
    min-width: 34px;
  }

  .player-volume-inline {
    gap: 6px;
    flex-basis: 98px;
  }

  .player-volume-control--inline {
    width: 58px;
    min-width: 46px;
  }

  .player-time-readout {
    min-width: 68px;
    min-height: 32px;
    padding: 0;
    font-size: 0.68rem;
  }

  .player-control-group--actions {
    min-width: 0;
    flex: 0 1 auto;
    max-width: none;
    justify-content: flex-end;
    padding-inline: 2px 3px;
    margin-inline: -2px -3px;
  }

  .player-action-btn {
    min-width: 34px;
    height: 34px;
    flex: 0 0 auto;
    padding: 0 7px;
  }

  .player-action-btn--quality {
    min-width: 34px;
  }

  .player-action-chip {
    width: 15px;
    height: 15px;
    flex-basis: 15px;
  }

  .player-control-row--compact {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .player-control-row--compact .player-control-group--transport {
    gap: 6px;
  }

  .player-control-row--compact .player-time-readout {
    min-width: 62px;
  }

  .player-control-row--compact .player-control-group--actions {
    flex: 0 0 auto;
    max-width: none;
    overflow: visible;
  }

  .player-control-row--compact .player-action-btn--play,
  .player-control-row--compact .player-action-btn--settings {
    width: 34px;
    min-width: 34px;
    height: 34px;
  }

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
  .player-action-btn {
    min-width: 40px;
    height: 40px;
    padding: 0 8px;
  }

  .player-action-chip {
    font-size: 0.66rem;
  }

  .player-volume-control {
    width: 100%;
  }

  .player-volume-inline {
    gap: 5px;
    flex-basis: 86px;
  }

  .player-volume-control--inline {
    min-width: 42px;
  }

  .player-time-readout {
    min-width: 58px;
    font-size: 0.7rem;
  }

  .player-control-row {
    gap: 6px;
  }

  .player-control-group--actions {
    gap: 5px;
  }

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
