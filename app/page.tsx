"use client"

import Navbar from "@/components/navbar"
import Hero from "@/components/hero"

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <Hero />
    </div>
  )
}
