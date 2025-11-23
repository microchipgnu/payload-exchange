"use client";

import { AppsSDKUIProvider as OpenAIAppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import Link from "next/link";

export const AppsSDKUIProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <OpenAIAppsSDKUIProvider linkComponent={Link}>
      {children}
    </OpenAIAppsSDKUIProvider>
  );
};
