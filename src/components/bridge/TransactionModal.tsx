"use client";

import { clsx } from "clsx";
import { animate } from "framer-motion";
import { AlertTriangle, ArrowDown, Check, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfig } from "wagmi";
import { chainById, explorerTx } from "@/config/chains";
import { tokenBySymbol } from "@/config/tokens";
import { bridgeError, type BridgeError } from "@/lib/errors";
import { formatAmount, formatDuration, formatElapsed, formatUsd, shortHash } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { providerById } from "@/lib/routes";
import { usePassportStore } from "@/lib/store/passport";
import { usePortalStore } from "@/lib/store/portal";
import { executeDemo, executeLive, initialSnapshot, type ExecutionSnapshot, type StepId } from "@/lib/wallet/execution";
import type { QuoteParams } from "@/types/provider";
import type { RouteQuote, ScoredRoute } from "@/types/route";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Label, SourceTag, Tag } from "@/components/ui/primitives";
import { FeeLines, RouteErrorView, RoutePath } from "./RouteViews";

const STEPS: { id: StepId; label: string; active: string }[] = [
  { id: "prepare", label: "Preparing route", active: "Preparing route…" },
  { id: "wallet", label: "Wallet confirmation", active: "Waiting for your wallet…" },
  { id: "sent", label: "Transaction sent", active: "Waiting for the source network…" },
  { id: "crossing", label: "Crossing chain", active: "Crossing chain…" },
  { id: "destination", label: "Destination confirmed", active: "Destination confirmed" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  route?: ScoredRoute;
  params?: QuoteParams;
  mode: "demo" | "live";
  expired: boolean;
  onRefresh: () => void;
}

const outOf = (q: RouteQuote) => Number(q.estimatedAmountOut) / 10 ** q.destinationToken.decimals;

/**
 * OPEN PORTAL. Three stages — ALLOW PORTAL TO ROUTE, CONFIRM TRANSACTION,
 * ENTERING PORTAL — over a security review that hides nothing. The modal
 * drives the crossing animation and the passport; the execution layer does
 * the signing, one explicit wallet prompt per step.
 */
export function TransactionModal({ open, onClose, route, params, mode, expired, onRefresh }: Props) {
  const config = useConfig();
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | undefined>();
  const [reviewed, setReviewed] = useState<RouteQuote | undefined>();
  const [routeChanged, setRouteChanged] = useState<BridgeError | undefined>();
  const confirmResolver = useRef<((ok: boolean) => void) | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const journeyId = useRef<string | undefined>(undefined);
  const now = useNow();
  const addJourney = usePassportStore((s) => s.addJourney);
  const updateJourney = usePassportStore((s) => s.updateJourney);
  const setPhase = usePortalStore((s) => s.setPhase);
  const beginCrossing = usePortalStore((s) => s.beginCrossing);
  const setCrossing = usePortalStore((s) => s.setCrossing);
  const resetToIdle = usePortalStore((s) => s.resetToIdle);

  const quote = snapshot ? reviewed : route?.quote;
  const running = Boolean(snapshot && !snapshot.finished);

  // Snapshot the quote being reviewed when the modal opens; flag ROUTE CHANGED if it moves > 0.5 % before signing.
  useEffect(() => {
    if (!open) return;
    setPhase("confirming");
    return () => {
      abort.current?.abort();
    };
  }, [open, setPhase]);

  useEffect(() => {
    if (!open || snapshot || !route) return;
    const incoming = route.quote;
    if (!reviewed || reviewed.provider !== incoming.provider) {
      const t = setTimeout(() => setReviewed(incoming), 0);
      return () => clearTimeout(t);
    }
    const drift = Math.abs(outOf(incoming) - outOf(reviewed)) / Math.max(outOf(reviewed), 1e-12);
    if (drift > 0.005 && incoming.id !== reviewed.id) {
      const t = setTimeout(() => setRouteChanged(bridgeError("ROUTE_CHANGED")), 0);
      return () => clearTimeout(t);
    }
  }, [open, route, reviewed, snapshot]);

  const acceptChange = () => {
    if (route) setReviewed(route.quote);
    setRouteChanged(undefined);
  };

  const emit = useCallback((patch: Partial<ExecutionSnapshot> | ((s: ExecutionSnapshot) => Partial<ExecutionSnapshot>)) => {
    setSnapshot((prev) => {
      const base = prev ?? initialSnapshot();
      return { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
    });
  }, []);

  // Portal choreography + passport, reacting to the execution snapshot.
  const lastSteps = useRef<Record<StepId, string>>({ prepare: "", wallet: "", sent: "", crossing: "", destination: "" });
  useEffect(() => {
    if (!snapshot || !quote || !params) return;
    const prev = lastSteps.current;
    const steps = snapshot.steps;
    if (steps.sent === "active" && prev.sent !== "active") {
      const asset = { glyph: tokenBySymbol(params.sourceToken.symbol)?.glyph ?? "eth", symbol: params.sourceToken.symbol };
      beginCrossing(asset);
      animate(0, 0.62, { duration: 3.2, ease: "linear", onUpdate: (v) => setCrossing(v) });
      journeyId.current = `${Date.now().toString(36)}-${quote.provider}`;
      addJourney({
        id: journeyId.current,
        mode,
        provider: quote.provider,
        providerName: quote.providerName,
        sourceChain: quote.sourceChain,
        destinationChain: quote.destinationChain,
        tokenSymbol: quote.sourceToken.symbol,
        amountIn: formatAmount(quote.amountIn, quote.sourceToken.decimals, 6),
        amountOut: formatAmount(quote.estimatedAmountOut, quote.destinationToken.decimals, 6),
        usd: quote.amountOutUsd,
        sourceTxHash: snapshot.sourceTxHash,
        startedAt: Date.now(),
        state: "in_transit",
      });
    }
    if (steps.destination === "done" && prev.destination !== "done") {
      const from = Math.max(usePortalStore.getState().crossing, 0.62);
      animate(from, 1, { duration: 1.3, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setCrossing(v) });
      if (journeyId.current) updateJourney(journeyId.current, { state: "arrived", completedAt: Date.now(), destinationTxHash: snapshot.destinationTxHash, sourceTxHash: snapshot.sourceTxHash });
    }
    if (snapshot.error && journeyId.current && steps.crossing === "failed") updateJourney(journeyId.current, { state: "failed" });
    if (snapshot.error) setPhase("error");
    lastSteps.current = { ...steps };
  }, [snapshot, quote, params, mode, beginCrossing, setCrossing, addJourney, updateJourney, setPhase]);

  const start = async () => {
    if (!quote || !params) return;
    const controller = new AbortController();
    abort.current = controller;
    setSnapshot(initialSnapshot());
    if (mode === "demo") {
      await executeDemo({
        quote,
        emit,
        signal: controller.signal,
        waitForConfirmation: () => new Promise<boolean>((resolve) => (confirmResolver.current = resolve)),
      });
      return;
    }
    const provider = providerById("live", quote.provider);
    if (!provider || !params.sender) return;
    await executeLive({ config, provider, quote, params, sender: params.sender, emit, signal: controller.signal });
  };

  const close = () => {
    abort.current?.abort();
    confirmResolver.current?.(false);
    confirmResolver.current = undefined;
    setSnapshot(undefined);
    setReviewed(undefined);
    setRouteChanged(undefined);
    journeyId.current = undefined;
    lastSteps.current = { prepare: "", wallet: "", sent: "", crossing: "", destination: "" };
    resetToIdle();
    onClose();
  };

  const source = quote ? chainById(quote.sourceChain) : undefined;
  const destination = quote ? chainById(quote.destinationChain) : undefined;
  const totalCost = route?.totalCostUsd;
  const needsApproval = quote?.sourceToken.address !== "0x0000000000000000000000000000000000000000";
  const approvalsPending = useMemo(() => snapshot?.approvals.filter((a) => a.state !== "skipped") ?? [], [snapshot]);
  const elapsed = snapshot?.sentAt ? (snapshot.arrivedAt ?? now) - snapshot.sentAt : 0;
  const arrived = snapshot?.steps.destination === "done";

  return (
    <Modal open={open} onClose={close} title={<span className="flex items-center gap-2">Open portal {quote && <SourceTag source={quote.source} />}</span>} dismissable={!running || Boolean(snapshot?.error)}>
      {!quote || !source || !destination ? (
        <div className="p-5 text-sm text-muted">No route selected.</div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          {/* SECURITY REVIEW */}
          <section aria-label="Review" className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Review label="You send" value={`${formatAmount(quote.amountIn, quote.sourceToken.decimals, 6)} ${quote.sourceToken.symbol}`} />
            <Review label="From" value={source.name} />
            <Review label="You receive est." value={`${formatAmount(quote.estimatedAmountOut, quote.destinationToken.decimals, 6)} ${quote.destinationToken.symbol}`} accent />
            <Review label="On" value={destination.name} accent />
            <Review label="Route" value={quote.providerName} />
            <Review label="Max estimated cost" value={formatUsd(totalCost)} />
            {quote.minimumAmountOut !== undefined && quote.minimumAmountOut !== quote.estimatedAmountOut && (
              <Review label="Minimum received" value={`${formatAmount(quote.minimumAmountOut, quote.destinationToken.decimals, 6)} ${quote.destinationToken.symbol}`} />
            )}
            <Review label="Estimated time" value={formatDuration(quote.estimatedDuration)} />
          </section>
          <div className="panel-inset p-3">
            <RoutePath quote={quote} compact />
            <div className="mt-3">
              <FeeLines quote={quote} gasUsd={quote.estimatedGas.usd} />
            </div>
          </div>

          {mode === "demo" && !snapshot && (
            <p className="label leading-relaxed normal-case tracking-normal text-muted">
              Demo mode: this walks through the portal with simulated data. <span className="text-white">No transaction is sent, nothing is signed.</span>
            </p>
          )}
          {routeChanged && !snapshot && (
            <div className="flex flex-col gap-2">
              <RouteErrorView error={routeChanged} />
              <Button variant="ghost" onClick={acceptChange}>
                Review new amount
              </Button>
            </div>
          )}
          {expired && !snapshot && <RouteErrorView error={bridgeError("QUOTE_EXPIRED")} onRefresh={onRefresh} />}

          {/* STAGES */}
          <section aria-label="Steps" className="grid grid-cols-3 gap-2">
            <Stage n={1} label="Allow portal to route" state={!snapshot ? "pending" : snapshot.steps.wallet === "done" || snapshot.steps.wallet === "failed" ? (snapshot.steps.wallet === "failed" ? "failed" : "done") : snapshot.steps.wallet === "active" ? "active" : "pending"} hint={needsApproval ? `${quote.sourceToken.symbol} approval` : "No approval needed for ETH"} />
            <Stage n={2} label="Confirm transaction" state={!snapshot ? "pending" : snapshot.steps.sent === "done" || snapshot.steps.crossing !== "pending" ? "done" : snapshot.steps.wallet === "done" || snapshot.steps.sent === "active" ? "active" : snapshot.steps.wallet === "failed" ? "failed" : "pending"} hint="One wallet signature" />
            <Stage n={3} label="Entering portal" state={!snapshot ? "pending" : arrived ? "done" : snapshot.steps.crossing === "active" ? "active" : snapshot.steps.crossing === "failed" ? "failed" : "pending"} hint={formatDuration(quote.estimatedDuration)} />
          </section>

          {/* TIMELINE */}
          {snapshot && (
            <ol className="flex flex-col gap-2" aria-label="Progress">
              {STEPS.map((s) => {
                const st = snapshot.steps[s.id];
                return (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className={clsx("flex size-5 items-center justify-center rounded-full border", st === "done" ? "border-energy/50 bg-energy/15 text-energy" : st === "active" ? "border-energy text-energy" : st === "failed" ? "border-danger text-danger" : "border-graphite-2 text-muted-2")}>
                      {st === "done" ? <Check size={11} /> : st === "active" ? <Loader2 size={11} className="animate-spin" /> : st === "failed" ? <AlertTriangle size={10} /> : <span className="size-1 rounded-full bg-current" />}
                    </span>
                    <span className={clsx("label", st === "pending" ? "text-muted-2" : st === "failed" ? "text-danger" : "text-white")}>{st === "active" ? s.active : s.label}</span>
                    {s.id === "wallet" && st === "active" && approvalsPending.length > 0 && (
                      <span className="label ml-auto text-[10px] text-muted">
                        {approvalsPending.map((a) => `${a.token.symbol} ${a.state}`).join(" · ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {/* LIVE STATUS */}
          {snapshot && snapshot.steps.sent !== "pending" && (
            <section className="panel-inset flex flex-col gap-3 p-3" aria-label="Bridge status">
              <StatusRow title="Source confirmed" done={snapshot.steps.sent === "done"} active={snapshot.steps.sent === "active"}>
                {snapshot.sourceTxHash ? <HashLink hash={snapshot.sourceTxHash} url={explorerTx(source, snapshot.sourceTxHash)} /> : mode === "demo" ? <span className="label text-muted-2">Demo · no transaction hash</span> : null}
              </StatusRow>
              <ArrowDown size={12} className="ml-2 text-muted-2" />
              <StatusRow title="In transit" done={arrived} active={snapshot.steps.crossing === "active"}>
                <span className="label">
                  Provider: <span className="text-white">{quote.providerName}</span> · Elapsed: <span className="mono text-white">{formatElapsed(elapsed)}</span>
                  {snapshot.status?.message && snapshot.status.message !== "Demo — simulated crossing" && <span className="block text-muted-2">{snapshot.status.message}</span>}
                </span>
              </StatusRow>
              <ArrowDown size={12} className="ml-2 text-muted-2" />
              <StatusRow title={arrived ? "Arrived" : "Destination"} done={arrived} active={false}>
                {arrived ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="mono text-sm text-energy">
                      {formatAmount(quote.estimatedAmountOut, quote.destinationToken.decimals, 6)} {quote.destinationToken.symbol}
                    </span>
                    <span className="label">{destination.name}</span>
                    {snapshot.destinationTxHash ? <HashLink hash={snapshot.destinationTxHash} url={explorerTx(destination, snapshot.destinationTxHash)} /> : mode === "demo" ? <Tag tone="demo">Demo</Tag> : null}
                  </span>
                ) : (
                  <span className="label text-muted-2">Waiting…</span>
                )}
              </StatusRow>
            </section>
          )}

          {snapshot?.error && <RouteErrorView error={snapshot.error} />}

          {/* ACTIONS */}
          <div className="flex flex-col gap-2">
            {!snapshot ? (
              <Button variant="primary" className="h-12 w-full text-[13px] tracking-[0.2em]" onClick={start} disabled={Boolean(routeChanged) || expired || (mode === "live" && !quote.executable)}>
                {mode === "demo" ? "Open portal · simulate" : "Confirm & open portal"}
              </Button>
            ) : snapshot.awaitingWallet && mode === "demo" ? (
              <div className="flex gap-2">
                <Button variant="primary" className="h-12 flex-1" onClick={() => confirmResolver.current?.(true)}>
                  Confirm (simulated wallet)
                </Button>
                <Button variant="ghost" className="h-12" onClick={() => confirmResolver.current?.(false)}>
                  Reject
                </Button>
              </div>
            ) : snapshot.finished ? (
              <Button variant={snapshot.error ? "ghost" : "primary"} className="h-12 w-full" onClick={close}>
                {snapshot.error ? "Close" : "Done"}
              </Button>
            ) : (
              <Button variant="ghost" className="h-12 w-full" disabled>
                {snapshot.awaitingWallet ? "Confirm in your wallet…" : "Working…"}
              </Button>
            )}
            {mode === "live" && !snapshot && (
              <p className="label text-center normal-case tracking-normal text-muted-2">Every step asks your wallet. PORTAL never signs on your behalf.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Review({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <div className={clsx("mono mt-1 text-sm", accent ? "text-energy" : "text-white")}>{value}</div>
    </div>
  );
}

function Stage({ n, label, state, hint }: { n: number; label: string; state: "pending" | "active" | "done" | "failed"; hint: string }) {
  return (
    <div className={clsx("panel-inset flex flex-col gap-1 px-3 py-2.5", state === "active" && "border-energy/40", state === "done" && "border-energy/20", state === "failed" && "border-danger/40")}>
      <span className={clsx("label text-[10px]", state === "pending" ? "text-muted-2" : state === "failed" ? "text-danger" : "text-energy")}>Step {n}</span>
      <span className={clsx("label leading-tight", state === "pending" ? "text-muted" : "text-white")}>{label}</span>
      <span className="label text-[9px] normal-case tracking-normal text-muted-2">{hint}</span>
    </div>
  );
}

function StatusRow({ title, done, active, children }: { title: string; done: boolean; active: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className={clsx("mt-0.5 size-2 shrink-0 rounded-full", done ? "bg-energy shadow-[0_0_8px_#70E7FF]" : active ? "animate-[blink_1s_ease-in-out_infinite] bg-energy" : "bg-graphite-3")} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <span className={clsx("label", done || active ? "text-white" : "text-muted")}>{title}</span>
        {children}
      </div>
    </div>
  );
}

function HashLink({ hash, url }: { hash: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mono flex items-center gap-1 text-xs text-white hover:text-energy">
      {shortHash(hash)} <ExternalLink size={11} />
    </a>
  );
}
