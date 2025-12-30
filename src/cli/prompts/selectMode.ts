import inquirer from "inquirer";

export type SelectionMode = "controller" | "endpoint";

/**
 * 선택 모드 프롬프트
 */
export async function selectMode(): Promise<SelectionMode> {
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "How do you want to select APIs?",
      choices: [
        {
          name: "By Controller (tag) - Select entire controller",
          value: "controller",
        },
        {
          name: "By Endpoint - Select individual API endpoints",
          value: "endpoint",
        },
      ],
    },
  ]);

  return mode as SelectionMode;
}
