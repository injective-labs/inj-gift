import { z } from "zod";

const schema = z.object({
  chainId: z.coerce.number().int().positive(),
  rpcUrl: z.string().url(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export type GiftServerConfig = {
  chainId: number;
  rpcUrl?: string;
  contractAddress: `0x${string}`;
};

export function getGiftServerConfig(): Required<GiftServerConfig> {
  const parsed = schema.parse({
    chainId: process.env.GIFT_EVM_CHAIN_ID ?? process.env.NEXT_PUBLIC_EVM_CHAIN_ID,
    rpcUrl: process.env.GIFT_EVM_RPC_URL ?? process.env.NEXT_PUBLIC_EVM_RPC_URL,
    contractAddress: process.env.GIFT_EVM_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_EVM_CONTRACT_ADDRESS,
  });
  return parsed as Required<GiftServerConfig>;
}
