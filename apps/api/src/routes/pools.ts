import { Hono } from "hono";
import { z } from "zod";

import {
  createPoolMetadata,
  getActiveContractAddress,
  getPoolById,
  getPoolDetailById,
  isActiveContractAddress,
  listPools
} from "../services/pool-service";
import { getUserWallet } from "../services/circle-wallet-service";

export const poolsRoutes = new Hono();

const createPoolSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  onchainPoolId: z.coerce.number().int().nonnegative(),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  createdTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional()
});

const listPoolsSchema = z.object({
  creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  member: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  status: z.string().optional(),
  includeLegacy: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
});

function getBearerUserToken(c: { req: { header: (name: string) => string | undefined } }) {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

poolsRoutes.post("/pools", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = createPoolSchema.safeParse(json);

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await createPoolMetadata(parsed.data);
    return c.json({ data: result, error: null }, result.created ? 201 : 200);
  } catch (error) {
    return c.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Unable to create pool metadata"
      },
      400
    );
  }
});

poolsRoutes.get("/pools", async (c) => {
  const parsed = listPoolsSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));

  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400);
  }

  const items = await listPools(parsed.data);
  return c.json({ data: items, error: null });
});

poolsRoutes.get("/pools/:id", async (c) => {
  const id = c.req.param("id");
  const userToken = getBearerUserToken(c);
  let walletAddressPresent = false;
  const activeContractAddress = getActiveContractAddress();

  try {
    const poolMetadata = await getPoolById(id);
    if (!poolMetadata) {
      return c.json({ data: null, error: "Pool metadata not found" }, 404);
    }

    const contractMatchesActive = isActiveContractAddress(poolMetadata.contractAddress);
    if (!contractMatchesActive) {
      console.warn("[Pools detail] legacy contract pool rejected", {
        poolUuid: id,
        onchainPoolId: poolMetadata.onchainPoolId,
        storedContractAddress: poolMetadata.contractAddress,
        activeContractAddress,
        contractMatchesActive,
        errorMessage: "Pool belongs to a legacy contract."
      });

      return c.json(
        {
          data: null,
          error: {
            code: "LEGACY_CONTRACT_UNSUPPORTED",
            message: "This pool belongs to a legacy contract and is hidden from the current MVP runtime.",
            storedContractAddress: poolMetadata.contractAddress,
            activeContractAddress,
            contractMatchesActive
          }
        },
        409
      );
    }

    const wallet = userToken ? await getUserWallet(userToken).catch(() => null) : null;
    walletAddressPresent = Boolean(wallet?.address);
    const pool = await getPoolDetailById(id, wallet?.address ?? null, Boolean(wallet?.walletId));

    return c.json({ data: pool, error: null });
  } catch (error) {
    const pool = await getPoolById(id).catch(() => null);
    const message = error instanceof Error ? error.message : "Unable to load pool detail.";

    console.warn("[Pools detail] failed to load pool detail", {
      poolUuid: id,
      onchainPoolId: pool?.onchainPoolId ?? null,
      storedContractAddress: pool?.contractAddress ?? null,
      activeContractAddress,
      contractMatchesActive: pool ? isActiveContractAddress(pool.contractAddress) : null,
      walletAddressPresent,
      memberCount: null,
      currentRound: pool?.currentRound ?? null,
      status: pool?.status ?? null,
      errorCode: error instanceof Error ? error.name : null,
      errorMessage: message.split("\n")[0] ?? "Unable to load pool detail."
    });

    return c.json(
      {
        data: null,
        error: {
          code: "POOL_DETAIL_LOAD_FAILED",
          message: "Unable to load pool detail from chain."
        }
      },
      502
    );
  }
});
