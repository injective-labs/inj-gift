"use client";

import { useMemo, useState } from "react";
import { useGiftAdapter } from "@/hooks/useGiftAdapter";
import { useTx } from "@/hooks/useTx";
import { toast } from "sonner";
import type { CreatePacketInput } from "@/domain/types";
import { ethers } from "ethers";

export default function DebugPage() {
  const { adapter, adapterError } = useGiftAdapter();

  const [address, setAddress] = useState<string | null>(null);
  const [packetId, setPacketId] = useState<string>(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  );

  const [createInput, setCreateInput] = useState<CreatePacketInput>({
    token: ethers.ZeroAddress,
    amount: "10000000000000000", // 0.01
    count: 2,
    password: "test",
    durationSec: 3600,
    mode: "random",
  });

  const getAddrTx = useTx();
  const connectTx = useTx();
  const disconnectTx = useTx();
  const getPacketTx = useTx();
  const createTx = useTx();
  const claimTx = useTx();
  const refundTx = useTx();

  const stackLabel = adapter.stack;

  const refreshAddress = async () => {
    const addr = await adapter.getAddress();
    setAddress(addr);
  };

  const onConnect = async () => {
    await connectTx.run(async () => {
      await adapter.connect();
      await refreshAddress();
      return { hash: "0x" };
    });
    toast.success("Connected");
  };

  const onDisconnect = async () => {
    await disconnectTx.run(async () => {
      await adapter.disconnect();
      setAddress(null);
      return { hash: "0x" };
    });
    toast.success("Disconnected");
  };

  const onGetPacket = async () => {
    const id = packetId.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(id)) {
      toast.error("packetId must be 0x + 64 hex chars");
      return;
    }

    const packet = await getPacketTx.run(async () => {
      const p = await adapter.getPacket(id);
      // no receipt; return fake hash
      console.log("packet", p);
      return { hash: "0x" };
    });
    void packet;
    toast.success("Fetched packet (see console)");
  };

  const onCreate = async () => {
    const hash = await createTx.run(async () => {
      const res = await adapter.createPacket(createInput);
      return { hash: res.hash };
    });
    toast.success(`create tx: ${hash.slice(0, 10)}...`);
  };

  const onClaim = async () => {
    const id = packetId.trim();
    const hash = await claimTx.run(async () => {
      const res = await adapter.claimPacket({ id, password: createInput.password });
      return { hash: res.hash };
    });
    toast.success(`claim tx: ${hash.slice(0, 10)}...`);
  };

  const onRefund = async () => {
    await refundTx.run(async () => {
      const res = await adapter.refundPacket(packetId.trim());
      return { hash: res.hash };
    });
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Debug</h1>

      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">Stack:</span> {stackLabel}
        </div>
        <div>
          <span className="font-medium">Adapter error:</span>{" "}
          {adapterError ? `${adapterError.code}: ${adapterError.message}` : "none"}
        </div>
        <div>
          <span className="font-medium">Address:</span> {address ?? "(not connected)"}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="border px-3 py-2" onClick={onConnect}>
          Connect
        </button>
        <button className="border px-3 py-2" onClick={onDisconnect}>
          Disconnect
        </button>
        <button className="border px-3 py-2" onClick={() => refreshAddress()}>
          Refresh Address
        </button>
      </div>

      <hr />

      <div className="space-y-2">
        <div className="font-medium">Packet</div>
        <input
          className="border px-3 py-2 w-full"
          value={packetId}
          onChange={(e) => setPacketId(e.target.value)}
          placeholder="0x... (bytes32)"
        />
        <button className="border px-3 py-2" onClick={onGetPacket}>
          getPacket (logs to console)
        </button>
      </div>

      <hr />

      <div className="space-y-2">
        <div className="font-medium">Create (EVM only)</div>
        <label className="block text-sm">
          Token (0x0 for native)
          <input
            className="border px-3 py-2 w-full"
            value={createInput.token}
            onChange={(e) => setCreateInput((s) => ({ ...s, token: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Amount (wei)
          <input
            className="border px-3 py-2 w-full"
            value={createInput.amount}
            onChange={(e) => setCreateInput((s) => ({ ...s, amount: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Count
          <input
            className="border px-3 py-2 w-full"
            type="number"
            value={createInput.count}
            onChange={(e) => setCreateInput((s) => ({ ...s, count: Number(e.target.value) }))}
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            className="border px-3 py-2 w-full"
            value={createInput.password}
            onChange={(e) => setCreateInput((s) => ({ ...s, password: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          Duration (sec)
          <input
            className="border px-3 py-2 w-full"
            type="number"
            value={createInput.durationSec}
            onChange={(e) =>
              setCreateInput((s) => ({ ...s, durationSec: Number(e.target.value) }))
            }
          />
        </label>
        <label className="block text-sm">
          Mode
          <select
            className="border px-3 py-2 w-full"
            value={createInput.mode}
            onChange={(e) => setCreateInput((s) => ({ ...s, mode: e.target.value as any }))}
          >
            <option value="random">random</option>
            <option value="equal">equal</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button className="border px-3 py-2" onClick={onCreate}>
            createPacket
          </button>
          <button className="border px-3 py-2" onClick={onClaim}>
            claimPacket (uses Password above)
          </button>
          <button className="border px-3 py-2" onClick={onRefund}>
            refundPacket
          </button>
        </div>

        <div className="text-xs text-gray-600">
          Tx state: create={createTx.state.status}, claim={claimTx.state.status},
          refund={refundTx.state.status}
        </div>
      </div>
    </main>
  );
}


