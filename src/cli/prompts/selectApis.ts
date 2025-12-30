import inquirer from "inquirer";
import { fzfSelect, checkFzfInstalled } from "../../utils/fzf.js";
import type { SelectionMode } from "./selectMode.js";

interface ApiInfo {
  method: string;
  path: string;
  operationId: string;
  tags?: string[];
}

interface OpenApiSpec {
  paths: Record<string, Record<string, any>>;
  tags?: Array<{ name: string; description?: string }>;
}

/**
 * API 선택 프롬프트
 */
export async function selectApis(
  spec: OpenApiSpec,
  mode: SelectionMode
): Promise<ApiInfo[]> {
  if (mode === "controller") {
    return selectByController(spec);
  } else {
    return selectByEndpoint(spec);
  }
}

/**
 * 컨트롤러(태그) 단위 선택 - fzf 사용
 */
async function selectByController(spec: OpenApiSpec): Promise<ApiInfo[]> {
  const tagMap = new Map<string, ApiInfo[]>();

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;

      const tags = operation.tags || ["untagged"];
      const apiInfo: ApiInfo = {
        method,
        path,
        operationId: operation.operationId || `${method}_${path}`,
        tags,
      };

      for (const tag of tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag)!.push(apiInfo);
      }
    }
  }

  const controllers = Array.from(tagMap.keys()).sort();
  const displayItems = controllers.map(
    (tag) => `${tag} (${tagMap.get(tag)!.length} endpoints)`
  );

  const hasFzf = await checkFzfInstalled();

  let selectedTags: string[];

  if (hasFzf) {
    const selected = await fzfSelect(displayItems, {
      multi: true,
      prompt: "Select controllers > ",
      header: "Controllers (Space: select, Ctrl+A: all, Enter: confirm)",
      height: "60%",
    });

    // 디스플레이 문자열에서 태그 이름 추출
    selectedTags = selected.map((item) => item.split(" (")[0]);
  } else {
    const { tags } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "tags",
        message: "Select controllers:",
        choices: displayItems.map((item, i) => ({
          name: item,
          value: controllers[i],
        })),
        pageSize: 20,
      },
    ]);
    selectedTags = tags;
  }

  // 선택된 컨트롤러의 모든 API 반환
  const selectedApis: ApiInfo[] = [];
  for (const tag of selectedTags) {
    selectedApis.push(...(tagMap.get(tag) || []));
  }

  // 중복 제거
  return selectedApis.filter(
    (api, index, self) =>
      index === self.findIndex((a) => a.operationId === api.operationId)
  );
}

/**
 * 개별 엔드포인트 선택 - fzf 사용
 */
async function selectByEndpoint(spec: OpenApiSpec): Promise<ApiInfo[]> {
  const allApis: ApiInfo[] = [];

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;

      allApis.push({
        method,
        path,
        operationId: operation.operationId || `${method}_${path}`,
        tags: operation.tags,
      });
    }
  }

  // 정렬
  allApis.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  // 디스플레이 문자열 생성
  const displayItems = allApis.map(
    (api) => `[${api.method.toUpperCase().padEnd(6)}] ${api.path}`
  );

  const hasFzf = await checkFzfInstalled();

  let selectedIndices: number[];

  if (hasFzf) {
    const selected = await fzfSelect(displayItems, {
      multi: true,
      prompt: "Select APIs > ",
      header: "API Endpoints (Space: select, Ctrl+A: all, Enter: confirm)",
      height: "70%",
    });

    // 선택된 문자열의 인덱스 찾기
    selectedIndices = selected.map((item) => displayItems.indexOf(item)).filter((i) => i >= 0);
  } else {
    const { indices } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "indices",
        message: "Select API endpoints:",
        choices: displayItems.map((item, i) => ({
          name: item,
          value: i,
        })),
        pageSize: 20,
      },
    ]);
    selectedIndices = indices;
  }

  return selectedIndices.map((i) => allApis[i]);
}
