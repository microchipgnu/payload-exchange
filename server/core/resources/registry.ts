import BASE_RESOURCES_JSON from "./base-resources.json";
import type { Resource } from "./types";

const TOP_RESOURCES = BASE_RESOURCES_JSON as Resource[];
/**
 * List all available x402 resources
 */
export async function listResources(): Promise<Resource[]> {
  return TOP_RESOURCES;
}

/**
 * Get a specific resource by url
 */
export async function getResource(
  resourceUrl: string,
): Promise<Resource | null> {
  const found = TOP_RESOURCES.find((r) => r.resource === resourceUrl);
  return found || null;
}

/**
 * Search resources by query
 */
export async function searchResources(query: string): Promise<Resource[]> {
  const lowerQuery = query.toLowerCase();
  const results = TOP_RESOURCES.filter((r) => {
    const matchResource = r.resource.toLowerCase().includes(lowerQuery);

    // Check description in accepts array
    const matchDescription = r.accepts.some(
      (a) =>
        a.description?.toLowerCase().includes(lowerQuery) ||
        a.extra?.name?.toLowerCase().includes(lowerQuery),
    );

    return matchResource || matchDescription;
  });

  return results;
}
