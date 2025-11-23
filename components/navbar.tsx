"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 w-full">
      <div className="flex items-center">
        <Image
          src="/logo-PLDX-accent-stacked.svg"
          alt="PLDX Logo"
          width={120}
          height={40}
          className="h-auto"
        />
      </div>
      <Button variant="outline" size="lg">
        CONNECT
      </Button>
    </nav>
  )
}

