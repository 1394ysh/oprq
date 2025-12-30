import axios from "axios";

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, OperationObject>>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
  tags?: Array<{ name: string; description?: string }>;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
}

export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema?: SchemaObject;
  description?: string;
}

export interface RequestBodyObject {
  required?: boolean;
  content?: Record<string, { schema?: SchemaObject }>;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

export interface SchemaObject {
  type?: string;
  $ref?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: string[];
  format?: string;
  description?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  additionalProperties?: boolean | SchemaObject;
  nullable?: boolean;
}

/**
 * OpenAPI 스펙 fetch
 */
export async function fetchOpenApiSpec(url: string): Promise<OpenApiSpec> {
  try {
    const response = await axios.get<OpenApiSpec>(url, {
      timeout: 30000,
      headers: {
        Accept: "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch OpenAPI spec: ${error.message}`);
    }
    throw error;
  }
}

/**
 * $ref에서 스키마 이름 추출
 */
export function getRefName(ref: string): string {
  return ref.replace("#/components/schemas/", "");
}

/**
 * $ref 참조 해결
 */
export function resolveRef(ref: string, spec: OpenApiSpec): SchemaObject | null {
  if (!ref.startsWith("#/components/schemas/")) {
    return null;
  }

  const schemaName = getRefName(ref);
  return spec.components?.schemas?.[schemaName] || null;
}

/**
 * 스키마를 TypeScript 타입 문자열로 변환 (인라인)
 * $ref를 만나면 실제 스키마를 풀어서 인라인 타입으로 생성
 */
export function schemaToTypeString(
  schema: SchemaObject | undefined,
  spec: OpenApiSpec,
  depth = 0,
  visitedRefs: Set<string> = new Set()
): string {
  if (!schema) return "unknown";

  // $ref 처리 - 실제 스키마로 해석
  if (schema.$ref) {
    const refName = getRefName(schema.$ref);

    // 순환 참조 방지
    if (visitedRefs.has(refName)) {
      return refName; // 순환 참조시 타입 이름만 반환
    }

    const resolvedSchema = resolveRef(schema.$ref, spec);
    if (resolvedSchema) {
      visitedRefs.add(refName);
      const result = schemaToTypeString(resolvedSchema, spec, depth, visitedRefs);
      visitedRefs.delete(refName);
      return result;
    }
    return refName;
  }

  // allOf 처리
  if (schema.allOf) {
    const types = schema.allOf.map((s) =>
      schemaToTypeString(s, spec, depth, visitedRefs)
    );
    return types.join(" & ");
  }

  // oneOf 처리
  if (schema.oneOf) {
    const types = schema.oneOf.map((s) =>
      schemaToTypeString(s, spec, depth, visitedRefs)
    );
    return types.join(" | ");
  }

  // anyOf 처리
  if (schema.anyOf) {
    const types = schema.anyOf.map((s) =>
      schemaToTypeString(s, spec, depth, visitedRefs)
    );
    return types.join(" | ");
  }

  // 기본 타입 처리
  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return schema.enum.map((e) => `"${e}"`).join(" | ");
      }
      if (schema.format === "binary") {
        return "Blob"; // File download/upload
      }
      if (schema.format === "date-time" || schema.format === "date") {
        return "string"; // ISO date string
      }
      return "string";

    case "integer":
    case "number":
      return "number";

    case "boolean":
      return "boolean";

    case "array":
      const itemType = schemaToTypeString(schema.items, spec, depth, visitedRefs);
      return `${itemType}[]`;

    case "object":
      if (!schema.properties && schema.additionalProperties) {
        if (typeof schema.additionalProperties === "boolean") {
          return "Record<string, unknown>";
        }
        const valueType = schemaToTypeString(schema.additionalProperties, spec, depth + 1, visitedRefs);
        return `Record<string, ${valueType}>`;
      }

      if (!schema.properties) {
        return "Record<string, unknown>";
      }

      // 깊은 중첩 방지 (가독성)
      if (depth > 3) {
        return "object";
      }

      const props = Object.entries(schema.properties)
        .map(([key, prop]) => {
          const optional = !schema.required?.includes(key) ? "?" : "";
          const nullable = prop.nullable ? " | null" : "";
          const type = schemaToTypeString(prop, spec, depth + 1, visitedRefs);
          // 특수문자가 있는 키는 따옴표로 감싸기
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
          return `${safeKey}${optional}: ${type}${nullable}`;
        })
        .join("; ");
      return `{ ${props} }`;

    default:
      // type이 없는 경우 (nullable만 있거나 등)
      if (schema.nullable) {
        return "unknown | null";
      }
      return "unknown";
  }
}

/**
 * 스키마를 개별 interface/type 정의로 생성
 */
export function generateTypeDefinition(
  name: string,
  schema: SchemaObject,
  spec: OpenApiSpec
): string {
  const typeString = schemaToTypeString(schema, spec, 0);

  // 단순 타입이면 type alias
  if (!typeString.startsWith("{")) {
    return `export type ${name} = ${typeString};`;
  }

  // 객체면 interface
  const props = typeString.slice(2, -2); // { } 제거
  const formattedProps = props
    .split("; ")
    .filter(Boolean)
    .map((prop) => `  ${prop};`)
    .join("\n");

  return `export interface ${name} {\n${formattedProps}\n}`;
}

/**
 * Operation에서 사용된 모든 스키마 이름 추출 (재귀적)
 */
export function extractAllSchemaNames(
  operation: OperationObject,
  spec: OpenApiSpec
): Set<string> {
  const names = new Set<string>();

  function collectRefs(schema: SchemaObject | undefined) {
    if (!schema) return;

    if (schema.$ref) {
      const name = getRefName(schema.$ref);
      if (!names.has(name)) {
        names.add(name);
        // 해당 스키마 내부의 참조도 수집
        const resolvedSchema = spec.components?.schemas?.[name];
        if (resolvedSchema) {
          collectRefs(resolvedSchema);
        }
      }
    }

    if (schema.items) collectRefs(schema.items);
    if (schema.properties) {
      Object.values(schema.properties).forEach(collectRefs);
    }
    if (schema.allOf) schema.allOf.forEach(collectRefs);
    if (schema.oneOf) schema.oneOf.forEach(collectRefs);
    if (schema.anyOf) schema.anyOf.forEach(collectRefs);
    if (schema.additionalProperties && typeof schema.additionalProperties !== "boolean") {
      collectRefs(schema.additionalProperties);
    }
  }

  // 파라미터에서 추출
  operation.parameters?.forEach((param) => {
    collectRefs(param.schema);
  });

  // 요청 본문에서 추출
  const requestSchema = operation.requestBody?.content?.["application/json"]?.schema;
  collectRefs(requestSchema);

  // 응답에서 추출
  Object.values(operation.responses || {}).forEach((response) => {
    const responseSchema = response?.content?.["application/json"]?.schema;
    collectRefs(responseSchema);
  });

  return names;
}

/**
 * @deprecated extractAllSchemaNames 사용
 */
export function extractSchemaNames(
  operation: OperationObject,
  spec: OpenApiSpec
): string[] {
  return Array.from(extractAllSchemaNames(operation, spec));
}
