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
    get: {
      parameters: { path: { id: string } };
      responses: { 200: { content: { "application/json": { id: string } } } };
    };
  };
};

type UserPathOutputOnly = {
  "/users/{id}": {
    get: { responses: { 200: { content: { "application/json": { id: string } } } } };
  };
};

type UserPathWithDelete = {
  "/users/{id}": {
    get: {
      parameters: { path: { id: string } };
      responses: { 200: { content: { "application/json": { id: string } } } };
    };
    delete: {
      parameters: { path: { id: string } };
      responses: { 200: { content: { "application/json": { deleted: true } } } };
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

type SearchUsersPath = {
  "/users": {
    get: {
      parameters: { query: { q: string } };
      responses: { 200: { content: { "application/json": { items: string[] } } } };
    };
  };
};

type UploadAvatarPath = {
  "/users/{id}/avatar": {
    post: {
      parameters: {
        path: { id: string };
        header: { "x-trace-id": string };
        cookie: { session: string };
      };
      requestBody: {
        content: { "multipart/form-data": { fileName?: string; orderId?: number } };
      };
      responses: { 200: { content: { "application/json": { ok: true } } } };
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
      .get("/pets", sValidator("query", z.object({ limit: z.string().optional() })), (c) =>
        c.json([]),
      )
      .get("/pets/items", (c) => c.json(["ok"] as const))
      .get("/pets/model", sValidator("query", z.object({ limit: z.string().optional() })), (c) =>
        c.json({}),
      )
      .get("/pets/person", sValidator("query", z.object({ limit: z.string().optional() })), (c) =>
        c.json({ id: 1 }),
      )
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

test("accepts compatible validated query input", () => {
  const app = defineApp<SearchUsersPath>()(
    new Hono().get("/users", sValidator("query", z.object({ q: z.string() })), (c) =>
      c.json({ items: [c.req.valid("query").q] }),
    ),
  );

  expectTypeOf<ValidationResult<typeof app, SearchUsersPath>>().toEqualTypeOf<unknown>();
});

test("accepts compatible validated form, header, and cookie input", () => {
  const app = defineApp<UploadAvatarPath>()(
    new Hono().post(
      "/users/:id/avatar",
      sValidator("header", z.object({ "x-trace-id": z.string() })),
      sValidator("cookie", z.object({ session: z.string() })),
      sValidator(
        "form",
        z.object({ fileName: z.string().optional(), orderId: z.string().optional() }),
      ),
      (c) => c.json({ ok: true }),
    ),
  );

  expectTypeOf<ValidationResult<typeof app, UploadAvatarPath>>().toEqualTypeOf<unknown>();
});

test("reports an incompatible 200 application/json output", () => {
  const app = new Hono().get("/users/:id", (c) => c.json({ userId: c.req.param("id") }));

  expectTypeOf<ValidationResult<typeof app, UserPathOutputOnly>>().toEqualTypeOf<{
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
    "JSON input mismatch at POST /users": never;
  }>();
});

test("reports an incompatible validated query input", () => {
  const app = new Hono().get("/users", sValidator("query", z.object({ search: z.string() })), (c) =>
    c.json({ items: [c.req.valid("query").search] }),
  );

  expectTypeOf<ValidationResult<typeof app, SearchUsersPath>>().toEqualTypeOf<{
    "Query input mismatch at GET /users": never;
  }>();
});

test("reports an incompatible validated form input", () => {
  const app = new Hono().post(
    "/users/:id/avatar",
    sValidator("header", z.object({ "x-trace-id": z.string() })),
    sValidator("cookie", z.object({ session: z.string() })),
    sValidator("form", z.object({ filePath: z.string() })),
    (c) => c.json({ ok: true }),
  );

  expectTypeOf<ValidationResult<typeof app, UploadAvatarPath>>().toEqualTypeOf<{
    "Form input mismatch at POST /users/:id/avatar": never;
  }>();
});

test("reports a path parameter name mismatch", () => {
  const app = new Hono().get("/users/:userId", (c) => c.json({ id: c.req.param("userId") }));

  expectTypeOf<ValidationResult<typeof app, UserPath>>().branded.toEqualTypeOf<{
    "Path input mismatch at GET /users/:id": never;
    "Output mismatch at GET /users/:id": never;
  }>();
});

test("reports a nested route mounted under the wrong prefix", () => {
  const app = new Hono().route("/v1", createUsersSubApp());

  expectTypeOf<ValidationResult<typeof app, ApiUsersPath>>().branded.toEqualTypeOf<{
    "Path input mismatch at GET /api/users/:id": never;
    "Output mismatch at GET /api/users/:id": never;
  }>();
});

test("reports a basePath mismatch", () => {
  const app = new Hono().basePath("/v1").get("/pets", (c) => c.json({ items: ["cat"] }));

  expectTypeOf<ValidationResult<typeof app, ApiPetsPath>>().branded.toEqualTypeOf<{
    "Output mismatch at GET /api/pets": never;
  }>();
});
