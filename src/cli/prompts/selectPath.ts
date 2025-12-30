import inquirer from "inquirer";
import path from "path";

/**
 * 출력 경로 선택 프롬프트
 */
export async function selectOutputPath(): Promise<string> {
  const defaultPath = "./api";

  const { pathChoice } = await inquirer.prompt([
    {
      type: "list",
      name: "pathChoice",
      message: "Select output path:",
      choices: [
        {
          name: `Use current directory (${defaultPath})`,
          value: "current",
        },
        {
          name: "Enter custom path",
          value: "custom",
        },
      ],
    },
  ]);

  if (pathChoice === "current") {
    return path.resolve(process.cwd(), defaultPath);
  }

  const { customPath } = await inquirer.prompt([
    {
      type: "input",
      name: "customPath",
      message: "Enter output path:",
      default: defaultPath,
      validate: (input: string) => {
        if (!input.trim()) {
          return "Path cannot be empty";
        }
        return true;
      },
    },
  ]);

  return path.resolve(process.cwd(), customPath);
}
