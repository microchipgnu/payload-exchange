"use client";

import { CDPReactProvider } from "@coinbase/cdp-react";
import type { ReactNode } from "react";

// Get project ID from environment variable
const projectId =
  process.env.NEXT_PUBLIC_CDP_PROJECT_ID ||
  "146d7f40-dc10-49df-8773-b5ee5693d765";

export function CDPProvider({ children }: { children: ReactNode }) {
  return (
    <CDPReactProvider
      config={{
        projectId,
        ethereum: {
          // Create an EOA (Externally Owned Account) on login
          createOnLogin: "eoa",
        },
        solana: {
          // Create a Solana account on login
          createOnLogin: false,
        },
        appName: "Payload.exchange",
      }}
    >
      {children}
    </CDPReactProvider>
  );
}
