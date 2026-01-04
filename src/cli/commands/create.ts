import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

const CONFIG_FILE_NAME = "oprq.config.json";

interface CreateOptions {
  method?: string;
  path?: string;
  spec?: string;
}

interface OprqConfig {
  outputPath: string;
  reactQueryVersion: "v3" | "v4" | "v5";
  specs?: Record<string, { url: string; description?: string }>;
  generate?: {
    queryHook?: boolean;
    mutationHook?: boolean;
    suspenseHook?: boolean;
    infiniteQueryHook?: boolean;
  };
  [key: string]: unknown;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Create placeholder API file
 */
export async function runCreate(options: CreateOptions): Promise<void> {
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  oprq - Create Placeholder API"));
  console.log(chalk.bold("========================================\n"));

  // Load config file
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  const config = await loadConfig(configPath);

  if (!config) {
    console.log(chalk.red("oprq.config.json not found."));
    console.log(chalk.gray("Run 'oprq init' first to initialize the project."));
    return;
  }

  // Select or input spec name
  let specName = options.spec;
  if (!specName) {
    const existingSpecs = Object.keys(config.specs || {});
    const choices = [...existingSpecs, "Create new spec..."];

    const { selectedSpec } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedSpec",
        message: "Select spec to add endpoint:",
        choices,
      },
    ]);

    if (selectedSpec === "Create new spec...") {
      const { newSpecName } = await inquirer.prompt([
        {
          type: "input",
          name: "newSpecName",
          message: "New spec name (e.g., MY_API):",
          validate: (input) => {
            if (!input.trim()) return "Please enter a spec name.";
            if (!/^[A-Z][A-Z0-9_]*$/.test(input)) {
              return "Use UPPER_SNAKE_CASE (e.g., MY_API)";
            }
            return true;
          },
        },
      ]);
      specName = newSpecName;
    } else {
      specName = selectedSpec;
    }
  }

  // Select HTTP method
  let method = options.method?.toUpperCase() as HttpMethod;
  if (!method || !HTTP_METHODS.includes(method)) {
    const { selectedMethod } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedMethod",
        message: "HTTP method:",
        choices: HTTP_METHODS,
      },
    ]);
    method = selectedMethod;
  }

  // Input API path
  let apiPath = options.path;
  if (!apiPath) {
    const { inputPath } = await inquirer.prompt([
      {
        type: "input",
        name: "inputPath",
        message: "API path (e.g., /users/{userId}):",
        validate: (input) => {
          if (!input.trim()) return "Please enter an API path.";
          if (!input.startsWith("/")) return "Path must start with /";
          return true;
        },
      },
    ]);
    apiPath = inputPath;
  }

  // Extract path params from path
  const pathParamMatches = apiPath!.match(/\{(\w+)\}/g) || [];
  const pathParams = pathParamMatches.map((p) => p.slice(1, -1));

  // Input Response type
  const { responseType } = await inquirer.prompt([
    {
      type: "input",
      name: "responseType",
      message: "Response type (TypeScript):",
      default: "unknown",
      validate: (input) => {
        if (!input.trim()) return "Please enter a type.";
        return true;
      },
    },
  ]);

  // Input Body type for POST/PUT/PATCH
  let bodyType = "undefined";
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const { inputBodyType } = await inquirer.prompt([
      {
        type: "input",
        name: "inputBodyType",
        message: "Request body type (TypeScript):",
        default: "unknown",
      },
    ]);
    bodyType = inputBodyType || "undefined";
  }

  // Input Query params
  const { hasQueryParams } = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasQueryParams",
      message: "Does this endpoint have query parameters?",
      default: false,
    },
  ]);

  let queryParamsType = "Record<string, never>";
  if (hasQueryParams) {
    const { inputQueryParams } = await inquirer.prompt([
      {
        type: "input",
        name: "inputQueryParams",
        message: "Query params type (TypeScript):",
        default: "{ page?: number; limit?: number }",
      },
    ]);
    queryParamsType = inputQueryParams;
  }

  // Generate file
  const spinner = ora("Creating placeholder API file...").start();
  const finalApiPath = apiPath!;

  try {
    const operationId = generateOperationId(method, finalApiPath);
    const pascalCaseId = toPascalCase(operationId);

    const fileContent = generatePlaceholderFile({
      specName: specName!,
      method,
      apiPath: finalApiPath,
      operationId,
      pascalCaseId,
      pathParams,
      queryParamsType,
      bodyType,
      responseType,
      config,
    });

    // Calculate output path
    const outputDir = path.join(
      process.cwd(),
      config.outputPath,
      specName!,
      method.toLowerCase(),
      ...finalApiPath.split("/").filter(Boolean)
    );

    await fs.mkdir(outputDir, { recursive: true });

    const fileName = "index.ts";
    const filePath = path.join(outputDir, fileName);

    // Check if file exists
    try {
      await fs.access(filePath);
      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `${filePath} already exists. Overwrite?`,
          default: false,
        },
      ]);
      if (!overwrite) {
        spinner.info("Cancelled.");
        return;
      }
    } catch {
      // File doesn't exist, continue
    }

    await fs.writeFile(filePath, fileContent);

    spinner.succeed("Placeholder API file created!");

    console.log(chalk.green(`\n✓ Created: ${filePath}`));
    console.log("");
    console.log(chalk.yellow("⚠️  This is a placeholder file."));
    console.log(chalk.gray("   The API function will throw an error until you implement it."));
    console.log(chalk.gray("   When the actual API is ready, run 'oprq generate --overwrite' to replace."));
    console.log("");
  } catch (error) {
    spinner.fail("Failed to create file.");
    throw error;
  }
}

