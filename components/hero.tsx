"use client";

import { useState } from "react";
import AsciiHero from "@/components/ascii-generator";
import { Button } from "@/components/ui/button";

type AsciiStyle = "dots" | "lines" | "blocks";

const ASCII_STYLES: AsciiStyle[] = ["dots", "lines", "blocks"];

export default function Hero() {
  const [asciiStyle, setAsciiStyle] = useState<AsciiStyle>("dots");
  const [isClicked, setIsClicked] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleDataClick = () => {
    // Cycle through styles
    const currentIndex = ASCII_STYLES.indexOf(asciiStyle);
    const nextIndex = (currentIndex + 1) % ASCII_STYLES.length;
    setAsciiStyle(ASCII_STYLES[nextIndex]);

    // Trigger click animation
    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, 200);
  };

  return (
    <section className="hero-section relative z-0 flex items-center min-h-[calc(100vh-80px)] overflow-x-hidden">
      <div className="absolute right-0 md:right-1/12 lg:right-1/10 top-1/2 -translate-y-1/2 flex items-center justify-center rotate-90 scale-150 z-0">
        <AsciiHero
          textColor="#EB7D32"
          bgColor="transparent"
          intervalMs={300}
          asciiStyle={asciiStyle}
        />
      </div>
      <div className="relative z-0 w-full px-8 md:px-16 -mt-80 md:mt-0">
        <h1 className="geist text-6xl md:text-6xl lg:text-7xl xl:text-8xl font-[500] text-white leading-none select-none">
          Accept any{" "}
          <button
            type="button"
            onClick={handleDataClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleDataClick();
              }
            }}
            className={`inline-block cursor-pointer transition-all duration-500 ease-in-out border-none bg-transparent p-0 text-inherit font-inherit ${isClicked ? "scale-90" : "scale-100"
              }`}
            style={{
              transition:
                "color 0.5s ease-in-out, text-shadow 0.5s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#EB7D32";
              e.currentTarget.style.textShadow =
                "0 0 20px rgba(235, 125, 50, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "white";
              e.currentTarget.style.textShadow = "none";
            }}
            aria-label="Cycle through data visualization styles"
          >
            data
          </button>
          <span className="md:hidden"> </span>
          <br className="hidden md:block" />
          as payments
        </h1>
        <div className="flex gap-4 mt-8">
          <Button
            disabled={isNavigating}
            className="bg-[#EB7D32] hover:bg-[#EB7D32]/90 text-white border-none rounded-none px-12 py-8 text-lg font-medium uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed transition-opacity"
            onClick={() => {
              setIsNavigating(true);
              // Small delay to show loading state, then navigate
              setTimeout(() => {
                window.location.href = "/sponsor";
              }, 150);
            }}
          >
            {isNavigating ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                LOADING...
              </span>
            ) : (
              "START"
            )}
          </Button>
          <Button
            className="bg-gray-800 hover:bg-gray-700 text-white border-none rounded-none px-12 py-8 text-lg font-medium uppercase tracking-wide"
            onClick={(e) => {
              e.preventDefault();
              // Do nothing for now
            }}
          >
            TRY AS A USER
          </Button>
        </div>
      </div>
    </section>
  );
}
