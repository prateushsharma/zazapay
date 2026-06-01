#!/usr/bin/env bash
set -e

patch_agent() {
  local FILE=$1
  local AGENT_LABEL=$2

  # Replace the full registerIfNeeded function (3-arg version → 2-arg version)
  node -e "
const fs = require('fs');
let src = fs.readFileSync('${FILE}', 'utf8');

const oldFn = \`async function registerIfNeeded(
  publicClient: ReturnType<typeof makeClients>[\"publicClient\"],
  walletClient: ReturnType<typeof makeClients>[\"walletClient\"],
  address: Address
): Promise<void> {
  const active = await publicClient.readContract({
    address: CONTRACT_ADDRESSES.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: \"isActiveAgent\",
    args: [address],
  }) as boolean;

  if (active) {
    log(\\\`Already registered in AgentRegistry\\\`);
    return;
  }

  log(\\\`Registering in AgentRegistry as executor...\\\`);
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESSES.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: \"registerAgent\",
    args: [address, \"executor\"],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  log(\\\`Registered. tx=\\\${hash}\\\`);
}\`;

const newFn = \`async function registerIfNeeded(
  publicClient: ReturnType<typeof makeClients>[\"publicClient\"],
  address: Address
): Promise<void> {
  const active = await publicClient.readContract({
    address: CONTRACT_ADDRESSES.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: \"isActiveAgent\",
    args: [address],
  }) as boolean;

  if (!active) {
    throw new Error(
      \\\`Agent \\\${address} is not registered in AgentRegistry. Run: npx tsx scripts/register-agents.ts\\\`
    );
  }

  log(\\\`Confirmed active in AgentRegistry\\\`);
}\`;

if (!src.includes('walletClient: ReturnType<typeof makeClients>[\"walletClient\"],\n  address: Address')) {
  console.log('${AGENT_LABEL}: registerIfNeeded already patched, skipping function body');
} else {
  src = src.replace(oldFn, newFn);
  console.log('${AGENT_LABEL}: patched registerIfNeeded function body');
}

// Replace the call site
const oldCall = 'await registerIfNeeded(publicClient, walletClient, account.address);';
const newCall = 'await registerIfNeeded(publicClient, account.address);';
if (src.includes(oldCall)) {
  src = src.replace(oldCall, newCall);
  console.log('${AGENT_LABEL}: patched registerIfNeeded call site');
} else {
  console.log('${AGENT_LABEL}: call site already patched or not found');
}

fs.writeFileSync('${FILE}', src);
"
}

patch_agent "agents/executor-agent-a.ts" "EXECUTOR-A"
patch_agent "agents/executor-agent-b.ts" "EXECUTOR-B"

echo ""
echo "==> Both agents patched."
echo "==> Now run: npx tsx scripts/register-agents.ts"
echo "==> Then run agents normally."
