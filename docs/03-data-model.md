# PORTAL — Data model

All types live in `src/types/`. Amounts are `bigint` in the smallest unit; USD
values are `number | undefined` (undefined = "not known", rendered as "—",
never as 0).

## Chain (`types/chain.ts`, data in `config/chains.ts`)

```ts
type ChainKey = "ethereum" | "base" | "arbitrum" | "optimism" | "polygon" | "robinhood"

interface ChainConfig {
  id: number                 // 1, 8453, 42161, 10, 137, 4663
  key: ChainKey
  name: string               // "Robinhood Chain"
  label: string              // ring engraving, "ROBINHOOD"
  home: boolean              // true for Robinhood Chain: centre of the network map
  native: { symbol: "ETH" | "POL"; decimals: 18 }
  rpcUrl: string
  explorer: { name: string; url: string }
  wrappedNative?: Address     // WETH / WPOL, needed by Across
  providerKeys: { lifi?: number; relay?: number; layerzero?: string; across?: number }
  hue: number                // monochrome tint used for the chain glyph
}
```

## Token (`types/token.ts`, data in `config/tokens.ts`)

```ts
interface TokenConfig {
  symbol: string; name: string; decimals: number
  kind: "native" | "erc20"
  glyph: "eth" | "usdc" | "usdg" | "pol" | "portal"
  addresses: Partial<Record<ChainKey, Address>>   // zero address for native
}
type TokenRef = { chainId: number; address: Address; symbol: string; decimals: number }
```

## Route quote (`types/route.ts`)

```ts
interface RouteQuote {
  id: string                          // provider + nonce
  provider: ProviderId
  providerName: string
  source: "live" | "demo"             // the only thing that decides the DEMO tag
  sourceChain: number; destinationChain: number
  sourceToken: TokenRef; destinationToken: TokenRef
  amountIn: bigint
  estimatedAmountOut: bigint
  minimumAmountOut?: bigint
  providerFees: Fee[]                 // { label, amount, token: TokenRef, usd? }
  estimatedGas: { amount: bigint; token: TokenRef; usd?: number }
  estimatedDuration: number           // seconds
  transactionSteps: RouteStep[]       // approve / swap / bridge / receive, never hidden
  quoteExpiration: number             // epoch ms
  amountOutUsd?: number; amountInUsd?: number
  executable: boolean                 // false = quote for comparison only (e.g. Relay without key)
  notes?: string[]
  raw?: unknown                       // provider payload reused by buildTransaction
}

interface RouteStep {
  kind: "approve" | "swap" | "bridge" | "receive"
  chainId: number
  label: string                       // "RELAY", "USDC → ETH"
  detail?: string
  tokenIn?: TokenRef; tokenOut?: TokenRef
}
```

## Scoring (`lib/router/scoreRoutes.ts`)

```ts
type Preference = "value" | "fastest" | "fees"
interface ScoredRoute { quote: RouteQuote; score: number; netValueUsd?: number; totalCostUsd?: number; rank: number }
interface RouteRanking {
  preference: Preference
  ranked: ScoredRoute[]               // sorted for the preference
  best?: ScoredRoute                  // only defined when ≥ 1 executable quote was scored
  winners: { value?: string; fastest?: string; fees?: string }   // quote ids
}
```

## Execution (`types/route.ts`)

```ts
interface TransactionRequestData { chainId: number; to: Address; data: Hex; value: bigint; gas?: bigint }
interface Approval { chainId: number; token: TokenRef; spender: Address; amount: bigint }
interface BuiltRoute { approvals: Approval[]; transaction: TransactionRequestData; tracking: TrackingRef }
type TrackingRef = { provider: ProviderId; sourceChain: number; destinationChain: number; requestId?: string; txHash?: Hex; bridge?: string }

type RouteStatusState = "pending" | "source_confirmed" | "in_transit" | "arrived" | "failed" | "refunded" | "unknown"
interface RouteStatus { state: RouteStatusState; sourceTxHash?: Hex; destinationTxHash?: Hex; message?: string; updatedAt: number }
```

## Journey / Passport (`types/passport.ts`, persisted locally)

```ts
interface Journey {
  id: string; mode: "demo" | "live"; provider: ProviderId
  sourceChain: number; destinationChain: number
  tokenSymbol: string; amountIn: string; amountOut: string; usd?: number
  sourceTxHash?: Hex; destinationTxHash?: Hex
  startedAt: number; completedAt?: number; state: RouteStatusState
}
interface SavedRoute { sourceChain: number; destinationChain: number; tokenSymbol: string }
// Passport stats are derived: chains visited, routes completed, volume routed, favourite route.
// Levels: Explorer (< 10 completed live routes) · Navigator (< 50) · Gatekeeper.
```

## Portal machine (`lib/store/portal.ts`)

```
dormant → idle → aligning → locked → building → confirming → open → bridging → complete → idle
                     ▲                                                  │
                     └────────────── destination/source change ─────────┘
energy target: dormant 0 · idle .18 · aligning .3 · locked .45 · building .6 · confirming .75 · open 1 · bridging 1 · complete .35
```
