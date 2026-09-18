import type { Address, Hex } from "viem";
import type { Config } from "wagmi";
import { getBalance, readContract, sendTransaction, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { erc20Abi } from "@/lib/contracts/erc20";
import { STATUS_POLL_MS } from "@/lib/env";
import { bridgeError, errorMessage, isUserRejection, ProviderNotConfiguredError, type BridgeError } from "@/lib/errors";
import type { QuoteParams, RouteProvider } from "@/types/provider";
import type { Approval, RouteQuote, RouteStatus, TrackingRef } from "@/types/route";

export type StepId = "prepare" | "wallet" | "sent" | "crossing" | "destination";
export type StepState = "pending" | "active" | "done" | "failed";

export interface ApprovalProgress extends Approval {
  state: "pending" | "signing" | "mining" | "done" | "skipped";
  hash?: Hex;
}

export interface ExecutionSnapshot {
  steps: Record<StepId, StepState>;
  approvals: ApprovalProgress[];
  sourceTxHash?: Hex;
  destinationTxHash?: Hex;
  status?: RouteStatus;
  tracking?: TrackingRef;
  error?: BridgeError;
  startedAt: number;
  sentAt?: number;
  arrivedAt?: number;
  /** True while the wallet prompt is open (or, in DEMO, while waiting for the simulated confirmation). */
  awaitingWallet: boolean;
  finished: boolean;
}

export const initialSnapshot = (): ExecutionSnapshot => ({
  steps: { prepare: "pending", wallet: "pending", sent: "pending", crossing: "pending", destination: "pending" },
  approvals: [],
  startedAt: Date.now(),
  awaitingWallet: false,
  finished: false,
});

type Emit = (patch: Partial<ExecutionSnapshot> | ((s: ExecutionSnapshot) => Partial<ExecutionSnapshot>)) => void;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    }, { once: true });
  });

const TERMINAL: RouteStatus["state"][] = ["arrived", "failed", "refunded"];

/**
 * LIVE execution. Every signature is an explicit wallet prompt:
 *   1. approvals (only when the allowance is short)
 *   2. the provider's transaction
 * then the source receipt, then the provider's status until the destination
 * confirms. Nothing is retried silently; errors land in the snapshot.
 */
