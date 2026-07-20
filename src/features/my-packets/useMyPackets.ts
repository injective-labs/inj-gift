"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import {
  flushPacketSyncOutbox,
  syncCreatedPacket,
  type PacketSyncItem,
} from "@/client/gift/packetSync";
import { fetchMyPackets } from "./client";
import type { GiftPacketIndex } from "./types";

export function useMyPackets() {
  const { address } = useAccount();
  const [packets, setPackets] = useState<GiftPacketIndex[]>([]);
  const [packetOwner, setPacketOwner] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (!address) {
      setPackets([]);
      setPacketOwner(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    try {
      await flushPacketSyncOutbox();
      const next = await fetchMyPackets(address);
      if (generation.current !== currentGeneration) return;
      setPackets(next);
      setPacketOwner(address);
      setStatus("ready");
    } catch {
      if (generation.current !== currentGeneration) return;
      setPackets([]);
      setPacketOwner(address);
      setStatus("error");
    }
  }, [address]);

  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (!address) return;
    void flushPacketSyncOutbox().then(() => fetchMyPackets(address)).then(
      (next) => {
        if (generation.current !== currentGeneration) return;
        setPackets(next);
        setPacketOwner(address);
        setStatus("ready");
      },
      () => {
        if (generation.current !== currentGeneration) return;
        setPackets([]);
        setPacketOwner(address);
        setStatus("error");
      },
    );
  }, [address]);

  const recordCreatedPacket = useCallback(
    async (item: PacketSyncItem) => {
      const packet = await syncCreatedPacket(item);
      await refresh();
      return packet;
    },
    [refresh],
  );

  return {
    address,
    packets: packetOwner === address ? packets : [],
    status: !address ? "idle" : packetOwner === address ? status : "loading",
    refresh,
    recordCreatedPacket,
  };
}
