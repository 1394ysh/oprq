import chalk from "chalk";
import ora from "ora";
import fs from "fs/promises";
import path from "path";
import { selectSpec } from "../prompts/selectSpec.js";
import { selectMode } from "../prompts/selectMode.js";
import { selectApis } from "../prompts/selectApis.js";
import { selectOutputPath } from "../prompts/selectPath.js";
import { confirmOverwrite } from "../prompts/confirmOverwrite.js";
import {
  selectReactQueryVersion,
  type ReactQueryConfig,
} from "../prompts/selectReactQueryVersion.js";
import { fetchOpenApiSpec } from "../../parser/openapi.js";
import { generateApiFile } from "../../generator/fileGenerator.js";
import type { SpecName } from "../../config/specs.js";

const CONFIG_FILE_NAME = "orq.config.json";

interface SpecConfig {
  url: string;
  description?: string;
}

interface GenerateConfig {
  queryHook?: boolean;
  mutationHook?: boolean;
  suspenseHook?: boolean;
}

interface OrqConfig {
  outputPath?: string;
  reactQueryVersion?: "v3" | "v4" | "v5";
  specs?: Record<string, SpecConfig>;
  generate?: GenerateConfig;
  [key: string]: unknown;
}

interface GenerateOptions {
  spec?: string;
  output?: string;
  all?: boolean;
  overwrite?: boolean;
}

/**
 * Load config file
 */
async function loadConfig(): Promise<OrqConfig | null> {
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Run interactive mode
 */
export async function runInteractiveMode(options: GenerateOptions): Promise<void> {
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  orq - OpenAPI React Query Generator"));
  console.log(chalk.bold("========================================\n"));

  // Load config file
  const config = await loadConfig();

  if (!config) {
    console.log(chalk.red("orq.config.json not found."));
    console.log(chalk.gray("Run 'orq init' first to initialize the project."));
    return;
  }

  const specs = config.specs || {};

  if (Object.keys(specs).length === 0) {
    console.log(chalk.yellow("No specs registered."));
    console.log(chalk.gray("Run 'orq add' to add an OpenAPI spec."));
    return;
  }

  // Step 1: Select spec
  let specName: SpecName;
  if (options.spec && options.spec in specs) {
    specName = options.spec as SpecName;
    console.log(chalk.green(`✓ Using spec: ${specName}`));
  } else {
    specName = await selectSpec(specs);
  }

  const specConfig = specs[specName];

  // Step 2: Fetch OpenAPI spec
  const spinner = ora(`Fetching OpenAPI spec from ${specName}...`).start();
  let openApiSpec;
  try {
    openApiSpec = await fetchOpenApiSpec(specConfig.url);
    spinner.succeed(`Loaded ${Object.keys(openApiSpec.paths || {}).length} endpoints`);
  } catch (error) {
    spinner.fail("Failed to fetch OpenAPI spec");
    throw error;
  }

  // Step 3: Selection mode
  let selectedApis;
  if (options.all) {
    selectedApis = extractAllApis(openApiSpec);
    console.log(chalk.green(`✓ Selected all ${selectedApis.length} APIs`));
  } else {
    const mode = await selectMode();
    selectedApis = await selectApis(openApiSpec, mode);
  }

  if (selectedApis.length === 0) {
    console.log(chalk.yellow("\nNo APIs selected. Exiting."));
    return;
  }

  // Step 4: Select React Query version (if not in config)
  let reactQueryConfig: ReactQueryConfig;
  if (config?.reactQueryVersion) {
    const { getReactQueryConfig } = await import("../prompts/selectReactQueryVersion.js");
    reactQueryConfig = getReactQueryConfig(config.reactQueryVersion);
    console.log(chalk.green(`✓ Using React Query ${config.reactQueryVersion} (from config)`));
  } else {
    reactQueryConfig = await selectReactQueryVersion();
  }

  // Step 5: Select output path
  const outputPath = options.output || config?.outputPath || await selectOutputPath();

  // Step 6: Ensure utility files exist
  await ensureUtilityFiles(outputPath);

  // Step 7: Summary and confirmation
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  Summary"));
  console.log(chalk.bold("========================================"));
  console.log(`  Spec: ${chalk.cyan(specName)}`);
  console.log(`  APIs: ${chalk.cyan(selectedApis.length.toString())} endpoints`);
  console.log(`  Output: ${chalk.cyan(outputPath)}`);
  console.log(`  React Query: ${chalk.cyan(reactQueryConfig.version)} (${reactQueryConfig.importPath})`);
  console.log("");

  selectedApis.slice(0, 5).forEach((api) => {
    console.log(`    ${chalk.gray("-")} [${api.method.toUpperCase()}] ${api.path}`);
  });
  if (selectedApis.length > 5) {
    console.log(chalk.gray(`    ... and ${selectedApis.length - 5} more`));
  }
  console.log("");

  // Step 8: Generate files
  const generatedFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const api of selectedApis) {
    const fileName = generateFileName(api.method, api.path);
    const filePath = `${outputPath}/${specName}/${fileName}`;

    // Check file exists and handle overwrite
    const fileExists = await checkFileExists(filePath);
    if (fileExists && !options.overwrite) {
      const shouldOverwrite = await confirmOverwrite(filePath);
      if (!shouldOverwrite) {
        skippedFiles.push(filePath);
        continue;
      }
    }

    try {
      await generateApiFile({
        specName,
        api,
        outputPath: filePath,
        openApiSpec,
        reactQueryConfig,
        hookOptions: config.generate,
      });
      generatedFiles.push(filePath);
    } catch (error) {
      console.error(chalk.red(`Failed to generate ${filePath}`));
      if (error instanceof Error) {
        console.error(chalk.gray(error.message));
      }
    }
  }

  // Step 9: Output result
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  Result"));
  console.log(chalk.bold("========================================"));
  console.log(`  ${chalk.green("Generated:")} ${generatedFiles.length} files`);
  if (skippedFiles.length > 0) {
    console.log(`  ${chalk.yellow("Skipped:")} ${skippedFiles.length} files`);
  }
  console.log("");
}

