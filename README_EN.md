<p align="center">
  <h1 align="center">oprq</h1>
  <p align="center">
    <strong>OpenAPI React Query Codegen</strong> - Generate type-safe React Query code from OpenAPI specs
  </p>
  <p align="center">
    <a href="./README.md">한국어</a>
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#commands">Commands</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#usage">Usage</a>
</p>

---

**oprq** is a CLI tool that generates fully typed React Query hooks and API client code from OpenAPI specifications. Inspired by [shadcn/ui](https://ui.shadcn.com/), it gives you ownership of the generated code - no runtime dependencies, just clean TypeScript files in your project.

## Why oprq?

This project was built to establish a **single source of truth** for API contracts in team collaboration.

### Key Benefits

- **Type Safety** - Generate types directly from OpenAPI specs to prevent runtime errors
- **Incremental Adoption** - Generate only the endpoints you need without changing your entire codebase. Easy to adopt in legacy projects
- **Code Ownership** - Generated code fully belongs to your project. Modify freely as needed
- **Zero Runtime Dependency** - oprq is just a generator, not included in your production bundle
- **Parallel Development** - Create placeholder APIs before the backend is ready to start frontend development early

## Features

- **Type-safe** - Full TypeScript support with auto-generated types from OpenAPI schemas
- **OpenAPI 3.x support** - Supports OpenAPI 3.0/3.1 specs (Swagger 2.0 support coming soon)
- **React Query v3/v4/v5** - Support for all major versions of TanStack Query
- **Zero runtime overhead** - Generated code has no dependencies on oprq
- **Interactive CLI** - Fuzzy search to select specific endpoints
- **Incremental generation** - Add or regenerate individual endpoints as needed
- **axios integration** - Bootstrap pattern for HTTP client configuration
- **Custom request config** - Inject headers, responseType, onUploadProgress for file upload/download

## Requirements

- Node.js >= 18.0.0
- **fzf** - Required for interactive fuzzy search ([install guide](https://github.com/junegunn/fzf#installation))
- axios >= 1.0.0
- One of:
  - `react-query` >= 3.0.0 (for v3)
  - `@tanstack/react-query` >= 4.0.0 (for v4/v5)

### Installing fzf

```bash
# macOS
brew install fzf

# Ubuntu/Debian
sudo apt install fzf

# Windows (scoop)
scoop install fzf

# Windows (choco)
choco install fzf
```

## Installation

```bash
npm install -g oprq
# or
npx oprq
```

## Quick Start

```bash
# 1. Install peer dependencies
npm install axios @tanstack/react-query

# 2. Initialize your project
npx oprq init

# 3. Add an OpenAPI spec
npx oprq add

# 4. Generate API code
npx oprq gen
```

## Commands

### init

Initialize project - creates config file (`oprq.config.json`) and utility files (`__oprq__/`)

https://github.com/user-attachments/assets/fdfa6234-9dee-4c06-bc8d-8f4605971306

### add

Add a new OpenAPI spec URL

https://github.com/user-attachments/assets/6d8bd179-02c5-4f63-8041-b24665904b36

### generate (alias: `g`, `gen`)

Generate API code - select by controller or endpoint

**Select by Controller**

https://github.com/user-attachments/assets/62b5839d-384f-49a8-a4bd-604461da37a9

**Select by Endpoint**

https://github.com/user-attachments/assets/ebf9070e-825c-4474-aa61-db944f58967a

### create (alias: `new`)

Create placeholder API - for frontend development before backend is ready

https://github.com/user-attachments/assets/e6b14a94-03ad-4821-8b7d-5ba31d5afc12

### Other Commands

| Command         | Alias | Description                     |
| --------------- | ----- | ------------------------------- |
| `oprq remove`   | `rm`  | Remove a registered spec        |
| `oprq sync`     | -     | Regenerate all registered specs |
| `oprq list`     | `ls`  | List registered specs           |

### Generate Options

```bash
# Interactive mode (default)
npx oprq gen

# Generate all endpoints from a spec
npx oprq gen --spec PETSTORE --all

# Overwrite existing files
npx oprq gen --all --overwrite
```

### Create Placeholder API

Create API files before the backend is ready - useful for parallel frontend/backend development:

```bash
# Interactive mode
npx oprq create

# Direct mode
npx oprq create --method GET --path /users/{userId} --spec MY_API
```

The generated file includes types and hooks, but the API function throws an error until replaced with `oprq generate --overwrite` when the actual API is ready.

## Configuration

After running `oprq init`, an `oprq.config.json` file is created:

```json
{
  "$schema": "https://unpkg.com/oprq/schema.json",
  "outputPath": "./src/api",
  "reactQueryVersion": "v5",
  "httpClient": "axios",
  "keepSpecPrefix": true,
  "specs": {
    "PETSTORE": {
      "url": "https://petstore3.swagger.io/api/v3/openapi.json",
      "description": "Swagger Petstore API"
    }
  },
  "generate": {
    "queryHook": true,
    "mutationHook": true,
    "suspenseHook": false,
    "infiniteQueryHook": false
  }
}
```

### Options

| Option                       | Type                   | Default       | Description                                      |
| ---------------------------- | ---------------------- | ------------- | ------------------------------------------------ |
| `outputPath`                 | `string`               | `"./src/api"` | Output directory for generated files             |
| `reactQueryVersion`          | `"v3" \| "v4" \| "v5"` | `"v5"`        | React Query version                              |
| `httpClient`                 | `"axios"`              | `"axios"`     | HTTP client (axios only for now)                 |
| `keepSpecPrefix`             | `boolean`              | `true`        | Keep spec prefix in API URLs (see below)         |
| `generate.queryHook`         | `boolean`              | `true`        | Generate `useQuery` hooks                        |
| `generate.mutationHook`      | `boolean`              | `true`        | Generate `useMutation` hooks                     |
| `generate.suspenseHook`      | `boolean`              | `false`       | Generate `useSuspenseQuery` hooks (v5 only)      |
| `generate.infiniteQueryHook` | `boolean`              | `false`       | Generate `useInfiniteQuery` hooks for pagination |

### keepSpecPrefix Option

Determines whether to keep the spec name prefix in API URLs.

#### `keepSpecPrefix: true` (default) - Multiple API Servers

When using multiple OpenAPI specs (domains) with different baseURLs:

```typescript
// Generated URL: "PETSTORE:/pet/{petId}"
// Route baseURL by spec prefix in axios interceptor
http.interceptors.request.use((config) => {
  if (config.url?.startsWith("PETSTORE:")) {
    config.baseURL = "https://petstore3.swagger.io/api/v3";
    config.url = config.url.replace("PETSTORE:", "");
  } else if (config.url?.startsWith("USER_API:")) {
    config.baseURL = "https://user-api.example.com";
    config.url = config.url.replace("USER_API:", "");
  }
  return config;
});
```

#### `keepSpecPrefix: false` - Single API Server

When using a single baseURL:

```typescript
// Generated URL: "/pet/{petId}" (prefix removed)
const http = axios.create({
  baseURL: "https://petstore3.swagger.io/api/v3",
});
setHttpClient(http);
```

## Usage

### 1. Setup HTTP Client

In your app's entry point, configure the axios instance:

```typescript
// src/main.tsx or src/index.tsx
import axios from "axios";
import { setHttpClient } from "@/api/__oprq__";

const http = axios.create({
  baseURL: "/api",
  // Add your interceptors, headers, etc.
});

setHttpClient(http);
```

### 2. Use Generated Hooks

```typescript
import { useGetPetByIdQuery } from "@/api/PETSTORE/get/pet/{petId}";

function PetDetail({ petId }: { petId: string }) {
  const { data, isLoading, error } = useGetPetByIdQuery({
    pathParams: { petId },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>Status: {data.status}</p>
    </div>
  );
}
```

### 3. Use Repository Functions Directly

```typescript
import { getPetById } from "@/api/PETSTORE/get/pet/{petId}";

async function fetchPet(petId: string) {
  const pet = await getPetById({ pathParams: { petId } });
  console.log(pet.name);
}
```

### 4. File Upload / Download

Use the `config` option to customize axios request config:

```typescript
import { uploadFile } from "@/api/MY_API/post/files/upload";
import { downloadFile } from "@/api/MY_API/get/files/{fileId}";

// File upload with progress
const formData = new FormData();
formData.append("file", file);

await uploadFile({
  body: formData,
  config: {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      const percent = Math.round((e.loaded * 100) / e.total);
      console.log(`Upload progress: ${percent}%`);
    },
  },
});

// File download as blob
const blob = await downloadFile({
  pathParams: { fileId: "123" },
  config: { responseType: "blob" },
});
```

### 5. Use in Class Components

React Query hooks only work in functional components, but you can use repository functions directly in class components:

```typescript
import { getPetById } from "@/api/PETSTORE/get/pet/{petId}";

class PetDetail extends React.Component<{ petId: string }> {
  state = { pet: null, loading: true, error: null };

  async componentDidMount() {
    try {
      const pet = await getPetById({
        pathParams: { petId: this.props.petId },
      });
      this.setState({ pet, loading: false });
    } catch (error) {
      this.setState({ error, loading: false });
    }
  }

  render() {
    const { pet, loading, error } = this.state;
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;
    return <div>{pet?.name}</div>;
  }
}
```

## Generated File Structure

```
src/api/
├── __oprq__/
│   ├── httpClient.ts      # HTTP client bootstrap & RequestConfig type
│   ├── StringReplacer.ts  # URL parameter utility
│   └── index.ts
└── PETSTORE/
    ├── get/
    │   └── pet/{petId}.ts
    └── post/
        └── pet.ts
```

### Generated Code Example

Each API file includes:

```typescript
// Types
export type PathParams = { petId: string };
export type QueryParams = Record<string, never>;
export type Body = undefined;
export type Response = Pet;
export type ErrorResponse = ApiError;

// Request interface
export interface RequestArgs {
  pathParams: PathParams;
  queryParams?: QueryParams;
  body?: Body;
  config?: RequestConfig; // For custom headers, responseType, etc.
}

// Query key for cache management
export const getPetByIdQueryKey = (req: RequestArgs) =>
  ["PETSTORE", "GET", "/pet/{petId}", req] as const;

// Repository function
export const getPetById = async (args: RequestArgs): Promise<Response> => {
  const url = new StringReplacer("PETSTORE:/pet/{petId}").replaceText(
    args.pathParams
  );
  const http = getHttpClient();
  return http.get(url, { params: args?.queryParams, ...args?.config });
};

// React Query hook
export const useGetPetByIdQuery = <TData = Response, TError = ErrorResponse>(
  req: RequestArgs,
  options?: Omit<
    UseQueryOptions<Response, TError, TData>,
    "queryKey" | "queryFn"
  >
): UseQueryResult<TData, TError> => {
  return useQuery({
    queryKey: getPetByIdQueryKey(req),
    queryFn: () => getPetById(req),
    ...options,
  });
};
```

## License

MIT
