import type { HonoBase } from "hono/hono-base";
import type { IntoSchema } from "./openapi.js";
import type { NormalizeReason, PrettyMethod, UnionToIntersection } from "./utility.js";

export type AnyHono = HonoBase<any, any, any, any>;

export type SchemaPathEntry = {
  path: string;
  methods: Record<string, unknown>;
};

export type SchemaEntries<Schema> =
  Schema extends Record<string, unknown>
    ? {
        [Path in keyof Schema & string]: { path: Path; methods: Schema[Path] };
      }[keyof Schema & string]
    : never;

export type NormalizeSchemaEntries<Schema> =
  SchemaEntries<Schema> extends infer Entry
    ? Entry extends SchemaPathEntry
      ? { path: Entry["path"]; methods: Entry["methods"] }
      : never
    : never;

export type ExpectedEntries<Paths> = NormalizeSchemaEntries<IntoSchema<Paths>>;

export type ActualEntries<App extends AnyHono> =
  App extends HonoBase<any, infer Schema, any, any> ? NormalizeSchemaEntries<Schema> : never;

export type PathMethodTableFromEntries<Entries> = UnionToIntersection<
  Entries extends {
    path: infer Path extends string;
    methods: infer Methods extends Record<string, unknown>;
  }
    ? { [Key in Path]: Methods }
    : never
>;

export type ActualMethodTable<App extends AnyHono> = PathMethodTableFromEntries<ActualEntries<App>>;

export type FindActualMethodsForPath<
  App extends AnyHono,
  Path extends string,
> = Path extends keyof ActualMethodTable<App> ? ActualMethodTable<App>[Path] : never;

type CheckMethodJsonInputCompatibility<
  ActualMethod,
  ExpectedMethod,
  Path extends string,
  Method extends string,
> = ActualMethod extends { input: infer ActualInput }
  ? ExpectedMethod extends { input: infer ExpectedInput }
    ? ExpectedInput extends { json: infer ExpectedJson }
      ? ActualInput extends { json: infer ActualJson }
        ? [ExpectedJson] extends [ActualJson]
          ? never
          : { [Key in `Input mismatch at ${PrettyMethod<Method>} ${Path}`]: never }
        : { [Key in `Input mismatch at ${PrettyMethod<Method>} ${Path}`]: never }
      : never
    : never
  : never;

type CheckMethodOutputCompatibility<
  ActualMethod,
  ExpectedMethod,
  Path extends string,
  Method extends string,
> = ExpectedMethod extends { output: infer Expected }
  ? [
      ActualMethod extends unknown
        ? ActualMethod extends { outputFormat: "json"; output: infer Candidate }
          ? [Candidate] extends [Expected]
            ? Candidate
            : never
          : never
        : never,
    ] extends [never]
    ? { [Key in `Output mismatch at ${PrettyMethod<Method>} ${Path}`]: never }
    : never
  : never;

export type CheckMethodInNormalizedSchema<
  ActualMethods,
  ExpectedMethods,
  Path extends string,
  Method extends keyof ExpectedMethods & string,
> = Method extends keyof ActualMethods
  ? NormalizeReason<
      | CheckMethodJsonInputCompatibility<
          ActualMethods[Method],
          ExpectedMethods[Method],
          Path,
          Method
        >
      | CheckMethodOutputCompatibility<ActualMethods[Method], ExpectedMethods[Method], Path, Method>
    >
  : { [Key in `${PrettyMethod<Method>} ${Path} is missing`]: never };

export type CheckNormalizedSchema<App extends AnyHono, Paths> = NormalizeReason<
  ExpectedEntries<Paths> extends infer Entry
    ? Entry extends {
        path: infer Path extends string;
        methods: infer Methods extends Record<string, unknown>;
      }
      ? {
          [Method in keyof Methods & string]: CheckMethodInNormalizedSchema<
            FindActualMethodsForPath<App, Path>,
            Methods,
            Path,
            Method
          >;
        }[keyof Methods & string]
      : never
    : never
>;

export type DefineAppCheckNormalizedSchema<App extends AnyHono, Paths> = CheckNormalizedSchema<
  App,
  Paths
>;
