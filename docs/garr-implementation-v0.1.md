# AgentScope TYPESCRIPT：GARR 统一规范适配入口

> **TYPESCRIPT 详细技术实现、源码与测试**：[GARR Implementation v0.1](garr/implementation-typescript-v0.1.md)。本入口仅是语言映射，完整公共规则以统一合同为准。

> **language-adapter-only** · 更新于 2026-10-28。**本文件没有独立的 GARR 架构与算法定义。**
>
> 跨语言**唯一规范**：**[GARR Unified Contract v0.1](garr/GARR-UNIFIED-CONTRACT-v0.1.md)**。规范唯一编辑源：`partme-docs/docs/standards/garr/GARR-UNIFIED-CONTRACT-v0.1.md`。本仓镜像必须与源文件 SHA-256 完全一致。

## 1. 当前实现状态

TypeScript P0 Planner 已实现，并通过 Node24 运行的 9 个统一 Golden Fixture；完整 tsup/pnpm 打包尚未验证。

## 2. 本仓特定适配（不改变公共语义）

复用 `packages/agentscope/src/agent/agent.ts`、`packages/agentscope/src/tool/toolkit.ts`；`Promise`、`AbortSignal`、TS discriminated union 只能是统一 `garr/0.1` DTO 的语言映射。可实现 `full_engine` 或 `frame_executor`，但**同 `policy_id` 时必须匹配同一组 Planner 黄金测试**。

所有语言的决策枚举、Proof Obligations、ConstraintCoupling、GraphSnapshot/Frame/预算/事件状态与错误语义**一律以统一规范为准**。本仓只能选择部署的 Capability Profile（`full_engine` / `frame_executor` / `client_lite`），不能自行发明第四种语义或把不支持的功能伪装为成功。

## 3. 验收、限制与持续维护

遵循本仓实际 pnpm/测试配置，补充结构化消息 Schema 运行时校验、取消和跨语言 Fixture；SDK 类型通过不等于 Wire 合规。

跨语言一致性的必要证明始终包括：文档字节一致、`garr/0.1` Golden Fixture 通过、真实运行环境验证，三者分别记录。统一规范修改先在 `partme-docs` 审议并同步镜像；语言仓的实际代码任务遵守本仓既有规格工作流。

## 4. 旧草案保存

原先各自撰写的方案已完整移至 [2026-10-28 本地草案归档](garr/archive/local-draft-2026-10-28.md)，**仅作为历史设计背景，不再具有规范效力**。其中若存在与统一规范相异的 Planner 策略、字段、拆分模式或架构定位，以统一规范为准；不得继续根据归档草案新增代码。
