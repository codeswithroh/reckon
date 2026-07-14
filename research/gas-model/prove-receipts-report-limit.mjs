// Two facts to establish Monad's gas model definitively:
//  Q1: Does receipt.gasUsed == tx.gas (limit) for all txs? (receipt reports the CHARGED limit)
//  Q2: Is ACTUAL execution gas (from debug_traceTransaction/callTracer) < tx.gas?
//      If yes while charge==limit, users provably overpay and failed txs pay the full limit.
import { createPublicClient, http, formatEther } from 'viem';
const RPC = 'https://testnet-rpc.monad.xyz';
const client = createPublicClient({ transport: http(RPC) });
async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const H = (h) => BigInt(h);

async function main() {
  const latest = Number(await client.getBlockNumber());
  // collect ~40 recent txs across blocks
  const txs = [];
  for (let bn = latest; bn > latest - 400 && txs.length < 40; bn--) {
    let receipts; try { receipts = await rpc('eth_getBlockReceipts', ['0x' + bn.toString(16)]); } catch { continue; }
    if (!receipts) continue;
    for (const rc of receipts) { txs.push({ bn, rc }); if (txs.length >= 40) break; }
  }
  console.log(`Collected ${txs.length} recent txs\n`);

  // Q1: receipt.gasUsed vs tx.gas
  let eq = 0, neq = 0;
  const traceTargets = [];
  for (const { rc } of txs) {
    const tx = await rpc('eth_getTransactionByHash', [rc.transactionHash]);
    const limit = H(tx.gas), used = H(rc.gasUsed);
    if (limit === used) eq++; else neq++;
    if (traceTargets.length < 8) traceTargets.push({ hash: rc.transactionHash, tx, rc, limit, used });
  }
  console.log(`Q1 — receipt.gasUsed == tx.gas(limit):  equal=${eq}  notEqual=${neq}  (of ${txs.length})`);
  console.log(`     => ${eq === txs.length ? 'ALWAYS equal: receipt reports the CHARGED LIMIT, not actual usage' : 'not always equal'}\n`);

  // Q2: actual execution gas via callTracer, vs the charged limit
  console.log('Q2 — actual execution gas (trace) vs charged limit:');
  let overpayFound = 0;
  for (const t of traceTargets) {
    let trace;
    try { trace = await rpc('debug_traceTransaction', [t.hash, { tracer: 'callTracer' }]); }
    catch (e) { console.log(`  ${t.hash.slice(0,12)}… trace unavailable (${e.message.slice(0,40)})`); continue; }
    const realGas = trace && trace.gasUsed ? H(trace.gasUsed) : null;
    const price = H(t.rc.effectiveGasPrice);
    const status = t.rc.status === '0x1' ? 'OK' : 'REVERT';
    if (realGas == null) { console.log(`  ${t.hash.slice(0,12)}… no gasUsed in trace`); continue; }
    const overpayWei = (t.limit - realGas) * price;
    const ratio = Number(t.limit) / Number(realGas);
    if (t.limit > realGas) overpayFound++;
    console.log(`  ${t.hash.slice(0,12)}… ${status.padEnd(6)} limit=${t.limit} realExec=${realGas} ` +
      `(${ratio.toFixed(2)}x)  overpaid=${formatEther(overpayWei)} MON`);
  }
  console.log(`\nSUMMARY: charged-limit-reported-as-gasUsed=${eq === txs.length}; ` +
    `txs where charged limit > actual execution gas: ${overpayFound}/${traceTargets.length}`);
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
