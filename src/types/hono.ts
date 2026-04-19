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

type InputTarget = "param" | "query" | "header" | "cookie" | "json" | "form";

type ExpectedInputTargets<ExpectedInput> = keyof ExpectedInput & InputTarget;

type PrettyInputTarget<Target extends InputTarget> = Target extends "param"
  ? "Path"
  : Target extends "json"
    ? "JSON"
    : Capitalize<Target>;

type InputMismatchReason<Target extends InputTarget, Path extends string, Method extends string> = {
  [Key in `${PrettyInputTarget<Target>} input mismatch at ${PrettyMethod<Method>} ${Path}`]: never;
};

type InputTargetValue<Input, Target extends InputTarget> = Target extends keyof Input
  ? Input[Target]
  : never;

type NarrowStringInput<Value> = [Exclude<Value, undefined>] extends [string]
  ? string extends Exclude<Value, undefined>
    ? never
    : Exclude<Value, undefined>
  : never;

type HasArrayInput<Value> = [
  Extract<Exclude<Value, undefined>, readonly unknown[] | unknown[]>,
] extends [never]
  ? false
  : true;

type IsStringInputCompatible<ExpectedValue, ActualValue> = [
  NarrowStringInput<ExpectedValue>,
] extends [never]
  ? string extends ActualValue
    ? true
    : false
  : NarrowStringInput<ExpectedValue> extends ActualValue
    ? true
    : false;

type IsQueryInputCompatible<ExpectedValue, ActualValue> =
  HasArrayInput<ExpectedValue> extends true
    ? string[] extends ActualValue
      ? true
      : false
    : IsStringInputCompatible<ExpectedValue, ActualValue>;

type IsFormInputCompatible<ExpectedValue, ActualValue> =
  HasArrayInput<ExpectedValue> extends true
    ? string[] extends ActualValue
      ? true
      : false
    : IsStringInputCompatible<ExpectedValue, ActualValue>;

type AreTargetPropertiesCompatible<
  Target extends Exclude<InputTarget, "json">,
  ExpectedTargetInput extends object,
  ActualTargetInput extends object,
> = [keyof ExpectedTargetInput] extends [never]
  ? true
  : false extends {
        [Key in keyof ExpectedTargetInput]-?: Key extends keyof ActualTargetInput
          ? Target extends "query"
            ? IsQueryInputCompatible<ExpectedTargetInput[Key], ActualTargetInput[Key]>
            : Target extends "form"
              ? IsFormInputCompatible<ExpectedTargetInput[Key], ActualTargetInput[Key]>
              : IsStringInputCompatible<ExpectedTargetInput[Key], ActualTargetInput[Key]>
          : false;
      }[keyof ExpectedTargetInput]
    ? false
    : true;

type IsInputTargetCompatible<
  ActualInput extends object,
  ExpectedInput extends object,
  Target extends ExpectedInputTargets<ExpectedInput>,
> = Target extends keyof ActualInput
  ? Target extends "json"
    ? [InputTargetValue<ExpectedInput, Target>] extends [InputTargetValue<ActualInput, Target>]
      ? true
      : false
    : InputTargetValue<ExpectedInput, Target> extends object
      ? InputTargetValue<ActualInput, Target> extends object
        ? AreTargetPropertiesCompatible<
            Exclude<Target, "json">,
            InputTargetValue<ExpectedInput, Target>,
            InputTargetValue<ActualInput, Target>
          >
        : false
      : false
  : false;

type CheckMethodInputTargetCompatibility<
  ActualMethod,
  ExpectedInput extends object,
  Path extends string,
  Method extends string,
  Target extends ExpectedInputTargets<ExpectedInput>,
> = [
  ActualMethod extends unknown
    ? ActualMethod extends { input: infer ActualInput extends object }
      ? IsInputTargetCompatible<ActualInput, ExpectedInput, Target> extends true
        ? ActualInput
        : never
      : never
    : never,
] extends [never]
  ? InputMismatchReason<Target, Path, Method>
  : never;

type CheckMethodInputCompatibility<
  ActualMethod,
  ExpectedMethod,
  Path extends string,
  Method extends string,
> = ExpectedMethod extends { input: infer ExpectedInput extends object }
  ? [ExpectedInputTargets<ExpectedInput>] extends [never]
    ? never
    : NormalizeReason<
        {
          [Target in ExpectedInputTargets<ExpectedInput>]: CheckMethodInputTargetCompatibility<
            ActualMethod,
            ExpectedInput,
            Path,
            Method,
            Target
          >;
        }[ExpectedInputTargets<ExpectedInput>]
      >
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
      | CheckMethodInputCompatibility<ActualMethods[Method], ExpectedMethods[Method], Path, Method>
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
