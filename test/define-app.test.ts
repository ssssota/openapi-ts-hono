import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import { defineApp } from "../src/index.js";
import type { DefineAppCheckNormalizedSchema } from "../src/types/index.js";
import type { paths as FixturePaths } from "./fixtures/simple-example.js";
import type { HonoBase } from "hono/hono-base";

type UserPath = {
  "/users/{id}": {
    get: { responses: { 200: { content: { "application/json": { id: string } } } } };
  };
};

type UserPathWithDelete = {
  "/users/{id}": {
    get: { responses: { 200: { content: { "application/json": { id: string } } } } };
    delete: { responses: { 200: { content: { "application/json": { deleted: true } } } } };
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
    get: { responses: { 200: { content: { "application/json": { items: string[] } } } } };
  };
};

type CreateUserPath = {
  "/users": {
    post: {
      requestBody: { content: { "application/json": { name: string; age: number } } };
      responses: { 200: { content: { "application/json": { id: string } } } };
    };
  };
};

type SupportedPaths = {
  "/": {
    get: { responses: { 200: { content: { "application/json": { ok: true } } } } };
  };
  "/pets": ApiPetsPath["/api/pets"];
  "/pets/model": {
    get: { responses: { 200: { content: { "application/json": { model: string } } } } };
  };
  "/pets/person": {
    get: { responses: { 200: { content: { "application/json": { id: number | string } } } } };
  };
  "/unevaluated-properties": {
    get: {
      responses: { 200: { content: { "application/json": { foo?: string; bar?: number } } } };
    };
  };
  "/users/{id}": UserPathWithDelete["/users/{id}"];
};

type FixtureImplementedPaths = Pick<
  FixturePaths,
  "/" | "/pets" | "/pets/items" | "/pets/model" | "/pets/person" | "/unevaluated-properties"
>;

type ValidationResult<App extends HonoBase, Paths> = DefineAppCheckNormalizedSchema<App, Paths>;

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

  expectTypeOf<ValidationResult<typeof app, SupportedPaths>>().toEqualTypeOf<unknown>();
});

test("allows extra routes", () => {
  const app = defineApp<SupportedPaths>()(createSupportedApp().get("/health", (c) => c.text("ok")));

  expectTypeOf<ValidationResult<typeof app, SupportedPaths>>().toEqualTypeOf<unknown>();
});

test("supports basePath()", () => {
  const app = defineApp<ApiPetsPath>()(
    new Hono().basePath("/api").get("/pets", (c) => c.json({ items: ["cat"] })),
  );

  expectTypeOf<ValidationResult<typeof app, ApiPetsPath>>().toEqualTypeOf<unknown>();
});

test("supports route() composition", () => {
  const app = defineApp<ApiUsersPath>()(new Hono().route("/api", createUsersSubApp()));

  expectTypeOf<ValidationResult<typeof app, ApiUsersPath>>().toEqualTypeOf<unknown>();
});

test("supports route() with multiple methods", () => {
  const app = defineApp<ApiUsersPathWithDelete>()(
    new Hono().route("/api", createUsersSubAppWithDelete()),
  );

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

  expectTypeOf<ValidationResult<typeof app, UserPath>>().toEqualTypeOf<unknown>();
});

test("accepts compatible validated json input", () => {
  const app = defineApp<CreateUserPath>()(
    new Hono().post(
      "/users",
      sValidator("json", z.object({ name: z.string(), age: z.number().optional() })),
      (c) => c.json({ id: c.req.valid("json").name }),
    ),
  );

  expectTypeOf<ValidationResult<typeof app, CreateUserPath>>().toEqualTypeOf<unknown>();
});

test("reports an incompatible 200 application/json output", () => {
  const app = new Hono().get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));

  expectTypeOf<ValidationResult<typeof app, UserPath>>().toEqualTypeOf<{
    "Output mismatch at GET /users/:id": never;
  }>();
});

test("reports an incompatible validated json input", () => {
  const app = new Hono().post(
    "/users",
    sValidator("json", z.object({ name: z.string(), active: z.boolean() })),
    (c) => c.json({ id: c.req.valid("json").name }),
  );

  expectTypeOf<ValidationResult<typeof app, CreateUserPath>>().toEqualTypeOf<{
    "Input mismatch at POST /users": never;
  }>();
});

test("reports a path parameter name mismatch", () => {
  const app = new Hono().get("/users/:userId", (c) => c.json({ id: c.req.param("userId") }));

  expectTypeOf<ValidationResult<typeof app, UserPath>>().toEqualTypeOf<{
    "Output mismatch at GET /users/:id": never;
  }>();
});

test("reports a nested route mounted under the wrong prefix", () => {
  const app = new Hono().route("/v1", createUsersSubApp());

  expectTypeOf<ValidationResult<typeof app, ApiUsersPath>>().toEqualTypeOf<{
    "Output mismatch at GET /api/users/:id": never;
  }>();
});

test("reports a basePath mismatch", () => {
  const app = new Hono().basePath("/v1").get("/pets", (c) => c.json({ items: ["cat"] }));

  expectTypeOf<ValidationResult<typeof app, ApiPetsPath>>().toEqualTypeOf<{
    "Output mismatch at GET /api/pets": never;
  }>();
});
