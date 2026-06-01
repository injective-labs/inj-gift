export {};

declare global {
  interface Eip1193RequestArgs {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }

  interface Eip1193Provider {
    request(args: Eip1193RequestArgs): Promise<unknown>;
    on?(event: string, listener: (...args: unknown[]) => void): void;
    removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  }

  interface Window {
    ethereum?: Eip1193Provider;
  }
}
