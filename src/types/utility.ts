export type PrettyMethod<Method extends string> = Method extends `$${infer Raw}`
  ? Uppercase<Raw>
  : Uppercase<Method>;

export type UnionToIntersection<Union> = (
  Union extends unknown ? (arg: Union) => void : never
) extends (arg: infer Intersection) => void
  ? Intersection
  : never;

export type NormalizeReason<ReasonUnion> = [ReasonUnion] extends [never]
  ? unknown
  : UnionToIntersection<ReasonUnion>;
