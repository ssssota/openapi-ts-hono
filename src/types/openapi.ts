import type { Env, Hono } from "hono";

export type ConvertPath<P extends string> = P extends `${infer A}{${infer Param}}${infer B}`
  ? `${A}:${Param}${ConvertPath<B>}`
  : P;

export type HttpMethod = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";

export type ExtractParam<Op> = Op extends {
  parameters: { path: infer P extends object };
}
  ? P
  : never;

export type ExtractQuery<Op> = Op extends { parameters: { query?: infer Q } }
  ? NonNullable<Q> extends object
    ? NonNullable<Q>
    : never
  : never;

export type ExtractBody<Op> = Op extends {
  requestBody: { content: { "application/json": infer B } };
}
  ? B
  : never;

export type ExtractResponse<Op> = Op extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;

export type IntoHonoInput<Op> = ([ExtractParam<Op>] extends [never]
  ? object
  : { param: ExtractParam<Op> }) &
  ([ExtractQuery<Op>] extends [never] ? object : { query: ExtractQuery<Op> }) &
  ([ExtractBody<Op>] extends [never] ? object : { json: ExtractBody<Op> });

export type IntoHonoEndpoint<Op> = {
  input: IntoHonoInput<Op>;
  output: ExtractResponse<Op>;
  outputFormat: "json";
  status: 200;
};

export type IntoSchema<Paths> = {
  [P in keyof Paths as ConvertPath<P & string>]: {
    [M in keyof Paths[P] & HttpMethod as [NonNullable<Paths[P][M]>] extends [never]
      ? never
      : `$${M}`]: IntoHonoEndpoint<NonNullable<Paths[P][M]>>;
  };
};

export type TypedHono<Paths, E extends Env = Env, B extends string = "/"> = Hono<
  E,
  IntoSchema<Paths>,
  B
>;
