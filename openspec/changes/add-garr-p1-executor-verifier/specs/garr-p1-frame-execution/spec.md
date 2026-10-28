# GARR P1 FrameExecutor / Independent Verifier (uniform cross-language delta)

## ADDED Requirements

### Requirement: Frame must be authorized and validated before model execution
All P1 implementations SHALL reject empty/duplicate Frame ID, mismatched scope or revision, stale/duplicate EvidenceRef and unapproved node scope before calling any FramePort.

#### Scenario: Cross-tenant or forged evidence reference
- **WHEN** any Frame has incorrect scope/revision or evidence node outside owned/shared nodes
- **THEN** the run SHALL return blocked with zero model calls

### Requirement: Only a read-only AgentScope port may execute P1 frames
FrameExecutor SHALL use existing AgentScope Agent/Model/Toolkit or an injected read-only host callback. It SHALL NOT create an unrestricted tool execution loop or allow model output to grant rights.

#### Scenario: Port error or timeout
- **WHEN** a frame's read-only port errors or times out
- **THEN** subsequent frames SHALL not start and the run SHALL fail

### Requirement: Independent receipts decide verification
Join SHALL evaluate all root obligations plus contract-boundary obligations against trusted registered validators. Model text SHALL never create VerificationReceipt.

#### Scenario: Missing proof
- **WHEN** output claims to have passed but an obligation lacks an independent verifier receipt
- **THEN** the run SHALL be partial, never completed

### Requirement: Budget and cancellation are bounded
BudgetLedger SHALL atomically reserve before running, reject duplicate/over-limit settlement, and conservatively charge upper bound for unknown use. Cancellation before start SHALL call no port, and cancellation while running SHALL prohibit further frames.

#### Scenario: Cancel before execution
- **WHEN** cancel is signaled before calling the FrameExecutor
- **THEN** the run SHALL be cancelled and zero frames SHALL execute

### Requirement: A constrained device declares unsupported capability explicitly
Zig/C++ bounded P1 clients SHALL reject over-capacity tasks and SHALL not claim to preempt a blocking hardware callback unless a real cancellation port exists.

#### Scenario: Frame count exceeds device limit
- **WHEN** requested frames exceed the device's declared maximum
- **THEN** the run SHALL return unsupported_capability and shall not invoke its Port

### Requirement: Seven SDKs keep one shared source-of-truth
Each implementation SHALL reference the same GARR-P1-EXECUTION-VERIFICATION-v0.1.md and its fixture file. Language adaptation MUST NOT redefine statuses or validation rules.

#### Scenario: Language implementation is not buildable on current machine
- **WHEN** platform toolchain is unavailable
- **THEN** build/test remains not_run, not falsely passed
