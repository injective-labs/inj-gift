"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { EVM_WALLETS } from "../config/wallets";
import { WalletItem } from "./WalletItem";
import type { WalletControllerState, WalletControllerActions } from "../controller/walletController.types";
import { useI18n, errorMessage } from "@/i18n";

export function WalletModal({
  state,
  actions,
}: {
  state: WalletControllerState;
  actions: WalletControllerActions;
}) {
  const { t: dict } = useI18n();
  const tw = dict.wallet;
  const isBusy = state.status === "connecting" || state.status === "switching_network";
  const hints = tw.hints as Record<string, string>;

  return (
    <Dialog.Root open={state.isModalOpen} onOpenChange={(o) => (o ? actions.openModal() : actions.closeModal())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={clsx(
            "fixed z-50 w-full max-w-md bg-white shadow-2xl border border-gray-200",
            "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl",
            "max-sm:left-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:max-w-none",
          )}
        >
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold text-gray-900">{tw.modalTitle}</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-1">
                {tw.modalDesc}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
                disabled={isBusy}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Status bar */}
          {(state.status === "connecting" || state.status === "switching_network") && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-gray-700" />
              <div className="text-sm font-medium text-gray-800">
                {state.status === "connecting" ? dict.common.connecting : tw.switchingNetwork}
              </div>
            </div>
          )}

          {/* Error */}
          {state.status === "error" && state.error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-900">{tw.connectFailed}</div>
                  <div className="text-sm text-red-700 mt-1 break-words">{errorMessage(state.error, dict)}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={actions.resetError}
                      className="px-3 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
                    >
                      {tw.gotIt}
                    </button>
                    {state.expectedChainId && state.chainId && state.chainId !== state.expectedChainId && (
                      <button
                        type="button"
                        onClick={() => actions.switchNetwork()}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        {tw.switchNetwork}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-6 space-y-3">
            {EVM_WALLETS.filter((w) => w.enabled !== false).map((w) => (
              <WalletItem
                key={w.id}
                title={w.name}
                hint={w.hintKey ? hints[w.hintKey] : undefined}
                recommended={w.recommended}
                disabled={isBusy || w.enabled === false}
                onClick={() => {
                  // connect() rethrows on failure; it already records the error
                  // into UI state, so swallow the rejection here to avoid an
                  // "Uncaught (in promise)" in the console.
                  void actions.connect(w.id).catch(() => {});
                }}
              />
            ))}
          </div>

          <div className="px-6 pb-6 text-xs text-gray-500">
            {state.expectedChainName ? (
              <div>
                {tw.network}: <span className="font-semibold text-gray-700">{state.expectedChainName}</span>
              </div>
            ) : (
              <div>{tw.networkFromEnv}</div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

