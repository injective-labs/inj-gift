const STORAGE_KEY = "injgift.packetPasscodes";

type PacketPasscodeReference = {
  packetId?: string;
  shareCode?: string;
};

type PacketPasscodeInput = PacketPasscodeReference & {
  passcode: string;
};

function storageKey(value: string): string {
  return value.startsWith("0x") ? value.toLowerCase() : value;
}

function readPasscodes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberPacketPasscode(input: PacketPasscodeInput): void {
  if (typeof window === "undefined" || !input.passcode) return;
  const passcodes = readPasscodes();
  if (input.packetId) passcodes[storageKey(input.packetId)] = input.passcode;
  if (input.shareCode) passcodes[storageKey(input.shareCode)] = input.passcode;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passcodes));
}

export function getPacketPasscode(reference: PacketPasscodeReference): string | null {
  const passcodes = readPasscodes();
  if (reference.shareCode) {
    const passcode = passcodes[storageKey(reference.shareCode)];
    if (passcode) return passcode;
  }
  if (reference.packetId) {
    return passcodes[storageKey(reference.packetId)] ?? null;
  }
  return null;
}
