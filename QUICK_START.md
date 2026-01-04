# oprq 빠른 시작 가이드

## 소개

**oprq**는 OpenAPI 스펙에서 타입 안전한 React Query 코드를 자동 생성하는 CLI 도구입니다.

- OpenAPI 스펙 URL만 등록하면 끝
- 타입, 훅, API 함수 자동 생성
- 수동 API 클라이언트 작성 불필요

## 설치

```bash
# 전역 설치
npm install -g oprq

# 또는 npx로 바로 실행
npx oprq
```

## 1분 만에 시작하기

### Step 1: 프로젝트 초기화

```bash
npx oprq init
```

설정 파일(`oprq.config.json`)과 유틸리티 파일이 생성됩니다.

### Step 2: 필수 패키지 설치

```bash
# React Query v5 (권장)
npm install axios @tanstack/react-query

# React Query v3 사용 시
npm install axios react-query
```

### Step 3: OpenAPI 스펙 등록

```bash
npx oprq add
```

```
? Spec name: PETSTORE
? OpenAPI spec URL: https://petstore3.swagger.io/api/v3/openapi.json
? Description: Petstore API

✓ PETSTORE added successfully!
```

### Step 4: API 코드 생성

```bash
npx oprq gen
```

fuzzy 검색으로 원하는 엔드포인트를 선택하면 코드가 생성됩니다.

## 생성된 코드 사용하기

### HTTP 클라이언트 설정

앱의 진입점에서 axios 인스턴스를 등록합니다:

```typescript
// src/main.tsx
import axios from "axios";
import { setHttpClient } from "@/api/__oprq__";

const http = axios.create({
  baseURL: "/api",
  // 필요시 interceptor, headers 추가
});

setHttpClient(http);
```

### 컴포넌트에서 사용

```typescript
import { useGetPetByIdQuery } from "@/api/PETSTORE/get/pet/{petId}";

function PetDetail({ petId }: { petId: string }) {
  const { data, isLoading, error } = useGetPetByIdQuery({
    pathParams: { petId },
  });

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>에러 발생</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>상태: {data.status}</p>
    </div>
  );
}
```

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `oprq init` | 프로젝트 초기화 |
| `oprq add` | OpenAPI 스펙 등록 |
| `oprq gen` | API 코드 생성 |
| `oprq list` | 등록된 스펙 목록 |
| `oprq sync` | 모든 스펙 재생성 |
| `oprq create` | 플레이스홀더 API 생성 |

## 생성되는 파일 구조

```
src/api/
├── __oprq__/
│   ├── httpClient.ts      # HTTP 클라이언트 설정 & RequestConfig 타입
│   ├── StringReplacer.ts  # URL 파라미터 유틸리티
│   └── index.ts
└── PETSTORE/
    ├── get/
    │   └── pet/{petId}.ts   # 타입 + 훅 + API 함수
    └── post/
        └── pet.ts
```

## 생성 옵션 설정

`oprq.config.json`에서 생성할 훅을 선택할 수 있습니다:

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

| 옵션 | 설명 |
|------|------|
| `queryHook` | `useQuery` 훅 생성 |
| `mutationHook` | `useMutation` 훅 생성 |
| `suspenseHook` | `useSuspenseQuery` 훅 생성 (v5 전용) |
| `infiniteQueryHook` | `useInfiniteQuery` 훅 생성 (페이지네이션용) |

## 백엔드 없이 개발하기

백엔드가 아직 준비되지 않았다면, 플레이스홀더 API를 먼저 생성할 수 있습니다:

```bash
npx oprq create
```

```
? Select spec: MY_API
? HTTP method: GET
? API path: /users/{userId}
? Response type: { id: string; name: string; email: string }
```

타입과 훅이 포함된 파일이 생성되며, API 함수는 에러를 던지는 상태로 생성됩니다.
백엔드가 완료되면 `npx oprq gen --overwrite`로 실제 구현으로 교체하세요.

## 다음 단계

- [전체 문서 보기](./README.md)
- [설정 옵션 상세](./README.md#설정)
- [GitHub 저장소](https://github.com/1394ysh/oprq)

## 문제 해결

### "oprq.config.json not found" 에러

`oprq init`을 먼저 실행하세요.

### "HTTP client not initialized" 에러

앱 시작 시 `setHttpClient()`를 호출했는지 확인하세요.

### 타입이 맞지 않음

`oprq sync`로 최신 스펙에서 코드를 재생성하세요.
