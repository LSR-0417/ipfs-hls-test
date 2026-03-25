<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'local'].includes(value),
  },
});
</script>

<template>
  <svg viewBox="0 0 18 14" fill="none" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5" />

    <path
      v-if="variant === 'primary'"
      d="M4.5 9.25H13.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />

    <template v-else-if="variant === 'secondary'">
      <path
        d="M4.5 4.75H13.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M6 8.25H12"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        opacity="0.78"
      />
    </template>

    <template v-else>
      <rect x="7" y="4" width="4" height="3.25" rx="0.8" fill="currentColor" />
      <path
        d="M5.5 9.5H12.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>
  </svg>
</template>
