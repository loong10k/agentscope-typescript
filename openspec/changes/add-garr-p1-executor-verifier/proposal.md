# Add native GARR P1 FrameExecutor and JoinVerifier (typescript)

## Why
GARR P0 Typed Graph/CPARP decision is present, but applications need an actual bounded read-only Frame execution and trusted Join verification stage, consistent across all seven AgentScope languages.

## What Changes
- Apply exact cross-language contract from docs/garr/GARR-P1-EXECUTION-VERIFICATION-v0.1.md and shared 10-case P1 fixture.
- Add language-native FrameRequest/Evidence/Artifact/Receipt/RunState/BudgetLedger and FrameExecutor/JoinVerifier adapters, preserving existing ReAct/Toolkit boundary.
- Add tests for authorized completion, partial proof, cross-scope, duplicate frames, forged citations, cancellation, model failure/timeout and double settlement.
- Keep Zig/C++ hardware profile bounded and explicitly unsupported when capacity exceeds. Do not auto-grant device permissions.
- Document real status; require separate target build and runtime evidence for full platform claims.

## Capabilities
### New Capabilities
- `garr-p1-frame-execution`: unified read-only execution/verification contract.
### Modified Capabilities
None. Existing AgentScope Core/Model/Tool/Harness semantics MUST remain backward compatible.

## Impact
Language: typescript. See docs/garr/P1-implementation-typescript-v0.1.md for concrete API, source, build and remaining limitations. Never edit deprecated agentscope-runtime-*.
