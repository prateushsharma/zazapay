import { Router, Request, Response } from "express";
import { createPublicClient, http } from "viem";
import { somniaTestnet } from "../../agents/shared/chain";
import { CONTRACT_ADDRESSES, AGENT_REGISTRY_ABI } from "../../agents/shared/contracts";

const router = Router();

// GET /v1/agents
router.get("/", async (_req: Request, res: Response) => {
  const ts = new Date().toISOString();
  try {
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http("https://dream-rpc.somnia.network"),
    });

    const agents = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.AgentRegistry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getAllAgents",
      args: [],
    }) as any[];

    const formatted = agents.map((a: any) => ({
      address: a.wallet ?? a.agentAddress ?? a[0],
      role: a.role ?? a.agentRole ?? a[1],
      active: a.active ?? a[6] ?? true,
      lastHeartbeat: a.lastHeartbeat?.toString() ?? a[3]?.toString() ?? "0",
      successCount: Number(a.successCount ?? a[4] ?? 0),
      failureCount: Number(a.failureCount ?? a[5] ?? 0),
    }));

    res.json({ count: formatted.length, agents: formatted });
  } catch (err: any) {
    console.error(`[${ts}] [API] getAllAgents failed:`, err?.message);
    res.status(500).json({
      error: "Failed to fetch agents",
      detail: err?.message ?? String(err),
    });
  }
});

export default router;
