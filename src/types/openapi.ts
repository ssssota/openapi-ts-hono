export type ConvertPath<P extends string> = P extends `${infer A}{${infer Param}}${infer B}`
  ? `${A}:${Param}${ConvertPath<B>}`
  : P;

export type HttpMethod = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";

type NormalizeBasePathInner<BasePath extends string> = BasePath extends `${infer Prefix}/`
  ? NormalizeBasePathInner<Prefix>
  : BasePath;

export type NormalizeBasePath<BasePath extends string> = BasePath extends "" | "/"
  ? ""
  : NormalizeBasePathInner<BasePath>;

export type StripBasePath<Path extends string, BasePath extends string> =
  NormalizeBasePath<BasePath> extends infer NormalizedBasePath extends string
    ? NormalizedBasePath extends ""
      ? Path
      : Path extends NormalizedBasePath
        ? "/"
        : Path extends `${NormalizedBasePath}/${infer Rest}`
          ? `/${Rest}`
          : never
    : never;

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

type HttpStatusFromKey<Key> = Key extends number
  ? Key
  : Key extends `${infer Status extends number}`
    ? Status
    : never;

type ExtractResponseContent<Response> = Response extends { content: infer Content }
  ? NonNullable<Content> extends object
    ? NonNullable<Content>
    : never
  : Response extends { content?: infer Content }
    ? NonNullable<Content> extends object
      ? NonNullable<Content>
      : never
    : never;

type OutputFormatForContentType<ContentType extends string> = ContentType extends "application/json"
  ? "json"
  : ContentType extends "text/plain"
    ? "text"
    : "body";

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

type IntoHonoResponseWithContent<PathItem, Op, Status extends number, Content extends object> = {
  [ContentType in keyof Content & string]: {
    input: IntoHonoInput<PathItem, Op>;
    output: Content[ContentType];
    outputFormat: OutputFormatForContentType<ContentType>;
    status: Status;
    responseLabel: `${Status} ${ContentType}`;
  };
}[keyof Content & string];

type IntoHonoEmptyResponse<PathItem, Op, Status extends number> = {
  input: IntoHonoInput<PathItem, Op>;
  output: null;
  outputFormat: "body";
  status: Status;
  responseLabel: `${Status} no content`;
};

type IntoHonoResponse<PathItem, Op, ResponseKey, Response> =
  HttpStatusFromKey<ResponseKey> extends infer Status
    ? [Status] extends [never]
      ? never
      : Status extends number
        ? [ExtractResponseContent<Response>] extends [never]
          ? IntoHonoEmptyResponse<PathItem, Op, Status>
          : ExtractResponseContent<Response> extends infer Content extends object
            ? IntoHonoResponseWithContent<PathItem, Op, Status, Content>
            : never
        : never
    : never;

export type IntoHonoMethod<PathItem, Op> = Op extends { responses: infer Responses extends object }
  ? {
      [ResponseKey in keyof Responses]: IntoHonoResponse<
        PathItem,
        Op,
        ResponseKey,
        Responses[ResponseKey]
      >;
    }[keyof Responses]
  : {
      input: IntoHonoInput<PathItem, Op>;
    };

type IntoHonoMethodOrInputOnly<PathItem, Op> = [IntoHonoMethod<PathItem, Op>] extends [never]
  ? {
      input: IntoHonoInput<PathItem, Op>;
    }
  : IntoHonoMethod<PathItem, Op>;

export type IntoHonoEndpoint<PathItem, Op> = IntoHonoMethodOrInputOnly<PathItem, Op>;

type IntoSchemaMethod<PathItem, Op> = IntoHonoEndpoint<PathItem, Op>;

export type IntoSchema<Paths, BasePath extends string = ""> = {
  [P in keyof Paths as [StripBasePath<P & string, BasePath>] extends [never]
    ? never
    : ConvertPath<StripBasePath<P & string, BasePath> & string>]: {
    [M in keyof Paths[P] & HttpMethod as [NonNullable<Paths[P][M]>] extends [never]
      ? never
      : `$${M}`]: IntoSchemaMethod<Paths[P], NonNullable<Paths[P][M]>>;
  };
};
