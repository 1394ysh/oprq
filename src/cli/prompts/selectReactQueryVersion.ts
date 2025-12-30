import inquirer from "inquirer";
import { fzfSelectOne, checkFzfInstalled } from "../../utils/fzf.js";

export type ReactQueryVersion = "v3" | "v4" | "v5";

export interface ReactQueryConfig {
  version: ReactQueryVersion;
  importPath: string;
  queryImports: string[];
  mutationImports: string[];
}

const REACT_QUERY_CONFIGS: Record<ReactQueryVersion, ReactQueryConfig> = {
  v3: {
    version: "v3",
    importPath: "react-query",
    queryImports: ["useQuery", "UseQueryOptions", "UseQueryResult"],
    mutationImports: ["useMutation", "UseMutationOptions", "UseMutationResult"],
  },
  v4: {
    version: "v4",
    importPath: "@tanstack/react-query",
    queryImports: ["useQuery", "UseQueryOptions", "UseQueryResult"],
    mutationImports: ["useMutation", "UseMutationOptions", "UseMutationResult"],
  },
  v5: {
    version: "v5",
    importPath: "@tanstack/react-query",
    queryImports: ["useQuery", "UseQueryOptions", "UseQueryResult"],
    mutationImports: ["useMutation", "UseMutationOptions", "UseMutationResult"],
  },
};

/**
 * React Query 버전 선택 프롬프트
 */
export async function selectReactQueryVersion(): Promise<ReactQueryConfig> {
  const choices = [
    { name: "v3 (react-query)", value: "v3" },
    { name: "v4 (@tanstack/react-query)", value: "v4" },
    { name: "v5 (@tanstack/react-query) - Latest", value: "v5" },
  ];

  const hasFzf = await checkFzfInstalled();

  let selected: ReactQueryVersion;

  if (hasFzf) {
    const displayItems = choices.map((c) => c.name);
    const result = await fzfSelectOne(displayItems, {
      prompt: "Select React Query version > ",
      header: "React Query Version",
      height: "30%",
    });

    if (!result) {
      selected = "v5"; // 기본값
    } else {
      const index = displayItems.indexOf(result);
      selected = choices[index]?.value as ReactQueryVersion || "v5";
    }
  } else {
    const { version } = await inquirer.prompt([
      {
        type: "list",
        name: "version",
        message: "Select React Query version:",
        choices,
        default: "v5",
      },
    ]);
    selected = version;
  }

  return REACT_QUERY_CONFIGS[selected];
}

export function getReactQueryConfig(version: ReactQueryVersion): ReactQueryConfig {
  return REACT_QUERY_CONFIGS[version];
}