export async function executeLive(
  args: { config: Config; provider: RouteProvider; quote: RouteQuote; params: QuoteParams; sender: Address; emit: Emit; signal?: AbortSignal },
): Promise<void> {
  const { config, provider, quote, params, sender, emit, signal } = args;
  const fail = (error: BridgeError, step: StepId) => {
    emit((s) => ({ error, finished: true, awaitingWallet: false, steps: { ...s.steps, [step]: "failed" } }));
  };

  try {
    // 1. PREPARE — build the exact transaction the provider wants.
    emit((s) => ({ steps: { ...s.steps, prepare: "active" } }));
    let built;
    try {
      built = await provider.buildTransaction(quote, { ...params, sender });
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) return fail(bridgeError("PROVIDER_ERROR", { title: "PROVIDER NOT CONFIGURED", message: error.message }), "prepare");
      return fail(bridgeError("PROVIDER_ERROR", { message: errorMessage(error) }), "prepare");
    }
    const chainId = built.transaction.chainId;

    // Balance and gas sanity before any prompt.
    const native = await getBalance(config, { address: sender, chainId });
    const gasBudget = quote.estimatedGas.amount > 0n ? quote.estimatedGas.amount * 2n : 0n;
    if (native.value < built.transaction.value + gasBudget) {
      return fail(native.value < built.transaction.value ? bridgeError("INSUFFICIENT_BALANCE") : bridgeError("INSUFFICIENT_GAS", { message: `You need ${native.symbol} on ${params.sourceChain.name} to begin this route.` }), "prepare");
    }
    if (params.sourceToken.kind === "erc20") {
      const balance = await readContract(config, { abi: erc20Abi, address: quote.sourceToken.address, functionName: "balanceOf", args: [sender], chainId });
      if (balance < quote.amountIn) return fail(bridgeError("INSUFFICIENT_BALANCE"), "prepare");
    }
    emit((s) => ({ steps: { ...s.steps, prepare: "done", wallet: "active" }, approvals: built.approvals.map((a) => ({ ...a, state: "pending" })), tracking: built.tracking }));

    // 2. WALLET — network, approvals, then the transaction.
    try {
      await switchChain(config, { chainId });
    } catch (error) {
      if (isUserRejection(error)) return fail(bridgeError("USER_REJECTED"), "wallet");
      return fail(bridgeError("WRONG_NETWORK", { message: errorMessage(error) }), "wallet");
    }

    for (let i = 0; i < built.approvals.length; i++) {
      const approval = built.approvals[i];
      const allowance = await readContract(config, { abi: erc20Abi, address: approval.token.address, functionName: "allowance", args: [sender, approval.spender], chainId: approval.chainId });
      if (allowance >= approval.amount) {
        emit((s) => ({ approvals: s.approvals.map((a, j) => (j === i ? { ...a, state: "skipped" } : a)) }));
        continue;
      }
      emit((s) => ({ awaitingWallet: true, approvals: s.approvals.map((a, j) => (j === i ? { ...a, state: "signing" } : a)) }));
      let hash: Hex;
      try {
        hash = await writeContract(config, { abi: erc20Abi, address: approval.token.address, functionName: "approve", args: [approval.spender, approval.amount], chainId: approval.chainId });
      } catch (error) {
        return fail(isUserRejection(error) ? bridgeError("USER_REJECTED") : bridgeError("PROVIDER_ERROR", { title: "APPROVAL FAILED", message: errorMessage(error) }), "wallet");
      }
      emit((s) => ({ awaitingWallet: false, approvals: s.approvals.map((a, j) => (j === i ? { ...a, state: "mining", hash } : a)) }));
      await waitForTransactionReceipt(config, { hash, chainId: approval.chainId });
      emit((s) => ({ approvals: s.approvals.map((a, j) => (j === i ? { ...a, state: "done" } : a)) }));
    }

    emit({ awaitingWallet: true });
    let txHash: Hex;
    try {
      txHash = await sendTransaction(config, { to: built.transaction.to, data: built.transaction.data, value: built.transaction.value, gas: built.transaction.gas, chainId });
    } catch (error) {
      return fail(isUserRejection(error) ? bridgeError("USER_REJECTED") : bridgeError("PROVIDER_ERROR", { title: "TRANSACTION FAILED", message: errorMessage(error) }), "wallet");
    }
    const tracking: TrackingRef = { ...built.tracking, txHash };
    emit((s) => ({ awaitingWallet: false, sourceTxHash: txHash, sentAt: Date.now(), tracking, steps: { ...s.steps, wallet: "done", sent: "active" } }));

    // 3. SENT — source receipt.
    const receipt = await waitForTransactionReceipt(config, { hash: txHash, chainId });
    if (receipt.status !== "success") return fail(bridgeError("PROVIDER_ERROR", { title: "TRANSACTION REVERTED", message: "The source transaction reverted. Nothing left your wallet except gas." }), "sent");
    emit((s) => ({ steps: { ...s.steps, sent: "done", crossing: "active" }, status: { state: "source_confirmed", sourceTxHash: txHash, updatedAt: Date.now() } }));

    // 4. CROSSING — provider status until terminal.
    for (;;) {
      if (signal?.aborted) return;
      let status: RouteStatus;
      try {
        status = await provider.getStatus(tracking);
      } catch (error) {
        status = { state: "in_transit", sourceTxHash: txHash, updatedAt: Date.now(), message: errorMessage(error) };
      }
      emit({ status });
      if (TERMINAL.includes(status.state)) {
        if (status.state === "arrived") {
          emit((s) => ({ steps: { ...s.steps, crossing: "done", destination: "done" }, destinationTxHash: status.destinationTxHash, arrivedAt: Date.now(), finished: true }));
        } else {
          fail(bridgeError("PROVIDER_ERROR", { title: status.state === "refunded" ? "REFUNDED" : "CROSSING FAILED", message: status.message ?? "The provider reported a failure. Check the source transaction on the explorer." }), "crossing");
        }
        return;
      }
      await sleep(STATUS_POLL_MS, signal);
    }
  } catch (error) {
    if (signal?.aborted) return;
    fail(bridgeError("PROVIDER_ERROR", { message: errorMessage(error) }), "crossing");
  }
}

/**
 * DEMO execution: the same timeline, no wallet, no transaction, no hashes.
 * The "wallet" step waits for an explicit click on the simulated confirmation.
 */
export async function executeDemo(args: { quote: RouteQuote; emit: Emit; waitForConfirmation: () => Promise<boolean>; signal?: AbortSignal }): Promise<void> {
  const { quote, emit, waitForConfirmation, signal } = args;
  try {
    emit((s) => ({ steps: { ...s.steps, prepare: "active" } }));
    await sleep(700, signal);
    emit((s) => ({ steps: { ...s.steps, prepare: "done", wallet: "active" }, awaitingWallet: true, tracking: { provider: quote.provider, sourceChain: quote.sourceChain, destinationChain: quote.destinationChain, requestId: String(Date.now()) } }));
    const confirmed = await waitForConfirmation();
    if (!confirmed) {
      emit((s) => ({ awaitingWallet: false, finished: true, error: bridgeError("USER_REJECTED"), steps: { ...s.steps, wallet: "failed" } }));
      return;
    }
    emit((s) => ({ awaitingWallet: false, sentAt: Date.now(), steps: { ...s.steps, wallet: "done", sent: "active" } }));
    await sleep(900, signal);
    emit((s) => ({ steps: { ...s.steps, sent: "done", crossing: "active" }, status: { state: "in_transit", updatedAt: Date.now(), message: "Demo — simulated crossing" } }));
    const crossingMs = Math.min(6000, Math.max(2500, quote.estimatedDuration * 250));
    await sleep(crossingMs, signal);
    emit((s) => ({ steps: { ...s.steps, crossing: "done", destination: "done" }, status: { state: "arrived", updatedAt: Date.now(), message: "Demo — simulated arrival" }, arrivedAt: Date.now(), finished: true }));
  } catch {
    /* aborted */
  }
}
