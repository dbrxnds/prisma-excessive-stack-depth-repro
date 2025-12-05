/*
 * Taken from: https://gist.github.com/riordanpawley/1265ac8df7c373560bf42c71a731d2ff
 */

import type { Operation } from "@prisma/client/runtime/client";
import type { Replace } from "type-fest";
import { Data, Effect, Option, Schema } from "effect";
import { Prisma } from "./prisma/generated/client";

export const PrismaErrorCodeSchema = Schema.Literal(
  "NOT_FOUND",
  "UNKNOWN",
  "INVALID_STATE",
  "DATABASE_UNREACHABLE",
  "TIMEOUT",
  "ACCESS_DENIED",
  "INVALID_ARGUMENTS",
  "DB_FN_UNIMPLEMENTED",
  "UNIQUE_CONSTRAINT_VIOLATION",
  "FOREIGN_KEY_CONSTRAINT_VIOLATION"
);
export type PrismaErrorCodes = typeof PrismaErrorCodeSchema.Type;

export const NativePrismaErrorShape = Schema.Struct({
  clientVersion: Schema.optional(Schema.String),
  code: Schema.optional(Schema.String),
  errorCode: Schema.optional(Schema.String),
  meta: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
    Schema.annotations({ decodingFallback: () => Effect.succeed({}) }),
    Schema.optional
  ),
});

export class PrismaError extends Schema.TaggedError<PrismaError>()(
  "PrismaError",
  {
    clientVersion: Schema.optional(Schema.String),
    code: PrismaErrorCodeSchema,
    cause: Schema.Unknown,
    meta: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.optional
    ),
    prismaCode: Schema.String.pipe(Schema.NullOr),
  }
) {
  static fromUnknown(err: unknown): PrismaError {
    if (err instanceof PrismaError) {
      return err;
    }
    return Schema.decodeUnknownOption(NativePrismaErrorShape)(err).pipe(
      Option.match({
        onNone: () =>
          new PrismaError({
            code: "UNKNOWN",
            prismaCode: null,
            cause: err,
          }),
        onSome: (parsed) =>
          new PrismaError({
            clientVersion: parsed.clientVersion,
            code: prismaCodeMapper(parsed.code ?? parsed.errorCode ?? ""),
            meta: parsed.meta,
            prismaCode: parsed.code ?? parsed.errorCode ?? null,
            cause: err,
          }),
      })
    );
  }
}

function prismaCodeMapper(code: string): PrismaErrorCodes {
  switch (code) {
    case "P1001":
    case "P1013":
    case "P1011":
      return "DATABASE_UNREACHABLE";
    case "P2024":
    case "P1008":
      return "TIMEOUT";
    case "P1010":
      return "ACCESS_DENIED";
    case "P2009":
    case "P2012":
    case "P2013":
    case "P2000":
      return "INVALID_ARGUMENTS";
    case "P2002":
      return "UNIQUE_CONSTRAINT_VIOLATION";
    case "P2003":
      return "FOREIGN_KEY_CONSTRAINT_VIOLATION";
    case "P2015":
    case "P2018":
    case "P2025":
    case "P2001":
      return "NOT_FOUND";
    case "P2005":
      return "INVALID_STATE";
    case "P2026":
      return "DB_FN_UNIMPLEMENTED";
    default:
      return "UNKNOWN";
  }
}

type PrismaModelOp = Exclude<
  Operation,
  | "$executeRaw"
  | "$executeRawUnsafe"
  | "$queryRaw"
  | "$queryRawUnsafe"
  | "$runCommandRaw"
  | "aggregateRaw"
  | "findFirst"
  | "findFirstOrThrow"
  | "findRaw"
  | "findUnique"
  | "findUniqueOrThrow"
>;

const PrismaModelOps = [
  "findMany",
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "aggregate",
  "count",
  "groupBy",
] as const satisfies Array<PrismaModelOp>;

