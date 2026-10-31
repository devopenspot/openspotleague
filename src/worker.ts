import handler from "vinext/server/fetch-handler"
import { setHyperdriveUrl } from "./lib/config/env"
import { runInRequestScope, type AssetFetcher } from "./lib/utils/request-scope"

export * from "vinext/server/fetch-handler"

type WorkerEnv = { ASSETS: AssetFetcher; HYPERDRIVE: { connectionString: string } }

const worker = {
  ...handler,
  fetch(request: Request, env: WorkerEnv, ctx: unknown) {
    setHyperdriveUrl(env.HYPERDRIVE.connectionString)
    return runInRequestScope(env.ASSETS, () => handler.fetch(request, env, ctx))
  },
}

export default worker
