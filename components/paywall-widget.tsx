"use client";

import { useX402 } from "@coinbase/cdp-hooks";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { MagicCard } from "@/components/ui/magic-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Resource } from "@/server/core/resources/types";

interface PaywallWidgetProps {
  resource?: Resource | null;
}

export const PaywallWidget = ({
  resource: initialResource,
}: PaywallWidgetProps = {}) => {
  const [resource, setResource] = useState<Resource | null>(
    initialResource ?? null,
  );
  const [selectedNetwork, setSelectedNetwork] = useState("Base");
  const [isNetworkSelectOpen, setIsNetworkSelectOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentResponse, setPaymentResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const { fetchWithPayment } = useX402();

  useEffect(() => {
    // Only listen for OpenAI events if no resource was provided as a prop
    if (initialResource) return;

    // Initialize from window.openai if available
    const toolOutput = window.openai?.toolOutput as {
      resource?: Resource;
    } | null;
    if (toolOutput?.resource) {
      setResource(toolOutput.resource);
    }

    // Listen for OpenAI events
    const handleSetGlobals = () => {
      const toolOutput = window.openai?.toolOutput as {
        resource?: Resource;
      } | null;
      if (toolOutput?.resource) {
        setResource(toolOutput.resource);
      }
    };

    window.addEventListener("openai:set_globals", handleSetGlobals);

    return () => {
      window.removeEventListener("openai:set_globals", handleSetGlobals);
    };
  }, [initialResource]);

  const handleSignTransaction = async () => {
    console.log("Sign transaction clicked");

    if (!resource?.resource) {
      setError("No resource URL available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Make the x402 payment request using fetchWithPayment
      const response = await fetchWithPayment(resource.resource, {
        method: resource.accepts?.[0]?.outputSchema?.input?.method ?? "GET",
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentResponse(data);
        console.log("Payment successful:", data);

        // Notify OpenAI that payment was successful
        if (window.openai?.sendFollowUpMessage) {
          await window.openai.sendFollowUpMessage({
            prompt: `Payment successful for resource: ${resource.resource}`,
          });
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Payment failed: ${response.status} - ${errorText}`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Payment failed";
      console.error("Payment error:", err);
      setError(errorMessage);

      // Notify OpenAI about the error
      if (window.openai?.sendFollowUpMessage) {
        await window.openai.sendFollowUpMessage({
          prompt: `Payment failed: ${errorMessage}`,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubStar = async () => {
    console.log("GitHub star clicked");
    window.open("https://github.com/microchipgnu/mcpay", "_blank");
    if (window.openai?.sendFollowUpMessage) {
      await window.openai.sendFollowUpMessage({
        prompt: "User starred the repository on GitHub",
      });
    }
  };

  const handleFollowX = async () => {
    console.log("Follow on X clicked");
    window.open("https://x.com/x420yo", "_blank");
    if (window.openai?.sendFollowUpMessage) {
      await window.openai.sendFollowUpMessage({
        prompt: "User followed on X",
      });
    }
  };

  const handleSurvey = async () => {
    console.log("Survey clicked");
    window.open("https://forms.gle/your-survey", "_blank");
    if (window.openai?.sendFollowUpMessage) {
      await window.openai.sendFollowUpMessage({
        prompt: "User completed the survey",
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="relative max-w-md mx-auto p-[1px] rounded-lg bg-gradient-to-br from-slate-800 to-slate-700">
        {/* Decorative dots */}
        <div className="absolute top-6 left-6 w-1 h-1 bg-[#C8D8F5] rounded-full z-10" />
        <div className="absolute top-6 right-6 w-1 h-1 bg-[#C8D8F5] rounded-full z-10" />
        <div className="absolute bottom-6 left-6 w-1 h-1 bg-[#C8D8F5] rounded-full z-10" />
        <div className="absolute bottom-6 right-6 w-1 h-1 bg-[#C8D8F5] rounded-full z-10" />
        <MagicCard
          className="relative overflow-hidden p-6 border-0 rounded-lg [&>div:nth-child(2)]:!bg-gradient-to-br [&>div:nth-child(2)]:!from-slate-900 [&>div:nth-child(2)]:!to-slate-950"
          gradientSize={200}
          gradientColor="#1e293b"
          gradientOpacity={0.3}
          gradientFrom="rgba(148, 163, 184, 0.1)"
          gradientTo="rgba(51, 65, 85, 0.1)"
        >
          <CardContent className="p-0 space-y-6 relative z-10">
            {/* Resource Info */}
            {resource && (
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-base font-semibold text-white mb-2">
                  {resource.resource}
                </div>
                <div className="text-xs text-[#7C869C] px-2 py-1 bg-slate-700/50 rounded inline-block">
                  {resource.type}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-4xl font-normal text-[#7C869C]/50 font-mono">
                  x402
                </h2>
                <p className="text-sm text-[#7C869C]/50 font-mono">
                  Payment Required
                </p>
              </div>
              <div className="border-t border-slate-700/30 -mx-6" />
            </div>

            {/* Payment Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Badge variant="pay" className="text-xs px-2 py-0.5">
                  PAY
                </Badge>
                <div className="flex items-start justify-center gap-4">
                  <div className="text-right">
                    <span className="text-4xl font-normal text-white font-mono">
                      0.1
                    </span>
                  </div>
                  <div className="flex flex-col gap-0 text-sm text-[#7C869C] font-mono leading-none min-w-[80px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block w-fit dotted-underline text-[#7C869C] hover:text-white transition-colors font-semibold">
                          USDC
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="rounded">
                        <p>Currency</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1 -mt-1">
                      <span>ON</span>
                      <div className="relative flex items-center gap-1 group/network">
                        <Select
                          value={selectedNetwork}
                          onValueChange={setSelectedNetwork}
                          open={isNetworkSelectOpen}
                          onOpenChange={setIsNetworkSelectOpen}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 w-fit gap-1 text-sm text-[#7C869C] font-mono [&>svg]:hidden">
                                <span
                                  className={`inline-block w-fit dotted-underline-network transition-colors font-semibold cursor-pointer ${isNetworkSelectOpen ? "text-white" : "text-[#7C869C] group-hover/network:text-white"}`}
                                >
                                  {selectedNetwork.toUpperCase()}
                                </span>
                              </SelectTrigger>
                            </TooltipTrigger>
                            <TooltipContent className="rounded">
                              <p>Selected Network</p>
                            </TooltipContent>
                          </Tooltip>
                          <SelectContent className="bg-slate-900 border-slate-700 rounded-sm [&_svg]:!text-emerald-400">
                            <SelectItem
                              value="Base"
                              className="focus:bg-gradient-to-r focus:from-[#576E96] focus:to-[#7E99C9] rounded-sm focus:rounded-sm data-[highlighted]:rounded-sm"
                            >
                              Base
                            </SelectItem>
                            <SelectItem
                              value="Avax"
                              className="focus:bg-gradient-to-r focus:from-[#576E96] focus:to-[#7E99C9] rounded-sm focus:rounded-sm data-[highlighted]:rounded-sm"
                            >
                              Avax
                            </SelectItem>
                            <SelectItem
                              value="Sei"
                              className="focus:bg-gradient-to-r focus:from-[#576E96] focus:to-[#7E99C9] rounded-sm focus:rounded-sm data-[highlighted]:rounded-sm"
                            >
                              Sei
                            </SelectItem>
                            <SelectItem
                              value="Solana"
                              className="focus:bg-gradient-to-r focus:from-[#576E96] focus:to-[#7E99C9] rounded-sm focus:rounded-sm data-[highlighted]:rounded-sm"
                            >
                              Solana
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <ChevronDown
                          className={`w-3 h-3 transition-transform cursor-pointer ${isNetworkSelectOpen ? "rotate-180 text-white" : "text-[#7C869C] group-hover/network:text-white"}`}
                          onClick={() =>
                            setIsNetworkSelectOpen(!isNetworkSelectOpen)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                variant="customSecondary"
                className="w-full"
                onClick={handleSignTransaction}
                disabled={isLoading || !resource?.resource}
              >
                {isLoading ? "Processing Payment..." : "Sign Transaction"}
              </Button>

              {error && (
                <div className="text-red-400 text-sm text-center p-2 bg-red-900/20 rounded">
                  {error}
                </div>
              )}

              {paymentResponse !== null ? (
                <div className="text-emerald-400 text-sm text-center p-2 bg-emerald-900/20 rounded">
                  Payment successful!
                </div>
              ) : null}
            </div>

            {/* Separator */}
            <div className="flex items-center justify-center gap-5 py-4">
              <div className="w-24 border-t border-slate-700" />
              <span className="text-base uppercase font-mono text-white">
                OR
              </span>
              <div className="w-24 border-t border-slate-700" />
            </div>

            {/* Free Options */}
            <div className="space-y-3">
              <Badge variant="shimmer" className="text-xs px-2 py-0.5">
                FREE
              </Badge>
              <Button
                variant="customPrimary"
                size="default"
                className="w-full"
                onClick={handleGitHubStar}
              >
                Star on GitHub
              </Button>

              <Button
                variant="customPrimary"
                size="default"
                className="w-full"
                onClick={handleFollowX}
              >
                Follow on X
              </Button>

              <Button
                variant="customPrimary"
                size="default"
                className="w-full"
                onClick={handleSurvey}
              >
                Answer survey
              </Button>
            </div>

            {/* Footer */}
            <Link
              href="https://mcpay.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs text-[#7C869C] pt-2 font-mono flex items-center justify-center gap-2 hover:text-white transition-colors"
            >
              Powered by{" "}
              <svg
                width="22"
                height="9"
                viewBox="0 0 22 9"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block h-2.5 w-auto"
                aria-label="MCPAY Logo"
              >
                <title>MCPAY Logo</title>
                <g clipPath="url(#clip0_2281_26140)">
                  <path
                    d="M21.4351 4.48004C20.6724 4.47545 19.9094 4.46892 19.1471 4.48513C18.8771 4.49087 18.7994 4.41354 18.8036 4.14921C18.82 3.11406 18.8037 2.07846 18.8154 1.04321C18.8182 0.800413 18.7496 0.712554 18.488 0.720456C17.908 0.737967 17.3276 0.738116 16.7466 0.720903C16.5063 0.714155 16.3444 0.798978 16.1818 0.957996C15.088 2.02776 13.9891 3.0927 12.8852 4.15282C12.8271 4.20886 12.7876 4.33039 12.681 4.29033C12.5724 4.24953 12.627 4.13419 12.6267 4.05396C12.6232 3.06265 12.6137 2.07112 12.6323 1.08012C12.6377 0.792843 12.5301 0.717288 12.2583 0.723119C11.6894 0.735308 11.1202 0.735363 10.5508 0.723287C10.4677 0.720838 10.3847 0.730781 10.3047 0.752766C10.119 0.767731 9.94665 0.852173 9.8242 0.988176C8.73037 2.05794 7.63151 3.12288 6.52761 4.183C6.46947 4.23905 6.42997 4.36057 6.32334 4.32051C6.21476 4.27971 6.2694 4.16437 6.26911 4.08414C6.26558 3.09283 6.25606 2.1013 6.27469 1.1103C6.28009 0.823027 6.17249 0.747474 5.90065 0.753298C5.33172 0.765491 4.76257 0.765547 4.19321 0.753466C4.08038 0.749076 3.96794 0.768914 3.86396 0.811562C3.75998 0.854209 3.66704 0.91861 3.59178 1.00014C2.87477 1.70575 2.15192 2.40579 1.42323 3.10025C0.964934 3.53828 0.495692 3.96559 0 4.4269C0.215893 4.54313 0.344227 4.51419 0.46636 4.51478C1.20629 4.51838 1.94627 4.51621 2.68623 4.51565C3.14155 4.5153 3.14133 4.51503 3.14105 4.97136C3.14046 5.96268 3.14637 6.95408 3.13504 7.94529C3.13235 8.18031 3.18895 8.28404 3.45562 8.27745C4.05855 8.26256 4.66226 8.26959 5.2655 8.27817C5.35032 8.2795 5.43443 8.26303 5.51205 8.22987C5.58967 8.19672 5.65896 8.14768 5.71514 8.08613C6.83773 6.99542 7.96227 5.90661 9.08878 4.81968C9.14002 4.77021 9.1703 4.66192 9.26605 4.69684C9.379 4.73803 9.32857 4.84807 9.32876 4.92967C9.33098 5.93195 9.34032 6.9344 9.32422 7.93645C9.31993 8.20375 9.41326 8.28444 9.67435 8.2796C10.2661 8.26864 10.8582 8.2712 11.4501 8.27878C11.5267 8.28068 11.6032 8.26962 11.6759 8.24611C11.8285 8.23454 11.9707 8.16643 12.0728 8.05595C13.1954 6.96524 14.3199 5.87643 15.4464 4.7895C15.4977 4.74003 15.5279 4.63174 15.6237 4.66667C15.7366 4.70786 15.6862 4.81789 15.6864 4.89949C15.6886 5.90178 15.698 6.90422 15.6819 7.90627C15.6776 8.17357 15.7709 8.25426 16.032 8.24943C16.6237 8.23846 17.2159 8.24102 17.8077 8.2486C17.8977 8.25229 17.9875 8.23676 18.0706 8.20311C18.1537 8.16947 18.2282 8.11854 18.2887 8.05393C19.1427 7.21755 20.0018 6.38604 20.866 5.55939C21.2089 5.23015 21.5621 4.91101 21.9235 4.57534C21.7285 4.43808 21.5761 4.48089 21.4351 4.48004Z"
                    fill="currentColor"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_2281_26140">
                    <rect
                      width="21.9235"
                      height="7.55983"
                      fill="white"
                      transform="translate(0 0.719971)"
                    />
                  </clipPath>
                </defs>
              </svg>
            </Link>
          </CardContent>
        </MagicCard>
      </div>
    </TooltipProvider>
  );
};
