"use client"

import AsciiHero from "@/components/ascii-generator"

export default function Hero() {
  return (
    <section className="hero-section relative flex items-center min-h-[calc(100vh-80px)] overflow-x-hidden">
      <div className="absolute right-0 md:right-1/12 lg:right-1/10 top-1/2 -translate-y-1/2 flex items-center justify-center rotate-90 scale-150">
        <AsciiHero
          textColor="#EB7D32"
          bgColor="transparent"
          intervalMs={300}
        />
      </div>
      <div className="relative z-10 w-full px-8 md:px-16">
        <h1 className="geist text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-[500] text-white leading-none">
          Accept any data<br />as payments
        </h1>
      </div>
    </section>
  )
}

