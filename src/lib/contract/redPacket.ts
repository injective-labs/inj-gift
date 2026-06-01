import { env } from "../env";
import type { PacketInfo } from "../../types/packet";
import type { JsonObject } from "@cosmjs/cosmwasm-stargate";
import { toBase64 } from "@cosmjs/encoding";

export interface CreatePacketMsg {
  total_amount: string;
  denom_or_cw20: string;
  count: number;
  password_hash: string;
  expires_at: number;
  mode: string; // "random" | "equal"
}

export interface ClaimMsg {
  packet_id: string;
  password: string;
}

/* --------------------
   Constants
-------------------- */
const getContractAddress = (): string => {
  const contract = env.NEXT_PUBLIC_INJ_GIFT_ADDRESS;
  if (!contract) throw new Error("[redPacket] contract address missing in env");
  return contract;
};

/* --------------------
   Msg builders
-------------------- */
const buildExecMsg = {
  create: (m: CreatePacketMsg): JsonObject => ({ create_packet: m }),
  claim: (m: ClaimMsg): JsonObject => ({ claim: m }),
  refund: (id: string): JsonObject => ({ refund: { packet_id: id } }),
};

/* --------------------
   Query helpers
-------------------- */
export const queryPacket = async (packetId: string): Promise<PacketInfo> => {
  const { NEXT_PUBLIC_LCD_ENDPOINT } = env;
  const contract = getContractAddress();
  const queryBase64 = toBase64(new TextEncoder().encode(JSON.stringify({ packet: { packet_id: packetId } })));
  const url = `${NEXT_PUBLIC_LCD_ENDPOINT}/cosmwasm/wasm/v1/contract/${contract}/smart/${queryBase64}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
  const data = await res.json();
  return data.data as PacketInfo;
};

/* --------------------
   Minimal client interface (to avoid CosmJS version conflicts)
-------------------- */
interface CosmWasmSigningClient {
  execute(
    senderAddress: string,
    contractAddress: string,
    msg: JsonObject,
    fee: "auto" | number | StdFee,
    memo?: string,
    funds?: readonly Coin[]
  ): Promise<ExecuteResult>;
}

interface Coin {
  denom: string;
  amount: string;
}

interface StdFee {
  amount: readonly Coin[];
  gas: string;
}

interface ExecuteResult {
  transactionHash: string;
  height: number;
  gasWanted: bigint | number;
  gasUsed: bigint | number;
}

/*
 * Generic execute wrapper
 */
const exec = async (
  client: CosmWasmSigningClient,
  sender: string,
  msg: JsonObject,
  funds: readonly { denom: string; amount: string }[] = []
) => {
  return client.execute(sender, getContractAddress(), msg, "auto", undefined, funds);
};

/* --------------------
   Execute functions
-------------------- */
export const createPacket = async (
  client: CosmWasmSigningClient,
  sender: string,
  msg: CreatePacketMsg,
  funds: readonly { denom: string; amount: string }[] = []
) => exec(client, sender, buildExecMsg.create(msg), funds);

export const claimPacket = async (
  client: CosmWasmSigningClient,
  sender: string,
  msg: ClaimMsg
) => exec(client, sender, buildExecMsg.claim(msg));

export const refundPacket = async (
  client: CosmWasmSigningClient,
  sender: string,
  packetId: string
) => exec(client, sender, buildExecMsg.refund(packetId));
