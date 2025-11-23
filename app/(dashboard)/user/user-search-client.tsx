"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ResourceItem {
  resource: string;
  type: string;
  lastUpdated: string;
  accepts: Array<{
    resource: string;
    description?: string;
    [key: string]: unknown;
  }>;
  metadata?: {
    confidence?: {
      overallScore?: number;
    };
    [key: string]: unknown;
  };
}

interface Resource {
  id: string;
  url: string;
  description?: string;
}

interface UserSearchClientProps {
  initialResources: ResourceItem[];
}

export default function UserSearchClient({
  initialResources,
}: UserSearchClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const query = searchQuery.toLowerCase().trim();

      if (!query) {
        setResources([]);
        return;
      }

      const filtered = initialResources
        .filter((item) => {
          const resourceUrl = item.resource?.toLowerCase() || "";
          const description =
            item.accepts?.[0]?.description?.toLowerCase() || "";
          return resourceUrl.includes(query) || description.includes(query);
        })
        .map((item, index) => ({
          id: `${item.resource}-${index}`,
          url: item.resource,
          description: item.accepts?.[0]?.description,
        }))
        .slice(0, 50); // Limit to 50 results

      setResources(filtered);
    } catch (error) {
      console.error("Failed to search:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Search x402 Resources</h1>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for APIs..."
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </form>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.length === 0 && searchQuery.trim() === "" && (
          <div className="col-span-full text-center py-12 text-slate-600 dark:text-slate-400">
            <p>Enter a search query to find x402 resources.</p>
          </div>
        )}

        {resources.length === 0 && searchQuery.trim() !== "" && (
          <div className="col-span-full text-center py-12 text-slate-600 dark:text-slate-400">
            <p>No resources found. Try a different search query.</p>
          </div>
        )}

        {resources.map((resource) => (
          <Link key={resource.id} href={`/user/resources/${resource.id}`}>
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader>
                <CardTitle className="truncate">{resource.url}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {resource.description || "No description available"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
