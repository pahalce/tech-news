# Functional DDD Architecture for TypeScript

## Table of Contents

1. Architecture Goals
2. Core Design Principles
3. Architecture Overview
4. Directory Structure
5. Import Policy
6. Layer Responsibilities
7. Domain vs Application Decision Guide
8. Domain Modeling
9. Validation Strategy
10. Factory & Restoration Pattern
11. Persistence Mapping
12. Application Ports & Infrastructure Adapters
13. Transaction Strategy
14. UseCase Pattern
15. Application Layer Scaling Strategy
16. Multi-Domain Design
17. Error Handling
18. Shared Module Policy
19. Architecture Enforcement
20. Testing Strategy
21. Recommended Stack
22. Summary

---

# 1. Architecture Goals

このアーキテクチャは、TypeScriptで:

- class hierarchyに依存せず
- pure function中心
- immutable data中心
- type system中心
- import boundary中心

にDDDを実現するための構成である。

DDDを:

```txt
class hierarchy
```

ではなく、

```txt
module boundary
+
immutable data
+
pure function
+
static analysis
```

として扱う。

---

## 1.1 DDD ≠ OOP

この構成では:

```txt
DDD ≠ class-based OOP
```

と考える。

DDDの本質は:

- business concept modeling
- consistency boundary
- dependency control
- ubiquitous language

であり、class inheritanceではない。

---

## 1.2 Why Avoid Class-Centric Design

この構成では、Domain layerにおけるclass中心設計を採用しない。

理由:

- hidden mutable stateを避けたい
- inheritance couplingを避けたい
- serializationを簡単にしたい
- composabilityを高めたい
- tree-shakingしやすくしたい
- static analysisしやすくしたい
- pure function testingしやすくしたい
- module boundaryを明確にしたい

---

# 2. Core Design Principles

## 2.1 Domain is Pure

Domain layerは:

- framework非依存
- storage非依存
- IO禁止
- side effect禁止

を維持する。

---

## 2.2 Entity = Immutable Data

Entityはclassではなくimmutable objectとして表現する。

```ts
export type User = Readonly<{
  id: UserId;
  name: string;
  email: Email;
  status: "active" | "suspended";
}>;
```

---

## 2.3 State Transition = Function

```ts
user.suspend();
```

ではなく:

```ts
suspendUser(user);
```

とする。

---

## 2.4 Architecture is Enforced by Imports

DDD enforcementはruntimeではなく:

```txt
import dependency graph
```

で保証する。

---

# 3. Architecture Overview

## 3.1 Layer Structure

```txt
Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure
```

---

## 3.2 Dependency Rules

許可:

```txt
presentation -> application
application -> domain
application -> application ports
infrastructure -> domain
infrastructure -> application ports
```

禁止:

```txt
domain -> application
domain -> infrastructure
application -> infrastructure implementation
presentation -> infrastructure
```

---

## 3.3 domains/ vs features/

```txt
domains/
```

は:

```txt
business model layer
```

である。

```txt
features/
```

は:

```txt
runtime feature layer
```

である。

---

## 3.4 Example Responsibility Split

```txt
domains/user
  = Userという概念そのもの

features/user
  = 「ユーザー停止機能」を実行する仕組み
```

---

# 4. Directory Structure

## 4.1 Overall Structure

```txt
src/
  domains/
    user/
      index.ts
      user.ts
      user.rules.ts
      user.errors.ts
      user.service.ts

    team/
      index.ts
      team.ts
      team.rules.ts
      team.errors.ts
      team.service.ts

  features/
    user/
      application/
        ports/
          userRepository.ts
          userNotifier.ts

        suspendUserUsecase.ts

      infrastructure/
        persistence/
          userRepositoryDrizzle.ts
          userRepositoryJson.ts
          userRepositoryCsv.ts

        notification/
          userNotifierDiscord.ts
          userNotifierSlack.ts

      presentation/
        userRoute.ts

    team/
      application/
      infrastructure/
      presentation/

  shared/
    domain/
      result.ts

    application/
      ports/
        transaction.ts
        logger.ts
        clock.ts
        idGenerator.ts

    infrastructure/
```

---

## 4.2 domains/

含むもの:

- Entity
- Value Object
- Domain Rules
- Domain Errors
- Domain Service

