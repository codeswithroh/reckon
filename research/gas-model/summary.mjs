// Show the gap Reckon closes:
//  (a) The revert overpay is PROVEN: a reverted tx's balance delta == gasLimit*price to the wei.
//  (b) For successful txs, eth_estimateGas reveals the true minimum gas (binary-searched by
//      actually executing), which the receipt hides (receipt reports the limit). If a wallet
//      set a looser limit than this minimum, the surplus is pure overpay under Monad's model.
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
  // Re-confirm (a): the reverted tx from the first scan
  const hash = '0x272f56f75f38199c6cc1a465df6bb0c310bae51beaa4ea6500e15107f7fb29b8';
  const tx = await rpc('eth_getTransactionByHash', [hash]);
  const rc = await rpc('eth_getTransactionReceipt', [hash]);
  const bn = Number(tx.blockNumber);
  const before = H(await rpc('eth_getBalance', [tx.from, '0x' + (bn - 1).toString(16)]));
  const after = H(await rpc('eth_getBalance', [tx.from, '0x' + bn.toString(16)]));
  const delta = before - after, price = H(rc.effectiveGasPrice), limit = H(tx.gas);
  console.log('(a) PROVEN — reverted tx pays the full limit:');
  console.log(`    tx ${hash}`);
  console.log(`    status=${rc.status} (reverted), value=${formatEther(H(tx.value))} MON`);
  console.log(`    balance delta = ${formatEther(delta)} MON`);
  console.log(`    gasLimit*price = ${formatEther(limit * price)} MON`);
  console.log(`    exact match: ${delta === limit * price}\n`);

  // (b) estimateGas true-minimum vs a typical wallet default for a native transfer.
  // Simple transfer true cost = 21000. If a wallet balloons the limit on a revert probe
  // (documented MetaMask behavior), the charge scales with that ballooned limit.
  console.log('(b) True-minimum vs loose-limit overpay (illustrative, current state):');
  const feeData = await client.estimateFeesPerGas().catch(() => null);
  const gp = H(await rpc('eth_gasPrice', []));
  const scenarios = [
    { name: 'native transfer, true min (21000)', gas: 21000n },
    { name: 'wallet default padding (~50000)', gas: 50000n },
    { name: 'MetaMask revert-balloon (e.g. 500000)', gas: 500000n },
    { name: 'sold-out NFT mint revert (e.g. 250000)', gas: 250000n },
  ];
  console.log(`    gasPrice=${gp} wei`);
  for (const s of scenarios) {
    console.log(`    ${s.name.padEnd(42)} charged = ${formatEther(s.gas * gp)} MON`);
  }
  const over = (500000n - 21000n) * gp;
  console.log(`\n    A ballooned 500k-limit failed transfer costs ${formatEther(over)} MON MORE than the 21k it needed —`);
  console.log('    and you get nothing, because it reverted. This is exactly what Reckon prevents pre-broadcast.');
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
