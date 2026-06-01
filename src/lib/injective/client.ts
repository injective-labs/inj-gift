import { env } from "../env";
import { ChainGrpcBankApi, ChainGrpcTxFeesApi, TxRestApi } from "@injectivelabs/sdk-ts";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";

class InjectiveEnvError extends Error {
  constructor(msg: string) { super(`[injective-client] ${msg}`); }
}

export const createQueryClient = () => {
  const { NEXT_PUBLIC_LCD_ENDPOINT, NEXT_PUBLIC_RPC_ENDPOINT } = env;
  if (!NEXT_PUBLIC_LCD_ENDPOINT || !NEXT_PUBLIC_RPC_ENDPOINT) {
    throw new InjectiveEnvError("LCD or RPC endpoint missing");
  }
  return {
    bank: new ChainGrpcBankApi(NEXT_PUBLIC_LCD_ENDPOINT),
    tx: new ChainGrpcTxFeesApi(NEXT_PUBLIC_LCD_ENDPOINT),
    rest: new TxRestApi(NEXT_PUBLIC_LCD_ENDPOINT),
  } as const;
};

export const createTxClient = async (
  signer: SigningCosmWasmClient | undefined,
): Promise<SigningCosmWasmClient> => {
  if (!signer) throw new InjectiveEnvError("Signer undefined");
  return signer; // Wallet already connected to RPC
};
