import type { AppError } from "@/domain/errors";

/**
 * WalletController is intentionally backend-agnostic.
 * 
 * Phase 1 (current): EVM-first (Injective inEVM) implementation only.
 * Future: a CosmWasm controller can implement the same interface and be swapped in
 * without changing UI components.
 */
export type WalletBackend = "evm" | "wasm";

export type WalletUiStatus =
  | "idle"
  | "connecting"
  | "switching_network"
  | "connected"
  | "error";

export type WalletDescriptor = {
  id: string;
  name: string;
  logoSrc?: string;
  hint?: string;
  recommended?: boolean;
  enabled?: boolean;
};

export type WalletControllerState = {
  backend: WalletBackend;
  status: WalletUiStatus;
  isModalOpen: boolean;
  selectedWalletId: string | null;
  address: string | null;
  chainId: number | null;
  expectedChainId: number | null;
  expectedChainName: string | null;
  error: AppError | null;
};

export type WalletControllerActions = {
  openModal: () => void;
  closeModal: () => void;
  selectWallet: (id: string) => void;
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  resetError: () => void;
};

export type WalletController = {
  state: WalletControllerState;
  actions: WalletControllerActions;
};

