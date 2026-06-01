import { defineChain } from "viem";
import { INJECTIVE_EVM_NETWORKS } from "@/stacks/evm/config";

const testnetParams = INJECTIVE_EVM_NETWORKS.testnet;
export const injectiveInEvmTestnet = defineChain({
  id: testnetParams.chainId,
  name: testnetParams.chainName,
  nativeCurrency: testnetParams.nativeCurrency,
  rpcUrls: {
    default: { http: testnetParams.rpcUrls },
  },
  blockExplorers: {
    default: {
      name: "Injective Explorer",
      url: testnetParams.blockExplorerUrls[0],
    },
  },
  testnet: true,
});

const mainnetParams = INJECTIVE_EVM_NETWORKS.mainnet;
export const injectiveInEvmMainnet = defineChain({
  id: mainnetParams.chainId,
  name: mainnetParams.chainName,
  nativeCurrency: mainnetParams.nativeCurrency,
  rpcUrls: {
    default: { http: mainnetParams.rpcUrls },
  },
  blockExplorers: {
    default: {
      name: "Injective Explorer",
      url: mainnetParams.blockExplorerUrls[0],
    },
  },
  testnet: false,
});
