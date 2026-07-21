import { BrowserProvider, Contract, Interface, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import type { Eip1193Provider } from "@injpass/cli";
import type { GiftAdapter } from "@/domain/giftAdapter";
import { resolvePacketReference } from "@/features/my-packets/client";
import { getEvmConfigOrThrow, injGiftAddress } from "@/stacks/evm/config";
import { connectInjpass } from "@/wallet/injpass/provider";

type ConnectedWallet = {
  address: string;
  provider: Eip1193Provider;
};

export type ClaimReceipt = {
  status?: number | string | null;
  logs?: Array<{ address?: string; data?: string; topics?: ReadonlyArray<string> }>;
};

type Dependencies = {
  connect: () => Promise<ConnectedWallet>;
  readNonce: (
    contractAddress: string,
    address: string,
    provider: Eip1193Provider,
  ) => Promise<bigint>;
  fetcher: typeof fetch;
  now: () => number;
  relayerUrl: string;
  /**
   * Optional receipt waiter. When provided, the claim resolves only after the
   * relayed tx is mined, letting us surface the real claimed amount and catch
   * on-chain reverts. When omitted, the call returns as soon as the relayer
   * accepts the tx (hash only).
   */
  waitForReceipt?: (
    hash: string,
    provider: Eip1193Provider,
  ) => Promise<ClaimReceipt | null>;
};

const claimedEventInterface = new Interface([
  "event RedPacketClaimed(bytes32 indexed id,address indexed claimer,uint256 amount)",
]);

function extractClaimAmount(receipt: ClaimReceipt | null): string | undefined {
  if (!receipt?.logs?.length) return undefined;
  for (const log of receipt.logs) {
    try {
      const parsed = claimedEventInterface.parseLog({
        topics: [...(log.topics ?? [])],
        data: log.data ?? "0x",
      });
      if (parsed?.name === "RedPacketClaimed") {
        const amount = parsed.args?.amount ?? parsed.args?.[2];
        if (amount != null) return amount.toString();
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function isReverted(receipt: ClaimReceipt | null): boolean {
  if (!receipt || receipt.status == null) return false;
  return receipt.status === 0 || receipt.status === "0x0";
}

/**
 * Production receipt waiter for the relayed claim tx. Prefers a direct public
 * RPC — its `eth_getTransactionReceipt` is reliable — over the wallet provider,
 * because embedded wallets (e.g. the INJ Pass provider) may not poll receipts,
 * which previously left the claimed amount blank. Falls back to the wallet
 * provider, and degrades to `null` on timeout so a slow RPC never turns an
 * accepted claim into a fake failure.
 */
export const waitForClaimReceipt = async (
  hash: string,
  provider: Eip1193Provider,
): Promise<ClaimReceipt | null> => {
  try {
    const { rpcUrl } = getEvmConfigOrThrow();
    if (rpcUrl) {
      const receipt = await new JsonRpcProvider(rpcUrl).waitForTransaction(hash, 1, 30_000);
      if (receipt) return receipt as unknown as ClaimReceipt;
    }
  } catch {
    // fall through to the wallet provider
  }
  try {
    const browserProvider = new BrowserProvider(provider);
    return (await browserProvider.waitForTransaction(hash, 1, 20_000)) as
      | ClaimReceipt
      | null;
  } catch {
    return null;
  }
};

const defaultReadNonce: Dependencies["readNonce"] = async (
  contractAddress,
  address,
  provider,
) => {
  const browserProvider = new BrowserProvider(provider);
  const contract = new Contract(
    contractAddress,
    ["function claimNonces(address) view returns (uint256)"],
    browserProvider,
  );
  return contract.claimNonces(address) as Promise<bigint>;
};

function defaultRelayerUrl(): string {
  return "/api/gift/claims/relay";
}

const defaultFetcher: typeof fetch = (input, init) => globalThis.fetch(input, init);

async function relayErrorMessage(response: Response): Promise<string> {
  const fallback = `INJ Gift relayer returned ${response.status}`;
  try {
    const payload = await response.json() as {
      error?: { message?: unknown };
    };
    if (
      payload.error
      && typeof payload.error.message === "string"
      && payload.error.message.trim()
    ) {
      return payload.error.message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function claimPacketGasless(
  input: {
    packetId: string;
    password: string;
    contractAddress: string;
    chainId: number;
  },
  overrides: Partial<Dependencies> = {},
): Promise<{ hash: string; receipt?: ClaimReceipt | null; claimAmount?: string }> {
  const dependencies: Dependencies = {
    connect: overrides.connect ?? connectInjpass,
    readNonce: overrides.readNonce ?? defaultReadNonce,
    fetcher: overrides.fetcher ?? defaultFetcher,
    now: overrides.now ?? Date.now,
    relayerUrl: overrides.relayerUrl ?? defaultRelayerUrl(),
    waitForReceipt: overrides.waitForReceipt,
  };
  const { address, provider } = await dependencies.connect();
  const nonce = await dependencies.readNonce(
    input.contractAddress,
    address,
    provider,
  );
  const deadline = BigInt(Math.floor(dependencies.now() / 1000) + 5 * 60);
  const pwdHash = keccak256(toUtf8Bytes(input.password));
  const typedData = {
    domain: {
      name: "InjGift",
      version: "1",
      chainId: input.chainId,
      verifyingContract: input.contractAddress,
    },
    primaryType: "ClaimPermit",
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ClaimPermit: [
        { name: "id", type: "bytes32" },
        { name: "pwdHash", type: "bytes32" },
        { name: "claimer", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    message: {
      id: input.packetId,
      pwdHash,
      claimer: address,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    },
  };
  const signature = (await provider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(typedData)],
  })) as string;
  const response = await dependencies.fetcher(dependencies.relayerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractAddress: input.contractAddress,
      packetId: input.packetId,
      pwdHash,
      claimer: address,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    }),
  });
  if (!response.ok) {
    throw new Error(await relayErrorMessage(response));
  }
  const payload = (await response.json()) as { transactionHash: string };
  const hash = payload.transactionHash;

  if (!dependencies.waitForReceipt) {
    return { hash };
  }

  const receipt = await dependencies.waitForReceipt(hash, provider);
  if (isReverted(receipt)) {
    throw new Error("Claim transaction reverted on-chain");
  }
  return { hash, receipt, claimAmount: extractClaimAmount(receipt) };
}

type ClaimReferenceDependencies = {
  resolveReference: typeof resolvePacketReference;
  claimGasless: typeof claimPacketGasless;
  currentContractAddress: string | undefined;
};

export async function claimPacketReference(
  input: {
    reference: string;
    password: string;
    adapter: GiftAdapter;
    waitForReceipt?: (
      hash: string,
      provider: Eip1193Provider,
    ) => Promise<ClaimReceipt | null>;
  },
  overrides: Partial<ClaimReferenceDependencies> = {},
): Promise<{
  hash: string;
  packetId: string;
  claimAmount?: string;
  receipt?: unknown;
}> {
  const resolveReference = overrides.resolveReference ?? resolvePacketReference;
  const claimGasless = overrides.claimGasless ?? claimPacketGasless;
  const currentContractAddress = overrides.currentContractAddress ?? injGiftAddress;
  const packet = await resolveReference(input.reference);

  if (
    packet.contractAddress
    && packet.chainId
    && currentContractAddress
    && packet.contractAddress.toLowerCase() === currentContractAddress.toLowerCase()
  ) {
    const result = input.waitForReceipt
      ? await claimGasless(
          {
            packetId: packet.packetId,
            password: input.password,
            contractAddress: packet.contractAddress,
            chainId: packet.chainId,
          },
          { waitForReceipt: input.waitForReceipt },
        )
      : await claimGasless({
          packetId: packet.packetId,
          password: input.password,
          contractAddress: packet.contractAddress,
          chainId: packet.chainId,
        });
    return { ...result, packetId: packet.packetId };
  }

  const result = await input.adapter.claimPacket({
    id: packet.packetId,
    password: input.password,
  }, packet.contractAddress);
  return { ...result, packetId: packet.packetId };
}
