/**
 * AgentScope GARR CPARP/0.1 — same reference policy as agentscope-rust / Java.
 * No model calls, no tool side effects, no permissions granted by graph context.
 */
export type EdgeKind =
  | 'implements' | 'calls' | 'reads' | 'writes' | 'depends_on'
  | 'constrained_by' | 'verified_by' | 'precedes' | 'conflicts_with'
  | 'hypothesized_affects';
export type Evidence = 'observed' | 'verified' | 'proposed' | 'disputed' | 'stale';
export type Coupling = 'inherited' | 'contractible' | 'atomic';
export type Phase = 'analyze' | 'design' | 'implement' | 'verify';
export type Action = 'direct' | 'probe' | 'verify' | 'split' | 'blocked';

export interface GraphNode {
  node_id: string;
  domain: string;
  node_kind: 'domain' | 'component' | 'code_symbol' | 'state_machine' | 'rule' | 'test' | 'resource';
}
export interface GraphEdge {
  from: string;
  to: string;
  edge_kind: EdgeKind;
  evidence_state: Evidence;
  evidence_refs?: string[];
}
export interface GraphConstraint {
  constraint_id: string;
  scope_nodes: string[];
  coupling: Coupling;
  evidence_state: Evidence;
  validator_ref?: string;
  phases?: Phase[];
}
export interface Snapshot {
  scope: string;
  revision: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  constraints: GraphConstraint[];
}
export interface Budget { tokens: number; model_calls: number; graph_reads: number; }
export interface Frame {
  scope: string; graph_revision: string; goal: string; phase: Phase;
  anchors: string[]; obligations: string[]; budget: Budget; depth: number;
}
export interface Child {
  domains: string[]; owned_nodes: string[]; shared_read_only_nodes: string[];
  obligations: string[]; budget: Budget;
}
export interface SplitPlan {
  mode: 'and'; children: Child[];
  boundary_contracts: { constraint_id: string; validator_ref: string }[];
  join_obligations: string[]; required_budget: Budget;
}
export interface Decision {
  decision: Action; reason_code: string; visited_nodes: string[];
  constraint_ids: string[]; targets?: string[];
  direct_score?: number; split_score?: number; split_plan?: SplitPlan;
}

/** UTF-8 byte order, not JavaScript UTF-16 code-unit order. GARR-015. */
const garrUtf8Compare = (a: string, b: string): number => {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
};

export class GarrPlanner {
  readonly policy_id = 'garr-cparp-0.1';
  readonly maxGraphDepth = 2;
  readonly maxNodes = 120;
  readonly maxChildren = 3;
  readonly maxRecursionDepth = 1;
  readonly minimumSplitGain = 10;
  readonly childBudget: Budget = { tokens: 1800, model_calls: 2, graph_reads: 2 };

