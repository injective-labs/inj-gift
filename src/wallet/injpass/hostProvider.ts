"use client";

import type { Eip1193Provider } from "@injpass/cli";

export const INJPASS_MINIAPP_CHANNEL = "injpass-miniapp-v1";

export interface InjPassHostSession {
  authenticated: boolean;
  address: string | null;
  walletName?: string;
  chainId: number;
}

type EventHandler = (...args: unknown[]) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error & { code?: number; data?: unknown }) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function getInjpassHostOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const configured = new URLSearchParams(window.location.search).get("injpass_host_origin");
  if (configured) {
    try {
      const origin = new URL(configured).origin;
      window.sessionStorage.setItem("injpass.miniapp.parentOrigin", origin);
      return origin;
    } catch {
      return null;
    }
  }
  const stored = window.sessionStorage.getItem("injpass.miniapp.parentOrigin");
  if (stored) return stored;
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

export function isInjpassMiniAppHost(): boolean {
  if (typeof window === "undefined" || window.parent === window) return false;
  const fromQuery = new URLSearchParams(window.location.search).get("injpass_miniapp") === "1";
  if (fromQuery) {
    window.sessionStorage.setItem("injpass.miniapp.active", "1");
    return true;
  }
  return window.sessionStorage.getItem("injpass.miniapp.active") === "1";
}

class InjPassHostProvider implements Eip1193Provider {
  isInjPass = true;
  isMetaMask = false;

  private readonly parentOrigin: string;
  private requestCounter = 0;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Set<EventHandler>>();
  private session: InjPassHostSession | null = null;
  private sessionListeners = new Set<(session: InjPassHostSession) => void>();
  private navigationDepth = 0;
  private navigationForwardDepth = 0;
  private originalPushState: History["pushState"] | null = null;
  private originalReplaceState: History["replaceState"] | null = null;
  private titleObserver: MutationObserver | null = null;

  constructor(parentOrigin: string) {
    this.parentOrigin = parentOrigin;
    this.navigationDepth = window.location.pathname === "/" ? 0 : 1;
    window.addEventListener("message", this.handleMessage);
    this.installNavigationBridge();
    this.post({ type: "ready" });
    queueMicrotask(this.sendNavigation);
  }

