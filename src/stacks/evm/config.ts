import { z } from "zod";

const EvmEnvSchema = z.object({
  NEXT_PUBLIC_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  NEXT_PUBLIC_EVM_CHAIN_ID: z
    .string()
    .min(1)
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, "invalid chain id")
    .optional(),
  NEXT_PUBLIC_EVM_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_EVM_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "invalid address")
    .optional(),
});

export type EvmEnv = z.infer<typeof EvmEnvSchema>;

const _raw = {
  NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
  NEXT_PUBLIC_EVM_CHAIN_ID: process.env.NEXT_PUBLIC_EVM_CHAIN_ID,
  NEXT_PUBLIC_EVM_RPC_URL: process.env.NEXT_PUBLIC_EVM_RPC_URL,
  NEXT_PUBLIC_EVM_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS,
} as Record<string, unknown>;

const _parsed = EvmEnvSchema.safeParse(_raw);

export const evmEnv: EvmEnv = _parsed.success
  ? _parsed.data
  : {
      NEXT_PUBLIC_NETWORK: "testnet",
      NEXT_PUBLIC_EVM_CHAIN_ID: undefined,
      NEXT_PUBLIC_EVM_RPC_URL: undefined,
      NEXT_PUBLIC_EVM_CONTRACT_ADDRESS: undefined,
    };

// Injective inEVM Official Params
export const INJECTIVE_EVM_NETWORKS = {
  testnet: {
    chainId: 1439,
    chainName: "Injective inEVM Testnet",
    nativeCurrency: { name: "INJ", symbol: "INJ", decimals: 18 },
    rpcUrls: ["https://k8s.testnet.json-rpc.injective.network/"],
    blockExplorerUrls: ["https://testnet.blockscout.injective.network/"],
  },
  mainnet: {
    chainId: 1776,
    chainName: "Injective inEVM Mainnet",
    nativeCurrency: { name: "INJ", symbol: "INJ", decimals: 18 },
    rpcUrls: ["https://sentry.evm-rpc.injective.network/"],
    blockExplorerUrls: ["https://blockscout.injective.network"],
  },
};

export const evmConfig = {
  isConfigured: !!(
    (evmEnv.NEXT_PUBLIC_EVM_CHAIN_ID || INJECTIVE_EVM_NETWORKS[evmEnv.NEXT_PUBLIC_NETWORK].chainId) &&
    evmEnv.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS
  ),
  errors: _parsed.success ? undefined : _parsed.error.flatten().fieldErrors,
};

export const getEvmConfigOrThrow = () => {
  if (!evmConfig.isConfigured) {
    const missing: string[] = [];
    if (!evmEnv.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS)
      missing.push("NEXT_PUBLIC_EVM_CONTRACT_ADDRESS");
    throw new Error(`EVM not configured: missing ${missing.join(", ")}`);
  }
  
  const networkParams = INJECTIVE_EVM_NETWORKS[evmEnv.NEXT_PUBLIC_NETWORK];
  
  return {
    chainId: evmEnv.NEXT_PUBLIC_EVM_CHAIN_ID || networkParams.chainId,
    rpcUrl: evmEnv.NEXT_PUBLIC_EVM_RPC_URL || networkParams.rpcUrls[0],
    contractAddress: evmEnv.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS!,
    networkParams: networkParams,
  };
};

export const injGiftAddress = evmEnv
  .NEXT_PUBLIC_EVM_CONTRACT_ADDRESS as `0x${string}` | undefined;

export const evmChain = {
  get chainId() { return getEvmConfigOrThrow().chainId; },
  get rpcUrl() { return getEvmConfigOrThrow().rpcUrl; },
  get params() { return getEvmConfigOrThrow().networkParams; }
} as const;

