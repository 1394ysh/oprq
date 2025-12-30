import chalk from "chalk";
import type { SpecName } from "../../config/specs.js";
import { fzfSelectOne, checkFzfInstalled } from "../../utils/fzf.js";
import inquirer from "inquirer";

interface SpecConfig {
  url: string;
  description?: string;
}

/**
 * fzf 기반 스펙 선택 프롬프트
 * - 상단에 검색 입력창
 * - 실시간 fuzzy search
 */
export async function selectSpec(
  configSpecs: Record<string, SpecConfig> = {}
): Promise<SpecName> {
  const specs = Object.keys(configSpecs);

  // fzf 설치 확인
  const hasFzf = await checkFzfInstalled();

  if (hasFzf) {
    const selected = await fzfSelectOne(specs, {
      prompt: "Select OpenAPI spec > ",
      header: "Available OpenAPI Specs",
      height: "50%",
    });

    if (!selected) {
      console.log(chalk.yellow("\nNo spec selected. Exiting."));
      process.exit(0);
    }

    return selected as SpecName;
  } else {
    // fzf 없으면 기본 inquirer 사용
    console.log(chalk.yellow("\nfzf not found. Using basic selection."));
    console.log(chalk.dim("Install fzf for better experience: brew install fzf\n"));

    const { spec } = await inquirer.prompt([
      {
        type: "list",
        name: "spec",
        message: "Select OpenAPI spec:",
        choices: specs.map((name) => ({
          name: `${name} - ${configSpecs[name]?.description || configSpecs[name]?.url}`,
          value: name,
        })),
        pageSize: 15,
      },
    ]);

    return spec as SpecName;
  }
}
