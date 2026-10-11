import type { APIRoute } from "astro";
import { notFound } from "../lib/http.ts";

/** Everything that is not a known route gets the same plain 404. */
export const ALL: APIRoute = () => notFound();
