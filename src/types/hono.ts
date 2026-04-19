import type { HonoBase } from "hono/hono-base";

import type { IntoSchema } from "./openapi.js";
import type { NormalizeReason, PrettyMethod, UnionToIntersection } from "./utility.js";

export type SchemaPathEntry = {
  path: string;
  methods: Record<string, unknown>;
};

export type SchemaEntries<Schema> =
  Schema extends Record<string, unknown>
    ? {
        [Path in keyof Schema & string]: {
          path: Path;
          methods: Schema[Path];
        };
      }[keyof Schema & string]
    : never;

export type NormalizeSchemaEntries<Schema> =
  SchemaEntries<Schema> extends infer Entry
    ? Entry extends SchemaPathEntry
      ? {
          path: Entry["path"];
          methods: Entry["methods"];
        }
      : never
    : never;

export type ExpectedEntries<Paths> = NormalizeSchemaEntries<IntoSchema<Paths>>;

export type ActualEntries<App> =
  App extends HonoBase<any, infer Schema, any, any> ? NormalizeSchemaEntries<Schema> : never;

export type PathMethodTableFromEntries<Entries> = UnionToIntersection<
  Entries extends {
    path: infer Path extends string;
    methods: infer Methods extends Record<string, unknown>;
  }
    ? {
        [Key in Path]: Methods;
      }
    : never
>;

export type ActualMethodTable<App> = PathMethodTableFromEntries<ActualEntries<App>>;

export type FindActualMethodsForPath<
  App,
  Path extends string,
> = Path extends keyof ActualMethodTable<App> ? ActualMethodTable<App>[Path] : never;

export type CheckMethodInNormalizedSchema<
  ActualMethods,
  ExpectedMethods,
  Path extends string,
  Method extends keyof ExpectedMethods & string,
> = Method extends keyof ActualMethods
  ? ActualMethods[Method] extends { output: infer Actual }
    ? ExpectedMethods[Method] extends { output: infer Expected }
      ? [Actual] extends [Expected]
        ? never
        : {
            [Key in `Output mismatch at ${PrettyMethod<Method>} ${Path}`]: never;
          }
      : never
    : never
  : {
      [Key in `${PrettyMethod<Method>} ${Path} is missing`]: never;
    };

export type CheckNormalizedSchema<App, Paths> = NormalizeReason<
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

export type CheckOutputs<App, Paths> =
  App extends HonoBase<any, any, any, any>
    ? CheckNormalizedSchema<App, Paths>
    : { "App is not Hono instance": never };

export type DefineAppSchemaPathEntry = SchemaPathEntry;
export type DefineAppSchemaEntries<Schema> = SchemaEntries<Schema>;
export type DefineAppNormalizedSchemaEntries<Schema> = NormalizeSchemaEntries<Schema>;
export type DefineAppExpectedEntries<Paths> = ExpectedEntries<Paths>;
export type DefineAppActualEntries<App> = ActualEntries<App>;
export type DefineAppActualMethodTable<App> = ActualMethodTable<App>;
export type DefineAppFindActualMethodsForPath<App, Path extends string> = FindActualMethodsForPath<
  App,
  Path
>;
export type DefineAppCheckMethodInNormalizedSchema<
  ActualMethods,
  ExpectedMethods,
  Path extends string,
  Method extends keyof ExpectedMethods & string,
> = CheckMethodInNormalizedSchema<ActualMethods, ExpectedMethods, Path, Method>;
export type DefineAppCheckNormalizedSchema<App, Paths> = CheckNormalizedSchema<App, Paths>;
export type DefineAppCheckOutputs<App, Paths> = CheckOutputs<App, Paths>;
