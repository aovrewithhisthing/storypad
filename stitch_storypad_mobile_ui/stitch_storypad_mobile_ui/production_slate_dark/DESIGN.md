---
name: Production Slate Dark
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
  code-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an uncompromising, mission-critical workspace tailored for on-set script supervisors, digital imaging technicians (DITs), and post-production video editors. Operating within high-stress, low-light video village environments or multi-monitor grading bays, the interface rejects decorative embellishments in favor of extreme operational efficiency, immediate visual hierarchy, and zero eye fatigue.

The aesthetic is purely functional minimalism driven by flat architectural surfacing:
- **Absolute Surface Integrity:** No linear gradients, radial washes, frosted blurs, or drop shadows. Every panel is an opaque, solid-color plane.
- **Precision Contrast:** Boundaries are established through distinct solid borders and stepped surface lightness, preserving readability under varying monitor calibrations and harsh set lighting.
- **Utilitarian Speed:** Visual noise is minimized to prioritize critical telemetry, take statuses, timecodes, and metadata.

## Colors

The palette employs strictly solid swatches calibrated for dark-room operation, color-accurate monitoring, and critical status differentiation.

### Palette Architecture
- **Canvas Base (`#0F1115`):** Solid obsidian base background. Provides deep black depth without pure zero-black pixel clipping.
- **Panel Primary (`#1A1D24`):** Solid base container surface for primary panels, timelines, and inspector decks.
- **Panel Elevated (`#21252E`):** Solid active surface for modal windows, active slate items, nested lists, and input wells.
- **Structural Borders (`#2A2E39` / `#373C4A`):** Crisp 1px solid architectural dividers. `#2A2E39` provides structural layout segregation; `#373C4A` frames interactive targets, hover states, and card outlines.
- **Primary Accent (`#3B82F6`):** Vibrant cobalt blue used selectively for active selections, focused tools, playback heads, and primary confirmation buttons.
- **Operational Statuses:**
  - **Good Take / Verified (`#10B981`):** Solid emerald green for circled takes, verified audio sync, and export completion.
  - **Alert / Review Required (`#F59E0B`):** Solid amber for false takes, missing metadata, dropped frames, and hold statuses.
  - **Critical Failure / Slate Cut (`#EF4444`):** Solid punchy red reserved exclusively for recording tally flags, audio distortion clips, and take aborts.
- **Text Layers:**
  - **Text Primary (`#FFFFFF` / `#F3F4F6`):** High-contrast optical white for critical readouts, take numbers, and active labels.
  - **Text Secondary (`#9CA3AF`):** Muted cool gray for non-urgent metadata, scene breakdowns, and inactive states.
  - **Technical / Script Data (`#E2E8F0`):** Crisp neutral for timecodes, reel IDs, and scene dialogue logs.

## Typography

Inter serves as the single typeface across all levels, configured to maximize neutral, rapid legibility. 

- **Tabular Figures:** All numeric displays (timecodes, take counters, clip durations, audio levels) must enforce monospaced numbers (`font-feature-settings: "tnum"`).
- **Labels & Statuses:** Operational labels use `label-sm` with tight uppercase tracking (`letter-spacing: 0.05em`) to provide clear visual anchors without encroaching on content area.
- **Hierarchy Rules:** Never use light font weights (`300` or below) on dark surfaces to prevent subpixel antialiasing degradation. Regular (`400`) handles continuous text, SemiBold (`600`) anchors data headers, and Bold (`700`) is reserved for major slate or reel callouts.

## Layout & Spacing

The layout model is governed by high-density, multi-panel structural framing configured for dual-monitor edit suites and portable tablet rigs.

### Grid & Density Architecture
- **Desktop/DIT Stations:** Fluid multi-column panel workspace (Timeline, Clip Bin, Metadata Inspector, Script Log) bounded by rigid `1px` borders. Gutters maintain a compact `1.25rem` spacing to maximize usable screen real estate.
- **Set Tablets / Field Devices:** Collapsible dual-pane layout converting to a tabbed single-column view below `768px`. Margins lock to `1rem`.
- **Rhythm:** Built strictly on an 8pt spatial grid with a 4pt sub-step (`0.25rem` = 4px, `0.5rem` = 8px, `0.75rem` = 12px, `1.25rem` = 20px, `2rem` = 32px).
- **Component Compactness:** Data tables, audio meters, and shot logs utilize `space-xs` and `space-sm` for dense row structures, ensuring maximum take entries remain visible above the fold without scrolling.

