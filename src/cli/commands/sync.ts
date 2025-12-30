import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { fetchOpenApiSpec } from "../../parser/openapi.js";
import { generateApiFile } from "../../generator/fileGenerator.js";
import { getReactQueryConfig } from "../prompts/selectReactQueryVersion.js";

const CONFIG_FILE_NAME = "orq.config.json";

interface SyncOptions {
  spec?: string;
  force?: boolean;
}

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
  outputPath: string;
  reactQueryVersion: "v3" | "v4" | "v5";
  specs?: Record<string, SpecConfig>;
  generate?: GenerateConfig;
  [key: string]: unknown;
}

/**
 * Sync (regenerate) registered specs
 */
export async function runSync(options: SyncOptions): Promise<void> {
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  orq - Sync OpenAPI Specs"));
  console.log(chalk.bold("========================================\n"));

  // Check config file
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  const config = await loadConfig(configPath);

  if (!config) {
    console.log(chalk.red("orq.config.json not found."));
    console.log(chalk.gray("Run 'orq init' first to initialize the project."));
    return;
  }

  const specs = config.specs || {};
  const specNames = Object.keys(specs);

  if (specNames.length === 0) {
    console.log(chalk.yellow("No specs registered."));
    console.log(chalk.gray("Run 'orq add' to add a spec."));
    return;
  }

  // Select specs to sync
  let targetSpecs: string[];
  if (options.spec) {
    if (!specs[options.spec]) {
      console.log(chalk.red(`${options.spec} is not a registered spec.`));
      return;
    }
    targetSpecs = [options.spec];
  } else {
    const { selectedSpecs } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedSpecs",
        message: "Select specs to sync (space to select, enter to confirm):",
        choices: specNames.map((name) => ({
          name: `${name} - ${specs[name].description || specs[name].url}`,
          value: name,
        })),
        validate: (answer: string[]) => {
          if (answer.length === 0) {
            return "Please select at least one spec.";
          }
          return true;
        },
      },
    ]);
    targetSpecs = selectedSpecs;
  }

  if (targetSpecs.length === 0) {
    console.log(chalk.yellow("\nNo specs selected."));
    return;
  }

  // Confirmation
  if (!options.force) {
    console.log(chalk.gray(`\nWill regenerate API code for ${targetSpecs.length} spec(s).`));
    console.log(chalk.gray("Existing files will be overwritten.\n"));

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Continue?",
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("\nCancelled."));
      return;
    }
  }

  // React Query config
  const reactQueryConfig = getReactQueryConfig(config.reactQueryVersion);

  // Sync each spec
  let totalGenerated = 0;
  let totalFailed = 0;

  for (const specName of targetSpecs) {
    const specConfig = specs[specName];
    console.log(chalk.bold(`\n[${specName}]`));

    const spinner = ora(`Fetching OpenAPI spec...`).start();

    try {
      // Load spec
      const openApiSpec = await fetchOpenApiSpec(specConfig.url);
      const endpoints = Object.keys(openApiSpec.paths || {}).length;
      spinner.succeed(`Loaded ${endpoints} endpoints`);

      // Extract APIs
      const apis = extractAllApis(openApiSpec);

      // Generate files
      const generateSpinner = ora(`Generating ${apis.length} files...`).start();
      let generated = 0;
      let failed = 0;

      for (const api of apis) {
        const fileName = generateFileName(api.method, api.path);
        const filePath = path.join(
          process.cwd(),
          config.outputPath,
          specName,
          fileName
        );

        try {
          await generateApiFile({
            specName,
            api,
            outputPath: filePath,
            openApiSpec,
            reactQueryConfig,
            hookOptions: config.generate,
          });
          generated++;
        } catch {
          failed++;
        }
      }

      generateSpinner.succeed(`Generated ${generated} files`);
      if (failed > 0) {
        console.log(chalk.yellow(`  ⚠ ${failed} files failed`));
      }

      totalGenerated += generated;
      totalFailed += failed;
    } catch (error) {
      spinner.fail("Failed to fetch spec");
      if (error instanceof Error) {
        console.log(chalk.gray(`  ${error.message}`));
      }
      totalFailed++;
    }
  }

  // Result
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  Result"));
  console.log(chalk.bold("========================================"));
  console.log(`  ${chalk.green("Generated:")} ${totalGenerated} files`);
  if (totalFailed > 0) {
    console.log(`  ${chalk.red("Failed:")} ${totalFailed}`);
  }
  console.log("");
}

/**
 * Extract all APIs from spec
 */
function extractAllApis(
  spec: any
): Array<{ method: string; path: string; operationId: string }> {
  const apis: Array<{ method: string; path: string; operationId: string }> = [];

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(
      methods as Record<string, any>
    )) {
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
 * Generate file path
 */
function generateFileName(method: string, apiPath: string): string {
  const cleanPath = apiPath.replace(/^\//, "");
  return `${method.toLowerCase()}/${cleanPath}.ts`;
}

/**
 * Load config file
 */
async function loadConfig(configPath: string): Promise<OrqConfig | null> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
