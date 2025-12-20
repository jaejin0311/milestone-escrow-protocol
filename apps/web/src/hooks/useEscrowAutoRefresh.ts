"use client";

import { useEffect } from "react";
import { useEscrowStore } from "@/components/escrow/store";
import { useEscrowActions } from "@/hooks/useEscrowActions";

export function useEscrowAutoRefresh() {
  const s = useEscrowStore();
  const { refresh } = useEscrowActions();

  // 1분 tick
  useEffect(() => {
    const id = setInterval(() => s.setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [s]);

  // escrowLimit 변화시 refresh
  useEffect(() => {
    refresh(null).catch((e) => s.setLog(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.escrowLimit]);
}
