# PORTAL — Architecture

> One route. Any chain. PORTAL is an aggregation / routing **frontend**: it never
> bridges anything itself. Every crossing is executed by an existing provider
> (LI.FI, Across, Relay, …) through a normalized adapter.

## Principles

1. **Adapters, not a protocol.** `src/lib/routes/*.ts` are thin adapters that
   turn a provider's API into the normalized `RouteProvider` interface
   (`docs/04-route-provider-interface.md`). Adding a provider = adding a file
   and registering it in `src/config/providers.ts`.
2. **Demo and live never mix.** A global mode (`src/lib/env.ts`,
   `src/lib/store/mode.ts`) selects the provider registry. In DEMO mode only
   the `demo` adapter answers, and every quote carries `source: "demo"` which
   the UI renders as a `DEMO DATA` tag. In LIVE mode only real providers answer
   and quotes carry `source: "live"`. No fixture is ever shown as live data.
3. **No fake transactions.** DEMO mode simulates the *timeline* (clearly
   labeled "no transaction is sent", no hashes). LIVE mode sends exactly the
   transaction the provider built, after an explicit wallet confirmation for
   every step (approval, deposit).
4. **Configuration-driven chains.** `src/config/chains.ts` is the only place a
   chain is described (id, RPC, explorer, provider keys, ring position). The
   UI never switches on a chain id.
5. **The portal is the brand, the navigation and the feedback.** A single
   store (`src/lib/store/portal.ts`) holds the machine's phase; the 3D rig,
   the lite portal, the CTA and the transaction modal all read the same state.

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│ app/ (Next.js routes)  /  /bridge /routes /network /activity ...  │
├──────────────────────────────────────────────────────────────────┤
│ components/ portal · bridge · routes · network · wallet · ui      │
├──────────────────────────────────────────────────────────────────┤
│ lib/store   bridge (form) · portal (machine) · passport · mode    │
│ lib/router  findRoutes (fan-out) · scoreRoutes · useRoutes (RQ)   │
│ lib/routes  relay · across · lifi · stargate · ccip · canonical   │
│             demo (fixtures) · registry                            │
│ lib/wallet  wagmi config · execution (approve → send → track)     │
│ lib/contracts  ERC-20 · Across SpokePool ABIs                     │
├──────────────────────────────────────────────────────────────────┤
│ config/  chains · tokens · providers · contracts · token · site   │
│ types/   chain · token · route · provider · passport              │
└──────────────────────────────────────────────────────────────────┘
```

## Request flow (LIVE)

```
BridgePanel ── form state ──▶ useRoutes(params)            (TanStack Query)
                                 │  fan-out, Promise.allSettled, 12 s timeout
                                 ▼
                    registry.live: [lifi, across, relay, stargate]
                                 │  each → RouteQuote | null
                                 ▼
                    scoreRoutes(quotes, preference)  → ranked + category winners
                                 │
                                 ▼
                    RouteSummary (BEST ROUTE) · RouteList (OTHER ROUTES)
                                 │  OPEN PORTAL
                                 ▼
                    execution.ts: switchChain → approvals → sendTransaction
                                 │  hash
                                 ▼
                    provider.getStatus(tracking) polled every 5 s → BridgeStatus
                                 │  arrived
                                 ▼
                    passport store (journey saved locally)
```

## Provider status (verified 2026-09-18 against the public APIs)

| Provider  | Quotes                    | Build tx                         | Status               | Robinhood Chain |
|-----------|---------------------------|----------------------------------|----------------------|-----------------|
| LI.FI     | `GET li.quest/v1/quote`   | returned by the quote            | `GET /v1/status`     | yes (4663)      |
| Across    | `suggested-fees` (public) | `SpokePool.depositV3` encoded    | `deposit/status`     | yes (4663)      |
| Relay     | `POST /price` (keyless)   | `POST /quote` needs `RELAY_API_KEY` (server route) | `intents/status/v2` | yes (4663) |
| Stargate  | LayerZero transfer API (unverified for 4663) | from quote steps | —             | experimental    |
| CCIP      | no public quote API       | —                                | —                    | demo only       |
| Canonical | Orbit bridge, not configured | —                             | —                    | demo only       |

## Environment

```
NEXT_PUBLIC_PORTAL_MODE=demo|live        default demo; can be switched in the UI
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=    optional; without it only injected wallets
NEXT_PUBLIC_RPC_<CHAINKEY>=              optional RPC overrides
RELAY_API_KEY=                           server-only; enables Relay execution
NEXT_PUBLIC_PORTAL_TOKEN_<CHAINKEY>=     optional $PORTAL token address per chain
```

## Performance rules

- Every Three.js component is `next/dynamic` with `ssr: false`.
- The network scene mounts only when its section enters the viewport.
- Frame loops stop when `document.hidden`, and drop to the lite portal when
  `prefers-reduced-motion` or a coarse pointer + narrow viewport is detected.
- No textures are loaded from disk: every texture is generated on a canvas at
  mount (tick marks, glyph rings, LED strips).
