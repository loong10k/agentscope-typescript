# AgentScope TypeScript × GARR 实施设计 v0.1

> **设计草案，未实现。** 2026-10-28。本文覆盖 TypeScript AgentScope 框架适配；TinyClaw/OpenClaw 风格的产品界面与实际用户路由应在产品仓库。历史 agentscope-runtime-* 不再是目标。

## 1. 实际接入点与职责

本仓 packages/agentscope/src/agent/agent.ts、packages/agentscope/src/tool/toolkit.ts 已提供框架抽象。建议在 packages/agentscope/src/extension/garr/ 或独立可选包中提供类型定义与 Client/Executor Adapter，**不改写现有 Agent/Tool 实现**。生产中可以通过 garr/0.1 协议调用 Rust/服务端 Planner；本地轻量 Direct/Probe 可以按需提供，避免再实现一套无边界的递归 AgentLoop。

~~~mermaid
flowchart LR
  T[TinyClaw TS / 产品] --> R[Reasoning Router]
  R --> G[GarrClient / GraphProvider]
  G --> P[Planner（远程或受限本地）]
  P --> A[现有 Agent / Toolkit]
  A --> V[Evidence/Join/Usage]
~~~

## 2. TypeScript 类型契约

~~~typescript
// 设计目标，不是当前源码的已导出 API
export type GarrDecision =
  | { kind: "direct" }
  | { kind: "probe"; queries: GraphQuery[] }
  | { kind: "verify"; obligations: string[] }
  | { kind: "split"; plan: SplitPlan }
  | { kind: "blocked"; reason: string };

export interface GarrFrameRef {
  runId: string;
  frameId: string;
  graphRevision: string;
  depth: number;
}
export interface GraphContextProvider {
  snapshot(scope: string, signal?: AbortSignal): Promise<GraphSnapshotRef>;
  query(ref: GraphSnapshotRef, query: GraphQuery, signal?: AbortSignal): Promise<GraphSlice>;
}
~~~

Wire JSON 统一使用 schema_version=garr/0.1；TypeScript camelCase 仅用于 SDK 对象，序列化层明确 snake_case 映射。网络输入必须校验实际 Schema、长度、合法的 EdgeKind/Decision/ConstraintKind；不能把 TS 类型断言当成运行时授权。AbortSignal 与事件订阅应能停止未完成子 Frame，预算和 graph revision 必须从受信运行时派生。

## 3. 功能边界与验收

类型化图关系、Proof Obligations、Inherited/Contractible/Atomic 约束应实际影响计划选择，不仅拼进 Prompt。重要节点可作为共享只读上下文引用；缺证据优先 Probe，跨 Frame 的 BoundaryContract 必须由 JoinVerifier 检查。任何文件写入、网络发送、浏览器控制仍交由现有 Tool/Permission/HITL 或 TinyClaw 产品宿主，不允许 GARR 绕过。

T0：协议类型、fixture 与错误处理；T1：Agent/Toolkit 只读 FrameExecutor 适配；T2：跨语言事件/取消/预算联调；T3：文档示例与已有 SDK 回归。测试覆盖简单 Direct、证据 Probe、Atomic 图干预、预算、取消和权限拒绝；UI 演示不能替代真实框架行为证据。
