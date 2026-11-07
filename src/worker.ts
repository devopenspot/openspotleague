import handler from "vinext/server/fetch-handler"
import { setHyperdriveUrl } from "./lib/config/env"
import { runInRequestScope, type AssetFetcher } from "./lib/utils/request-scope"

export * from "vinext/server/fetch-handler"

/** `ctx.waitUntil`, bound, when the runtime provides an execution context. */
function waitUntilOf(ctx: unknown): ((promise: Promise<unknown>) => void) | undefined {
  const candidate = ctx as { waitUntil?: (promise: Promise<unknown>) => void } | null
  return typeof candidate?.waitUntil === "function" ? candidate.waitUntil.bind(candidate) : undefined
}

type WorkerEnv = { ASSETS: AssetFetcher; HYPERDRIVE: { connectionString: string } }

const worker = {
  ...handler,
  fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    setHyperdriveUrl(env.HYPERDRIVE.connectionString)
    return runInRequestScope(env.ASSETS, () => handler.fetch(request, env, ctx), waitUntilOf(ctx))
  },
}

export default worker
