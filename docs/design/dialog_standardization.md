# Gateway Dialog Standard

## Purpose

This document records the current standardized design and interaction rules for the gateway switch dialog implemented in `src/components/Header.vue`.

Target viewport range:
- Mobile minimum: iPhone 13 mini (`375 x 812`)
- Large desktop maximum: 4K (`3840 x 2160`)

## Current Structure

The dialog uses a shared shell pattern:

```text
dialog shell
|- header
|- scrollable body
|- footer
```

Rules:
- The fixed area only contains title and description.
- The body is the only scrollable region.
- The footer stays visible and contains the primary actions.

## Size And Responsive Rules

### Desktop

- Use a centered form dialog.
- Width: `min(640px, calc(100vw - 48px))`
- Max height: `min(84dvh, 960px)`
- Keep outer backdrop padding so the dialog never touches the viewport edge.

### Mobile

- Switch to a true bottom-sheet layout below `768px`.
- Width: `100%`
- Max height: `min(92dvh, 100dvh)`
- Top corners stay rounded.
- Footer includes safe-area bottom padding.
- Keep a stronger frosted-glass treatment than desktop so copy remains readable over active page content.
- Use layered dark gradients plus panel blur; do not fall back to a fully opaque solid sheet.
- Header and footer may carry slightly stronger separation than the scroll body to keep title and actions readable.

## Header Rules

The header is intentionally minimal:
- Title: `Switch Gateway`
- Description: one short line explaining the action
- No close `X`

Dismiss behavior is standardized through:
- `Cancel`
- `Escape`
- backdrop click

## Footer Rules

- Footer buttons always stay horizontal.
- On narrow screens, `Cancel` and `Apply` are equal-width.
- On wider screens, `Apply` keeps slightly stronger emphasis.
- If the selected target differs from the current gateway, show a short summary above the buttons:

Examples:
- `Switch from Local Node to dweb.link`
- `Use Custom Gateway`

If the selected gateway already matches the current gateway, no summary is shown.

## Body Information Hierarchy

Current order:

1. `Available Gateways` section header
2. `Recheck Now` action
3. Gateway choice list
4. Conditional advanced settings
5. Validation error, when needed

The dialog does **not** show a separate current-gateway summary card anymore. Current state is already represented inside the gateway list.

## Gateway Card Semantics

Each gateway option card represents two different concepts:

### Current

`Current` means the gateway currently in use by the player.

Visual treatment:
- stronger cyan-accented card treatment
- `Current` badge

### Selected

`Selected` means the gateway currently chosen by the radio control as the next target.

Visual treatment:
- radio indicator fill
- `Selected` badge

Important rule:
- `Selected` must not add card-level glow or frame effects
- card emphasis belongs to `Current`, not to the temporary radio target

### Current Selection

When the current gateway and selected gateway are the same item, show:
- `Current Selection`

This replaces separate `Current` and `Selected` badges in that state.

### Recommended

If probe results identify the best ready gateway, show:
- `Recommended`

This is independent from `Current` and `Selected`.

## Gateway Card Content

Each option card shows:
- radio selector
- health dot
- gateway name
- state badges
- short description
- endpoint / hostname
- probe status text

This is enough to support the selection decision without needing a separate summary panel.

## Progressive Disclosure

Advanced fields are only shown when relevant:

- `Local Node Settings` only appears when `Local Node` is selected
- `Custom Gateway` form only appears when `Custom Gateway` is selected

This keeps the default dialog height compact on both desktop and mobile.

## Interaction Rules

- Opening the dialog moves focus into the dialog.
- Closing the dialog returns focus to the trigger button.
- Focus is trapped while the dialog is open.
- `Escape` closes the dialog.
- Dialog root uses `role="dialog"` and `aria-modal="true"`.
- The dialog description is wired through `aria-describedby`.

## Validation And Errors

- Invalid custom gateway input keeps the dialog open.
- Error messages appear inline above the footer.
- The footer summary only describes target switching intent; validation messaging stays separate.

## Verification

The standardized behavior is currently covered by:
- `npm test`
- `npm run test:e2e`

Responsive end-to-end checks cover:
- iPhone 13 mini bottom-sheet layout
- FHD centered desktop layout
- conditional advanced settings
- current vs selected gateway state behavior
