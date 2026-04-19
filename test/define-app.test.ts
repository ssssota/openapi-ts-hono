import { Hono } from "hono";
import { expectTypeOf, test } from "vitest";

import { defineApp } from "../src/index.js";
import type { DefineAppCheckNormalizedSchema } from "../src/types/index.js";
import type { paths as FixturePaths } from "./fixtures/simple-example.js";

type UserPath = {
  "/users/{id}": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { id: string };
          };
        };
      };
    };
  };
};

type UserPathWithDelete = {
  "/users/{id}": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { id: string };
          };
        };
      };
    };
    delete: {
      responses: {
        200: {
          content: {
            "application/json": { deleted: true };
          };
        };
      };
    };
  };
};

type ApiUsersPath = {
  "/api/users/{id}": UserPath["/users/{id}"];
};

type ApiUsersPathWithDelete = {
  "/api/users/{id}": UserPathWithDelete["/users/{id}"];
};

type ApiPetsPath = {
  "/api/pets": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { items: string[] };
          };
        };
      };
    };
  };
};

type SupportedPaths = {
  "/": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { ok: true };
          };
        };
      };
    };
  };
  "/pets": ApiPetsPath["/api/pets"];
  "/pets/model": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { model: string };
          };
        };
      };
    };
  };
  "/pets/person": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { id: number | string };
          };
        };
      };
    };
  };
  "/unevaluated-properties": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { foo?: string; bar?: number };
          };
        };
      };
    };
  };
  "/users/{id}": UserPathWithDelete["/users/{id}"];
};

type FixtureImplementedPaths = Pick<
  FixturePaths,
  "/" | "/pets" | "/pets/items" | "/pets/model" | "/pets/person" | "/unevaluated-properties"
>;

type ValidationResult<App, Paths> = DefineAppCheckNormalizedSchema<App, Paths>;

const createUsersSubApp = () =>
  new Hono().get("/users/:id", (c) => c.json({ id: c.req.param("id") }));

const createUsersSubAppWithDelete = () =>
  new Hono()
    .get("/users/:id", (c) => c.json({ id: c.req.param("id") }))
    .delete("/users/:id", (c) => c.json({ deleted: true }));

const createSupportedApp = () =>
  new Hono()
    .get("/", (c) => c.json({ ok: true }))
    .get("/pets", (c) => c.json({ items: ["cat"] }))
    .get("/pets/model", (c) => c.json({ model: "pet-model" }))
    .get("/pets/person", (c) => c.json({ id: 1 }))
    .get("/unevaluated-properties", (c) => c.json({ foo: "x", bar: 1 }))
    .get("/users/:id", (c) => c.json({ id: c.req.param("id") }))
    .delete("/users/:id", (c) => c.json({ deleted: true }));

test("accepts an app that implements all required routes", () => {
  const app = defineApp<SupportedPaths>()(createSupportedApp());

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, SupportedPaths>>().toEqualTypeOf<unknown>();
});

test("allows extra routes", () => {
  const app = defineApp<SupportedPaths>()(createSupportedApp().get("/health", (c) => c.text("ok")));

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, SupportedPaths>>().toEqualTypeOf<unknown>();
});

test("supports basePath()", () => {
  const app = defineApp<ApiPetsPath>()(
    new Hono().basePath("/api").get("/pets", (c) => c.json({ items: ["cat"] })),
  );

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, ApiPetsPath>>().toEqualTypeOf<unknown>();
});

test("supports route() composition", () => {
  const app = defineApp<ApiUsersPath>()(new Hono().route("/api", createUsersSubApp()));

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, ApiUsersPath>>().toEqualTypeOf<unknown>();
});

test("supports route() with multiple methods", () => {
  const app = defineApp<ApiUsersPathWithDelete>()(
    new Hono().route("/api", createUsersSubAppWithDelete()),
  );

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, ApiUsersPathWithDelete>>().toEqualTypeOf<unknown>();
});

test("works with openapi-typescript fixture paths when only implemented methods are required", () => {
  const app = defineApp<FixtureImplementedPaths>()(
    new Hono()
      .get("/", (c) => c.json({}))
      .get("/pets", (c) => c.json([]))
      .get("/pets/items", (c) => c.json(["ok"] as const))
      .get("/pets/model", (c) => c.json({}))
      .get("/pets/person", (c) => c.json({ id: 1 }))
      .get("/unevaluated-properties", (c) => c.json({ foo: "x", bar: 1 })),
  );

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, FixtureImplementedPaths>>().toEqualTypeOf<unknown>();
});

