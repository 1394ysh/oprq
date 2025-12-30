import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import axios from "axios";

const CONFIG_FILE_NAME = "orq.config.json";

interface AddOptions {
  name?: string;
  url?: string;
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
 * Add OpenAPI spec
 */
export async function runAdd(options: AddOptions): Promise<void> {
  console.log(chalk.bold("\n========================================"));
  console.log(chalk.bold("  orq - Add OpenAPI Spec"));
  console.log(chalk.bold("========================================\n"));

  // Load config file
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  const config = await loadConfig(configPath);

  if (!config) {
    console.log(chalk.red("orq.config.json not found."));
    console.log(chalk.gray("Run 'orq init' first to initialize the project."));
    return;
  }

  // Spec name input
  let specName = options.name;
  if (!specName) {
    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Spec name (e.g., PETSTORE, MY_API):",
        validate: (input) => {
          if (!input.trim()) return "Please enter a spec name.";
          if (config.specs?.[input]) return `${input} is already registered.`;
          return true;
        },
      },
    ]);
    specName = name;
  }

  // Spec URL input
  let specUrl = options.url;
  if (!specUrl) {
    const { url } = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "OpenAPI spec URL:",
        validate: (input) => {
          if (!input.trim()) return "Please enter a URL.";
          try {
            new URL(input);
            return true;
          } catch {
            return "Please enter a valid URL.";
          }
        },
      },
    ]);
    specUrl = url;
  }

  // Validate URL
  const spinner = ora("Validating OpenAPI spec...").start();
  try {
    const response = await axios.get(specUrl!, { timeout: 10000 });
    const spec = response.data;

    if (!spec.openapi && !spec.swagger) {
      spinner.fail("Not a valid OpenAPI spec.");
      return;
    }

    const title = spec.info?.title || specName;
    const version = spec.openapi || spec.swagger;
    const endpointCount = Object.keys(spec.paths || {}).length;

    spinner.succeed(`OpenAPI ${version} spec validated (${endpointCount} endpoints)`);

    // Description input
    const { description } = await inquirer.prompt([
      {
        type: "input",
        name: "description",
        message: "Description (optional):",
        default: title,
      },
    ]);

    // Update config file
    config.specs = config.specs || {};
    config.specs[specName!] = {
      url: specUrl!,
      description: description || undefined,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green(`\n✓ ${specName} added successfully!`));
    console.log(chalk.gray(`  URL: ${specUrl}`));
    console.log(chalk.gray(`  Endpoints: ${endpointCount}`));
    console.log("");
    console.log(chalk.cyan(`Run 'orq generate --spec ${specName}' to generate API code.`));
    console.log("");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      spinner.fail(`Failed to access URL: ${error.message}`);
    } else {
      spinner.fail("Error validating spec.");
    }
  }
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
