import * as ts from "typescript";
import { expect, test } from "vitest";

const rootDir = ts.sys.getCurrentDirectory();
const compilerTestOptions = {
  retry: { count: 2, delay: 100 },
  timeout: 10_000,
};

const readmePrelude = `
import { Hono } from "hono";
import { defineApp } from "../src/index.js";

interface paths {
  "/users/{id}": {
    get: {
      parameters: {
        path: { id: string };
      };
      responses: {
        200: {
          content: {
            "application/json": { id: string; name: string };
          };
        };
      };
    };
  };
}
`;

const diagnosticKeyPattern =
  /"((?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) [^"]+ is missing|(?:Path|JSON|Query|Header|Cookie|Form) input mismatch at [^"]+|Output mismatch at [^"]+|Base path [^"]+ has no matching OpenAPI paths)"/g;

type NormalizedDiagnostic = {
  code: `TS${number}`;
  keys: string[];
};

function compileSource(name: string, source: string): NormalizedDiagnostic[] {
  const compilerOptions = readCompilerOptions();
  const fileName = ts.sys.resolvePath(`${rootDir}/test/.readme-${name}.ts`);
  const host = createVirtualCompilerHost(compilerOptions, fileName, source);
  const program = ts.createProgram([fileName], compilerOptions, host);

  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === fileName)
    .map((diagnostic) => normalizeDiagnostic(diagnostic));
}

function readCompilerOptions(): ts.CompilerOptions {
  const configPath = ts.findConfigFile(
    rootDir,
    (fileName) => ts.sys.fileExists(fileName),
    "tsconfig.json",
  );

  if (configPath === undefined) {
    throw new Error("tsconfig.json not found");
  }

  const configFile = ts.readConfigFile(configPath, (fileName) => ts.sys.readFile(fileName));

  if (configFile.error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir);

  return {
    ...parsedConfig.options,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
}

function createVirtualCompilerHost(
  compilerOptions: ts.CompilerOptions,
  fileName: string,
  source: string,
): ts.CompilerHost {
  const host = ts.createCompilerHost(compilerOptions, true);
  const defaultFileExists = host.fileExists.bind(host);
  const defaultReadFile = host.readFile.bind(host);
  const defaultGetSourceFile = host.getSourceFile.bind(host);

  host.fileExists = (candidate) => candidate === fileName || defaultFileExists(candidate);
  host.readFile = (candidate) => (candidate === fileName ? source : defaultReadFile(candidate));
  host.getSourceFile = (candidate, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (candidate === fileName) {
      return ts.createSourceFile(candidate, source, languageVersion, true);
    }

    return defaultGetSourceFile(candidate, languageVersion, onError, shouldCreateNewSourceFile);
  };

  return host;
}

function normalizeDiagnostic(diagnostic: ts.Diagnostic): NormalizedDiagnostic {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const keys = Array.from(message.matchAll(diagnosticKeyPattern), ([, key]) => key);

  return {
    code: `TS${diagnostic.code}`,
    keys: Array.from(new Set(keys)),
  };
}

test("README success examples compile without diagnostics", compilerTestOptions, () => {
  expect(
    compileSource(
      "success",
      `${readmePrelude}
const app = defineApp<paths>()(
  new Hono().get("/users/:id", (c) => {
    return c.json({ id: c.req.param("id"), name: "Alice" });
  }),
);

const defineAppWithPaths = defineApp<paths>();

const reusedApp = defineAppWithPaths(
  new Hono().get("/users/:id", (c) => {
    return c.json({ id: c.req.param("id"), name: "Alice" });
  }),
);

const userApp = defineApp<paths, "/users">()(
  new Hono().get("/:id", (c) => {
    return c.json({ id: c.req.param("id"), name: "Alice" });
  }),
);
const routedApp = defineApp<paths>()(new Hono().route("/users", userApp));

export { app, reusedApp, routedApp };
`,
    ),
  ).toMatchInlineSnapshot(`[]`);
});

test("README error examples expose readable compiler diagnostics", compilerTestOptions, () => {
  const diagnostics = {
    "missing route or method": compileSource(
      "missing-route-or-method",
      `${readmePrelude}
defineApp<paths>()(
  new Hono().post("/users/:id", (c) => {
    return c.json({ id: c.req.param("id"), name: "Alice" });
  }),
);
`,
    ),
    "path parameter name mismatch": compileSource(
      "path-parameter-name-mismatch",
      `${readmePrelude}
defineApp<paths>()(
  new Hono().get("/users/:userId", (c) => {
    return c.json({ id: c.req.param("userId"), name: "Alice" });
  }),
);
`,
    ),
    "response body mismatch": compileSource(
      "response-body-mismatch",
      `${readmePrelude}
defineApp<paths>()(
  new Hono().get("/users/:id", (c) => {
    return c.json({ userId: c.req.param("id") });
  }),
);
`,
    ),
    "required JSON request body without a validator": compileSource(
      "required-json-request-body-without-a-validator",
      `
import { Hono } from "hono";
import { defineApp } from "../src/index.js";

type createUserPaths = {
  "/users": {
    post: {
      requestBody: {
        content: {
          "application/json": { name: string };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": { id: string; name: string };
          };
        };
      };
    };
  };
};

defineApp<createUserPaths>()(
  new Hono().post("/users", (c) => {
    return c.json({ id: "1", name: "Alice" }, 201);
  }),
);
`,
    ),
  };

  expect(diagnostics).toMatchInlineSnapshot(`
    {
      "missing route or method": [
        {
          "code": "TS2345",
          "keys": [
            "GET /users/:id is missing",
          ],
        },
      ],
      "path parameter name mismatch": [
        {
          "code": "TS2345",
          "keys": [
            "Path input mismatch at GET /users/:id",
          ],
        },
      ],
      "required JSON request body without a validator": [
        {
          "code": "TS2345",
          "keys": [
            "JSON input mismatch at POST /users",
          ],
        },
      ],
      "response body mismatch": [
        {
          "code": "TS2345",
          "keys": [
            "Output mismatch at GET /users/:id for 200 application/json",
          ],
        },
      ],
    }
  `);
});
