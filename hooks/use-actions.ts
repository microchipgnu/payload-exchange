import { useState } from "react";

interface ActionInstance {
  actionInstanceId: string;
  instructions: string;
  url?: string;
  coverage: {
    sponsorContribution: string;
    userContribution: string;
  };
}

interface ValidateActionParams {
  actionInstanceId: string;
  input: any;
  userId: string;
}

export function useActionValidation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAction = async (params: ValidateActionParams) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payload/actions/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (res.ok && data.status === "completed") {
        return { success: true, data };
      } else {
        setError(data.reason || "Validation failed");
        return { success: false, error: data.reason || "Validation failed" };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { validateAction, loading, error };
}

export function useAccessResource() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInstance, setActionInstance] = useState<ActionInstance | null>(
    null,
  );

  const accessResource = async (resourceId: string, userId: string) => {
    setLoading(true);
    setError(null);
    setActionInstance(null);
    try {
      const res = await fetch(`/api/payload/proxy/${resourceId}`, {
        method: "POST",
        headers: {
          "x-user-id": userId,
        },
      });

      const data = await res.json();

      if (data.type === "action_required") {
        setActionInstance(data);
        return { requiresAction: true, actionInstance: data };
      } else {
        return { requiresAction: false, data };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return { requiresAction: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { accessResource, actionInstance, loading, error };
}