  plan(frame: Frame, graph: Snapshot): Decision {
    const visited = new Set<string>();
    const activeConstraints = new Set<string>();
    const decide = (decision: Action, reason_code: string, extras: Partial<Decision> = {}): Decision => ({
      decision, reason_code, visited_nodes: [...visited].sort(garrUtf8Compare),
      constraint_ids: [...activeConstraints].sort(garrUtf8Compare), ...extras,
    });
    const nodes = new Map(graph.nodes.map(node => [node.node_id, node]));
    if (!graph.scope || !graph.revision || frame.scope !== graph.scope || frame.graph_revision !== graph.revision ||
        frame.anchors.length === 0 || frame.anchors.some(id => !nodes.has(id)) ||
        graph.edges.some(edge => !nodes.has(edge.from) || !nodes.has(edge.to)) ||
        graph.constraints.some(c => c.scope_nodes.length === 0 || c.scope_nodes.some(id => !nodes.has(id)))) {
      return decide('blocked', 'snapshot_mismatch');
    }
    const queue = frame.anchors.map(id => ({ id, depth: 0 }));
    frame.anchors.forEach(id => visited.add(id));
    if (visited.size > this.maxNodes) return decide('blocked', 'constraint_unresolved');

    for (let i = 0; i < queue.length; i++) {
      const { id, depth } = queue[i];
      if (depth >= this.maxGraphDepth) continue;
      for (const edge of graph.edges) {
        let next: string | undefined;
        if (edge.from === id && this.forward(edge.edge_kind, frame.phase)) next = edge.to;
        else if (edge.to === id && this.reverse(edge.edge_kind, frame.phase)) next = edge.from;
        if (next && !visited.has(next)) {
          visited.add(next);
          if (visited.size > this.maxNodes) return decide('blocked', 'constraint_unresolved');
          queue.push({ id: next, depth: depth + 1 });
        }
      }
    }
    // Hard-constraint closure is independent of the limited relation traversal depth.
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of graph.constraints) {
        if (!(c.phases?.length ? c.phases.includes(frame.phase) : true) ||
            !c.scope_nodes.some(id => visited.has(id))) continue;
        for (const id of c.scope_nodes) if (!visited.has(id)) {
          visited.add(id); changed = true;
          if (visited.size > this.maxNodes) return decide('blocked', 'constraint_unresolved');
        }
      }
    }
    const active = graph.constraints.filter(c =>
      (!c.phases?.length || c.phases.includes(frame.phase)) &&
      c.scope_nodes.some(id => visited.has(id)));
    active.forEach(c => activeConstraints.add(c.constraint_id));
    const probes = new Set<string>(), disputes = new Set<string>();
    for (const e of graph.edges) {
      if (!visited.has(e.from) || !visited.has(e.to)) continue;
      const ref = e.evidence_refs?.[0] ?? `${e.from}->${e.to}`;
      if (e.evidence_state === 'disputed') disputes.add(ref);
      if (e.evidence_state === 'proposed' || e.evidence_state === 'stale') probes.add(ref);
    }
    for (const c of active) {
      if (c.evidence_state === 'disputed') disputes.add(c.constraint_id);
      if (c.evidence_state === 'proposed' || c.evidence_state === 'stale') probes.add(c.constraint_id);
    }
    if (disputes.size) return decide('verify', 'conflicting_evidence', { targets: [...disputes].sort(garrUtf8Compare) });
    if (probes.size) return decide('probe', 'insufficient_evidence', { targets: [...probes].sort(garrUtf8Compare) });
    if (frame.depth >= this.maxRecursionDepth) return decide('direct', 'depth_limit');

    const domains = new Map<string, Set<string>>();
    for (const id of visited) {
      const node = nodes.get(id)!;
      if (node.node_kind === 'test' || node.node_kind === 'rule') continue;
      if (!domains.has(node.domain)) domains.set(node.domain, new Set());
      domains.get(node.domain)!.add(id);
    }
    if (domains.size < 2) return decide('direct', 'single_domain');
    const parent = new Map([...domains.keys()].map(key => [key, key]));
    const root = (id: string): string => {
      let cur = id;
      while (parent.get(cur) !== cur) cur = parent.get(cur)!;
      return cur;
    };
    if (frame.phase === 'implement') for (const c of active) {
      if (c.coupling !== 'atomic') continue;
      const affected = [...domains.entries()].filter(([, group]) => c.scope_nodes.some(id => group.has(id))).map(([name]) => name).sort(garrUtf8Compare);
      for (let i = 1; i < affected.length; i++) {
        const a = root(affected[0]), b = root(affected[i]);
        if (a !== b) parent.set(garrUtf8Compare(a,b) < 0 ? b : a, garrUtf8Compare(a,b) < 0 ? a : b);
      }
    }
    const groupNodes = new Map<string, Set<string>>();
    const groupDomains = new Map<string, Set<string>>();
    for (const [domain, ns] of [...domains.entries()].sort(([a], [b]) => garrUtf8Compare(a,b))) {
      const r = root(domain);
      if (!groupNodes.has(r)) { groupNodes.set(r, new Set()); groupDomains.set(r, new Set()); }
      ns.forEach(id => groupNodes.get(r)!.add(id));
      groupDomains.get(r)!.add(domain);
    }
    const k = groupNodes.size;
    if (k < 2 || k > this.maxChildren) return decide('direct', 'partition_count');
    const groupKeys = [...groupNodes.keys()].sort(garrUtf8Compare);
    const owner = new Map<string, number>();
    groupKeys.forEach((key, i) => groupNodes.get(key)!.forEach(id => owner.set(id, i)));
    const shared = new Set([...visited].filter(id => !owner.has(id)));
    const contracts: SplitPlan['boundary_contracts'] = [];
    for (const c of active) {
      const owners = new Set(c.scope_nodes.map(id => owner.get(id)).filter((v): v is number => v != null));
      if (owners.size < 2) continue;
      if (c.coupling === 'contractible') {
        if (!c.validator_ref?.trim()) return decide('probe', 'missing_boundary_validator', { targets: [c.constraint_id] });
        contracts.push({ constraint_id: c.constraint_id, validator_ref: c.validator_ref });
      }
      c.scope_nodes.forEach(id => shared.add(id));
    }
    const cross = graph.edges.filter(e => visited.has(e.from) && visited.has(e.to) &&
      owner.has(e.from) && owner.has(e.to) && owner.get(e.from) !== owner.get(e.to)).length;
    const n = visited.size, c = contracts.length;
    const direct_score = 25 + 6 * n + 85 * k + 4 * cross;
    const split_score = 25 + 6 * n + 30 * k + 26 * cross + 18 * c + 30;
    const required_budget = { tokens: 300 + 1800 * k + 900 + 700,
      model_calls: 2 * k + 2, graph_reads: 2 * k + 4 };
    const scores = { direct_score, split_score };
    if (frame.budget.tokens < required_budget.tokens || frame.budget.model_calls < required_budget.model_calls ||
        frame.budget.graph_reads < required_budget.graph_reads)
      return decide('direct', 'budget_insufficient', scores);
    if (Math.max(0, direct_score - split_score) < this.minimumSplitGain)
      return decide('direct', 'nonpositive_gain', scores);
    const children: Child[] = groupKeys.map(key => {
      const owned_nodes = [...groupNodes.get(key)!].sort(garrUtf8Compare);
      const shared_read_only_nodes = [...shared].filter(id => !groupNodes.get(key)!.has(id)).sort(garrUtf8Compare);
      const ds = [...groupDomains.get(key)!].sort(garrUtf8Compare);
      return { domains: ds, owned_nodes, shared_read_only_nodes,
        obligations: [`domain-analysis:${ds.join('+')}`], budget: this.childBudget };
    });
    return decide('split', 'split_positive_net_value',
      { ...scores, split_plan: { mode: 'and', children, boundary_contracts: contracts,
        join_obligations: frame.obligations, required_budget } });
  }

  private forward(kind: EdgeKind, phase: Phase): boolean {
    return kind !== 'precedes' || phase === 'implement';
  }
  private reverse(kind: EdgeKind, phase: Phase): boolean {
    return kind === 'implements' || kind === 'depends_on' || kind === 'constrained_by' ||
      kind === 'conflicts_with' || (kind === 'writes' && phase === 'implement');
  }
}
