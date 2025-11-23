import { createMcpHandler } from "mcp-handler";
import { z } from "zod/v3";
import { APP_BASE_URL } from "@/lib/config";
import {
  getResource,
  listResources,
  searchResources,
} from "@/server/core/resources/registry";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  description: string;
  widgetDomain: string;
};

function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const handler = createMcpHandler(async (server) => {
  const embedHtml = await getAppsSdkCompatibleHtml(APP_BASE_URL, "/embed");
  const resourcesHtml = await getAppsSdkCompatibleHtml(
    APP_BASE_URL,
    "/resources",
  );

  const contentWidget: ContentWidget = {
    id: "open_app",
    title: "Open Payload.exchange App",
    templateUri: "ui://widget/content-template.html",
    invoking: "Loading app...",
    invoked: "App loaded",
    html: embedHtml,
    description: "Displays Payload.exchange app",
    widgetDomain: "https://payload.exchange",
  };

  const resourceWidget: ContentWidget = {
    id: "resource_widget",
    title: "Resource Viewer",
    templateUri: "ui://widget/resource.html",
    invoking: "Loading resource...",
    invoked: "Resource loaded",
    html: resourcesHtml,
    description: "Displays resource content",
    widgetDomain: "https://payload.exchange",
  };

  server.registerResource(
    "content-widget",
    contentWidget.templateUri,
    {
      title: contentWidget.title,
      description: contentWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": contentWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${contentWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": contentWidget.description,
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": contentWidget.widgetDomain,
          },
        },
      ],
    }),
  );

  server.registerResource(
    "resource-widget",
    resourceWidget.templateUri,
    {
      title: resourceWidget.title,
      description: resourceWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": resourceWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri) => {
      const url = new URL(uri.href);
      const mode = url.searchParams.get("mode") || "list";
      const resourceUrl = url.searchParams.get("url") || "";
      const query = url.searchParams.get("query") || "";

      // We need to fetch the HTML with the correct search params to render the correct state
      const dynamicHtml = await getAppsSdkCompatibleHtml(
        APP_BASE_URL,
        `/resources?mode=${mode}&url=${encodeURIComponent(resourceUrl)}&query=${encodeURIComponent(query)}`,
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html+skybridge",
            text: `<html>${dynamicHtml}</html>`,
            _meta: {
              "openai/widgetDescription": resourceWidget.description,
              "openai/widgetPrefersBorder": true,
              "openai/widgetDomain": resourceWidget.widgetDomain,
            },
          },
        ],
      };
    },
  );

  //@ts-ignore
  server.registerTool(
    contentWidget.id,
    {
      title: contentWidget.title,
      description:
        "Fetch and display the homepage content with the name of the user",
      inputSchema: {
        name: z
          .string()
          .describe("The name of the user to display on the homepage"),
      },
      _meta: widgetMeta(contentWidget),
    },
    async ({ name }) => ({
      content: [
        {
          type: "text",
          text: name,
        },
      ],
      structuredContent: {
        name,
        timestamp: new Date().toISOString(),
      },
      _meta: widgetMeta(contentWidget),
    }),
  );

  server.registerTool(
    "get_resource_by_url",
    {
      title: "Get Resource by URL",
      description: "Fetch a specific resource by its URL",
      inputSchema: {
        url: z.string().describe("The URL of the resource to fetch"),
      },
      _meta: widgetMeta(resourceWidget),
    },
    async ({ url }) => {
      const resource = await getResource(url);
      if (!resource) {
        return {
          content: [
            {
              type: "text",
              text: `Resource not found: ${url}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resource, null, 2),
          },
        ],
        _meta: {
          ...widgetMeta(resourceWidget),
          "openai/outputTemplate": `${resourceWidget.templateUri}?mode=view&url=${encodeURIComponent(url)}`,
        },
      };
    },
  );
  server.registerTool(
    "list_resources",
    {
      title: "List Resources",
      description: "List all available x402 resources",
      inputSchema: {},
      _meta: widgetMeta(resourceWidget),
    },
    async () => {
      const resources = await listResources();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resources, null, 2),
          },
        ],
        _meta: {
          ...widgetMeta(resourceWidget),
          "openai/outputTemplate": `${resourceWidget.templateUri}?mode=list`,
        },
      };
    },
  );

  server.registerTool(
    "search_resources",
    {
      title: "Search Resources",
      description: "Search resources by query string",
      inputSchema: {
        query: z.string().describe("The search query"),
      },
      _meta: widgetMeta(resourceWidget),
    },
    async ({ query }) => {
      const results = await searchResources(query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
        _meta: {
          ...widgetMeta(resourceWidget),
          "openai/outputTemplate": `${resourceWidget.templateUri}?mode=search&query=${encodeURIComponent(query)}`,
        },
      };
    },
  );
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler;
export const POST = handler;
