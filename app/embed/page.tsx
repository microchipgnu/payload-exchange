"use client";

import { useMemo, useCallback } from "react";
import { FundFaucet } from "@/components/fund-faucet";
import { SendTransaction } from "@/components/send-transaction";
import { WalletAuth } from "@/components/wallet-auth";
import { WalletBalance } from "@/components/wallet-balance";
import {
  useDisplayMode,
  useIsChatGptApp,
  useMaxHeight,
  useRequestDisplayMode,
  useWidgetProps,
} from "@/hooks";

export default function Home() {
  const toolOutput = useWidgetProps<{
    name?: string;
    result?: { structuredContent?: { name?: string } };
  }>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();

  const name = useMemo(
    () =>
      toolOutput?.result?.structuredContent?.name || toolOutput?.name,
    [toolOutput],
  );

  const handleFullscreenClick = useCallback(() => {
    requestDisplayMode("fullscreen");
  }, [requestDisplayMode]);

  const containerStyle = useMemo(
    () => ({
      maxHeight,
      height: displayMode === "fullscreen" ? maxHeight : undefined,
    }),
    [maxHeight, displayMode],
  );

  return (
    <div
      className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center gap-16 p-8 pb-20 font-sans sm:p-20"
      style={containerStyle}
    >
      {displayMode !== "fullscreen" && (
        <button
          aria-label="Enter fullscreen"
          className="fixed top-4 right-4 z-50 cursor-pointer rounded-full bg-white p-2.5 text-slate-700 shadow-lg ring-1 ring-slate-900/10 transition-colors hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-700"
          onClick={handleFullscreenClick}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <main className="row-start-2 flex flex-col items-center gap-[32px] sm:items-start">
        {!isChatGptApp && (
          <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
            <div className="flex items-center gap-3">
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  clipRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  fillRule="evenodd"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-blue-900 text-sm dark:text-blue-100">
                  This app relies on data from a ChatGPT session.
                </p>
                <p className="font-medium text-blue-900 text-sm dark:text-blue-100">
                  No{" "}
                  <a
                    className="rounded bg-blue-100 px-1 py-0.5 font-mono underline hover:no-underline dark:bg-blue-900"
                    href="https://developers.openai.com/apps-sdk/reference"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    window.openai
                  </a>{" "}
                  property detected
                </p>
              </div>
            </div>
          </div>
        )}
        <ol className="list-inside list-decimal text-center font-mono text-sm/6 sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Welcome to Payload.exchange
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Name returned from tool call: {name ?? "..."}
          </li>
          <li className="mb-2 tracking-[-.01em]">MCP server path: /mcp</li>
        </ol>

        <div className="w-full space-y-6">
          <div className="border-slate-200 border-t pt-6 dark:border-slate-800">
            <h2 className="mb-4 font-semibold text-lg text-slate-900 dark:text-slate-100">
              CDP Embedded Wallet
            </h2>
            <WalletAuth />
            <div className="mt-4 space-y-4">
              <WalletBalance />
              <FundFaucet />
              <SendTransaction />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
