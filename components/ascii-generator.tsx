"use client"

import { useState, useEffect } from "react"

type AsciiStyle = "classic" | "dots" | "blocks" | "lines" | "mixed"

const ASCII_SETS = {
  classic: ["|", "/", "\\", "-", "o", "+", "*"],
  dots: ["·", "•", "◦", "∘", "○", "●", "⊙"],
  blocks: ["▪", "▫", "■", "□", "▬", "▭", "░"],
  lines: ["|", "/", "\\", "-", "—", "–", "│"],
  mixed: ["|", "/", "\\", "-", "o", "*", "●", "□", "◦"],
}

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

function generateCross(size: number, chars: string[], random: () => number, complexity: number) {
  const grid: string[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(" "))

  const center = Math.floor(size / 2)

  // Main cross lines
  for (let i = 0; i < size; i++) {
    grid[i][center] = chars[0] || "|"
    grid[center][i] = chars[3] || "-"
  }

  // Diagonal lines for complexity >= 5
  if (complexity >= 5) {
    for (let i = 0; i < size; i++) {
      if (i !== center && random() > 0.2) {
        grid[i][i] = chars[2] || "\\"
        grid[i][size - 1 - i] = chars[1] || "/"
      }
    }
  }

  // Center intersection
  grid[center][center] = chars[5] || "+"

  // Decorative asterisks for complexity >= 7
  if (complexity >= 7) {
    const offset = Math.floor(size / 4) + Math.floor(random() * 3)
    grid[center][center - offset] = chars[6] || "*"
    grid[center][center + offset] = chars[6] || "*"
    grid[center - offset][center] = chars[6] || "*"
    grid[center + offset][center] = chars[6] || "*"
  }

  return grid.map((row) => row.join("")).join("\n")
}

interface AsciiHeroProps {
  textColor?: string
  bgColor?: string
  className?: string
  intervalMs?: number
}

export default function AsciiHero({
  textColor = "#00ff9f",
  bgColor = "transparent",
  className = "",
  intervalMs = 1000,
}: AsciiHeroProps) {
  const [ascii, setAscii] = useState("")
  const [seed, setSeed] = useState(Date.now())

  // Fixed parameters
  const pattern = "cross" as const
  const asciiStyle: AsciiStyle = "dots"
  const complexity = 15

  const generateAscii = () => {
    const random = seededRandom(seed)
    const size = 15 + complexity
    const chars = ASCII_SETS[asciiStyle]
    const result = generateCross(size, chars, random, complexity)
    setAscii(result)
  }

  // Generate on mount and when seed changes
  useEffect(() => {
    generateAscii()
  }, [seed])

  // Auto-generate every intervalMs
  useEffect(() => {
    const interval = setInterval(() => {
      setSeed(Date.now())
    }, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs])

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      <pre
        className="geist-mono font-mono text-lg leading-relaxed"
        style={{
          color: textColor,
          backgroundColor: "transparent",
        }}
      >
        {ascii}
      </pre>
    </div>
  )
}

