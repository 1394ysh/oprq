import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

const CONFIG_FILE_NAME = "orq.config.json";

interface SpecConfig {
  url: string;
  description?: string;
}

interface OrqConfig {
  specs?: Record<string, SpecConfig>;
  [key: string]: unknown;
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
 * List registered OpenAPI specs
 */
export async function listSpecs(): Promise<void> {
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  orq - Registered Specs"));
  console.log(chalk.bold("========================================\n"));

  const config = await loadConfig();

  if (!config) {
    console.log(chalk.red("orq.config.json not found."));
    console.log(chalk.gray("Run 'orq init' first to initialize the project."));
    return;
  }

  const specs = config.specs || {};
  const specEntries = Object.entries(specs);

  if (specEntries.length === 0) {
    console.log(chalk.yellow("No specs registered."));
    console.log(chalk.gray("Run 'orq add' to add an OpenAPI spec."));
    return;
  }

  specEntries.forEach(([name, spec], index) => {
    console.log(
      `  ${chalk.cyan((index + 1).toString().padStart(2, " "))}. ${chalk.bold(name)}`
    );
    if (spec.description) {
      console.log(`      ${chalk.gray(spec.description)}`);
    }
    console.log(`      ${chalk.gray(spec.url)}`);
  });

  console.log(chalk.gray(`\nTotal: ${specEntries.length} specs\n`));
}