特徴:

- pure TypeScript
- no IO
- stable business concepts
- reusable across features

---

## 4.3 features/

含むもの:

- UseCase
- Application Ports
- Infrastructure implementation
- Presentation

特徴:

- runtime concerns
- orchestration
- framework integration
- persistence implementation

---

# 5. Import Policy

## 5.1 Absolute Import Policy

absolute importを使用する。

```ts
import { TeamId } from "src/domains/team";
```

利用しないもの:

```txt
../../../../
@ alias
package exports
```

---

## 5.2 Public API Design

各domainは:

```txt
src/domains/*/index.ts
```

のみ公開APIとする。

許可:

```ts
import { TeamId } from "src/domains/team";
```

禁止:

```ts
import { TeamId } from "src/domains/team/team";
```

---

## 5.3 Cross-Domain Dependency Policy

許可:

```txt
src/domains/user
  -> src/domains/team

src/features/user/application
  -> src/domains/team
```

禁止:

```txt
src/domains/user
  -> src/features/team/infrastructure

src/features/user/application
  -> src/features/team/infrastructure
```

つまり:

```txt
cross-domain access
=
domains/* only
```

とする。

---

# 6. Layer Responsibilities

## 6.1 Domain Layer

責務:

- business rules
- invariant validation
- state transition
- domain modeling

特徴:

- immutable
- pure function
- storage非依存
- framework非依存

---

## 6.2 Application Layer

責務:

- usecase orchestration
- transaction coordination
- multi-domain coordination
- authorization coordination
- external capability coordination

特徴:

- infrastructure implementationを知らない
- application portには依存可能
- transaction boundaryを決定する
- domainと外部世界を接続する

---

## 6.3 Infrastructure Layer

責務:

- persistence
- external API
- queue
- cache
- filesystem
- application port implementation

特徴:

- IO担当
- abstraction implementation担当

---

## 6.4 Presentation Layer

責務:

- route handler
- request validation
- serialization
- HTTP integration

特徴:

- application usecase呼び出しのみ

---

# 7. Domain vs Application Decision Guide

| Concern                    | Layer          |
| -------------------------- | -------------- |
| business invariant         | domain         |
| state transition           | domain         |
| pure business calculation  | domain         |
| aggregate consistency      | domain         |
| transaction boundary       | application    |
| repository coordination    | application    |
| authorization coordination | application    |
| side effect orchestration  | application    |
| persistence                | infrastructure |
| queue/cache/filesystem     | infrastructure |
| HTTP/CLI/Event input       | presentation   |

---

# 8. Domain Modeling

## 8.1 Entity

Entityはimmutable dataとして定義する。

```ts
export type User = Readonly<{
  id: UserId;
  name: string;
  email: Email;
  status: "active" | "suspended";
}>;
```

---

## 8.2 Value Object

Value ObjectはValibotのbrandを利用して型安全性を強化する。

