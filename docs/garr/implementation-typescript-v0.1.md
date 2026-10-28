# AgentScope TypeScript / Node：GARR v0.1 详细技术实现与源码对照

> **本文是语言专属的实施文档，不是另一套 GARR 架构。**
>
> **唯一规范源**：[`GARR-UNIFIED-CONTRACT-v0.1.md`](GARR-UNIFIED-CONTRACT-v0.1.md)，统一编号 `partme.agentscope.garr/0.1`；所有类型语义、CPARP 评分、Graph Closure、Proof Obligation、状态机、预算/权限和 Wire Schema 不得随语言变化。
>
> **跨语言源码映射总览**：`partme-docs/docs/standards/garr/GARR-MULTILANGUAGE-IMPLEMENTATION-v0.1.md`。本文可记载语言 API、模块/线程/异常处理、构建验证和实际缺口。

## 1. 目标工程与当前真实性

**仓库：** `agentscope-typescript`。
**可选 GARR 扩展：** `packages/agentscope/src/garr`。
**实现状态：** 已在 `packages/agentscope/src/garr/index.ts` 实现 P0 Planner，并加入 `tsup.config.ts` 的 `garr/index` entry 与 `package.json` 的 `./garr` 子路径导出。Node24 对同一 Golden Fixture 的 **10 项测试通过（含 GARR-015 UTF-8）**；完整 pnpm/tsup 打包尚未运行。

TypeScript 严格类型检查，ES2022/CommonJS；现有 npm 包 `@agentscope-ai/agentscope` 通过可选 `./garr` 入口消费，避免默认加载所有 GARR 编排依赖。测试使用 Node24 原生 Test Runner + 类型擦除，可在当前无 node_modules 的 Windows 环境直接执行。

本仓 GARR 仅在明确启用时运行。**AgentScope 是底层框架**，只提供结构图、ReasoningFrame、Planner、预算与执行器等能力；TinyClaw 是类似 OpenClaw 的**应用软件**，负责任务路由、Capability Graph、工具与渠道、用户记忆、权限审批、UI/CLI/Service/Embed。不要向本仓导入 TinyClaw 产品服务或重新实现模型/Tool 运行链。

## 2. 本语言模块分层与真实源码位置

### 2.1 Graph / Evidence / Constraint

`GraphNode/Edge/Constraint/Snapshot` 采用 discriminated/string union 的只读规则输入；现有 `Toolkit`/`Agent` 不依赖 GARR。证据引用和权限必须来自应用提供的可信 GraphContextProvider，不能直接把用户 Prompt 作为已验证的图边。

统一模型映射要求：`GraphSnapshotRef(scope,revision)`、`GraphNode`、`GraphEdge(edge_kind,evidence_state,evidence_refs)`、`GraphConstraint(scope_nodes,coupling,phases,validator_ref)`、`ReasoningFrame(anchors,owned/shared,obligations,budget_lease)`。当前 P0 若暂未实现某个对象或字段，需在 P1/P2 **增量补齐**，不能以本语言实现不足删去统一字段。

### 2.2 Planner / Reasoning Decision

`GarrPlanner.plan(frame, graph)` 实现类型/方向感知的遍历、约束闭包、Atomic 合并、Contractible validator、分区代价、统一预算阈值，并返回统一 Action/ReasonCode；Golden Fixture `tests/garr-conformance.node.test.mjs` 读取 `docs/garr/fixtures/garr-v0.1-conformance.json`，逐项对比 action/domains/contracts。

该 Planner 必须精确执行 `policy_id=garr-cparp-0.1` 同一逻辑：**可信 scope/revision → typed BFS → 完整硬约束闭包 → disputed 优先 Verify / proposed-stale 优先 Probe → Atomic 合并 → Contractible Validator → n/k/x/c 评分 → 子 Frame 与 Join/Verify 预算门禁 → Trace**。只要缺失必需权限或证明义务，就不得输出虚假的 Completed。此处只描述语言映射，不复制算法权威。

### 2.3 FrameExecutor / JoinVerifier / Budget Ledger

下一阶段写 `AgentScopeGarrFrameExecutor`，直接复用 `packages/agentscope/src/agent/agent.ts` 与 `tool/toolkit.ts`；权限由原 Tool/HITL 管控，AbortSignal 透传到真正模型请求和 Tool；需要生成 `FrameArtifact` 及独立 Join receipt。

