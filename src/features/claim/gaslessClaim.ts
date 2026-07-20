import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from "ethers";
import type { Eip1193Provider } from "@injpass/cli";
import type { GiftAdapter } from "@/domain/giftAdapter";
import { resolvePacketReference } from "@/features/my-packets/client";
import { injGiftAddress } from "@/stacks/evm/config";
import { connectInjpass } from "@/wallet/injpass/provider";

type ConnectedWallet = {
  address: string;
  provider: Eip1193Provider;
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

export async function claimPacketGasless(
  input: {
    packetId: string;
    password: string;
    contractAddress: string;
    chainId: number;
  },
  overrides: Partial<Dependencies> = {},
): Promise<{ hash: string }> {
  const dependencies: Dependencies = {
    connect: overrides.connect ?? connectInjpass,
    readNonce: overrides.readNonce ?? defaultReadNonce,
    fetcher: overrides.fetcher ?? defaultFetcher,
    now: overrides.now ?? Date.now,
    relayerUrl: overrides.relayerUrl ?? defaultRelayerUrl(),
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
    throw new Error(`INJ Gift relayer returned ${response.status}`);
  }
  const payload = (await response.json()) as { transactionHash: string };
  return { hash: payload.transactionHash };
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
    const result = await claimGasless({
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
