# PORTAL — Component tree

```
app/layout.tsx
└─ Providers (wagmi · RainbowKit · TanStack Query · mode hydration)
   ├─ CursorGlow                      subtle cyan light over [data-portal-interactive]
   ├─ RoutePulse                      full-width cyan pulse on "route found"
   ├─ Navbar                          transparent → graphite hairline after scroll
   │  ├─ Logo                         two broken concentric rings (SVG)
   │  ├─ NavLinks                     Bridge · Routes · Network · Activity
   │  ├─ ModeBadge                    DEMO / LIVE, switchable
   │  ├─ PortalBalance                $PORTAL balance when a token is configured
   │  └─ ConnectButton                RainbowKit custom button
   ├─ {page}
   ├─ MobileNav                       Bridge · Routes · Activity · Profile (bottom, < md)
   └─ Footer

app/page.tsx (landing — the application is the hero)
├─ IntroOverlay (dynamic, first visit)   INITIALIZING ROUTE → camera → lock → energy → logo
├─ Hero
│  ├─ Headline                       MOVE BETWEEN CHAINS. / One route. No bridge hunting.
│  └─ BridgePanel                    ← the same component as /bridge
├─ OneRoute                          three lines of copy
├─ NetworkSection (lazy)
│  └─ NetworkMap → NetworkScene (R3F)  Robinhood centre, chains orbiting, route tubes
├─ WhyPortal                         FASTEST · CHEAPEST · SIMPLEST
├─ TokenSection                      implemented utility only, inactive tiers flagged
├─ RecentCrossings                   DEMO ACTIVITY / live journeys
└─ FinalCta                          OPEN PORTAL

BridgePanel (components/bridge)
├─ SourceCard                        FROM · ChainSelect · TokenSelect · AmountInput · Balance
├─ PortalStage                       the 3D rig between FROM and TO
│  ├─ Portal (dynamic)               chooses PortalScene (R3F) or PortalLite (SVG)
│  │  ├─ PortalScene
│  │  │  ├─ Rig                      titanium rings (lathe), LED strip, bolts, clamps
│  │  │  ├─ GlyphRing ×2             source ring / destination ring (rotate to align)
│  │  │  ├─ LockChevrons             the "clac" at 9 and 3 o'clock
│  │  │  ├─ EnergySurface            shader disc: distortion, ripples, lensing
│  │  │  ├─ Particles                pulled inward, GPU-animated
│  │  │  └─ AssetObject              the crossing asset (ETH sphere / flat token)
│  │  └─ PortalLite                  SVG rings + CSS energy, same store
│  ├─ LockLabel                      ETHEREUM → ROBINHOOD CHAIN LOCKED · ROUTE FOUND
│  └─ CrossingOverlay                ARRIVED. 0.996 ETH · Robinhood Chain
├─ DestinationCard                   TO · ChainSelect · TokenSelect · Receive · time · cost
├─ RouteSummary                      BEST ROUTE (only when scored) + category tabs
│  ├─ RoutePath                      ETHEREUM ↓ RELAY ↓ ROBINHOOD (intermediate swaps shown)
│  └─ OpenPortalButton               appears only once the ring is locked and a route exists
├─ RouteList                         OTHER ROUTES, selectable
├─ RouteError                        NO ROUTE · INSUFFICIENT GAS · ROUTE CHANGED · QUOTE EXPIRED
└─ TransactionModal
   ├─ SecurityReview                 YOU SEND / FROM / YOU RECEIVE EST. / ON / ROUTE / MAX COST
   ├─ StepTimeline                   Preparing ✓ · Wallet ✓ · Sent ✓ · Crossing… · Destination
   └─ BridgeStatus                   SOURCE CONFIRMED · IN TRANSIT (provider, elapsed) · ARRIVED

app/routes            RouteGrid → RouteCard (pair, provider count)
app/routes/[from]/[to] RouteDetail → AssetTable · ProviderTable · AvailabilityStrip · LiveProbe
app/network           NetworkMap full-screen + legend
app/activity          ActivityFeed (demo-labeled) · YourJourneys
app/dashboard         PassportCard · StatGrid · Journeys · SavedRoutes · PortalBalanceCard
app/token             UtilityTiers · AdvancedRouting · Treasury (honest empty state)
```

## Shared UI (components/ui)

`Button` (magnetic), `Panel` (subtle perspective on hover), `Label` (mono
technical label), `AnimatedNumber`, `Dropdown`, `Modal`, `Tag`, `ChainIcon`,
`TokenIcon`, `Skeleton`, `Hairline`.
