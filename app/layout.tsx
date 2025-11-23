import "@/app/globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppsSDKUIProvider } from "@/components/apps-sdk-ui-provider";
import { CDPProviders } from "@/components/cdp-provider";
import { APP_BASE_URL } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Payload.exchange",
  description: "Exchange payloads for sponsored resources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <NextChatSDKBootstrap baseUrl={APP_BASE_URL} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <just cause>
          dangerouslySetInnerHTML={{
            __html: `
              /* Force CDP modal to appear above everything */
              body > div[data-radix-portal],
              body > div[data-radix-portal] > div,
              [data-radix-portal],
              [data-radix-portal] > div,
              [data-radix-portal] > div > div,
              div[role="dialog"],
              div[aria-modal="true"],
              body > div[style*="position: fixed"],
              body > div[style*="position:fixed"] {
                z-index: 99999 !important;
              }
            `,
          }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <trust me bro>
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Function to set high z-index on modal elements
                function setModalZIndex() {
                  // Target all possible modal containers
                  const selectors = [
                    '[data-radix-portal]',
                    '[data-radix-portal] > div',
                    '[role="dialog"]',
                    '[aria-modal="true"]',
                    'body > div[style*="position: fixed"]',
                    'body > div[style*="position:fixed"]'
                  ];
                  
                  selectors.forEach(selector => {
                    try {
                      const elements = document.querySelectorAll(selector);
                      elements.forEach(el => {
                        if (el instanceof HTMLElement) {
                          el.style.zIndex = '99999';
                        }
                      });
                    } catch (e) {
                      // Ignore selector errors
                    }
                  });
                }
                
                // Set z-index immediately
                setModalZIndex();
                
                // Watch for new modal elements being added
                const observer = new MutationObserver(() => {
                  setModalZIndex();
                });
                
                observer.observe(document.body, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['style', 'data-radix-portal', 'role', 'aria-modal']
                });
                
                // Also check periodically as a fallback
                setInterval(setModalZIndex, 100);
              })();
            `,
          }}
        />
        <AppsSDKUIProvider>
          <CDPProviders>{children}</CDPProviders>
        </AppsSDKUIProvider>
      </body>
    </html>
  );
}

function NextChatSDKBootstrap({ baseUrl }: { baseUrl: string }) {
  return (
    <>
      <base href={baseUrl} />
      <script>{`window.innerBaseUrl = ${JSON.stringify(baseUrl)}`}</script>
      <script>{`window.__isChatGptApp = typeof window.openai !== "undefined";`}</script>
      <script>
        {"(" +
          (() => {
            const baseUrl = window.innerBaseUrl;
            const htmlElement = document.documentElement;
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (
                  mutation.type === "attributes" &&
                  mutation.target === htmlElement
                ) {
                  const attrName = mutation.attributeName;
                  if (attrName && attrName !== "suppresshydrationwarning") {
                    htmlElement.removeAttribute(attrName);
                  }
                }
              });
            });
            observer.observe(htmlElement, {
              attributes: true,
              attributeOldValue: true,
            });

            const originalReplaceState = history.replaceState;
            history.replaceState = (_s, unused, url) => {
              const u = new URL(url ?? "", window.location.href);
              const href = u.pathname + u.search + u.hash;
              originalReplaceState.call(history, unused, href);
            };

            const originalPushState = history.pushState;
            history.pushState = (_s, unused, url) => {
              const u = new URL(url ?? "", window.location.href);
              const href = u.pathname + u.search + u.hash;
              originalPushState.call(history, unused, href);
            };

            const appOrigin = new URL(baseUrl).origin;
            const isInIframe = window.self !== window.top;

            window.addEventListener(
              "click",
              (e) => {
                const a = (e?.target as HTMLElement)?.closest("a");
                if (!a?.href) return;
                const url = new URL(a.href, window.location.href);
                if (
                  url.origin !== window.location.origin &&
                  url.origin !== appOrigin
                ) {
                  try {
                    if (window.openai) {
                      window.openai?.openExternal({ href: a.href });
                      e.preventDefault();
                    }
                  } catch {
                    console.warn(
                      "openExternal failed, likely not in OpenAI client",
                    );
                  }
                }
              },
              true,
            );

            if (isInIframe && window.location.origin !== appOrigin) {
              const originalFetch = window.fetch;

              window.fetch = (input: URL | RequestInfo, init?: RequestInit) => {
                let url: URL;
                if (typeof input === "string" || input instanceof URL) {
                  url = new URL(input, window.location.href);
                } else {
                  url = new URL(input.url, window.location.href);
                }

                if (url.origin === appOrigin) {
                  if (typeof input === "string" || input instanceof URL) {
                    input = url.toString();
                  } else {
                    input = new Request(url.toString(), input);
                  }

                  return originalFetch.call(window, input, {
                    ...init,
                    mode: "cors",
                  });
                }

                if (url.origin === window.location.origin) {
                  const newUrl = new URL(baseUrl);
                  newUrl.pathname = url.pathname;
                  newUrl.search = url.search;
                  newUrl.hash = url.hash;
                  url = newUrl;

                  if (typeof input === "string" || input instanceof URL) {
                    input = url.toString();
                  } else {
                    input = new Request(url.toString(), input);
                  }

                  return originalFetch.call(window, input, {
                    ...init,
                    mode: "cors",
                  });
                }

                return originalFetch.call(window, input, init);
              };
            }
          }).toString() +
          ")()"}
      </script>
    </>
  );
}