[Valibot brand API](https://valibot.dev/api/brand/?utm_source=chatgpt.com)

```ts
import * as v from "valibot";

export const UserIdSchema = v.pipe(v.string(), v.minLength(1), v.brand("UserId"));

export type UserId = v.InferOutput<typeof UserIdSchema>;

export const EmailSchema = v.pipe(v.string(), v.email(), v.brand("Email"));

export type Email = v.InferOutput<typeof EmailSchema>;
```

---

## 8.3 Construction Policy

Entity生成は:

- create\*
- restore\*

のみ許可する。

直接object literalでDomainObjectを構築しない。

---

## 8.4 State Transition Pattern

状態変更はpure functionで表現する。

```ts
export type SuspendUserError = {
  type: "UserAlreadySuspended";
};

export function suspendUser(user: User): Result<User, SuspendUserError> {
  if (user.status === "suspended") {
    return {
      ok: false,
      error: {
        type: "UserAlreadySuspended",
      },
    };
  }

  return {
    ok: true,
    value: {
      ...user,
      status: "suspended",
    },
  };
}
```

---

## 8.5 Rule Function Pattern

複雑な判定はrules moduleへ分離する。

```ts
export function canSuspend(user: User): boolean {
  return user.status === "active";
}
```

Rule Functionは:

```txt
predicate / condition
```

を担当する。

---

## 8.6 Domain Service Pattern

Domain Serviceは:

```txt
Entity / ValueObject に
自然に所属しない
domain logic
```

を担当する。

例:

- pricing calculation
- policy evaluation
- domain algorithm
- cross-entity business rule

禁止:

- repository orchestration
- transaction coordination
- IO
- external API access

---

# 9. Validation Strategy

## 9.1 Validation Philosophy

Validationは:

```txt
boundary validation
```

と

```txt
domain invariant validation
```

を分離する。

---

## 9.2 Boundary Validation

外部入力は:

```txt
unknown -> parse
```

で扱う。

対象:

- HTTP request
- DB row
- JSON file
- CSV record
- external API
- queue message

---

## 9.3 Domain Validation

DomainObject生成は:

```txt
typed input -> parse
```

で扱う。

---

## 9.4 Validation Library Policy

runtime validation libraryは:

- Valibot
- Zod

のどちらでもよい。

例ではValibotを使用する。

---

## 9.5 Example Domain Schema

```ts
import * as v from "valibot";

export const UserSchema = v.object({
  id: UserIdSchema,

  name: v.pipe(v.string(), v.minLength(1), v.maxLength(50)),

  email: EmailSchema,

  status: v.picklist(["active", "suspended"]),
});

export type User = Readonly<v.InferOutput<typeof UserSchema>>;
```

---

# 10. Factory & Restoration Pattern

## 10.1 createUser

作成入力と完成Entityを分離する。

```ts
export function createUser(input: CreateUserInput): User {
  return v.parse(UserSchema, {
    ...input,
    status: "active",
  });
}
```

---

## 10.2 restoreUser

永続化層から復元する際も必ずDomain validationを通す。

```ts
export function restoreUser(input: unknown): User {
  return v.parse(UserSchema, input);
}
```

重要:

```txt
storageに存在する
≠
DomainObjectとして正しい
```

---

# 11. Persistence Mapping

## 11.1 DB Row ≠ Domain Object

Persistence ModelとDomain Modelは分離する。

```txt
DB Row
  ↓
Persistence DTO
  ↓
Domain Factory
  ↓
Domain Entity
```

---

## 11.2 Why Separate

DB都合のフィールド:

- created_at
- updated_at
- deleted_at
- version
- internal flags

をDomainへ漏らさないため。

---

## 11.3 Mapping Example

```ts
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
};

export function toUser(row: UserRow): User {
  return restoreUser({
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
  });
}
```

---

# 12. Application Ports & Infrastructure Adapters

## 12.1 Philosophy

DDDの主目的は:

```txt
Domain modelを
外部都合から守ること
```

である。

そのため:

- DomainはIOを知らない
- Domainは外部技術を知らない
- UseCaseは必要な能力のみをportとして受け取る
- Infrastructureがportを実装する

という依存方向を維持する。

---

## 12.2 Port vs Adapter

```txt
Application Port
  = UseCaseが必要とする能力

Infrastructure Adapter
  = その能力の実装
```

例:

```txt
UserRepository
  = port

UserRepositoryDrizzle
  = adapter

UserNotifier
  = port

UserNotifierDiscord
  = adapter
```

---

## 12.3 Repository Philosophy

Repositoryは:

```txt
Aggregate persistence boundary
```

を表現する。

つまり:

```txt
Repositoryは
Aggregate Root単位で定義する
```

例えば:

```txt
User aggregate
  -> UserRepository

Order aggregate
  -> OrderRepository
```

のように扱う。

そのため通常は:

```txt
OrderItemRepository
UserProfileRepository
```

のような、

```txt
Aggregate内部要素単位
```

のRepositoryは作らない。

Repositoryは:

```txt
Aggregate全体の
load/save responsibility
```

を持つ。

---

## 12.4 Repository Port Example

```ts
export type UserRepository = {
  findById(id: UserId): Promise<User | null>;

  save(user: User): Promise<void>;
};
```

---

## 12.5 Notifier Port Example

portは:

```txt
何をしたいか
```

を表現する。

```ts
export type UserNotifier = {
  notifyUserSuspended(input: { userId: UserId }): Promise<void>;
};
```

---

## 12.6 Logger Port Example

```ts
export type Logger = {
  info(message: string, context?: Record<string, unknown>): void;

  warn(message: string, context?: Record<string, unknown>): void;

  error(message: string, context?: Record<string, unknown>): void;
};
```

---

## 12.7 Shared vs Feature Ports

feature固有なら:

```txt
features/*/application/ports
```

へ置く。

例:

- UserRepository
- UserNotifier

cross-featureなら:

```txt
shared/application/ports
```

へ置く。

例:

- Transaction
- Logger
- Clock
- IdGenerator

---

# 13. Transaction Strategy

## 13.1 Transaction Philosophy

Transaction boundaryはApplication layerが決定する。

Infrastructure layerはtransaction implementationのみ提供する。

---

## 13.2 Transaction Abstraction

```ts
export type Transaction<Ctx> = <A>(fn: (ctx: Ctx) => Promise<A>) => Promise<A>;
```

---

## 13.3 Drizzle Transaction Example

```ts
export type DrizzleTransactionContext = {
  db: DrizzleTx;
};

export const drizzleTransaction: Transaction<DrizzleTransactionContext> = async (fn) => {
  return db.transaction(async (tx) => {
    return fn({
      db: tx,
    });
  });
};
```

---

## 13.4 Repository Factory Pattern

Repository implementationはtransaction contextから生成する。

```ts
export function userRepositoryDrizzle(ctx: DrizzleTransactionContext): UserRepository {
  return {
    async findById(id) {
      const row = await ctx.db.query.users.findFirst({
        where: eq(users.id, id),
      });

      return row ? toUser(row) : null;
    },

    async save(user) {
      await ctx.db.insert(users).values(toUserRow(user));
    },
  };
}
```

---

## 13.5 Memory Transaction Example

テスト用にmemory transactionへ差し替え可能。

```ts
export type MemoryTransactionContext = {
  state: MemoryState;
};

export const memoryTransaction: Transaction<MemoryTransactionContext> = async (fn) => {
  return fn({
    state: createMemoryState(),
  });
};
```

---

# 14. UseCase Pattern

UseCaseはdependency injectionで構成する。

```ts
export type SuspendUserUsecaseError =
  | {
      type: "UserNotFound";
    }
  | SuspendUserError;

export function suspendUserUsecase<Ctx>(deps: {
  transaction: Transaction<Ctx>;

  logger: Logger;

  userRepository: (ctx: Ctx) => UserRepository;

  userNotifier: UserNotifier;
}) {
  return async (userId: UserId): Promise<Result<User, SuspendUserUsecaseError>> => {
    return deps.transaction(async (ctx) => {
      const userRepo = deps.userRepository(ctx);

      const user = await userRepo.findById(userId);

      if (!user) {
        deps.logger.warn("User not found", { userId });

        return {
          ok: false,
          error: {
            type: "UserNotFound",
          },
        };
      }

      const result = suspendUser(user);

      if (!result.ok) {
        return result;
      }

      await userRepo.save(result.value);

      await deps.userNotifier.notifyUserSuspended({
        userId: result.value.id,
      });

      deps.logger.info("User suspended", {
        userId: result.value.id,
      });

      return {
        ok: true,
        value: result.value,
      };
    });
  };
}
```

---

# 15. Application Layer Scaling Strategy

## 15.1 Problem

UseCaseへ責務を集中させすぎると:

- authorization
- repository coordination
- transaction
- side effect
- workflow

が肥大化する。

---

## 15.2 Splitting Guideline

以下が増えたらApplication layer内部で分割する:

- authorizationが複雑
- side effectが複数ある
- 複数repositoryを扱う
- usecase固有helperが増えた
- 100〜150行を超える

---

## 15.3 Example

```txt
application/
  suspendUserUsecase.ts
  suspendUserCoordinator.ts
  suspendUserPolicy.ts
  suspendUser.input.ts
```

---

# 16. Multi-Domain Design

## 16.1 Aggregate Rule

Aggregateは:

```txt
strong consistency boundary
```

である。

さらに:

- invariant consistency boundary
- synchronous transaction boundary

でもある。

---

## 16.2 Aggregate Guideline

強い整合性が必要なら同じAggregateへ寄せる。

例:

```txt
Order
  + OrderItems
```

---

## 16.3 Multi-Aggregate Coordination

別AggregateはApplication layerで調整する。

```txt
src/features/*/application
```

が:

- 複数Repository取得
- transaction coordination
- 複数domain function呼び出し

を担当する。

---

## 16.4 Bounded Context Pattern

文脈が違うなら別conceptとして分離する。

```txt
accountUser
billingCustomer
notificationRecipient
```

---

# 17. Error Handling

## 17.1 Error Philosophy

想定内失敗は:

```txt
Result<T, E>
```

で表現する。

---

## 17.2 Expected vs Unexpected

| Type                     | Strategy |
| ------------------------ | -------- |
| business failure         | Result   |
| validation failure       | Result   |
| unexpected infra failure | throw    |
| programmer bug           | throw    |

---

## 17.3 Result Type

```ts
export type Result<T, E> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };
```

---

## 17.4 Error Representation

Errorはplain objectで表現する。

```ts
export type UserNotFoundError = {
  type: "UserNotFound";
};
```

---

## 17.5 Error Responsibility

| Layer          | Responsibility         |
| -------------- | ---------------------- |
| Domain         | business rule failure  |
| Application    | orchestration failure  |
| Infrastructure | unexpected IO failure  |
| Presentation   | protocol error mapping |

---

# 18. Shared Module Policy

## 18.1 Shared Philosophy

`shared/` は最小限に保つ。

sharedは巨大utility置き場にしない。

---

## 18.2 Allowed in shared/

許可:

- Result type
- validation helper
- generic utility
- infrastructure abstraction

禁止:

- business logic
- cross-domain helper
- feature-specific utility

---

# 19. Architecture Enforcement

## 19.1 Core Philosophy

アーキテクチャは:

```txt
static analysis
```

で守る。

---

## 19.2 Recommended Toolchain

```txt
TypeScript
Vite+
dependency-cruiser
```

---

## 19.3 dependency-cruiser Responsibilities

担当:

- layer dependency
- cross-domain dependency
- circular dependency
- forbidden import
- public API enforcement

---

## 19.4 dependency-cruiser Example

```js
module.exports = {
  forbidden: [
    {
      name: "domain-no-features",
      from: {
        path: "^src/domains",
      },
      to: {
        path: "^src/features",
      },
    },

    {
      name: "presentation-no-domain",
      from: {
        path: "^src/features/.+/presentation",
      },
      to: {
        path: "^src/domains",
      },
    },

    {
      name: "infrastructure-no-presentation",
      from: {
        path: "^src/features/.+/infrastructure",
      },
      to: {
        path: "^src/features/.+/presentation",
      },
    },

    {
      name: "cross-domain-no-internal",
      from: {
        path: "^src/domains/([^/]+)",
      },
      to: {
        path: "^src/domains/(?!$1)[^/]+/(?!index\\.ts$)",
      },
    },
  ],
};
```

---

## 19.5 Domain Purity Rules

domain layerでは以下禁止:

- persistence implementation
- filesystem access
- fetch
- axios
- react
- next
- console
- Date.now

---

# 20. Testing Strategy

## 20.1 Domain Test

Domain layerはpure unit test中心。

```txt
input
  ↓
pure function
  ↓
assert
```

---

## 20.2 Application Test

Application layerはmemory transaction + memory repositoryでテストする。

```txt
UseCase
  + MemoryTransaction
  + MemoryRepository
```

---

## 20.3 Infrastructure Test

Infrastructure layerはintegration test中心。

対象:

- DB
- filesystem
- external API
- cache
- queue

---

# 21. Recommended Stack

| Category                | Technology                 |
| ----------------------- | -------------------------- |
| Runtime                 | TypeScript / Node.js / ESM |
| Toolchain               | Vite+                      |
| Validation              | Valibot or Zod             |
| Architecture Validation | dependency-cruiser         |

---

# 22. Summary

このアーキテクチャでは:

```txt
Entity = immutable data
Rules = predicate / condition
Domain Service = entityに所属しないdomain logic
UseCase = orchestration
Infrastructure = IO
Ports = application capability abstraction
Adapters = infrastructure implementation
Transaction = application-owned boundary
Repository = aggregate persistence boundary
```

として責務分離する。

DDDを:

```txt
class-based OOP
```

ではなく、

```txt
functional module architecture
```

として実現する。
