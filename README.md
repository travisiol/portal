# PORTAL

**One route. Any chain.**

PORTAL is a cross-chain routing interface built around Robinhood Chain. Pick a
source, an asset and a destination; PORTAL asks every configured route
provider, scores the answers, shows the path — approvals and swaps included —
and lets your wallet confirm each step. PORTAL never bridges anything itself
and never holds funds: every crossing is executed by an existing provider
through its own contracts.

```
ETHEREUM  →  🌀 PORTAL  →  ROBINHOOD CHAIN
```

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3459
```

```bash
npm run typecheck  # tsc
npm run lint       # eslint (React Compiler rules on)
npm test           # node --test, real API responses as fixtures
npm run capture    # headless Chrome + SwiftShader screenshots of every page
```

## DEMO mode / LIVE mode

The badge in the navbar switches the whole app (`NEXT_PUBLIC_PORTAL_MODE`
sets the default):

| | DEMO | LIVE |
|---|---|---|
| Quotes | deterministic, labeled **DEMO DATA**, never executable | returned by the configured providers only |
| OPEN PORTAL | simulated timeline, **no transaction is sent**, no hashes | real approvals + transaction, one wallet prompt per step |
| Activity | seeded feed labeled demo | your own journeys (a public feed needs an indexer) |

The two never mix: every quote carries `source: "demo" | "live"` and the tag
next to it comes from that field.

## Providers (state on 2026-09-18)

| Adapter | Quotes | Execution | Status |
|---|---|---|---|
| **LI.FI** | `GET li.quest/v1/quote`, no key | transaction returned with the quote; `/v1/status` tracking | live |
| **Across** | `GET app.across.to/api/suggested-fees` | `SpokePool.depositV3` encoded locally (selector verified on-chain) | live |
| **Relay** | `POST api.relay.link/price`, no key | `POST /quote` needs `RELAY_API_KEY` on the server (`/api/relay/quote`) | quotes live, execution needs key |
| **Stargate** | LayerZero transfer API | from quote steps | experimental — the API answered 404 for every pair tried |
| **CCIP** | — | — | demo only, no public quote API |
| **Canonical** | — | — | demo only until `NEXT_PUBLIC_ORBIT_INBOX` is set |

All six chains (Ethereum, Base, Arbitrum, Optimism, Polygon, Robinhood Chain
4663) are in `src/config/chains.ts`; LI.FI, Across and Relay all list
Robinhood Chain. Add a provider by adding a file in `src/lib/routes/` that
implements `RouteProvider` (`docs/04-route-provider-interface.md`) and
registering it in `src/lib/routes/index.ts`.

## Scoring

`src/lib/router/scoreRoutes.ts`. A route is labeled **BEST ROUTE** only when
at least two quotes were scored (one quote is "ONLY ROUTE"). Inputs: amount
received (re-valued at one shared price per token so providers' own oracles
cannot game the comparison), estimated gas, provider fees, estimated time,
availability. Three preferences: BEST VALUE, FASTEST, LOWEST FEES — the user
chooses, the category winners are tagged.

## The portal

`src/components/portal/`. React Three Fiber, no assets: brushed titanium
lathe rings, canvas-painted engravings and tick marks, instanced LEDs, two
engraved glyph rings that rotate to align the pair at 9 and 3 o'clock, lock
chevrons that close with a *clac*, a shader energy surface (warped spacetime
lattice, lensing, ripples, radar sweep while in transit), particles pulled
inward, and the crossing asset that shrinks into the ring while the camera
passes through. Phones and reduced motion get `PortalLite` (SVG + CSS) driven
by the same store. `/dev/portal?phase=…&crossing=…` renders any state in
development.

## $PORTAL

No token is deployed. `src/config/token.ts` holds the utility system (fee
tiers, advanced routing, treasury); every utility renders **INACTIVE** until
a token address is configured *and* the feature is implemented. PORTAL takes
no fee today, so there is no treasury to show.

## Environment

See `.env.example`. Nothing is required to run in DEMO mode; LIVE mode needs
nothing either for LI.FI and Across. Optional: a WalletConnect project id,
`RELAY_API_KEY`, RPC overrides, the token address.

## Docs

`docs/01-architecture.md` · `02-component-tree.md` · `03-data-model.md` ·
`04-route-provider-interface.md` · `05-visual-system.md`