P1 使用 Promise/AbortSignal/AsyncIterable 实现 Frame 执行和流事件；使用原工具注册表与隔离工作区，不能直接把模型生成的 JSON 作为授权。需要真实原子预算账本/跨请求持久状态，不能用无保护的 JS 全局对象跨工作进程假设唯一写者。

目标依赖方向：`GARR Extension → 现有 AgentScope Core/Model/Toolkit`；不得让 AgentScope Core 反向依赖扩展，或让 GARR 自行创造一套 Tool Permission。Frame 是受限任务单元，不等于每个 Frame 必须新建一个 Agent。所有 GraphContextRef 的读取应由可信 Provider 结合当前认证主体校验。

## 3. 语言调用示例

~~~typescript
// 已存在的可选 package export（详细类型以 index.ts 为准）
import { GarrPlanner } from '@agentscope-ai/agentscope/garr';
const decision = new GarrPlanner().plan(frame, graph);
if (decision.decision === 'split') {
  // P1: validate split, reserve budgets, execute isolated read-only agents
  console.log(decision.split_plan?.children.length);
}
~~~

示例中的规划结果不能直接当作外部写操作授权；`split` 的执行还需要冻结 GraphSnapshot、核查 Boundary Contract、预留 BudgetLease、提交可信 FrameExecutionContext，最后按独立验收义务 Join。

## 4. 协议与测试对接

**共享规范文件**：[统一 Wire Schema](schema/garr-wire-v0.1.schema.json) 与 [统一 Golden Fixture](fixtures/garr-v0.1-conformance.json)。任何 DTO 序列化映射均必须输出 `schema_version=garr/0.1`、固定的 snake_case 字段和枚举字符串；无能力的 ClientLite 返回 `unsupported_capability` 而不是默认 Direct。

**本语言当前执行命令：**

~~~text
node --experimental-strip-types --test packages/agentscope/tests/garr-conformance.node.test.mjs
~~~

**实际验证证据/限制：** Node24 命令执行 `garr-conformance.node.test.mjs`：**tests 10, pass 10, fail 0**。尚缺 `pnpm install` 的 node_modules，未运行完整 TS build/types/prod dist；这是 P0 行为验证，不是发布版 SDK 的构建验收。

所有新增实现需覆盖至少以下共同规则：GARR-001 单领域 Direct；GARR-002 不可靠证据门禁；GARR-003 Atomic vs Contractible；GARR-004 关系干预；GARR-006 版本/作用域；GARR-007 预算。后续必须补齐 GARR-005..014 的完整 Wire/Usage/Frame/权限/取消兼容矩阵，并与 Rust 相同 `policy_id` 做规范化逐字段对比。请保留失败报告，不得使用跳过测试冒充兼容。

## 5. 后续代码实施步骤（未完成不得勾选）

1. **P1-1**：从统一 Wire Schema 生成/手写运行时验证器，阻断未知执行枚举和权限字段；不能仅使用 TS 静态类型断言。
2. **P1-2**：安装依赖需用户授权或现有已缓存后执行 `pnpm --filter @agentscope-ai/agentscope build` 与 Jest/TypeScript 类型检查。
3. **P1/P2-3**：新增 Async FrameExecutor 与 AbortSignal 取消传播，防止 Promise 拒绝后继续启动子 Frame。
4. **P2-4**：实现 BudgetLease 原子预留/结算与 JoinVerifier，验证器回执不得来自模型自评。
5. **P2-5**：在 TinyClaw/其他应用中使用 `./garr` 可选能力，但产品 UI、Channel 和权限应维持在应用层。

对应的 OpenSpec/仓库任务台账应记录源码定位、真实测试命令、错误输出与行为证据。统一规范只作为共同语义合同，语言实施的 Done 标准独立于文档存在。

## 6. 最终验收与边界

要宣称 `full_engine`，必须证明：相同 `policy_id` 和相同 Task/GraphSnapshot/Budget，规划与 Frame 区分在共享 Fixture 中一致；能使用真实 BudgetLedger/Model Usage；Frame DAG 取消、超时、证据访问/租户隔离、JoinVerifier 均通过。要宣称 `frame_executor`，必须证明 Frame scope 和执行权限不越权；`client_lite` 必须有统一协议与失败路径。

**不在当前范围内**：TinyClaw UI/微信渠道/设备管理、Agent Fabric 的多租户控制面、学习型 Planner 的已验证性能收益，以及把调用关系推断为因果事实。
