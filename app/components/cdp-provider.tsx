"use client";

import { CDPReactProvider } from "@coinbase/cdp-react";
import { ReactNode, useEffect, useState } from "react";

export function CDPProvider({ children }: { children: ReactNode }) {
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Check if running in an iframe (like ChatGPT's sandbox)
    setIsInIframe(window.self !== window.top);
  }, []);

  // Get project ID from environment variable
  const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID || "146d7f40-dc10-49df-8773-b5ee5693d765";

  // CDP requires domain whitelisting, which doesn't work in ChatGPT's dynamic sandbox domains
  // Only wrap with CDP provider when not in iframe (direct access)
  if (isInIframe) {
    return <>{children}</>;
  }

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
          createOnLogin: true,
        },
        appName: "ChatGPT Apps SDK Next.js Starter",
      }}
    >
      {children}
    </CDPReactProvider>
  );
}

