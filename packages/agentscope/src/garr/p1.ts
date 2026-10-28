/** Same cross-language GARR P1 FrameExecutor + independent JoinVerifier contract. */
export type P1State = 'completed'|'partial'|'blocked'|'failed'|'cancelled';
export type Budget={tokens:number;model_calls:number;graph_reads:number};
export type Evidence={node_id:string;source_ref:string;graph_revision:string;excerpt:string};
export type Frame={frame_id:string;scope:string;graph_revision:string;goal:string;domains:string[];
  owned_nodes:string[];shared_read_only_nodes:string[];evidence:Evidence[];
  obligation_ids:string[];budget:Budget};
export type Plan={scope:string;graph_revision:string;frames:Frame[];join_obligations:string[];
  boundary_constraint_ids:string[];reserved_budget:Budget};
export type PortOutput={output:string;cited_evidence_refs:string[];measured_usage?:Budget};
export type Artifact={frame_id:string;scope:string;graph_revision:string;output:string;cited_evidence_refs:string[]};
export type Receipt={obligation_id:string;validator_id:string;evidence_ref:string;graph_revision:string};
export type Event={sequence:number;event_type:string;frame_id?:string};
export type Report={state:P1State;artifacts:Artifact[];receipts:Receipt[];missing_obligations:string[];
 events:Event[];usage_kind:'actual'|'upper_bound';error?:string};
