# openapi-rq (orq) Quick Start Guide

## Introduction

**openapi-rq** is a CLI tool that automatically generates type-safe React Query code from OpenAPI specs.

> **Note**: The package name is `openapi-rq`, and the CLI command is `orq` (short alias).

- Just register an OpenAPI spec URL
- Types, hooks, and API functions are auto-generated
- No more manual API client code

## Installation

```bash
# Global install
npm install -g openapi-rq

# Or run directly with npx
npx openapi-rq
```

## Get Started in 1 Minute

### Step 1: Initialize Project

```bash
npx openapi-rq init
```

This creates the config file (`orq.config.json`) and utility files.

### Step 2: Install Required Packages

```bash
# React Query v5 (recommended)
npm install axios @tanstack/react-query

# For React Query v3
npm install axios react-query
```

### Step 3: Register an OpenAPI Spec

```bash
npx openapi-rq add
```

```
? Spec name: PETSTORE
? OpenAPI spec URL: https://petstore3.swagger.io/api/v3/openapi.json
? Description: Petstore API

✓ PETSTORE added successfully!
```

### Step 4: Generate API Code

```bash
npx openapi-rq gen
```

Use fuzzy search to select the endpoints you want, and the code will be generated.

## Using Generated Code

### Configure HTTP Client

Register your axios instance at the app's entry point:

```typescript
// src/main.tsx
import axios from "axios";
import { setHttpClient } from "@/api/__orq__";

const http = axios.create({
  baseURL: "/api",
  // Add interceptors, headers as needed
});

setHttpClient(http);
```

### Use in Components

```typescript
import { useGetPetByIdQuery } from "@/api/PETSTORE/get/pet/{petId}";

function PetDetail({ petId }: { petId: string }) {
  const { data, isLoading, error } = useGetPetByIdQuery({
    pathParams: { petId },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error occurred</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>Status: {data.status}</p>
    </div>
  );
}
```

## Key Commands

| Command | Description |
|---------|-------------|
| `orq init` | Initialize project |
| `orq add` | Register OpenAPI spec |
| `orq gen` | Generate API code |
| `orq list` | List registered specs |
| `orq sync` | Regenerate all specs |
| `orq create` | Create placeholder API |

## Generated File Structure

```
src/api/
├── __orq__/
│   ├── httpClient.ts      # HTTP client setup & RequestConfig type
│   ├── StringReplacer.ts  # URL parameter utility
│   └── index.ts
└── PETSTORE/
    ├── get/
    │   └── pet/{petId}.ts   # Types + Hooks + API function
    └── post/
        └── pet.ts
```

## Generation Options

Configure which hooks to generate in `orq.config.json`:

```json
{
  "generate": {
    "queryHook": true,
    "mutationHook": true,
    "suspenseHook": false,
    "infiniteQueryHook": false
  }
}
```

| Option | Description |
|--------|-------------|
| `queryHook` | Generate `useQuery` hooks |
| `mutationHook` | Generate `useMutation` hooks |
| `suspenseHook` | Generate `useSuspenseQuery` hooks (v5 only) |
| `infiniteQueryHook` | Generate `useInfiniteQuery` hooks (for pagination) |

## Develop Without a Backend

If the backend isn't ready yet, you can create placeholder APIs first:

```bash
npx openapi-rq create
```

```
? Select spec: MY_API
? HTTP method: GET
? API path: /users/{userId}
? Response type: { id: string; name: string; email: string }
```

A file with types and hooks will be created, but the API function throws an error.
When the backend is ready, replace it with `npx openapi-rq gen --overwrite`.

## Next Steps

- [Full Documentation](./README_EN.md)
- [Configuration Details](./README_EN.md#configuration)
- [GitHub Repository](https://github.com/1394ysh/openapi-rq)

## Troubleshooting

### "orq.config.json not found" error

Run `orq init` first.

### "HTTP client not initialized" error

Make sure you called `setHttpClient()` at app startup.

### Types don't match

Regenerate code from the latest spec with `orq sync`.
