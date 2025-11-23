import Link from "next/link";
import {
  getResource,
  listResources,
  searchResources,
} from "@/server/core/resources/registry";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; url?: string; query?: string }>;
}) {
  const { mode, url, query } = await searchParams;

  if (mode === "view" && url) {
    const resource = await getResource(url);

    if (!resource) {
      return (
        <div className="flex flex-col gap-4 p-4">
          <div># Resource Not Found</div>
          <div>{`The resource with URL \`${url}\` could not be found.`}</div>
          <Link href="/resources">
            <button className="px-4 py-2 bg-gray-200 rounded">
              Back to List
            </button>
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>{`# ${resource.resource || "Resource Details"}`}</div>
          <Link href="/resources?mode=list">
            <button className="px-4 py-2 bg-gray-200 rounded">Back</button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-gray-200 rounded">{resource.type}</span>
          <span className="px-2 py-1 border rounded">
            {String(resource.x402Version)}
          </span>
        </div>

        <div className="space-y-2">
          <div>### Content</div>
          <pre className="p-4 overflow-auto bg-gray-100 rounded-md">
            {JSON.stringify(resource, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (mode === "search" && query) {
    const results = await searchResources(query);

    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>{`# Search Results for "${query}"`}</div>
          <Link href="/resources?mode=list">
            <button className="px-4 py-2 bg-gray-200 rounded">
              Clear Search
            </button>
          </Link>
        </div>

        {results.length === 0 ? (
          <div>No resources found.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((resource) => (
              <div
                key={resource.resource}
                className="flex flex-col gap-2 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{resource.resource}</span>
                  <Link
                    href={`/resources?mode=view&url=${encodeURIComponent(
                      resource.resource || "",
                    )}`}
                  >
                    <button className="px-2 py-1 bg-gray-200 rounded text-sm">
                      View
                    </button>
                  </Link>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 border rounded text-xs">
                    {resource.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default to list mode
  const resources = await listResources();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div># Resources</div>

      <div className="flex flex-col gap-2">
        {resources.map((resource) => (
          <div
            key={resource.resource}
            className="flex flex-col gap-2 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{resource.resource}</span>
              <Link
                href={`/resources?mode=view&url=${encodeURIComponent(
                  resource.resource || "",
                )}`}
              >
                <button className="px-2 py-1 bg-gray-200 rounded text-sm">
                  View
                </button>
              </Link>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 border rounded text-xs">
                {resource.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
