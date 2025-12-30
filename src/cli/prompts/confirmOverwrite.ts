import inquirer from "inquirer";
import chalk from "chalk";

type OverwriteChoice = "yes" | "no" | "all" | "none";

let globalChoice: "all" | "none" | null = null;

/**
 * 파일 덮어쓰기 확인 프롬프트
 */
export async function confirmOverwrite(filePath: string): Promise<boolean> {
  // 이전에 전체 선택을 했다면 그 선택을 따름
  if (globalChoice === "all") return true;
  if (globalChoice === "none") return false;

  console.log(chalk.yellow(`\nFile already exists: ${filePath}`));

  const { choice } = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: "What do you want to do?",
      choices: [
        { name: "Overwrite this file", value: "yes" },
        { name: "Skip this file", value: "no" },
        { name: "Overwrite ALL remaining files", value: "all" },
        { name: "Skip ALL remaining files", value: "none" },
      ],
    },
  ]);

  const selected = choice as OverwriteChoice;

  if (selected === "all") {
    globalChoice = "all";
    return true;
  }

  if (selected === "none") {
    globalChoice = "none";
    return false;
  }

  return selected === "yes";
}

/**
 * 전역 선택 상태 초기화
 */
export function resetOverwriteChoice(): void {
  globalChoice = null;
}
