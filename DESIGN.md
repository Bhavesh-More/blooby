# Design — Material 3 Expressive, in blooby apricot

> a soft tonal canvas, white cards floating on it, one dark stage where the mascot lives,
> and springy motion on everything you touch

The tokens live once, in `packages/studio/src/index.css` `:root`; every app (web, admin, the
editor) loads that file, then `kit/kit.css` (shell, dashboard, sign-in, legal) and
`kit/tour.css`. Old token names (`--ink`, `--paper`, `--signal`, `--hot`…) are kept as
aliases onto the M3 roles, so a rule written against them is already correct — prefer the
role names in new CSS.

Reference: Material 3 Expressive (May 2025) — the ten-step corner scale, spring motion,
emphasized type, shape morphing, button groups, floating toolbars.

## Colour — roles, not hex

Generated with Material Color Utilities (content scheme) from the source **#FBBF79**, a warm
apricot. It is a **light** tone (HCT tone 81): wonderful as a fill, useless as a line or as
text on white (1.6:1). So the scheme splits it three ways — pick by what you are drawing:

| Role | Value | Use |
|---|---|---|
| `--brand` = `--primary` | `#FBBF79` | **fills**: filled buttons, the play FAB, the picked segment / tool / lane chip, user chat bubbles, the stopwatch and selected keyframe, and every mark on the dark stage (handles, pen points, snaps) |
| `--on-primary` | `#472A00` | text and icons on those fills (8:1) — never white |
| `--accent` (`--signal`) | `#AC7A3B` | **lines and marks on light surfaces**: focus rings, slider track + handle, playhead, selection outlines, drop lines, chart bars, status dots (3.75:1, the 3:1 UI minimum with room) |
| `--primary-text` | `#815519` | apricot **text and icons** on light surfaces (6.2:1) |
| `--primary-container` / `--on-…` | `#FFDDB9` / `#663E01` | toggles that are on, selected rows, hovered picks |
| `--secondary-container` / `--on-…` | `#F7E4CF` / `#402D15` | nav and tab indicators, tags, filter chips when on |
| `--tertiary` (+ container) | `#5C6321` / `#E1E998` | the scheme's olive: "new" dots, badges, clip-driven keyframes, publish chips |
| `--error` (+ container) | `#BA1A1A` / `#FFDAD6` | destructive and recording only |
| `--success` | `#2E7D4F` | saved, connected |
| `--surface-container` (`--paper`) | `#F7ECE4` | the warm canvas behind cards; resting input fill |
| `--surface-lowest` (`--panel`) | `#FFFFFF` | cards and panels |
| `--surface-low` / `-high` / `-highest` | `#FDF2E9` / `#F1E6DE` / `#EBE1D8` | sheets and menus / hovered fields / slider track |
| `--on-surface` (`--ink`) | `#201B16` | text |
| `--on-surface-variant` | `#504539` | secondary text and icons |
| `--muted` | `#6B5F52` | helper text (5.3:1 on the canvas) |
| `--line` / `--line-soft` | `#E6DACF` / `#F1E8DF` | hairlines — cards don't need them, dividers do |
| `--inverse-surface` / `--inverse-on-surface` | `#352F2A` / `#FAEFE6` | snackbars, tooltips, the playing play button, the current state tab |
| `--stage` | `#17161b` | the canvas and every thumbnail or preview of it — apricot marks read 11:1 on it |

State layers (M3): hover `--hover` (on-surface 8%), press `--press` (12%), laid over a fill as a
`background-image` gradient so one rule works for every tone. The **stage stays dark**
(`#17161b`) — the mascot is the colour.

## Shape — the ten-step scale

`--r-xs 4 · --r-sm 8 · --r-md 12 · --r-lg 16 · --r-lg-inc 20 · --r-xl 28 · --r-xl-inc 32 · --r-2xl 48 · --r-full`

- Anything you press rests **fully round** (`--r-btn`) and **squares off while pressed**
  (`--r-press`, 8) — M3E's shape morph. A toggle that is on swaps to `--r-md`.
- Panels 16, the stage and dialogs 28, dashboard cards 20 → 28 on hover.
- Connected button groups (`.seg`): outer ends round, inner joins 4px, the picked segment
  springs to a full pill in `--primary` with `--on-primary` text.
- Nested radius = outer − padding; never the same radius inside and out.

## Motion — springs

| Token | Curve | Duration | For |
|---|---|---|---|
| `--spring-fast` | `cubic-bezier(.42,1.67,.21,.90)` | `--t-fast` 350ms | presses, toggles, pops, carets |
| `--spring` | `cubic-bezier(.38,1.21,.22,1)` | `--t` 500ms | menus, dialogs, sheets, folds |
| `--spring-slow` | `cubic-bezier(.39,1.29,.35,.98)` | `--t-slow` 650ms | hero moments, chart bars |
| `--fx` / `--fx-fast` | `(.34,.8,.34,1)` / `(.31,.94,.34,1)` | 200 / 150ms | colour and opacity — never overshoot |

These are M3 Expressive's own web fallbacks for its spatial and effects springs. Spatial
things (position, size, shape) bounce; colour never does. Shared keyframes at the end of
index.css: `pop-in`, `scrim-in`, `dialog-in`, `menu-in`, `item-in`, `loading` (the morphing
loading indicator). **Everything stands still under `prefers-reduced-motion`** — one rule, the
last in index.css; don't add motion that bypasses it.

## Type

Google Sans Flex (UI and display) and Google Sans Code (numbers, timecode) from Google
Fonts. The editor is dense: 11.5–13px labels, 13.5px panel titles in sentence case (no
uppercase tracking), 20–36px display on the dashboard and legal pages. Numbers are always
mono with `tabular-nums`.

## Components

- **Top app bar** (editor): wordmark, editable project name pill, undo/redo, then on the right
  composition chip, What's new, help, the ⋯ menu (everything about the file), and **Export**,
  the single filled button.
- **Rail tabs**: icon over label with a pill indicator (`.tabs .tab-ico`) — Design, Effects,
  Eyes, States, AI.
- **Folds** (`Collapsible`, or `Panel fold={…}`): the header is one big press target; the body
  springs in. Rarely-used sections nest under a folded "More options".
- **Floating toolbar**: the stage tools, at the bottom centre of the canvas.
- **Menus / sheets / dialogs**: `--surface-low`, `--shadow-3`, spring in from where they hang.
- **Snackbar** (`.toast`) and **tooltip** (`.m3-tooltip`): inverse surface. `ui/Tooltips.tsx`
  turns every `title` into the styled tooltip — keep writing `title`s.
- **Slider**: 4px track filled in `--accent` to a slim bar handle that narrows while held;
  set `--fill` on the input where the value is known (PropRow does).

## Do / don't

- Do use roles; don't introduce a new hex. Canvas code that can't read variables (the graph
  editor) spells out the same role values with a comment.
- Do keep colour meaningful: brand for "active/selected", tertiary for "new/special", error
  for destructive. Don't use error red for anything that isn't.
- Don't put `--brand` on white as a line, a dot or text — that is what `--accent` and
  `--primary-text` are for. Don't put white text on `--brand`.
- Do give every new control a `title` — it becomes its tooltip.
- Don't animate colour with a spatial spring, or anything with a duration longer than 650ms.
- Don't put new controls straight into the top bar — the ⋯ menu or a fold is where
  occasional things go.
