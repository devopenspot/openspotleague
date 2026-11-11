import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { responseStoreFor } from "./cloudflare.config.ts";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";

// The mode picks the environment (cloudflare.config.ts): `development` under
// `vite dev`, `develop` or `production` from scripts/build.ts.
export default defineConfig(async ({ mode }) => {
  const responseStore = await responseStoreFor(mode);
  return {
    plugins: [
      vinext({
        cache: responseStoreAdapter(),
      }),
      cloudflare({
        auxiliaryWorkers: [{ config: responseStore.serviceBindingWorker }],
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
    ],
  };
});
