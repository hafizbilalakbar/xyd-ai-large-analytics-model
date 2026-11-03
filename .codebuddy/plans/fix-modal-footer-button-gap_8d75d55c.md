---
name: fix-modal-footer-button-gap
overview: Fix the modal footer button gap issue. The root cause is that `.modal__footer` (flex container with gap:12px) has only one direct child — the projected `<div modalFooter>` wrapper — so the gap never applies between the actual buttons. The fix uses `::ng-deep` to make the projected footer wrapper itself a flex container with the gap, plus responsive rules, in `modal.component.scss` only.
todos:
  - id: fix-modal-footer-gap
    content: "Edit modal.component.scss: replace .modal__footer gap rule with :host ::ng-deep [modalFooter] flex+gap, add button sizing rules, add ≤640px and ≤360px responsive media queries"
    status: completed
  - id: verify-build
    content: Run ng build and confirm zero errors
    status: completed
    dependencies:
      - fix-modal-footer-gap
  - id: verify-git-status
    content: Run git status to confirm only modal.component.scss changed and 5 YAML files deleted
    status: completed
    dependencies:
      - fix-modal-footer-gap
---

## Product Overview

Fix modal footer buttons that touch each other across all modal popups in the Angular application. The gap between buttons is not being applied due to Angular content projection and emulated view encapsulation.

## Root Cause

The `.modal__footer` flex container has `gap: 12px`, but its only direct child is the projected `<div modalFooter>` wrapper from the parent component. The actual `<button>` elements are nested inside that wrapper, not direct children of `.modal__footer`. Angular's emulated encapsulation means the `.modal__footer` styles (scoped to `ModalComponent`) apply to the `<div class="modal__footer">` element itself, but the projected `<div modalFooter>` wrapper is not a flex container — so the two buttons inside it touch with zero gap.

## Affected Popups (5 total)

- **Sample Details** modal: "Edit" + "Close" buttons (in `review-checklist-table.component.html`)
- **Edit Sample** modal: "Cancel" + "Save" buttons (in `review-checklist-table.component.html`)
- **Delete confirm** dialog: "Cancel" + "Delete" buttons (via `app-confirm-dialog`)
- **Bulk delete confirm** dialog: "Cancel" + "Delete" buttons (via `app-confirm-dialog`)
- **Discard changes?** dialog: "Keep editing" + "Discard" buttons (via `app-confirm-dialog`)

## Core Fix Requirements

- Make the projected `[modalFooter]` wrapper the real flex container with gap, using `::ng-deep` to pierce encapsulation
- Desktop: `display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-wrap: nowrap`
- Buttons: height 36px, padding 0 16px, font-size 14px, border-radius 6px, no margin, `white-space: nowrap; text-overflow: ellipsis; overflow: hidden`
- Under 640px: footer padding 12px 16px, gap 10px, buttons height 34px, font-size 13px, padding 0 12px, `flex: 1 1 0; min-width: 0`
- Under 360px: buttons stack vertically, full width, gap 8px, primary action on top
- Fix applied from one shared place (`modal.component.scss`) so all 5 popups are fixed simultaneously

## Tech Stack

- Angular standalone components with `ChangeDetectionStrategy.OnPush`
- SCSS with Angular emulated view encapsulation (`ViewEncapsulation.Emulated` by default)
- CSS custom properties (`--font-size-sm`, `--color-*`) defined in `src/styles/_base.scss`
- No new libraries or dependencies

## Root Cause Analysis (Detailed)

DOM structure rendered by Angular:

```
<div class="modal__footer" _ngcontent-modalABC>        ← ModalComponent's own element, has gap:12px
  <div modalFooter _ngcontent-parentXYZ>                ← PROJECTED content, single direct child
    <button class="btn btn-reset">Cancel</button>       ← nested inside projected wrapper
    <button class="btn btn-danger">Delete</button>      ← nested inside projected wrapper
  </div>
</div>
```

- `gap: 12px` on `.modal__footer` applies between its **direct children** — but there is only ONE direct child (the projected `<div modalFooter>`), so the gap has no effect on the buttons.
- The projected `<div modalFooter>` wrapper is **not** a flex container, so the buttons inside it render with no gap.
- Angular's emulated encapsulation adds `_ngcontent-{hash}` attributes to elements in a component's own template. The projected `<div modalFooter>` belongs to the parent component's template, not `ModalComponent`'s, so it gets the parent's hash — meaning `ModalComponent`'s scoped styles cannot target it without `::ng-deep`.