test("preserves the concrete app type", () => {
  const app = defineApp<UserPath>()(
    new Hono().get("/users/:id", (c) => c.json({ id: c.req.param("id") })),
  );

  expectTypeOf(app).toEqualTypeOf(
    new Hono().get("/users/:id", (c) => c.json({ id: c.req.param("id") })),
  );
  expectTypeOf<ValidationResult<typeof app, UserPath>>().toEqualTypeOf<unknown>();
});

test("accepts output that is a subtype of the expected 200 application/json response", () => {
  const app = defineApp<UserPath>()(
    new Hono().get("/users/:id", (c) => c.json({ id: c.req.param("id"), extra: "ok" })),
  );

  expectTypeOf(app).toExtend<Hono>();
  expectTypeOf<ValidationResult<typeof app, UserPath>>().toEqualTypeOf<unknown>();
});

test("reports a missing route as a typed validation error", () => {
  const app = new Hono().get("/users/:id", (c) => c.json({ id: c.req.param("id") }));

  expectTypeOf<ValidationResult<typeof app, UserPathWithDelete>>().toEqualTypeOf<{
    "DELETE /users/:id is missing": never;
  }>();
});

test("reports a missing method on an existing path", () => {
  const app = new Hono().get("/pets", (c) => c.json({ items: ["cat"] }));

  expectTypeOf<
    ValidationResult<
      typeof app,
      {
        "/pets": {
          get: ApiPetsPath["/api/pets"]["get"];
          post: {
            responses: {
              200: {
                content: {
                  "application/json": { created: true };
                };
              };
            };
          };
        };
      }
    >
  >().toEqualTypeOf<{ "POST /pets is missing": never }>();
});

test("reports an incompatible 200 application/json output", () => {
  const app = new Hono().get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));

  expectTypeOf<ValidationResult<typeof app, UserPath>>().toEqualTypeOf<{
    "Output mismatch at GET /users/:id": never;
  }>();
});

test("reports a path parameter name mismatch", () => {
  const app = new Hono().get("/users/:userId", (c) => c.json({ id: c.req.param("userId") }));
  type Actual = ValidationResult<typeof app, UserPath>;
  type Expected = { "Output mismatch at GET /users/:id": never };

  expectTypeOf<Actual>().toEqualTypeOf<Expected>();
});

test("reports a nested route mounted under the wrong prefix", () => {
  const app = new Hono().route("/v1", createUsersSubApp());
  type Actual = ValidationResult<typeof app, ApiUsersPath>;
  type Expected = { "Output mismatch at GET /api/users/:id": never };

  expectTypeOf<Actual>().toEqualTypeOf<Expected>();
});

test("reports a basePath mismatch", () => {
  const app = new Hono().basePath("/v1").get("/pets", (c) => c.json({ items: ["cat"] }));
  type Actual = ValidationResult<typeof app, ApiPetsPath>;
  type Expected = { "Output mismatch at GET /api/pets": never };

  expectTypeOf<Actual>().toEqualTypeOf<Expected>();
});

test("reports partially implemented fixture paths", () => {
  type PartialFixturePaths = Pick<FixturePaths, "/" | "/pets" | "/pets/items">;

  const app = new Hono().get("/", (c) => c.json({})).get("/pets", (c) => c.json([]));
  type Actual = ValidationResult<typeof app, PartialFixturePaths>;
  type Expected = { "Output mismatch at GET /pets/items": never };

  expectTypeOf<Actual>().toEqualTypeOf<Expected>();
});

test("surfaces validation errors through defineApp at the call site", () => {
  defineApp<{
    "/pets": {
      get: ApiPetsPath["/api/pets"]["get"];
      post: {
        responses: {
          200: {
            content: {
              "application/json": { created: true };
            };
          };
        };
      };
    };
  }>()(
    // @ts-expect-error POST /pets is missing
    new Hono().get("/pets", (c) => c.json({ items: ["cat"] })),
  );
});

test("reports normalized output mismatches for partially implemented fixture paths", () => {
  const app = new Hono().get("/", (c) => c.json({})).get("/pets", (c) => c.json([]));

  expectTypeOf<ValidationResult<typeof app, FixturePaths>>().toEqualTypeOf<
    { "Output mismatch at GET /pets/items": never } & {
      "Output mismatch at GET /pets/model": never;
    } & { "Output mismatch at GET /pets/person": never } & {
      "Output mismatch at GET /unevaluated-properties": never;
    }
  >();
});
