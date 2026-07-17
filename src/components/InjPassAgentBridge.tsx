"use client";

import { useEffect } from "react";
import { getGiftAdapter } from "@/stacks";
import {
  getInjpassHostOrigin,
  getInjpassHostProvider,
  isInjpassMiniAppHost,
} from "@/wallet/injpass/hostProvider";
import { createInjGiftAgentMessageHandler } from "@/wallet/injpass/agentBridge";

export function InjPassAgentBridge() {
  useEffect(() => {
    if (!isInjpassMiniAppHost()) return;
    const origin = getInjpassHostOrigin();
    const provider = getInjpassHostProvider();
    if (!origin || !provider) return;

    const handler = createInjGiftAgentMessageHandler({
      parent: window.parent,
      origin,
      adapter: getGiftAdapter(),
      getSession: () => provider.getSession(),
      post: (payload) => window.parent.postMessage(payload, origin),
    });
    const listener = (event: MessageEvent) => void handler(event);
    window.addEventListener("message", listener);
    window.parent.postMessage({ channel: "injpass-miniapp-v1", type: "ready" }, origin);
    return () => window.removeEventListener("message", listener);
  }, []);

  return null;
}