## Elevation & Depth

This system intentionally eliminates all drop shadows, ambient blurs, and glassmorphic translucencies to keep monitors accurate and prevent ambient light simulation.

- **Flat Tonal Hierarchy:** Depth is created exclusively by stacking solid fills:
  - Level 0 (Base Canvas): `#0F1115`
  - Level 1 (Primary Panels & Toolbars): `#1A1D24`
  - Level 2 (Nested Decks, Inputs, Inactive Buttons): `#21252E`
  - Level 3 (Active Popovers, Modal Dialogs, Tooltips): `#2A2E39`
- **Architectural Seams:** Surfaces are separated by solid 1px borders in `#2A2E39` or `#373C4A`. A lighter border stacked on a darker panel instantly establishes foreground separation without blurring pixels.
- **Focus Rings:** High-visibility 2px solid `#3B82F6` borders with zero offset designate active keyboard focus and recording selections.

## Shapes

The design system employs a disciplined, soft-cornered industrial profile (`roundedness: 1`):

- **Micro Components (Buttons, Chips, Badges, Inputs):** `0.25rem` (4px). Keeps controls looking crisp, mechanical, and aligned to grid tracks.
- **Card Panels & Modal Frames:** `0.5rem` (8px). Softens larger viewport panels slightly while keeping them distinctly structural.
- **Video Players, Monitor Feeds, and Scopes:** Strict `0px` sharp corners to preserve exact raster edges and framing lines.
- **Prohibited:** Full pill shapes, circular buttons (except dedicated transport record toggles), and organic curves.

## Components

### Buttons & Transport Triggers
- **Primary Action (Log Take, Save Marker):** Solid `#3B82F6` background, solid `#FFFFFF` text, `0.25rem` border radius. Hover: Solid `#2563EB`. Active: Solid `#1D4ED8`. No gradients or glows.
- **Secondary (Add Note, Split Take):** Solid `#21252E` background, 1px solid border `#373C4A`, text `#F3F4F6`. Hover: Solid `#2A2E39` background with `#E2E8F0` text.
- **Status / Circled Take Button:** Solid `#10B981` background, `#FFFFFF` bold text.
- **Destructive / Cut Take:** Solid `#EF4444` background, `#FFFFFF` text.

### Badges & Status Chips
- **Circled Take / Good:** Solid `#10B981` fill with `#FFFFFF` text, or solid `#1A1D24` panel with a 1px solid `#10B981` border and `#10B981` text.
- **Hold / False Start:** Solid `#F59E0B` fill with `#0F1115` bold text.
- **Metadata Tag (Lens, Scene, Cam Angle):** Solid `#21252E` surface, 1px solid border `#2A2E39`, `#9CA3AF` text, `0.25rem` radius, padded at `2px 8px`.

### Data Lists & Script Log Tables
- **Row Styling:** Alternate background rows use `#1A1D24` and `#16191F`. Separated by 1px solid `#2A2E39` horizontal rules.
- **Selected Row (Active Take):** Solid `#21252E` background with a solid 3px vertical accent strip on the left edge colored `#3B82F6`.
- **Text Alignment:** Timecodes and frame counts are right-aligned or strictly tabular; scene/slate names are left-aligned.

### Input Fields & Metadata Editors
- **State Neutral:** Solid `#1A1D24` background, 1px solid border `#2A2E39`, `#F3F4F6` text, `0.25rem` radius.
- **State Focused:** Solid `#21252E` background, 1px solid outline `#3B82F6`.
- **Monospace Code/Timecode Inputs:** Rendered with tabular numbers, solid `#0F1115` inset background, `#E2E8F0` text.

### Panels & Cards
- **Base Card:** Solid `#1A1D24` background, 1px solid border `#2A2E39`, zero elevation shadows, internal padding of `space-md` (`0.75rem`).
- **Header Dock:** Solid `#16191F` background, bordered bottom by 1px solid `#2A2E39`, padding `space-sm` (`0.5rem`).

### Specialized Production Components
- **Slate Tally Indicator:** A solid 4px top border band that toggles between solid `#EF4444` (Rolling/Recording) and `#2A2E39` (Standby).
- **Timecode Scrubber Track:** Solid `#21252E` track base, solid `#3B82F6` elapsed bar, solid `#FFFFFF` 2px vertical needle indicator.