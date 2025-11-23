import { handle } from "hono/vercel";
import { app } from "@/server/hono/app";

export const runtime = "nodejs"; // Use nodejs runtime for database access

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

export const dynamic = "force-dynamic";
