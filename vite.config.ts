import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { responseStoreServiceBinding } from "./cloudflare.config.ts";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";

export default defineConfig({
  plugins: [
    vinext({
      cache: responseStoreAdapter(),
    }),
    cloudflare({
      auxiliaryWorkers: [{ config: responseStoreServiceBinding }],
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