export interface ReadOnlyPort{execute(frame:Frame,signal:AbortSignal):Promise<PortOutput>}
export interface ObligationVerifier{verify(id:string,artifacts:readonly Artifact[]):Promise<Receipt|undefined>|Receipt|undefined}
const valid=(b:Budget)=>!!b&&[b.tokens,b.model_calls,b.graph_reads].every(n=>Number.isSafeInteger(n)&&n>=0);
const covers=(a:Budget,b:Budget)=>a.tokens>=b.tokens&&a.model_calls>=b.model_calls&&a.graph_reads>=b.graph_reads;
function sum(a:Budget,b:Budget):Budget{
 const next={tokens:a.tokens+b.tokens,model_calls:a.model_calls+b.model_calls,graph_reads:a.graph_reads+b.graph_reads};
 if(!valid(next))throw Error('budget overflow');return next;
}
export class BudgetLedger{
 private remaining:Budget;private lease?:Budget;private settled=false;
 constructor(b:Budget){if(!valid(b))throw Error('invalid budget');this.remaining={...b}}
 reserve(b:Budget):boolean{
  if(!valid(b)||this.lease||this.settled||!covers(this.remaining,b))return false;
  this.lease={...b};
  this.remaining={tokens:this.remaining.tokens-b.tokens,model_calls:this.remaining.model_calls-b.model_calls,
                  graph_reads:this.remaining.graph_reads-b.graph_reads};
  return true;
 }
 settle(used:Budget):boolean{
  if(!this.lease||this.settled||!valid(used)||!covers(this.lease,used))return false;
  this.remaining=sum(this.remaining,{tokens:this.lease.tokens-used.tokens,
   model_calls:this.lease.model_calls-used.model_calls,graph_reads:this.lease.graph_reads-used.graph_reads});
  this.lease=undefined;this.settled=true;return true;
 }
 available():Budget{return {...this.remaining}}
}
function planError(plan:Plan):string|undefined{
 if(!plan?.scope?.trim()||!plan.graph_revision?.trim()||!plan.frames?.length||
 !plan.join_obligations?.length||!Array.isArray(plan.boundary_constraint_ids)||!valid(plan.reserved_budget))
  return 'invalid plan';
 const frames=new Set<string>();let needed:Budget={tokens:0,model_calls:0,graph_reads:0};
 for(const f of plan.frames){
  if(!f?.frame_id?.trim()||frames.has(f.frame_id)||f.scope!==plan.scope||f.graph_revision!==plan.graph_revision||
  !f.goal?.trim()||!f.domains?.length||!f.owned_nodes?.length||!Array.isArray(f.shared_read_only_nodes)||
  !Array.isArray(f.evidence)||!Array.isArray(f.obligation_ids)||!valid(f.budget))
   return 'duplicate frame or scope/revision mismatch';
  frames.add(f.frame_id);
  const nodes=new Set([...f.owned_nodes,...f.shared_read_only_nodes]);const refs=new Set<string>();
  for(const e of f.evidence){
   if(!e?.source_ref?.trim()||refs.has(e.source_ref)||!nodes.has(e.node_id)||e.graph_revision!==plan.graph_revision)
    return 'unauthorized/stale/duplicate evidence';
   refs.add(e.source_ref);
  }
  try{needed=sum(needed,f.budget)}catch{return 'budget overflow'}
 }
 if(!covers(plan.reserved_budget,needed)||plan.reserved_budget.tokens<=needed.tokens||
 plan.reserved_budget.model_calls<=needed.model_calls)return 'join/verify budget not reserved';
}
class Cancelled extends Error{constructor(){super('cancelled');this.name='AbortError'}}
class TimedOut extends Error{constructor(){super('timeout');this.name='TimeoutError'}}
class Unauthorized extends Error{constructor(){super('unapproved citation');this.name='UnauthorizedCitation'}}
async function executeBounded(port:ReadOnlyPort,frame:Frame,signal:AbortSignal,timeoutMs:number):Promise<PortOutput>{
 if(signal.aborted)throw new Cancelled();
 let timer:ReturnType<typeof setTimeout>|undefined;
 let remove=()=>{};
 try{
  const cancelled=new Promise<never>((_,reject)=>{
   const listener=()=>reject(new Cancelled());
   signal.addEventListener('abort',listener,{once:true});
   remove=()=>signal.removeEventListener('abort',listener);
   if(signal.aborted)reject(new Cancelled());
  });
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new TimedOut()),timeoutMs)});
  return await Promise.race([port.execute(frame,signal),cancelled,timeout]);
 }finally{remove();if(timer)clearTimeout(timer)}
}
export async function runP1(plan:Plan,port:ReadOnlyPort,checker:ObligationVerifier,
 signal:AbortSignal,timeoutMs=30_000):Promise<Report>{
 const artifacts:Artifact[]=[];const receipts:Receipt[]=[];const missing:string[]=[];const events:Event[]=[];
 let usage_kind:'actual'|'upper_bound'='actual';let state:P1State='partial';let error:string|undefined;
 const event=(event_type:string,frame_id?:string)=>events.push({sequence:events.length+1,event_type,...(frame_id?{frame_id}:{})});
 const report=():Report=>({state,artifacts,receipts,missing_obligations:missing,events,usage_kind,...(error?{error}:{})});
 event('run_started');
 if(signal.aborted){state='cancelled';event('run_cancelled');return report()}
 const problem=planError(plan);if(problem){state='blocked';error=problem;event('run_blocked');return report()}
 const ledger=new BudgetLedger(plan.reserved_budget);
 if(!ledger.reserve(plan.reserved_budget)){state='blocked';error='budget reserve failed';return report()}
 let spent:Budget={tokens:0,model_calls:0,graph_reads:0};
 try{
  for(const frame of plan.frames){
   if(signal.aborted)throw new Cancelled();
   event('frame_started',frame.frame_id);
   const out=await executeBounded(port,frame,signal,timeoutMs);
   const allowed=new Set(frame.evidence.map(e=>e.source_ref));
   if(!out||!Array.isArray(out.cited_evidence_refs)||out.cited_evidence_refs.some(ref=>!allowed.has(ref)))
    throw new Unauthorized();
   if(out.measured_usage){spent=sum(spent,out.measured_usage);if(!covers(plan.reserved_budget,spent))throw Error('usage exceeded reserved budget')}
   else usage_kind='upper_bound';
   artifacts.push({frame_id:frame.frame_id,scope:frame.scope,graph_revision:frame.graph_revision,
    output:out.output,cited_evidence_refs:[...out.cited_evidence_refs]});
   event('frame_completed',frame.frame_id);
  }
  const obligations=new Set([...plan.join_obligations,...plan.boundary_constraint_ids.map(id=>'contract:'+id)]);
  for(const id of obligations){
   const r=await checker.verify(id,artifacts);
   if(r?.obligation_id===id&&r.graph_revision===plan.graph_revision&&r.validator_id?.trim()&&r.evidence_ref?.trim())
    receipts.push(r);else missing.push(id);
  }
  event('join_verified');
  state=missing.length?'partial':'completed';
  if(state==='completed')event('run_completed');
 }catch(e){
  if(signal.aborted||e instanceof Cancelled){state='cancelled';event('run_cancelled')}
  else if(e instanceof Unauthorized){state='blocked';error=String(e);event('run_blocked')}
  else{state='failed';error=String(e);event('frame_failed')}
 }finally{
  const used=usage_kind==='actual'&&(state==='completed'||state==='partial')?spent:plan.reserved_budget;
  if(!ledger.settle(used)){state='blocked';error='budget settlement failed';event('run_blocked')}
  if(state==='cancelled'||state==='failed'||state==='blocked')usage_kind='upper_bound';
 }
 return report();
}
