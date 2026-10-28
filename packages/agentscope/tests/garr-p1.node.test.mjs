import test from 'node:test';
import assert from 'node:assert/strict';
import { runP1, BudgetLedger } from '../src/garr/p1.ts';

const budget = { tokens: 1000, model_calls: 1, graph_reads: 1 };
const frame = (id, domain) => ({
    frame_id: id, scope: 'tenant/a', graph_revision: 'git:abc',
    goal: 'read-only analysis', domains: [domain],
    owned_nodes: [domain], shared_read_only_nodes: [],
    evidence: [{ node_id: domain, source_ref: 'source://' + domain,
        graph_revision: 'git:abc', excerpt: 'trusted source' }],
    obligation_ids: ['verify:' + domain], budget,
});
const plan = () => ({
    scope: 'tenant/a', graph_revision: 'git:abc',
    frames: [frame('root:0', 'order'), frame('root:1', 'payment')],
    join_obligations: ['state-validity', 'refund-consistency'],
    boundary_constraint_ids: ['refund-policy'],
    reserved_budget: { tokens: 3000, model_calls: 3, graph_reads: 3 },
});
const verifier = (missing = false) => ({
    verify(id) {
        if (missing && id.startsWith('contract:')) return undefined;
        return { obligation_id: id, validator_id: 'trusted-fixture-checker',
            evidence_ref: 'test://proof/' + id, graph_revision: 'git:abc' };
    },
});
const port = calls => ({
    async execute(f) {
        calls.count++;
        return { output: 'model claims all tests passed (unverified)', cited_evidence_refs: ['source://' + f.domains[0]],
            measured_usage: { tokens: 100, model_calls: 1, graph_reads: 0 } };
    },
});
const run = async (p, x = port({ count: 0 }), v = verifier(), cancel = new AbortController()) =>
    runP1(p, x, v, cancel.signal, 20);

test('GARR-P1-01 successful join requires independent trusted receipts', async () => {
    const calls = { count: 0 };
    const r = await run(plan(), port(calls));
    assert.equal(r.state, 'completed');
    assert.equal(r.receipts.length, 3);
    assert.equal(calls.count, 2);
    assert.equal(r.usage_kind, 'actual');
    assert.equal(r.events.at(-1).event_type, 'run_completed');
    assert.ok(r.events.every((e, i) => e.sequence === i + 1));
});
test('GARR-P1-02 no proof receipt means partial', async () => {
    const r = await run(plan(), port({ count: 0 }), verifier(true));
    assert.equal(r.state, 'partial');
    assert.deepEqual(r.missing_obligations, ['contract:refund-policy']);
});
test('GARR-P1-03 scope/revision mismatch blocks before first call', async () => {
    const c = { count: 0 }; const p = plan();
    p.frames[0].scope = 'tenant/b';
    assert.equal((await run(p, port(c))).state, 'blocked');
    assert.equal(c.count, 0);
    const q = plan(); q.frames[0].evidence[0].graph_revision = 'git:old';
    assert.equal((await run(q, port(c))).state, 'blocked');
    assert.equal(c.count, 0);
});
test('GARR-P1-04 duplicate frame blocked', async () => {
    const p = plan(); p.frames[1].frame_id = p.frames[0].frame_id;
    assert.equal((await run(p)).state, 'blocked');
});
test('GARR-P1-05 evidence outside frame/citations rejected', async () => {
    const p = plan(); p.frames[0].evidence[0].node_id = 'other';
    assert.equal((await run(p)).state, 'blocked');
    const evil = { async execute() {
        return { output: 'forged', cited_evidence_refs: ['source://other'], measured_usage: budget };
    } };
    assert.equal((await run(plan(), evil)).state, 'blocked');
});
test('GARR-P1-06 cancelled before execution -> zero model calls', async () => {
    const c = { count: 0 }; const ac = new AbortController(); ac.abort();
    assert.equal((await run(plan(), port(c), verifier(), ac)).state, 'cancelled');
    assert.equal(c.count, 0);
});
test('GARR-P1-07 port error/timeout never reported as success', async () => {
    const failed = { async execute() { throw Error('model failed'); } };
    assert.equal((await run(plan(), failed)).state, 'failed');
    const never = { execute() { return new Promise(() => {}); } };
    assert.equal((await run(plan(), never)).state, 'failed');
});
test('GARR-P1-08 boundary contract must be independently checked', async () => {
    const r = await run(plan(), port({ count: 0 }), verifier(true));
    assert.equal(r.state, 'partial');
});
test('GARR-P1-09 BudgetLedger rejects reuse/excess', () => {
    const ledger = new BudgetLedger({ tokens: 1000, model_calls: 2, graph_reads: 2 });
    assert.equal(ledger.reserve({ tokens: 800, model_calls: 2, graph_reads: 2 }), true);
    assert.equal(ledger.reserve({ tokens: 1, model_calls: 1, graph_reads: 0 }), false);
    assert.equal(ledger.settle({ tokens: 900, model_calls: 2, graph_reads: 2 }), false);
    assert.equal(ledger.settle({ tokens: 500, model_calls: 1, graph_reads: 1 }), true);
    assert.equal(ledger.settle({ tokens: 1, model_calls: 0, graph_reads: 0 }), false);
    assert.equal(ledger.available().tokens, 500);
    const p = plan(); p.reserved_budget = { tokens: 2000, model_calls: 2, graph_reads: 2 };
    return run(p).then(r => assert.equal(r.state, 'blocked'));
});
test('GARR-P1 cancellation interrupts waiting, does not start next frame', async () => {
    const ac = new AbortController();let calls = 0;
    const slow = { execute() { calls++; return new Promise(() => {}); } };
    setTimeout(() => ac.abort(), 2);
    const r = await runP1(plan(), slow, verifier(), ac.signal, 100);
    assert.equal(r.state, 'cancelled');
    assert.equal(calls, 1);
});
