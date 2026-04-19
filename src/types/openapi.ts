export type ConvertPath<P extends string> = P extends `${infer A}{${infer Param}}${infer B}`
  ? `${A}:${Param}${ConvertPath<B>}`
  : P;

export type HttpMethod = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";

type ParameterLocation = "path" | "query" | "header" | "cookie";

type ExtractParameterRecord<Source, Location extends ParameterLocation> = Source extends {
  parameters: infer Parameters extends object;
}
  ? Location extends keyof Parameters
    ? NonNullable<Parameters[Location]> extends object
      ? NonNullable<Parameters[Location]>
      : never
    : never
  : never;

type ExtractMergedParameterRecord<PathItem, Op, Location extends ParameterLocation> = [
  ExtractParameterRecord<Op, Location>,
] extends [never]
  ? ExtractParameterRecord<PathItem, Location>
  : ExtractParameterRecord<Op, Location>;

type ExtractRequestBodyContent<Op, ContentType extends string> = Op extends {
  requestBody?: { content: infer Content extends object };
}
  ? ContentType extends keyof Content
    ? Content[ContentType]
    : never
  : never;

export type ExtractParam<PathItem, Op> = ExtractMergedParameterRecord<PathItem, Op, "path">;

export type ExtractQuery<PathItem, Op> = ExtractMergedParameterRecord<PathItem, Op, "query">;

export type ExtractHeader<PathItem, Op> = ExtractMergedParameterRecord<PathItem, Op, "header">;

export type ExtractCookie<PathItem, Op> = ExtractMergedParameterRecord<PathItem, Op, "cookie">;

export type ExtractJsonBody<Op> = ExtractRequestBodyContent<Op, "application/json">;

export type ExtractFormBody<Op> =
  | ExtractRequestBodyContent<Op, "multipart/form-data">
  | ExtractRequestBodyContent<Op, "application/x-www-form-urlencoded">;

export type ExtractResponse<Op> = Op extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;

export type IntoHonoInput<PathItem, Op> = ([ExtractParam<PathItem, Op>] extends [never]
  ? object
  : { param: ExtractParam<PathItem, Op> }) &
  ([ExtractQuery<PathItem, Op>] extends [never] ? object : { query: ExtractQuery<PathItem, Op> }) &
  ([ExtractHeader<PathItem, Op>] extends [never]
    ? object
    : { header: ExtractHeader<PathItem, Op> }) &
  ([ExtractCookie<PathItem, Op>] extends [never]
    ? object
    : { cookie: ExtractCookie<PathItem, Op> }) &
  ([ExtractJsonBody<Op>] extends [never] ? object : { json: ExtractJsonBody<Op> }) &
  ([ExtractFormBody<Op>] extends [never] ? object : { form: ExtractFormBody<Op> });

export type IntoHonoEndpoint<PathItem, Op> = {
  input: IntoHonoInput<PathItem, Op>;
  output: ExtractResponse<Op>;
  outputFormat: "json";
  status: 200;
};

export type IntoSchema<Paths> = {
  [P in keyof Paths as ConvertPath<P & string>]: {
    [M in keyof Paths[P] & HttpMethod as [NonNullable<Paths[P][M]>] extends [never]
      ? never
      : `$${M}`]: IntoHonoEndpoint<Paths[P], NonNullable<Paths[P][M]>>;
  };
};
