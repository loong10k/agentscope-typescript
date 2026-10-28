import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GarrPlanner } from '../src/garr/index.ts';

const fixture = JSON.parse(fs.readFileSync(
  new URL('../../../docs/garr/fixtures/garr-v0.1-conformance.json', import.meta.url), 'utf8'));
const planner = new GarrPlanner();
const task = fixture.default_task;
const budgets = fixture.default_budget;
const budget = (b) => ({ tokens: b.max_tokens, model_calls: b.max_model_calls, graph_reads: b.max_graph_reads });
const getGraph = (g) => fixture.graph_fixtures[g];
for (const item of fixture.cases) {
  test(item.case_id + ' common graph action', () => {
    const graph = getGraph(item.graph_ref);
    const over = item.overrides || {};
    const f = { ...task, ...(over.task || {}) };
    const bud = { ...budgets, ...(over.budget || {}) };
    const result = planner.plan({
      scope: f.scope, graph_revision: f.graph_revision,
      goal: f.goal, phase: f.phase, anchors: f.anchors,
      obligations: f.obligation_refs, budget: budget(bud), depth: f.depth,
    }, graph);
    assert.equal(result.decision, item.expected.decision);
    if (item.expected.child_frames != null) assert.equal(result.split_plan?.children.length ?? 0, item.expected.child_frames);
    if (item.expected.child_domains) assert.deepEqual(result.split_plan?.children.map(x => x.domains), item.expected.child_domains);
    if (item.expected.boundary_contract_refs) assert.deepEqual(result.split_plan?.boundary_contracts.map(x => x.constraint_id), item.expected.boundary_contract_refs);
  });
}