  request = async ({ method, params = [] }: { method: string; params?: unknown[] }): Promise<unknown> => {
    const id = `gift-${Date.now()}-${++this.requestCounter}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error("INJ Pass did not answer the mini app request.") as Error & { code?: number };
        error.code = -32000;
        reject(error);
      }, 60_000);
      this.pending.set(id, { resolve, reject, timer });
      this.post({ type: "rpc-request", id, method, params });
    });
  };

  on = (event: string, handler: EventHandler): void => {
    const handlers = this.listeners.get(event) || new Set<EventHandler>();
    handlers.add(handler);
    this.listeners.set(event, handlers);
  };

  removeListener = (event: string, handler: EventHandler): void => {
    this.listeners.get(event)?.delete(handler);
  };

  getSession(): InjPassHostSession | null {
    return this.session;
  }

  waitForSession(timeoutMs = 10_000): Promise<InjPassHostSession> {
    if (this.session) return Promise.resolve(this.session);
    this.post({ type: "ready" });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("INJ Pass mini app session was not received."));
      }, timeoutMs);
      const unsubscribe = this.subscribe((session) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(session);
      });
    });
  }

  async waitForAuthenticatedSession(timeoutMs = 180_000): Promise<InjPassHostSession> {
    const initial = await this.waitForSession(Math.min(timeoutMs, 10_000));
    if (initial.authenticated && initial.address) return initial;

    await this.request({ method: "injpass_requestLogin" });
    const current = this.session;
    if (current?.authenticated && current.address) return current;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("INJ Pass login was not completed."));
      }, timeoutMs);
      const unsubscribe = this.subscribe((session) => {
        if (!session.authenticated || !session.address) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(session);
      });
    });
  }

  subscribe(listener: (session: InjPassHostSession) => void): () => void {
    this.sessionListeners.add(listener);
    if (this.session) queueMicrotask(() => listener(this.session as InjPassHostSession));
    return () => this.sessionListeners.delete(listener);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((handler) => handler(...args));
  }

  private rejectPending(message: string, code: number): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      const error = new Error(message) as Error & { code?: number };
      error.code = code;
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private post(payload: Record<string, unknown>): void {
    window.parent.postMessage({ channel: INJPASS_MINIAPP_CHANNEL, ...payload }, this.parentOrigin);
  }

  private readNavigationPath(): string {
    const url = new URL(window.location.href);
    url.searchParams.delete("injpass_miniapp");
    url.searchParams.delete("injpass_host_origin");
    return `${url.pathname}${url.search}${url.hash}` || "/";
  }

  private sendNavigation = (): void => {
    this.post({
      type: "navigation",
      path: this.readNavigationPath(),
      title: document.title || "INJ Gift",
      canGoBack: this.navigationDepth > 0 || window.location.pathname !== "/",
      canGoForward: this.navigationForwardDepth > 0,
    });
  };

  private scheduleNavigation = (): void => {
    window.setTimeout(this.sendNavigation, 0);
  };

  private installNavigationBridge(): void {
    this.originalPushState = window.history.pushState;
    this.originalReplaceState = window.history.replaceState;
    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      this.originalPushState?.call(window.history, data, unused, url);
      this.navigationDepth += 1;
      this.navigationForwardDepth = 0;
      this.scheduleNavigation();
    }) as History["pushState"];
    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      this.originalReplaceState?.call(window.history, data, unused, url);
      this.scheduleNavigation();
    }) as History["replaceState"];
    window.addEventListener("popstate", this.sendNavigation);
    window.addEventListener("hashchange", this.sendNavigation);
    this.titleObserver = new MutationObserver(this.scheduleNavigation);
    this.titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  }

  private handleNavigationCommand(action: unknown): void {
    if (action === "back") {
      if (this.navigationDepth <= 0 && window.location.pathname === "/") return;
      this.navigationDepth = Math.max(0, this.navigationDepth - 1);
      this.navigationForwardDepth += 1;
      window.history.back();
      return;
    }
    if (action === "forward") {
      if (this.navigationForwardDepth <= 0) return;
      this.navigationDepth += 1;
      this.navigationForwardDepth -= 1;
      window.history.forward();
      return;
    }
    if (action === "home") {
      this.navigationDepth = 0;
      this.navigationForwardDepth = 0;
      window.location.assign("/");
      return;
    }
    if (action === "reload") window.location.reload();
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent || event.origin !== this.parentOrigin) return;
    const message = event.data as Record<string, unknown> | null;
    if (!message || message.channel !== INJPASS_MINIAPP_CHANNEL) return;

    if (message.type === "navigation-command") {
      this.handleNavigationCommand(message.action);
      return;
    }

    if (message.type === "session") {
      const previous = this.session;
      const candidate = message.session as Partial<InjPassHostSession> | null;
      if (
        !candidate
        || typeof candidate.authenticated !== "boolean"
        || (candidate.address !== null && typeof candidate.address !== "string")
        || typeof candidate.chainId !== "number"
      ) return;
      const next = candidate as InjPassHostSession;
      this.session = next;
      this.sessionListeners.forEach((listener) => listener(next));
      if (previous?.address !== next.address) {
        this.emit("accountsChanged", next.address ? [next.address] : []);
      }
      if (previous?.chainId !== next.chainId) {
        this.emit("chainChanged", `0x${next.chainId.toString(16)}`);
      }
      if (!next.authenticated || !next.address) {
        this.rejectPending("INJ Pass wallet session ended.", 4100);
      }
      return;
    }

    if (message.type !== "rpc-response" || typeof message.id !== "string") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error && typeof message.error === "object") {
      const payload = message.error as { code?: number; message?: string; data?: unknown };
      const error = new Error(payload.message || "INJ Pass request failed.") as Error & { code?: number; data?: unknown };
      error.code = payload.code;
      error.data = payload.data;
      pending.reject(error);
      return;
    }
    pending.resolve(message.result);
  };
}

let hostProvider: InjPassHostProvider | null = null;

export function getInjpassHostProvider(): InjPassHostProvider | null {
  if (!isInjpassMiniAppHost()) return null;
  if (hostProvider) return hostProvider;
  const parentOrigin = getInjpassHostOrigin();
  if (!parentOrigin) return null;
  hostProvider = new InjPassHostProvider(parentOrigin);
  return hostProvider;
}

export function subscribeToInjpassHostSession(
  listener: (session: InjPassHostSession) => void,
): () => void {
  const provider = getInjpassHostProvider();
  if (!provider) return () => undefined;
  return provider.subscribe(listener);
}

export async function requestInjpassHostLogin(): Promise<void> {
  const provider = getInjpassHostProvider();
  if (!provider) return;
  await provider.request({ method: "injpass_requestLogin" });
}
