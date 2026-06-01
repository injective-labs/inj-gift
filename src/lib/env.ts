import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_NETWORK: z.enum(['testnet', 'mainnet']),
  NEXT_PUBLIC_LCD_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_RPC_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_CHAIN_ID: z.string().min(1),
  // WASM contract address (kept for future CosmWasm adaptation)
  // Optional so EVM-first builds don't fail when only NEXT_PUBLIC_EVM_* is configured.
  NEXT_PUBLIC_INJ_GIFT_ADDRESS: z.string().optional(),
});

type EnvVars = z.infer<typeof EnvSchema>;

const _env = {
  NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
  NEXT_PUBLIC_LCD_ENDPOINT: process.env.NEXT_PUBLIC_LCD_ENDPOINT,
  NEXT_PUBLIC_RPC_ENDPOINT: process.env.NEXT_PUBLIC_RPC_ENDPOINT,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_INJ_GIFT_ADDRESS: process.env.NEXT_PUBLIC_INJ_GIFT_ADDRESS,
} as Record<string, unknown>;

export const env: EnvVars = (() => {
  const parsed = EnvSchema.safeParse(_env);
  if (!parsed.success) {
    // throw readable error in dev; fallback empty in prod build
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors,
    );
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('Invalid env vars');
    }
    // Return placeholder values in production to satisfy types
    const fallback: EnvVars = {
      NEXT_PUBLIC_NETWORK: 'testnet',
      NEXT_PUBLIC_LCD_ENDPOINT: '',
      NEXT_PUBLIC_RPC_ENDPOINT: '',
      NEXT_PUBLIC_CHAIN_ID: '',
      NEXT_PUBLIC_INJ_GIFT_ADDRESS: '',
    };
    return fallback;
  }
  return parsed.data;
})();