/**
 * Test script for all Demo / Demo-Light scenarios against the live Sui Testnet
 * smart contracts and the AEGIS AI Agent server.
 */

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SCENARIOS } from "../src/components/demo/scenarios";

const SENDER = "0xffae7e430e5cca75a00b23169f4a39cb43721fd1bad89fa3b3e1e01b12db2fe5";
const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:3001";
const suiClient = new SuiGrpcClient({
  network: "testnet",
  baseUrl: "https://fullnode.testnet.sui.io:443",
});

async function runTests() {
  console.log("===============================================================");
  console.log("🧪 Testing Demo & Demo-Light Scenarios (Live Testnet Contracts)");
  console.log("===============================================================\n");
  console.log(`Target Wallet : ${SENDER}`);
  console.log(`Agent Server  : ${AGENT_URL}\n`);

  let allPassed = true;

  for (const scenario of SCENARIOS) {
    console.log(`---------------------------------------------------------------`);
    console.log(`▶ Scenario: ${scenario.label} [${scenario.id}]`);
    console.log(`  Expected Verdict : ${scenario.expected.toUpperCase()}`);
    console.log(`  Executable       : ${scenario.executable}`);

    // 1. Build the transaction payload exactly as the demo does
    const tx = scenario.build(SENDER);
    const rawPtb = await tx.toJSON({ client: suiClient });

    // 2. Call AEGIS AI Agent Server
    const t0 = Date.now();
    let agentRes;
    try {
      const res = await fetch(`${AGENT_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPtb, walletAddress: SENDER }),
      });

      if (!res.ok) {
        throw new Error(`Agent returned HTTP ${res.status}: ${await res.text()}`);
      }

      agentRes = await res.json();
    } catch (err) {
      console.error(`  ✗ Agent analysis failed: ${err instanceof Error ? err.message : err}`);
      allPassed = false;
      continue;
    }

    const elapsed = Date.now() - t0;
    console.log(`  ⚡ Agent Analysis (${elapsed}ms):`);
    console.log(`     Risk Score     : ${agentRes.riskScore} / 100`);
    console.log(`     Recommendation : ${agentRes.recommendation.toUpperCase()}`);
    console.log(`     Risk Flags     : ${agentRes.riskFlags.join("; ") || "(none)"}`);
    console.log(`     Explanation    : ${agentRes.explanation.slice(0, 140)}...`);

    // Verify expected recommendation matches
    if (agentRes.recommendation.toLowerCase() !== scenario.expected.toLowerCase()) {
      console.error(`  ✗ Verdict mismatch: expected ${scenario.expected}, got ${agentRes.recommendation}`);
      allPassed = false;
    } else {
      console.log(`  ✓ Agent verdict matched expected: ${scenario.expected.toUpperCase()}`);
    }

    // 3. For executable scenarios, dry-run against live Sui Testnet RPC to verify smart contracts
    if (scenario.executable) {
      try {
        const bytes = await tx.build({ client: suiClient });
        const simRes = await suiClient.core.simulateTransaction({
          transaction: bytes,
          checksEnabled: false,
          include: { effects: true, balanceChanges: true },
        });

        const txData = simRes.$kind === "Transaction" ? simRes.Transaction : simRes.FailedTransaction;
        const isSuccess = txData.effects?.status?.success ?? false;

        if (isSuccess) {
          console.log(`  ✓ Sui Testnet On-Chain Dry-Run: SUCCESS (0 VM errors)`);
        } else {
          console.error(`  ✗ Sui Testnet Dry-Run status: Failed (${txData.effects?.status?.error?.message ?? "VM execution error"})`);
          allPassed = false;
        }
      } catch (err) {
        console.error(`  ✗ Sui Testnet Dry-Run failed: ${err instanceof Error ? err.message : err}`);
        allPassed = false;
      }
    }

    console.log("");
  }

  console.log("===============================================================");
  if (allPassed) {
    console.log("🎉 ALL SCENARIOS & SMART CONTRACTS PASSED VERIFICATION!");
  } else {
    console.log("❌ SOME SCENARIO CHECKS FAILED.");
  }
  console.log("===============================================================\n");

  process.exit(allPassed ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
