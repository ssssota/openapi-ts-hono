import type { HonoBase } from "hono/hono-base";
import type { DefineAppCheckNormalizedSchema } from "./types/index.js";

/**
 * Validates a Hono app against an OpenAPI-derived `paths` type.
 *
 * The function is curried so callers can specify `Paths` explicitly while keeping
 * the concrete `App` type inferred from the provided Hono instance.
 * Missing routes/methods and output mismatches are reported as type errors.
 *
 * This implementation normalizes both expected and actual schemas into
 * `{ path, methods }` entries before comparison, and then builds a path-indexed
 * lookup table for actual methods. This works with flat route definitions as
 * well as `basePath()` and `route()` composition.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { defineApp } from "openapi-ts-hono";
 * import type { paths } from "./generated/schema";
 *
 * const app = defineApp<paths>()(
 *   new Hono().get("/users/:userId", (c) => {
 *     const userId = c.req.param("userId");
 *     return c.json({ id: userId, name: "Alice" });
 *   }),
 * );
 * ```
 *
 * @example
 * ```ts
 * const users = new Hono().get("/users/:id", (c) => {
 *   return c.json({ id: c.req.param("id") });
 * });
 *
 * const app = defineApp<{
 *   "/api/users/{id}": {
 *     get: {
 *       responses: {
 *         200: {
 *           content: {
 *             "application/json": { id: string };
 *           };
 *         };
 *       };
 *     };
 *   };
 * }>()(new Hono().route("/api", users));
 * ```
 */
export function defineApp<Paths>(): <App extends HonoBase<any, any, any, any>>(
  app: App & DefineAppCheckNormalizedSchema<App, Paths>,
) => App {
  return (app) => app;
}
