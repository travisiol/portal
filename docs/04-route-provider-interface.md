# PORTAL — Route provider interface

`src/types/provider.ts`

```ts
interface QuoteParams {
  sourceChain: ChainConfig
  destinationChain: ChainConfig
  sourceToken: TokenConfig
  destinationToken: TokenConfig
  amountIn: bigint
  sender?: Address            // undefined → indicative quote (placeholder address)
  recipient?: Address
  slippageBps: number         // default 50
  signal?: AbortSignal
}

interface RouteProvider {
  id: ProviderId              // "relay" | "across" | "lifi" | "stargate" | "ccip" | "canonical" | "demo"
  name: string
  kind: "live" | "demo"
  status: "live" | "needs-key" | "experimental" | "demo-only"
  supports(pair: { sourceChain: ChainConfig; destinationChain: ChainConfig; token: TokenConfig }): boolean
  getQuote(params: QuoteParams): Promise<RouteQuote | null>      // null = no route, throw = provider error
  buildTransaction(quote: RouteQuote, params: QuoteParams & { sender: Address }): Promise<BuiltRoute>
  getStatus(tracking: TrackingRef): Promise<RouteStatus>
}
```

Rules every adapter follows:

- `getQuote` returns `null` for "no route" and throws `ProviderError` for
  transport / API failures. The router treats both as "unavailable" but shows
  the error text in the route list so a failing provider is visible.
- `buildTransaction` must re-quote with the real `sender` when the quote was
  indicative (`quote.raw.sender !== sender`), and must return **every**
  approval the user will be asked to sign. Nothing is signed automatically.
- `getStatus` is polled every 5 s until `arrived | failed | refunded`.
- Adapters never import UI code. Adapters never read the mode: the registry
  (`src/lib/routes/index.ts`) exposes `providersFor(mode)`.
- Errors are typed: `ProviderNotConfiguredError` (needs key / address) is
  rendered as "quote shown for comparison only" and disables OPEN PORTAL for
  that route only.

## Adapter mapping

| Adapter     | Quote endpoint                                            | Build                          | Status                                             |
|-------------|-----------------------------------------------------------|--------------------------------|----------------------------------------------------|
| `lifi.ts`   | `GET https://li.quest/v1/quote`                           | `transactionRequest` + `approvalAddress` | `GET https://li.quest/v1/status?txHash&bridge&fromChain&toChain` |
| `across.ts` | `GET https://app.across.to/api/suggested-fees`            | `SpokePool.depositV3(...)` via viem | `GET https://app.across.to/api/deposit/status?originChainId&depositTxHash` |
| `relay.ts`  | `POST https://api.relay.link/price` (keyless)             | `POST /api/relay/quote` (server adds `RELAY_API_KEY`) | `GET https://api.relay.link/intents/status/v2?requestId` |
| `stargate.ts` | `GET https://transfer.layerzero-api.com/v1/quotes`      | quote `steps[].transaction`    | `GET https://transfer.layerzero-api.com/v1/...` (experimental) |
| `ccip.ts`   | none — demo only                                          | throws NotConfigured           | —                                                  |
| `canonical.ts` | none until `contracts.ts` has the Orbit Inbox / gateway | throws NotConfigured        | —                                                  |
| `demo.ts`   | deterministic fixtures per provider profile, `source: "demo"` | simulated timeline         | simulated                                          |

## Timeouts and fan-out

`findRoutes(params, providers)` runs all providers with `Promise.allSettled`
and a 12 s `AbortSignal.timeout`. A slow provider never blocks the best route:
results stream into the list as they resolve (TanStack Query `placeholderData`
keeps the previous ranking while a refresh is in flight). Quotes expire on
`quoteExpiration`; the panel shows QUOTE EXPIRED and a refresh action.