interface GenerateFileOptions {
  specName: string;
  method: HttpMethod;
  apiPath: string;
  operationId: string;
  pascalCaseId: string;
  pathParams: string[];
  queryParamsType: string;
  bodyType: string;
  responseType: string;
  config: OprqConfig;
}

function generatePlaceholderFile(options: GenerateFileOptions): string {
  const {
    specName,
    method,
    apiPath,
    operationId,
    pascalCaseId,
    pathParams,
    queryParamsType,
    bodyType,
    responseType,
    config,
  } = options;

  const pathParamsType =
    pathParams.length > 0
      ? `{ ${pathParams.map((p) => `${p}: string`).join("; ")} }`
      : "Record<string, never>";

  const hasRequiredPathParams = pathParams.length > 0;
  const hasRequiredBody = ["POST", "PUT", "PATCH"].includes(method) && bodyType !== "undefined";
  const argsDefault = !hasRequiredPathParams && !hasRequiredBody ? " = {}" : "";

  // Calculate __oprq__ relative path
  // Structure: {specName}/{method}/...path.../index.ts → __oprq__ is at specName's parent level
  const pathDepth = apiPath.split("/").filter(Boolean).length;
  const totalDepth = 1 + 1 + pathDepth; // specName folder + method folder + path folders
  const utilsRelativePath = "../".repeat(totalDepth) + "__oprq__";

  const version = config.reactQueryVersion;
  const importPath = version === "v3" ? "react-query" : "@tanstack/react-query";

  const hookOptions = config.generate || {};
  const generateQuery = hookOptions.queryHook !== false;
  const generateMutation = hookOptions.mutationHook !== false;
  const generateSuspense = hookOptions.suspenseHook === true && version === "v5";
  const generateInfinite = hookOptions.infiniteQueryHook === true;

  // Build imports (using TypeScript 4.5+ inline type imports for ESLint compatibility)
  const imports: string[] = [];

  if (generateQuery || generateSuspense) {
    imports.push("useQuery");
    imports.push("type UseQueryOptions");
    imports.push("type UseQueryResult");
  }
  if (generateSuspense) {
    imports.push("useSuspenseQuery");
    imports.push("type UseSuspenseQueryResult");
  }
  if (generateMutation) {
    imports.push("useMutation");
    imports.push("type UseMutationOptions");
    imports.push("type UseMutationResult");
  }
  if (generateInfinite) {
    imports.push("useInfiniteQuery");
    imports.push("type UseInfiniteQueryOptions");
    imports.push("type UseInfiniteQueryResult");
    imports.push("type InfiniteData");
  }

  const reactQueryImport =
    imports.length > 0
      ? `import {
  ${imports.join(",\n  ")},
} from "${importPath}";`
      : "";

  // Generate hooks
  let hooksCode = "";

  if (generateQuery) {
    hooksCode += `
// ===== React Query Hook =====
export const use${pascalCaseId}Query = <TData = Response, TError = ErrorResponse>(
  req: RequestArgs${argsDefault},
  options?: Omit<UseQueryOptions<Response, TError, TData>, "queryKey" | "queryFn">
): UseQueryResult<TData, TError> => {
  return useQuery({
    queryKey: ${operationId}QueryKey(req),
    queryFn: () => ${operationId}(req),
    ...options,
  });
};
`;
  }

  if (generateSuspense) {
    hooksCode += `
// ===== Suspense Query Hook =====
export const use${pascalCaseId}SuspenseQuery = <TData = Response, TError = ErrorResponse>(
  req: RequestArgs${argsDefault},
  options?: Omit<UseQueryOptions<Response, TError, TData>, "queryKey" | "queryFn">
): UseSuspenseQueryResult<TData, TError> => {
  return useSuspenseQuery({
    queryKey: ${operationId}QueryKey(req),
    queryFn: () => ${operationId}(req),
    ...options,
  });
};
`;
  }

  if (generateInfinite) {
    if (version === "v5") {
      hooksCode += `
// ===== Infinite Query Hook =====
export const use${pascalCaseId}InfiniteQuery = <TPageParam = unknown>(
  req: RequestArgs${argsDefault},
  options: Omit<
    UseInfiniteQueryOptions<Response, ErrorResponse, InfiniteData<Response>, Response, ReturnType<typeof ${operationId}QueryKey>, TPageParam>,
    "queryKey" | "queryFn"
  >
): UseInfiniteQueryResult<InfiniteData<Response>, ErrorResponse> => {
  return useInfiniteQuery({
    queryKey: ${operationId}QueryKey(req),
    queryFn: ({ pageParam }) => ${operationId}({
      ...req,
      queryParams: { ...req.queryParams, ...(pageParam as Record<string, unknown>) },
    } as RequestArgs),
    ...options,
  });
};
`;
    } else {
      hooksCode += `
// ===== Infinite Query Hook =====
export const use${pascalCaseId}InfiniteQuery = <TPageParam = unknown>(
  req: RequestArgs${argsDefault},
  options: Omit<
    UseInfiniteQueryOptions<Response, ErrorResponse, InfiniteData<Response>, Response, ReturnType<typeof ${operationId}QueryKey>>,
    "queryKey" | "queryFn"
  > & {
    getNextPageParam: (lastPage: Response, allPages: Response[]) => TPageParam | undefined;
  }
): UseInfiniteQueryResult<InfiniteData<Response>, ErrorResponse> => {
  return useInfiniteQuery({
    queryKey: ${operationId}QueryKey(req),
    queryFn: ({ pageParam }) => ${operationId}({
      ...req,
      queryParams: { ...req.queryParams, ...(pageParam as Record<string, unknown>) },
    } as RequestArgs),
    ...options,
  });
};
`;
    }
  }

  if (generateMutation) {
    hooksCode += `
// ===== Mutation Hook =====
export const use${pascalCaseId}Mutation = <TContext = unknown>(
  options?: Omit<
    UseMutationOptions<Response, ErrorResponse, RequestArgs, TContext>,
    "mutationFn"
  >
): UseMutationResult<Response, ErrorResponse, RequestArgs, TContext> => {
  return useMutation({
    mutationFn: ${operationId},
    ...options,
  });
};
`;
  }

  const now = new Date().toISOString();

  return `/**
 * ${method.toUpperCase()} ${apiPath}
 * ⚠️ PLACEHOLDER - This file was created with 'oprq create'
 * Replace with 'oprq generate --overwrite' when the actual API is ready.
 * Generated at: ${now}
 * Source: ${specName}
 */
${reactQueryImport}
import { StringReplacer, getHttpClient, type RequestConfig } from "${utilsRelativePath}";

// ===== Types =====
export type PathParams = ${pathParamsType};

export type QueryParams = ${queryParamsType};

export type Body = ${bodyType};

export type Response = ${responseType};

export type ErrorResponse = unknown;

export interface RequestArgs {
  pathParams${hasRequiredPathParams ? "" : "?"}: PathParams;
  queryParams?: QueryParams;
  body${hasRequiredBody ? "" : "?"}: Body;
  config?: RequestConfig;
}

// ===== API URL =====
const API_URL = "${specName}:${apiPath}";

// ===== Query Keys =====
export const ${operationId}QueryKey = (req: RequestArgs) =>
  ["${specName}", "${method}", "${apiPath}", req] as const;

// ===== Repository =====
/**
 * ⚠️ PLACEHOLDER: This function throws an error.
 * Implement the actual API call or wait for 'oprq generate' to replace.
 */
export const ${operationId} = async (args: RequestArgs${argsDefault}): Promise<Response> => {
  // TODO: Uncomment when API is ready
  // const url = new StringReplacer(API_URL).replaceText(args?.pathParams ?? {});
  // const http = getHttpClient();
  // return http.${method.toLowerCase()}(url${["POST", "PUT", "PATCH"].includes(method) ? ", args?.body" : ""}, { params: args?.queryParams, ...args?.config });

  throw new Error("${operationId}: Not implemented - this is a placeholder API");
};
${hooksCode}`;
}

function generateOperationId(method: string, apiPath: string): string {
  const pathParts = apiPath
    .split("/")
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return "By" + toPascalCase(part.slice(1, -1));
      }
      return toPascalCase(part);
    });

  return method.toLowerCase() + pathParts.join("");
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

async function loadConfig(configPath: string): Promise<OprqConfig | null> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
