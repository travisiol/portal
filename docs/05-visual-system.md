# PORTAL — Visual system

Interstellar × infrastructure × Nothing × Apple industrial × physics lab.
Nearly monochrome. Cyan is *energy* — it exists only where something is
active: the portal, a found route, a travelling pulse, the primary CTA.

## Tokens (`src/app/globals.css`)

| Token            | Value     | Use                                            |
|------------------|-----------|------------------------------------------------|
| `--bg`           | `#050607` | page                                           |
| `--bg-2`         | `#0A0C0F` | panels, modal                                  |
| `--graphite`     | `#14171B` | hairlines, inactive route lines, inputs        |
| `--graphite-2`   | `#1C2025` | hover surfaces                                 |
| `--white`        | `#F3F5F7` | cold white text                                |
| `--muted`        | `#7B838D` | secondary text                                 |
| `--energy`       | `#70E7FF` | active energy                                  |
| `--energy-2`     | `#B9F7FF` | energy core / highlights                       |
| `--metal`        | `#2A2F36` | titanium / gunmetal surfaces (3D and UI)       |
| `--danger`       | `#FF6B6B` | errors only                                    |

Rules: no gradients except the energy surface; no glow larger than 24 px; no
border brighter than `--graphite-2` unless it is active energy.

## Typography

- Grotesk: **Geist** (`--font-geist-sans`) — headings uppercase, tracking
  `-0.02em`, weights 500/600. Hero headline `clamp(2.6rem, 7vw, 6.5rem)`.
- Mono: **Geist Mono** (`--font-geist-mono`) — addresses, hashes, route data,
  technical labels (`.label`: 11 px, uppercase, tracking `0.14em`, muted).
- Copy is minimal. Every section has one heading and at most three lines.

## Surfaces

- `.panel`: `--bg-2`, 1 px `--graphite` border, radius 14 px, no blur. On
  hover a 1.5° perspective tilt (framer-motion), nothing else.
- `.hairline`: 1 px `--graphite`.
- Inputs: graphite fill, cold-white text, mono for numbers.

## Motion

| Interaction          | Behaviour                                                       |
|----------------------|-----------------------------------------------------------------|
| Button               | magnetic: translates ≤ 4 px toward the pointer, spring 300/20   |
| Chain selector       | glyph lifts 2 px on hover                                       |
| Chain change         | glyph ring rotates with damping (~0.7 s), then the chevron locks |
| Route found          | 1 px cyan pulse crosses the viewport (900 ms)                   |
| OPEN PORTAL hover    | portal energy +0.15                                              |
| Amounts              | spring-animated numbers                                          |
| Portal               | tilts ≤ 6° toward the pointer                                    |
| Reduced motion       | ring snaps, pulses off, lite portal                              |

## The portal (3D)

- Brushed dark titanium: `MeshPhysicalMaterial` `#2A2F36`, metalness 0.92,
  roughness 0.38, anisotropy 0.7, RoomEnvironment PMREM (no HDRI file).
- Rings are lathe profiles with chamfers; engraved ticks and index numbers come
  from a generated canvas roughness/bump map.
- LED strip: 72 instanced markers, graphite when idle, energy when active.
- Glyph rings (source outer, destination inner) carry the six chain labels
  engraved; they rotate to align the pair at 9 and 3 o'clock, then the
  chevrons close ("clac") and the energy surface responds.
- Energy surface: single shader disc — fbm-warped fine grid (spacetime
  lattice) + radial lensing + concentric ripples + central bloom, all scaled
  by `uEnergy`; particles spiral inward at `uEnergy`.
- Camera: z 6.4, fov 34; intro dollies from z 14.

## Logo

Two incomplete concentric rings (outer 270°, inner 300°) with a single
tangential break that reads as motion through them. Cold white on black; the
inner ring turns energy cyan in the active state. Works at 16, 32, 400 px.
