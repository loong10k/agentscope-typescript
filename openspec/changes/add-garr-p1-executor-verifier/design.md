# GARR P1 typescript implementation contract

Single semantic contract: docs/garr/GARR-P1-EXECUTION-VERIFICATION-v0.1.md.
Single fixture: docs/garr/fixtures/garr-p1-contract-v0.1.json.
P0 Planner: docs/garr/GARR-UNIFIED-CONTRACT-v0.1.md.

## Implementation boundaries
FrameExecutor accepts only validated read-only scope/revision/evidence; it is not an extra full-permission ReAct loop. Exactly one frame belongs to one BudgetLease, and a Frame is not always an Agent. The host controls permissions and independently verifies obligations.

Decision -> input scope/evidence gate -> reserve -> frame read-only port -> artifact+citations -> independent receipts -> Join -> typed terminal state/usage. Model output contains no implicit verifier.

Language-specific threading, API names, fixed-memory representation and test commands are detailed in docs/garr/P1-implementation-typescript-v0.1.md. Do not use this design note to create an alternate Planner.

## Test gate
GARR-P1-01..10 must be implemented in native tests; genuine platform compilation is required before claiming pass. Reports must distinguish mock/ReAct API/host and real provider/device.

## Known gaps
Real persistent GraphContextProvider, cross-process lease recovery, provider-confirmed abort, true production verification receipts and wire runtime protocol serialization are pending.
