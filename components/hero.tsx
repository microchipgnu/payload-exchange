"use client"

import { useState } from "react"
import AsciiHero from "@/components/ascii-generator"

type AsciiStyle = "dots" | "lines" | "blocks"

const ASCII_STYLES: AsciiStyle[] = ["dots", "lines", "blocks"]

export default function Hero() {
  const [asciiStyle, setAsciiStyle] = useState<AsciiStyle>("dots")
  const [isClicked, setIsClicked] = useState(false)

  const handleDataClick = () => {
    // Cycle through styles
    const currentIndex = ASCII_STYLES.indexOf(asciiStyle)
    const nextIndex = (currentIndex + 1) % ASCII_STYLES.length
    setAsciiStyle(ASCII_STYLES[nextIndex])

    // Trigger click animation
    setIsClicked(true)
    setTimeout(() => {
      setIsClicked(false)
    }, 200)
  }

  return (
    <section className="hero-section relative flex items-center min-h-[calc(100vh-80px)] overflow-x-hidden">
      <div className="absolute right-0 md:right-1/12 lg:right-1/10 top-1/2 -translate-y-1/2 flex items-center justify-center rotate-90 scale-150">
        <AsciiHero
          textColor="#EB7D32"
          bgColor="transparent"
          intervalMs={300}
          asciiStyle={asciiStyle}
        />
      </div>
      <div className="relative z-10 w-full px-8 md:px-16 -mt-80 md:mt-0">
        <h1 className="geist text-6xl md:text-6xl lg:text-7xl xl:text-8xl font-[500] text-white leading-none">
          Accept any{" "}
          <span
            onClick={handleDataClick}
            className={`inline-block cursor-pointer transition-all duration-500 ease-in-out ${
              isClicked ? "scale-90" : "scale-100"
            }`}
            style={{
              transition: "color 0.5s ease-in-out, text-shadow 0.5s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#EB7D32"
              e.currentTarget.style.textShadow = "0 0 20px rgba(235, 125, 50, 0.3)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "white"
              e.currentTarget.style.textShadow = "none"
            }}
          >
            data
          </span>
          <span className="md:hidden"> </span>
          <br className="hidden md:block" />as payments
        </h1>
      </div>
    </section>
  )
}

