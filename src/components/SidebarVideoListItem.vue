<script setup>
import { computed } from 'vue';

const props = defineProps({
  tag: {
    type: String,
    default: 'article',
  },
  thumbnail: {
    type: String,
    default: '',
  },
  posterFallback: {
    type: String,
    default: '',
  },
  duration: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  secondaryText: {
    type: String,
    default: '',
  },
  tertiaryText: {
    type: String,
    default: '',
  },
  tertiaryVariant: {
    type: String,
    default: 'meta',
  },
  badgeTone: {
    type: String,
    default: 'accent',
  },
  accented: {
    type: Boolean,
    default: false,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  posterTestId: {
    type: String,
    default: '',
  },
  durationTestId: {
    type: String,
    default: '',
  },
  tertiaryTestId: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['click']);

const rootAttrs = computed(() =>
  props.tag === 'button'
    ? {
        type: 'button',
        disabled: props.disabled,
      }
    : {}
);

const tertiaryTag = computed(() => (props.tertiaryVariant === 'badge' ? 'span' : 'p'));
const tertiaryClasses = computed(() => ({
  'is-badge': props.tertiaryVariant === 'badge',
  'is-meta': props.tertiaryVariant === 'meta',
  'is-accent': props.tertiaryVariant === 'badge' && props.badgeTone !== 'warning',
  'is-warning': props.tertiaryVariant === 'badge' && props.badgeTone === 'warning',
}));

function handleClick(event) {
  if (props.disabled) {
    return;
  }

  emit('click', event);
}
</script>

<template>
  <component
    :is="tag"
    class="sidebar-video-list-item"
    :class="{
      'is-selected': selected,
      'is-disabled': disabled,
      'is-accented': accented,
    }"
    v-bind="rootAttrs"
    @click="handleClick"
  >
    <img
      v-if="thumbnail"
      :src="thumbnail"
      :alt="title"
      class="sidebar-video-list-item-poster"
      :data-testid="posterTestId || undefined"
    />
    <span v-else class="sidebar-video-list-item-poster-fallback">
      {{ posterFallback }}
    </span>
    <span
      v-if="duration"
      class="sidebar-video-list-item-duration"
      :data-testid="durationTestId || undefined"
    >
      {{ duration }}
    </span>
    <h3 class="sidebar-video-list-item-title">{{ title }}</h3>
    <p v-if="secondaryText" class="sidebar-video-list-item-secondary">
      {{ secondaryText }}
    </p>
    <component
      :is="tertiaryTag"
      v-if="tertiaryText"
      class="sidebar-video-list-item-tertiary"
      :class="tertiaryClasses"
      :data-testid="tertiaryTestId || undefined"
    >
      {{ tertiaryText }}
    </component>
  </component>
</template>

<style scoped>
.sidebar-video-list-item {
  position: relative;
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  grid-template-areas:
    'poster title'
    'poster secondary'
    'poster tertiary';
  align-items: flex-start;
  column-gap: 12px;
  row-gap: 4px;
  width: 100%;
  padding: 8px 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  box-shadow: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.sidebar-video-list-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
}

.sidebar-video-list-item:disabled {
  cursor: not-allowed;
}

.sidebar-video-list-item.is-selected {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-video-list-item.is-disabled {
  opacity: 0.56;
}

.sidebar-video-list-item-poster,
.sidebar-video-list-item-poster-fallback,
.sidebar-video-list-item-duration {
  grid-area: poster;
}

.sidebar-video-list-item-poster,
.sidebar-video-list-item-poster-fallback {
  width: 100%;
  aspect-ratio: 16 / 9;
  align-self: start;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgba(0, 210, 255, 0.18), transparent 55%),
    linear-gradient(180deg, rgba(21, 29, 48, 0.95), rgba(10, 16, 28, 0.9));
}

.sidebar-video-list-item-poster {
  display: block;
  object-fit: cover;
}

.sidebar-video-list-item-poster-fallback {
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.7);
  outline: 1px dashed rgba(255, 255, 255, 0.18);
  outline-offset: -1px;
}

.sidebar-video-list-item-duration {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  align-self: end;
  min-height: 20px;
  margin: 0 6px 6px 0;
  padding: 0 6px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 1;
}

.sidebar-video-list-item-title {
  grid-area: title;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sidebar-video-list-item.is-accented .sidebar-video-list-item-title {
  color: rgba(61, 197, 255, 0.96);
}

.sidebar-video-list-item-secondary {
  grid-area: secondary;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sidebar-video-list-item-tertiary {
  grid-area: tertiary;
  min-width: 0;
  margin: 0;
}

.sidebar-video-list-item-tertiary.is-meta {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sidebar-video-list-item-tertiary.is-badge {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  min-height: 18px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sidebar-video-list-item-tertiary.is-badge.is-accent {
  color: rgba(61, 197, 255, 0.96);
}

.sidebar-video-list-item-tertiary.is-badge.is-warning {
  color: rgba(255, 214, 168, 0.98);
}

@media (max-width: 1024px) {
  .sidebar-video-list-item {
    grid-template-columns: 104px minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .sidebar-video-list-item {
    grid-template-columns: 1fr;
    grid-template-areas:
      'poster'
      'title'
      'secondary'
      'tertiary';
  }
}
</style>
