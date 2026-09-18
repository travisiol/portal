import { createPublicClient, http, toFunctionSelector } from "viem";
const client = createPublicClient({ transport: http("https://ethereum-rpc.publicnode.com") });
const spoke = "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5";
// proxy? read implementation slot (EIP-1967)
const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const raw = await client.getStorageAt({ address: spoke, slot: implSlot });
const impl = "0x" + raw.slice(-40);
console.log("impl", impl);
const code = await client.getCode({ address: impl });
const sigs = {
  depositV3: "function depositV3(address depositor,address recipient,address inputToken,address outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,address exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityDeadline,bytes message)",
  deposit32: "function deposit(bytes32 depositor,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,bytes32 exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityParameter,bytes message)",
  wrappedNativeToken: "function wrappedNativeToken()",
};
for (const [name, sig] of Object.entries(sigs)) {
  const sel = toFunctionSelector(sig).slice(2);
  console.log(name, sel, code.includes(sel) ? "PRESENT" : "absent");
}
