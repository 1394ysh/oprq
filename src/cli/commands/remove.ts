import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";

const CONFIG_FILE_NAME = "orq.config.json";

interface RemoveOptions {
  name?: string;
  force?: boolean;
}

interface SpecConfig {
  url: string;
  description?: string;
}

interface OrqConfig {
  specs?: Record<string, SpecConfig>;
  [key: string]: unknown;
}

/**
 * Remove OpenAPI spec
 */
export async function runRemove(options: RemoveOptions): Promise<void> {
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  orq - Remove OpenAPI Spec"));
  console.log(chalk.bold("========================================\n"));

  // Load config file
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
    return;
  }

  // Select spec
  let specName = options.name;
  if (!specName) {
    const { name } = await inquirer.prompt([
      {
        type: "list",
        name: "name",
        message: "Select spec to remove:",
        choices: specNames.map((name) => ({
          name: `${name} - ${specs[name].description || specs[name].url}`,
          value: name,
        })),
      },
    ]);
    specName = name;
  }

  if (!specs[specName!]) {
    console.log(chalk.red(`${specName} is not registered.`));
    return;
  }

  // Confirm
  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `Remove ${specName}?`,
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("\nCancelled."));
      return;
    }
  }

  // Remove
  delete config.specs![specName!];

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(chalk.green(`\n✓ ${specName} removed successfully!`));
  console.log("");
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
