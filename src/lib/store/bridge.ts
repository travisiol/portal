import { create } from "zustand";
import { persist } from "zustand/middleware";
import { chainById, HOME_CHAIN, requireChain } from "@/config/chains";
import { defaultDestinationToken, isAvailableOn, tokenBySymbol, tokensOn } from "@/config/tokens";
import type { Preference, ProviderId } from "@/types/route";

interface BridgeState {
  sourceChainId: number;
  destinationChainId: number;
  sourceTokenSymbol: string;
  destinationTokenSymbol: string;
  amountInput: string;
  preference: Preference;
  /** Provider chosen by the user; undefined = follow the ranking. Ids survive refetches, quote ids do not. */
  selectedProvider?: ProviderId;
  setSourceChain: (id: number) => void;
  setDestinationChain: (id: number) => void;
  setSourceToken: (symbol: string) => void;
  setDestinationToken: (symbol: string) => void;
  setAmount: (input: string) => void;
  setPreference: (p: Preference) => void;
  selectProvider: (id?: ProviderId) => void;
  flip: () => void;
  setPair: (sourceChainId: number, destinationChainId: number, tokenSymbol?: string) => void;
}

const ETHEREUM = chainById(1)!;

/** Keeps the token selection valid for a (source, destination) pair. */
const reconcile = (state: Pick<BridgeState, "sourceChainId" | "destinationChainId" | "sourceTokenSymbol" | "destinationTokenSymbol">) => {
  const source = requireChain(state.sourceChainId);
  const destination = requireChain(state.destinationChainId);
  let sourceToken = tokenBySymbol(state.sourceTokenSymbol);
  if (!sourceToken || !isAvailableOn(sourceToken, source)) sourceToken = tokensOn(source)[0];
  let destinationToken = tokenBySymbol(state.destinationTokenSymbol);
  if (!destinationToken || !isAvailableOn(destinationToken, destination) || destinationToken.symbol !== sourceToken.symbol) {
    destinationToken = defaultDestinationToken(sourceToken, destination);
  }
  return { sourceTokenSymbol: sourceToken.symbol, destinationTokenSymbol: destinationToken.symbol, selectedProvider: undefined };
};

export const useBridgeStore = create<BridgeState>()(
  persist(
    (set, get) => ({
      sourceChainId: ETHEREUM.id,
      destinationChainId: HOME_CHAIN.id,
      sourceTokenSymbol: "ETH",
      destinationTokenSymbol: "ETH",
      amountInput: "1",
      preference: "value",
      selectedProvider: undefined,
      setSourceChain: (id) => {
        const s = get();
        // Choosing the current destination as the source swaps the pair instead of collapsing it.
        const destinationChainId = id === s.destinationChainId ? s.sourceChainId : s.destinationChainId;
        set({ sourceChainId: id, destinationChainId, ...reconcile({ ...s, sourceChainId: id, destinationChainId }) });
      },
      setDestinationChain: (id) => {
        const s = get();
        const sourceChainId = id === s.sourceChainId ? s.destinationChainId : s.sourceChainId;
        set({ destinationChainId: id, sourceChainId, ...reconcile({ ...s, sourceChainId, destinationChainId: id }) });
      },
      setSourceToken: (symbol) => {
        const s = get();
        set({ ...reconcile({ ...s, sourceTokenSymbol: symbol, destinationTokenSymbol: symbol }) });
      },
      setDestinationToken: (symbol) => {
        const s = get();
        const token = tokenBySymbol(symbol);
        if (!token || !isAvailableOn(token, requireChain(s.destinationChainId))) return;
        set({ destinationTokenSymbol: symbol, selectedProvider: undefined });
      },
      setAmount: (amountInput) => set({ amountInput, selectedProvider: undefined }),
      setPreference: (preference) => set({ preference, selectedProvider: undefined }),
      selectProvider: (selectedProvider) => set({ selectedProvider }),
      flip: () => {
        const s = get();
        const next = { sourceChainId: s.destinationChainId, destinationChainId: s.sourceChainId, sourceTokenSymbol: s.destinationTokenSymbol, destinationTokenSymbol: s.sourceTokenSymbol };
        set({ ...next, ...reconcile(next) });
      },
      setPair: (sourceChainId, destinationChainId, tokenSymbol) => {
        const s = get();
        const next = { sourceChainId, destinationChainId, sourceTokenSymbol: tokenSymbol ?? s.sourceTokenSymbol, destinationTokenSymbol: tokenSymbol ?? s.destinationTokenSymbol };
        set({ ...next, ...reconcile(next) });
      },
    }),
    {
      name: "portal.bridge",
      skipHydration: true,
      partialize: (s) => ({ sourceChainId: s.sourceChainId, destinationChainId: s.destinationChainId, sourceTokenSymbol: s.sourceTokenSymbol, destinationTokenSymbol: s.destinationTokenSymbol, preference: s.preference }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BridgeState>;
        const merged = { ...current, ...p };
        if (!chainById(merged.sourceChainId) || !chainById(merged.destinationChainId) || merged.sourceChainId === merged.destinationChainId) {
          return current;
        }
        return { ...merged, ...reconcile(merged) };
      },
    },
  ),
);
