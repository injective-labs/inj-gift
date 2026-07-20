import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  verifyTypedData,
  type TypedDataDomain,
} from "ethers";
import { getGiftServerConfig } from "./config";

const GIFT_ABI = [
  "function claimNonces(address) view returns (uint256)",
  "function redPackets(bytes32) view returns (address creator,address token,uint256 totalAmount,uint256 totalCount,uint256 claimedAmount,uint256 claimedCount,bytes32 passwordHash,uint256 expiration,uint64 internalNonce,bytes32 lastClaimHash,uint8 mode,bool isActive)",
  "function hasClaimed(bytes32,address) view returns (bool)",
  "function claimWithSig((bytes32 id,bytes32 pwdHash,address claimer,uint256 nonce,uint256 deadline) permit,bytes signature)",
];

export const claimPermitTypes = {
  ClaimPermit: [
    { name: "id", type: "bytes32" },
    { name: "pwdHash", type: "bytes32" },
    { name: "claimer", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export type RelayClaimInput = {
  contractAddress: string;
  packetId: string;
  pwdHash: string;
  claimer: string;
  nonce: string;
  deadline: string;
  signature: string;
};

type ClaimContract = {
  claimNonces(claimer: string): Promise<bigint>;
  redPacket(packetId: string): Promise<{
    creator: string;
    totalCount: bigint;
    claimedCount: bigint;
    expiration: bigint;
    isActive: boolean;
  }>;
  hasClaimed(packetId: string, claimer: string): Promise<boolean>;
  estimateClaim(
    permit: ClaimPermit,
    signature: string,
  ): Promise<bigint>;
  submitClaim(
    permit: ClaimPermit,
    signature: string,
    gasLimit: bigint,
  ): Promise<{ hash: string }>;
};

type ClaimPermit = {
  id: string;
  pwdHash: string;
  claimer: string;
  nonce: bigint;
  deadline: bigint;
};

type RelayerDependencies = {
  now: () => number;
  environment: Record<string, string | undefined>;
  createContract: (
    contractAddress: string,
    privateKey: string,
    rpcUrl: string,
    chainId: number,
  ) => ClaimContract;
};

const globalForGiftRelayer = globalThis as typeof globalThis & {
  giftRelayLocks?: Map<string, number>;
};
const relayLocks = (globalForGiftRelayer.giftRelayLocks ??= new Map());

export class GiftRelayError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GiftRelayError";
  }
}

export function resolveAllowedGiftContracts(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return (environment.INJ_GIFT_CONTRACT_ADDRESSES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(getAddress);
}

export function recoverClaimSigner(
  domain: TypedDataDomain,
  permit: ClaimPermit,
  signature: string,
): string {
  return getAddress(verifyTypedData(domain, claimPermitTypes, permit, signature));
}

export function resolveRelayGasLimit(
  estimatedGas: bigint,
  maxGas: bigint,
): bigint {
  const gasLimit = (estimatedGas * 120n + 99n) / 100n;
  if (gasLimit > maxGas) {
    throw new GiftRelayError(400, "Claim gas estimate exceeds the limit");
  }
  return gasLimit;
}

function defaultCreateContract(
  contractAddress: string,
  privateKey: string,
  rpcUrl: string,
  chainId: number,
): ClaimContract {
  const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
  const contract = new Contract(
    contractAddress,
    GIFT_ABI,
    new Wallet(privateKey, provider),
  );
  return {
    claimNonces: (claimer) => contract.claimNonces(claimer) as Promise<bigint>,
    async redPacket(packetId) {
      const packet = await contract.redPackets(packetId) as {
        creator: string;
        totalCount: bigint;
        claimedCount: bigint;
        expiration: bigint;
        isActive: boolean;
      };
      return packet;
    },
    hasClaimed: (packetId, claimer) =>
      contract.hasClaimed(packetId, claimer) as Promise<boolean>,
    estimateClaim: (permit, signature) =>
      contract.claimWithSig.estimateGas(permit, signature) as Promise<bigint>,
    submitClaim: (permit, signature, gasLimit) =>
      contract.claimWithSig(permit, signature, { gasLimit }) as Promise<{ hash: string }>,
  };
}

function acquireRelayLock(key: string, now: number): () => void {
  const expiresAt = relayLocks.get(key) ?? 0;
  if (expiresAt > now) {
    throw new GiftRelayError(429, "Claim relay is already in progress");
  }
  const nextExpiry = now + 60_000;
  relayLocks.set(key, nextExpiry);
  setTimeout(() => {
    if (relayLocks.get(key) === nextExpiry) relayLocks.delete(key);
  }, 60_000);
  return () => {
    if (relayLocks.get(key) === nextExpiry) relayLocks.delete(key);
  };
}

export async function relayGiftClaim(
  input: RelayClaimInput,
  overrides: Partial<RelayerDependencies> = {},
): Promise<{ transactionHash: string }> {
  const environment = overrides.environment ?? process.env;
  const nowMs = (overrides.now ?? Date.now)();
  const config = getGiftServerConfig();
  const contractAddress = getAddress(input.contractAddress);
  const claimer = getAddress(input.claimer);
  const allowedContracts = resolveAllowedGiftContracts(environment);
  if (!allowedContracts.includes(contractAddress)) {
    throw new GiftRelayError(400, "INJ Gift contract is not allowed");
  }

  const permit: ClaimPermit = {
    id: input.packetId,
    pwdHash: input.pwdHash,
    claimer,
    nonce: BigInt(input.nonce),
    deadline: BigInt(input.deadline),
  };
  const now = BigInt(Math.floor(nowMs / 1000));
  if (permit.deadline <= now || permit.deadline > now + 10n * 60n) {
    throw new GiftRelayError(400, "Claim permit deadline is invalid");
  }

  const domain = {
    name: "InjGift",
    version: "1",
    chainId: config.chainId,
    verifyingContract: contractAddress,
  };
  if (recoverClaimSigner(domain, permit, input.signature) !== claimer) {
    throw new GiftRelayError(400, "Claim permit signer is invalid");
  }

  const privateKey = environment.INJ_GIFT_RELAYER_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new GiftRelayError(503, "INJ_GIFT_RELAYER_PRIVATE_KEY is not configured");
  }
  const releaseLock = acquireRelayLock(
    `${claimer.toLowerCase()}:${input.packetId.toLowerCase()}`,
    nowMs,
  );
  try {
    const contract = (overrides.createContract ?? defaultCreateContract)(
      contractAddress,
      privateKey,
      config.rpcUrl,
      config.chainId,
    );
    const [chainNonce, packet, alreadyClaimed] = await Promise.all([
      contract.claimNonces(claimer),
      contract.redPacket(input.packetId),
      contract.hasClaimed(input.packetId, claimer),
    ]);
    if (chainNonce !== permit.nonce) {
      throw new GiftRelayError(400, "Claim permit nonce is stale");
    }
    if (
      packet.creator === "0x0000000000000000000000000000000000000000"
      || !packet.isActive
      || packet.expiration < now
      || packet.claimedCount >= packet.totalCount
      || alreadyClaimed
    ) {
      throw new GiftRelayError(400, "Packet is not claimable");
    }

    const gas = await contract.estimateClaim(permit, input.signature);
    const gasLimit = resolveRelayGasLimit(
      gas,
      BigInt(environment.INJ_GIFT_RELAYER_MAX_GAS ?? "500000"),
    );
    const transaction = await contract.submitClaim(
      permit,
      input.signature,
      gasLimit,
    );
    return { transactionHash: transaction.hash };
  } catch (error) {
    releaseLock();
    throw error;
  }
}
