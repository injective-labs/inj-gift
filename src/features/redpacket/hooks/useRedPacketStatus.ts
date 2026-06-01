"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { queryPacket } from "../../../lib/contract/redPacket";
import { mapToSummary } from "../domain/types";
import { mapRedPacketError, RedPacketError } from "../domain/errors";

interface Options {
  enabled?: boolean;
  intervalMs?: number;
}

export const useRedPacketStatus = (
  packetId: string,
  { enabled = true, intervalMs = 4000 }: Options = {}
) => {
  const [data, setData] = useState<ReturnType<typeof mapToSummary> | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<RedPacketError | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (packetId === "demo") {
        const demo = {
          creator: "inj1demoaddressxxxxxxxxxxxxxxxxxxxxxx",
          total_amount: "20000000000000000000",
          denom_or_cw20: "inj",
          count: 8,
          claimed_count: 3,
          claimed_amount: "5000000000000000000",
          password_hash: "",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          mode: "random",
        };
        setData(mapToSummary(packetId, demo));
        return;
      }
      const raw = await queryPacket(packetId);
      setData(mapToSummary(packetId, raw));
    } catch (e) {
      setError(mapRedPacketError(e));
    } finally {
      setLoading(false);
    }
  }, [packetId]);

  // initial + polling
  useEffect(() => {
    if (!enabled) return;
    fetchOnce();
    timerRef.current = setInterval(fetchOnce, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as ReturnType<typeof setInterval>);
    };
  }, [enabled, intervalMs, fetchOnce]);

  const refetch = useCallback(() => fetchOnce(), [fetchOnce]);

  return { data, isLoading, error, refetch } as const;
};





