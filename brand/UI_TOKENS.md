# 3Diner UI Tokens

These tokens are the brand contract for dashboard and customer UI work.

## Core Colors

| Token | Hex | Role |
| --- | --- | --- |
| Navy | `#022C60` | Primary brand structure, headings, dark surfaces |
| Navy Dark | `#002355` | Deep background, footer, dashboard base |
| Navy Soft | `#254473` | Hover states, soft borders, secondary structure |
| Navy Muted | `#51698F` | Muted text and inactive icons |
| Orange | `#FD5002` | Primary CTA, active navigation, highlight |
| Orange Bright | `#FC6A41` | Hover and warm emphasis |
| Orange Tint | `#FDD8C3` | Badge fills, soft alerts, light highlight |
| Off White | `#FDFDFD` | Primary light surface |
| Paper | `#F6F8FB` | Light app background |
| Border | `#CFD9E4` | Dividers, card borders |
| Surface | `#E0E7EE` | Light inactive surface and skeleton base |

## Dashboard Dark Tokens

| Token | Hex / Value | Role |
| --- | --- | --- |
| Dashboard Canvas | `#060E1B` | Main admin background |
| Dashboard Sidebar | `#0B1728` | Sidebar base |
| Dashboard Panel | `#0D1829` | Cards and panels |
| Dashboard Raised | `#132136` | Inputs, active controls, elevated surfaces |
| Dashboard Border | `rgba(255,255,255,0.07)` | Hairline borders |
| Dashboard Text | `#E9EEF6` | Primary text on dark |
| Dashboard Muted | `#5A7898` | Subtle labels |
| Dashboard Secondary | `#9FB6D1` | Secondary text |

## Semantic Colors

| Token | Hex | Role |
| --- | --- | --- |
| Success | `#22D3A6` | Healthy stock, completed order |
| Teal | `#00C2A8` | 3D model and positive engagement accent |
| Warning | `#F59E0B` | Low stock, pending attention |
| Danger | `#EF4444` | Critical stock, destructive action |

## Usage Ratio

- 70 percent navy, dark surfaces, and cool neutrals.
- 20 percent white/off-white or readable text.
- 10 percent orange accent.

Orange must stay special. Do not flood the interface with orange cards, orange text everywhere, or orange backgrounds on every component.

## Typography

Primary brand font:

- Poppins for brand identity, dashboard, and customer-facing UI.

Allowed product font fallback:

```css
font-family: "Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Guidelines:

- Headings: 600 to 800 weight.
- Body: 400 to 500 weight.
- Numeric metrics: 700 to 800 weight, use tabular numerals where possible.
- Do not use serif fonts in dashboard UI.
- Do not introduce Inter as a new default.

## Radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | `8px` | Small badges, compact controls |
| `--radius-sm` | `12px` | Inputs, buttons, small cards |
| `--radius-md` | `16px` | Dashboard panels and cards |
| `--radius-lg` | `20px` | Large surfaces |
| `--radius-pill` | `999px` | Pills and segmented controls |

Use one consistent radius rule per surface type. Do not mix random rounded styles.

## Shadows

Light UI:

```css
--shadow-card: 0 4px 14px rgba(2,44,96,0.08), 0 2px 4px rgba(2,44,96,0.05);
--shadow-orange: 0 6px 20px rgba(253,80,2,0.30);
```

Dashboard dark UI:

```css
--shadow-dashboard: 0 18px 48px rgba(0, 0, 0, 0.22);
```

Use shadows sparingly. Dashboard depth should mostly come from surface contrast, borders, and hierarchy.

## Focus Ring

```css
outline: 2px solid #FD5002;
outline-offset: 2px;
```

## Chart Palette

Use chart colors in this order:

1. Orange `#FD5002`
2. Teal `#00C2A8`
3. Success `#22D3A6`
4. Warning `#F59E0B`
5. Muted Navy `#51698F`
6. Danger `#EF4444` only for critical states

## CSS Token Starter

```css
:root {
  --color-navy: #022C60;
  --color-navy-dark: #002355;
  --color-navy-soft: #254473;
  --color-navy-muted: #51698F;
  --color-orange: #FD5002;
  --color-orange-bright: #FC6A41;
  --color-orange-tint: #FDD8C3;
  --color-white: #FDFDFD;
  --color-paper: #F6F8FB;
  --color-border: #CFD9E4;
  --color-surface: #E0E7EE;

  --dash-canvas: #060E1B;
  --dash-sidebar: #0B1728;
  --dash-panel: #0D1829;
  --dash-raised: #132136;
  --dash-text: #E9EEF6;
  --dash-muted: #5A7898;
  --dash-secondary: #9FB6D1;
  --dash-border: rgba(255,255,255,0.07);

  --semantic-success: #22D3A6;
  --semantic-teal: #00C2A8;
  --semantic-warning: #F59E0B;
  --semantic-danger: #EF4444;
}
```