## Implementation Approach

Use `:host ::ng-deep` in `modal.component.scss` to target the projected `[modalFooter]` wrapper and its button children, piercing encapsulation. This is the single shared fix point — all 5 popups project their footer content through `[modalFooter]`, so one rule fixes all.

### Key Decisions

1. **`::ng-deep` is the correct solution** because the gap must apply to projected content that Angular's emulated encapsulation blocks. `::ng-deep` is Angular's official mechanism for styling projected content from a host component.
2. **Single fix point in `modal.component.scss`** — no changes needed to `confirm-dialog.component.scss` or `review-checklist-table.component.scss` for the gap itself, since the `[modalFooter]` selector catches all projected footer content.
3. **Button sizing via `::ng-deep .btn`** in `modal.component.scss` — override height/padding/font-size/border-radius/margin on footer buttons from the shared modal styles, ensuring consistency across all popups regardless of which component defines the `.btn` class locally.
4. **Responsive behavior**: Replace the current `display: grid` at ≤640px with flex-based rules that properly handle gap, equal-width buttons, and vertical stacking at ≤360px.

## Implementation Notes

- **No comments** in the code per strict requirement.
- **No new files** — only edit existing `modal.component.scss`.
- **Preserve all existing changes** — the files already modified in git (`review-checklist-table.*`, `confirm-dialog.*`, `modal.*`, `toast-container.*`, `toast.service.ts`, etc.) must retain their current content; only the footer/button spacing rules change.
- **Blast radius**: The `::ng-deep` rules are scoped via `:host` so they only apply within `app-modal`'s view boundary — they will not leak to other components in the app.
- **`--font-size-sm`** is `0.875rem` = 14px, matching the desktop requirement. For ≤640px, hardcode `13px` as required.
- **`ng build`** must pass with zero errors — SCSS changes are purely CSS, no TypeScript impact.

## Directory Structure

```
src/app/shared/components/modal/
├── modal.component.html    # [NO CHANGE] Template is correct — ng-content select="[modalFooter]"
├── modal.component.scss    # [MODIFY] Fix footer flex/gap via ::ng-deep on [modalFooter], responsive rules
└── modal.component.ts      # [NO CHANGE] No style logic
```

Only **one file** is modified: `modal.component.scss`. All other files remain untouched.

### `modal.component.scss` — Modifications

**What changes:**

1. `.modal__footer` (lines 74-81): Add `align-items: center; flex-wrap: nowrap;` to the existing rule. Keep `display: flex; justify-content: flex-end; padding; border-top; flex-shrink: 0`. Remove `gap: 12px` from here (it has no effect on projected children — move it to the `::ng-deep` rule below).
2. **New rule**: `:host ::ng-deep .modal__footer [modalFooter]` — make the projected wrapper the real flex container: `display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-wrap: nowrap;`
3. **New rule**: `:host ::ng-deep .modal__footer [modalFooter] .btn` — enforce button sizing: `height: 36px; padding: 0 16px; font-size: 14px; border-radius: 6px; margin: 0; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;`
4. **≤640px media query**: Replace the current `display: grid` block with: `.modal__footer { padding: 12px 16px; }` + `:host ::ng-deep .modal__footer [modalFooter] { gap: 10px; }` + `:host ::ng-deep .modal__footer [modalFooter] .btn { flex: 1 1 0; min-width: 0; height: 34px; font-size: 13px; padding: 0 12px; }`
5. **≤360px media query (new)**: `:host ::ng-deep .modal__footer [modalFooter] { flex-direction: column-reverse; gap: 8px; }` + `:host ::ng-deep .modal__footer [modalFooter] .btn { flex: 1 1 auto; width: 100%; }` — `column-reverse` puts the primary (last) button visually on top.

**What stays the same:** All other rules in the file (`.modal-overlay`, `.modal`, `.modal--md`, `.modal--lg`, `.modal__header`, `.modal__title`, `.modal__close`, `.modal__body`, the ≤640px `.modal-overlay` and `.modal` rules).