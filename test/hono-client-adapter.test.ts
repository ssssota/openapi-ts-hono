import { Hono } from "hono";
import { expectTypeOf, test } from "vitest";

import { defineApp } from "../src/index.js";
import type {
  DefineAppCheckNormalizedSchema,
  FindActualMethodsForPath,
} from "../src/types/index.js";
import type { HonoBase } from "hono/hono-base";

type LiteralIndexPath = {
  "/index": {
    get: {
      responses: {
        200: { content: { "application/json": { page: "index" } } };
      };
    };
  };
};

type RootAndLiteralIndexPath = {
  "/": {
    get: {
      responses: {
        200: { content: { "application/json": { root: true } } };
      };
    };
  };
  "/index": LiteralIndexPath["/index"];
};

type ValidationResult<
  App extends HonoBase,
  Paths,
  BasePath extends string = "",
> = DefineAppCheckNormalizedSchema<App, Paths, BasePath>;

test("derives actual methods through hono/client for mounted nested paths", () => {
  const app = new Hono().route(
    "/admin",
    new Hono()
      .get("/users/:id/settings", (c) =>
        c.json({ id: c.req.param("id"), enabled: c.req.param("id").length > 0 }, 200),
      )
      .delete("/users/:id/settings", (c) => c.body(null, 204)),
  );

  type SettingsMethods = FindActualMethodsForPath<typeof app, "/admin/users/:id/settings">;

  expectTypeOf<SettingsMethods["$get"]["input"]>().toEqualTypeOf<{
    param: { id: string };
  }>();
  expectTypeOf<SettingsMethods["$get"]["output"]>().toEqualTypeOf<{
    id: string;
    enabled: boolean;
  }>();
  expectTypeOf<SettingsMethods["$get"]["outputFormat"]>().toEqualTypeOf<"json">();
  expectTypeOf<SettingsMethods["$delete"]["output"]>().toEqualTypeOf<null>();
  expectTypeOf<SettingsMethods["$delete"]["outputFormat"]>().toEqualTypeOf<"body">();
  expectTypeOf<SettingsMethods["$delete"]["status"]>().toEqualTypeOf<204>();
});

test("distinguishes a literal /index route from the root client index key", () => {
  const app = defineApp<LiteralIndexPath>()(
    new Hono().get("/index", (c) => c.json({ page: "index" as const }, 200)),
  );

  expectTypeOf<ValidationResult<typeof app, LiteralIndexPath>>().toEqualTypeOf<unknown>();
});

test("distinguishes root and literal /index routes when both exist", () => {
  const app = defineApp<RootAndLiteralIndexPath>()(
    new Hono()
      .get("/", (c) => c.json({ root: true as const }, 200))
      .get("/index", (c) => c.json({ page: "index" as const }, 200)),
  );

  expectTypeOf<ValidationResult<typeof app, RootAndLiteralIndexPath>>().toEqualTypeOf<unknown>();
});