export const prismaEffectExtension = {
  client: {
    // $executeRaw: (query: TemplateStringsArray | Sql, ...values: any[]) => PrismaPromise<number>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    $executeRawEffect<T>(
      this: T,
      query: Prisma.Sql,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...values: Array<any>
    ): Effect.Effect<number, PrismaError> {
      return Effect.tryPromise<number, PrismaError>({
        catch: (cause) => PrismaError.fromUnknown(cause),
        try: () => {
          const prismaExtensionContextClient = Prisma.getExtensionContext(this);
          // @ts-expect-error Can't predict these in advance
          return prismaExtensionContextClient.$executeRaw(query, ...values);
        },
      });
    },
  },
  model: {
    $allModels: {
      ...(Object.fromEntries(
        PrismaModelOps.map((method) => [
          `${method}Effect`,
          function <T, A, O extends typeof method>(
            this: T,
            x?: Prisma.Exact<A, Prisma.Args<T, O>>
          ): Effect.Effect<Prisma.Result<T, A, O>, PrismaError> {
            return Effect.tryPromise<Prisma.Result<T, A, O>, PrismaError>({
              catch: (cause) => PrismaError.fromUnknown(cause),
              try: () => {
                const prismaExtensionContextClient =
                  Prisma.getExtensionContext(this);
                // @ts-expect-error Can't predict these in advance
                return prismaExtensionContextClient[method](x) as any;
              },
            });
          },
        ])
      ) as {
        [K in `${(typeof PrismaModelOps)[number]}Effect`]: <
          T,
          A,
          O extends Replace<K, "Effect", "">
        >(
          this: T,
          x?: Prisma.Exact<A, Prisma.Args<T, O>>
        ) => Effect.Effect<Prisma.Result<T, A, O>, PrismaError>;
      }),
      findFirstEffect<T, A, O extends "findFirst">(
        this: T,
        x?: Prisma.Exact<A, Prisma.Args<T, O>>
      ): Effect.Effect<
        Option.Option<NonNullable<Prisma.Result<T, A, O>>>,
        PrismaError
      > {
        return Effect.tryPromise<Prisma.Result<T, A, O>, PrismaError>({
          catch: (cause) => PrismaError.fromUnknown(cause),
          try: () => {
            const prismaExtensionContextClient =
              Prisma.getExtensionContext(this);
            // @ts-expect-error Can't predict these in advance
            return prismaExtensionContextClient.findFirst(x);
          },
        }).pipe(Effect.map((result) => Option.fromNullable(result)));
      },
      findFirstOrThrowEffect<T, A, O extends "findFirstOrThrow">(
        this: T,
        x?: Prisma.Exact<A, Prisma.Args<T, O>>
      ): Effect.Effect<Prisma.Result<T, A, O>, PrismaError> {
        return Effect.tryPromise<Prisma.Result<T, A, O>, PrismaError>({
          catch: (cause) => PrismaError.fromUnknown(cause),
          try: () => {
            const prismaExtensionContextClient =
              Prisma.getExtensionContext(this);
            // @ts-expect-error Can't predict these in advance
            return prismaExtensionContextClient.findFirstOrThrow(x);
          },
        });
      },
      findUniqueEffect<T, A, O extends "findUnique">(
        this: T,
        x?: Prisma.Exact<A, Prisma.Args<T, O>>
      ): Effect.Effect<
        Option.Option<NonNullable<Prisma.Result<T, A, O>>>,
        PrismaError
      > {
        return Effect.tryPromise<Prisma.Result<T, A, O>, PrismaError>({
          catch: (cause) => PrismaError.fromUnknown(cause),
          try: () => {
            const prismaExtensionContextClient =
              Prisma.getExtensionContext(this);
            // @ts-expect-error Can't predict these in advance
            return prismaExtensionContextClient.findUnique(x);
          },
        }).pipe(Effect.map((result) => Option.fromNullable(result)));
      },
      findUniqueOrThrowEffect<T, A, O extends "findUniqueOrThrow">(
        this: T,
        x?: Prisma.Exact<A, Prisma.Args<T, O>>
      ): Effect.Effect<Prisma.Result<T, A, O>, PrismaError> {
        return Effect.tryPromise<Prisma.Result<T, A, O>, PrismaError>({
          catch: (cause) => PrismaError.fromUnknown(cause),
          try: () => {
            const prismaExtensionContextClient =
              Prisma.getExtensionContext(this);
            // @ts-expect-error Can't predict these in advance
            return prismaExtensionContextClient.findUniqueOrThrow(x);
          },
        });
      },
    },
  },
};
