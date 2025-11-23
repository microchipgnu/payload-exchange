"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  useIsSignedIn,
  useSignOut,
  useEvmAddress,
} from "@coinbase/cdp-hooks"
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton"

// Styles to match Button component with variant="outline" and size="lg"
const authButtonWrapperClass = `
  [&_button]:inline-flex
  [&_button]:shrink-0
  [&_button]:items-center
  [&_button]:justify-center
  [&_button]:gap-2
  [&_button]:whitespace-nowrap
  [&_button]:rounded-md
  [&_button]:border
  [&_button]:bg-background
  [&_button]:shadow-xs
  [&_button]:font-medium
  [&_button]:text-sm
  [&_button]:outline-none
  [&_button]:transition-all
  [&_button]:h-10
  [&_button]:px-6
  [&_button]:hover:bg-accent
  [&_button]:hover:text-accent-foreground
  [&_button]:focus-visible:border-ring
  [&_button]:focus-visible:ring-[3px]
  [&_button]:focus-visible:ring-ring/50
  [&_button]:dark:border-input
  [&_button]:dark:bg-input/30
  [&_button]:dark:hover:bg-input/50
`.replace(/\s+/g, " ").trim()

export default function Navbar() {
  const { isSignedIn } = useIsSignedIn()
  const { evmAddress } = useEvmAddress()
  const { signOut } = useSignOut()

  return (
    <nav className="flex items-center justify-between px-6 py-4 w-full">
      <div className="flex items-center gap-8">
        <Image
          src="/logo-PLDX-accent-stacked.svg"
          alt="PLDX Logo"
          width={120}
          height={40}
          className="h-auto"
        />
      </div>
      <div className="flex items-center gap-4">
        {isSignedIn && evmAddress && (
          <div className="hidden md:flex items-center gap-2 text-sm text-white/70">
            <span className="font-mono text-xs">
              {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
            </span>
          </div>
        )}
        {isSignedIn ? (
          <Button variant="outline" size="lg" onClick={signOut}>
            DISCONNECT
          </Button>
        ) : (
          <div className={authButtonWrapperClass}>
            <AuthButton />
          </div>
        )}
      </div>
    </nav>
  )
}

