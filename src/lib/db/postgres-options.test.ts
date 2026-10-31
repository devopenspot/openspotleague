import { describe, expect, it } from "vitest"
import { getPostgresOptions } from "./postgres-options"

describe("getPostgresOptions", () => {
  it("requires TLS and disables prepared statements for the Supabase pooler", () => {
    const options = getPostgresOptions("runtime")
    expect(options.ssl).toBe("require")
    expect(options.prepare).toBe(false)
  })

  it("leaves TLS to the connection string and keeps prepared statements on Hyperdrive", () => {
    const options = getPostgresOptions("runtime", { hyperdrive: true })
    expect(options).not.toHaveProperty("ssl")
    expect(options.prepare).toBe(true)
  })

  it("keeps array type fetching on because the schema has text[] columns", () => {
    expect(getPostgresOptions("runtime", { hyperdrive: true })).not.toHaveProperty("fetch_types")
  })
})
