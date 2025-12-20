"use client";

import React from "react";
import { EscrowProvider } from "@/components/escrow/store";
import { useEscrowAutoRefresh } from "@/hooks/useEscrowAutoRefresh";
import Home from "@/components/escrow/Home";

function Root() {
  useEscrowAutoRefresh();
  return <Home />;
}

export default function Page() {
  return (
    <EscrowProvider>
      <Root />
    </EscrowProvider>
  );
}