/**
 * Ensure utility files exist
 */
async function ensureUtilityFiles(outputPath: string): Promise<void> {
  const utilsDir = path.resolve(process.cwd(), outputPath, "__orq__");
  const stringReplacerPath = path.join(utilsDir, "StringReplacer.ts");
  const httpClientPath = path.join(utilsDir, "httpClient.ts");
  const indexPath = path.join(utilsDir, "index.ts");

  const stringReplacerExists = await checkFileExists(stringReplacerPath);
  const httpClientExists = await checkFileExists(httpClientPath);

  // Check if httpClient.ts needs RequestConfig update
  let needsRequestConfigUpdate = false;
  if (httpClientExists) {
    const content = await fs.readFile(httpClientPath, "utf-8");
    needsRequestConfigUpdate = !content.includes("RequestConfig");
  }

  // Skip if all files exist and up-to-date
  if (stringReplacerExists && httpClientExists && !needsRequestConfigUpdate) {
    return;
  }

  console.log(chalk.gray("\nCreating utility files..."));

  await fs.mkdir(utilsDir, { recursive: true });

  // StringReplacer.ts
  if (!stringReplacerExists) {
    const stringReplacerContent = `/**
 * Utility for replacing {param} placeholders in URL paths with actual values
 * Generated by orq
 */
export class StringReplacer {
  private template: string;

  constructor(template: string) {
    this.template = template;
  }

  replaceText<T extends Record<string, unknown>>(params: T): string {
    return this.template.replace(/\\{(\\w+)\\}/g, (match, key) => {
      const value = params[key as keyof T];
      if (value === undefined || value === null) {
        console.warn(\`StringReplacer: Missing value for placeholder "\${key}"\`);
        return match;
      }
      return String(value);
    });
  }

  getTemplate(): string {
    return this.template;
  }

  getPlaceholderKeys(): string[] {
    const matches = this.template.match(/\\{(\\w+)\\}/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1, -1));
  }
}

export default StringReplacer;
`;
    await fs.writeFile(stringReplacerPath, stringReplacerContent);
  }

  // httpClient.ts (create or update if RequestConfig is missing)
  if (!httpClientExists || needsRequestConfigUpdate) {
    const httpClientContent = `/**
 * HTTP Client Bootstrap (axios only)
 * Generated by orq
 *
 * @example
 * // Set up once at app bootstrap
 * import axios from "axios";
 * import { setHttpClient } from "@/api/__orq__/httpClient";
 *
 * const instance = axios.create({ baseURL: "/api" });
 * setHttpClient(instance);
 */
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * Axios config type excluding params and data (managed by generated code).
 * Use this to inject custom headers, responseType, onUploadProgress, etc.
 *
 * @example
 * // File upload with progress
 * uploadFile({
 *   body: formData,
 *   config: {
 *     headers: { 'Content-Type': 'multipart/form-data' },
 *     onUploadProgress: (e) => console.log(e.loaded / e.total)
 *   }
 * });
 *
 * // File download as blob
 * downloadFile({
 *   pathParams: { fileId },
 *   config: { responseType: 'blob' }
 * });
 */
export type RequestConfig = Omit<AxiosRequestConfig, 'params' | 'data'>;

let httpClient: AxiosInstance | null = null;

export function setHttpClient(client: AxiosInstance): void {
  httpClient = client;
}

export function getHttpClient(): AxiosInstance {
  if (!httpClient) {
    throw new Error(
      "HTTP client not initialized. Call setHttpClient(axiosInstance) in your app bootstrap."
    );
  }
  return httpClient;
}

/**
 * Helper to extract data from axios response
 */
export async function unwrap<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
  const response = await promise;
  return response.data;
}
`;
    await fs.writeFile(httpClientPath, httpClientContent);
  }

  // index.ts (always update to ensure exports)
  const indexContent = `export { StringReplacer } from "./StringReplacer";
export { setHttpClient, getHttpClient, unwrap, type RequestConfig } from "./httpClient";
`;
  await fs.writeFile(indexPath, indexContent);

  console.log(chalk.green("✓ Utility files created"));
}

/**
 * Extract all APIs from spec
 */
function extractAllApis(spec: any): Array<{ method: string; path: string; operationId: string }> {
  const apis: Array<{ method: string; path: string; operationId: string }> = [];

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      if (["get", "post", "put", "patch", "delete"].includes(method)) {
        apis.push({
          method,
          path,
          operationId: operation.operationId || `${method}_${path}`,
        });
      }
    }
  }

  return apis;
}

/**
 * Generate file path (folder nesting)
 * Example: GET /web-api/v1/sku/{skuId}/list -> get/web-api/v1/sku/{skuId}/list.ts
 */
function generateFileName(method: string, apiPath: string): string {
  const cleanPath = apiPath.replace(/^\//, ""); // Remove leading /
  return `${method.toLowerCase()}/${cleanPath}.ts`;
}

// /**
//  * 파일명 생성 (기존 방식 - 플랫 파일명)
//  */
// function generateFileNameLegacy(method: string, path: string): string {
//   const cleanPath = path
//     .replace(/^\//, "")
//     .replace(/\//g, "_")
//     .replace(/\{([^}]+)\}/g, "$1")
//     .replace(/-/g, "_");
//
//   return `${method.toLowerCase()}_${cleanPath}.ts`;
// }

/**
 * Check if file exists
 */
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
