// Empirically verify: does a REVERTED tx on Monad testnet charge the full gas_limit?
// Method: find a recent reverted tx with value==0 that is the sender's only tx in its block,
// then compare the sender's real balance delta (block-1 -> block) against
// gasLimit*price vs gasUsed*price. Uses only read RPC calls. No spend.
import { createPublicClient, http, formatEther } from 'viem';

const RPC = 'https://testnet-rpc.monad.xyz';
const client = createPublicClient({ transport: http(RPC) });

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const hexToBig = (h) => BigInt(h);

async function main() {
  const latest = Number(await client.getBlockNumber());
  // stay within retained-state window (~ a few thousand blocks); scan newest-first
  const SCAN = 4000;
  console.log(`latest=${latest}, scanning up to ${SCAN} blocks back for reverted txs...`);

  const CONC = 12;
  let found = null;
  for (let start = latest; start > latest - SCAN && !found; start -= CONC) {
    const batch = [];
    for (let b = start; b > start - CONC && b > latest - SCAN; b--) batch.push(b);
    const results = await Promise.all(batch.map(async (bn) => {
      try {
        const receipts = await rpc('eth_getBlockReceipts', ['0x' + bn.toString(16)]);
        if (!receipts) return null;
        const reverted = receipts.filter((r) => r.status === '0x0');
        return reverted.length ? { bn, receipts, reverted } : null;
      } catch { return null; }
    }));
    for (const r of results) {
      if (!r) continue;
      // find a clean candidate: sender has exactly one tx in this block, value 0
      for (const rc of r.reverted) {
        const tx = await rpc('eth_getTransactionByHash', [rc.transactionHash]);
        if (!tx) continue;
        if (hexToBig(tx.value) !== 0n) continue;
        const from = tx.from.toLowerCase();
        const sameSender = r.receipts.filter((x) => (x.from || '').toLowerCase() === from);
        if (sameSender.length !== 1) continue; // avoid multi-tx-from-sender blocks
        found = { bn: r.bn, tx, rc };
        break;
      }
      if (found) break;
    }
  }

  if (!found) { console.log('No clean reverted tx found in scan window.'); return; }

  const { bn, tx, rc } = found;
  const gasLimit = hexToBig(tx.gas);
  const gasUsed = hexToBig(rc.gasUsed);
  const price = hexToBig(rc.effectiveGasPrice);
  const from = tx.from;

  const balBefore = hexToBig(await rpc('eth_getBalance', [from, '0x' + (bn - 1).toString(16)]));
  const balAfter = hexToBig(await rpc('eth_getBalance', [from, '0x' + bn.toString(16)]));
  const delta = balBefore - balAfter;

  const feeIfLimit = gasLimit * price;
  const feeIfUsed = gasUsed * price;

  console.log('\n===== REVERTED TX EVIDENCE =====');
  console.log('block            :', bn);
  console.log('txHash           :', rc.transactionHash);
  console.log('from             :', from);
  console.log('status           :', rc.status, '(0x0 = reverted)');
  console.log('value            :', formatEther(hexToBig(tx.value)), 'MON');
  console.log('gasLimit         :', gasLimit.toString());
  console.log('gasUsed (receipt):', gasUsed.toString());
  console.log('effectiveGasPrice:', price.toString());
  console.log('---');
  console.log('actual balance delta (before-after):', delta.toString(), 'wei =', formatEther(delta), 'MON');
  console.log('fee IF charged on gasLimit          :', feeIfLimit.toString(), 'wei =', formatEther(feeIfLimit), 'MON');
  console.log('fee IF charged on gasUsed           :', feeIfUsed.toString(), 'wei =', formatEther(feeIfUsed), 'MON');
  console.log('---');
  const matchesLimit = delta === feeIfLimit;
  const matchesUsed = delta === feeIfUsed;
  console.log('delta == gasLimit*price ?', matchesLimit);
  console.log('delta == gasUsed*price  ?', matchesUsed);
  const ratio = Number(gasLimit) / Number(gasUsed);
  console.log(`gasLimit/gasUsed ratio  : ${ratio.toFixed(2)}x`);
  console.log('\nVERDICT:',
    matchesLimit && !matchesUsed ? 'CONFIRMED — reverted tx charged the FULL gas LIMIT (overpaid ' + (ratio).toFixed(1) + 'x vs used)'
    : matchesUsed && !matchesLimit ? 'CONTRADICTED — reverted tx charged only gas USED'
    : gasLimit === gasUsed ? 'INCONCLUSIVE — limit==used for this tx; need one where they differ'
    : 'UNCLEAR — delta matches neither exactly (other same-block effects?)');
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
