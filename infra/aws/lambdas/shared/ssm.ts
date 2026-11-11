/**
 * SSM SecureString reads (AWS-managed key; standard parameters are free),
 * cached for the life of the execution environment. `forget` drops a value
 * that turned out to be stale (rotated secret, revoked key).
 */

import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm"

const ssm = new SSMClient({})
const cache = new Map<string, string>()

export function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

/** Value of the SecureString named by env var `envName`. */
export async function secureParameter(envName: string): Promise<string> {
  const name = requiredEnv(envName)
  const cached = cache.get(name)
  if (cached) return cached
  const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }))
  const value = result.Parameter?.Value?.trim()
  if (!value) throw new Error(`Parameter ${name} is empty`)
  cache.set(name, value)
  return value
}

export function forgetParameter(envName: string): void {
  const name = process.env[envName]
  if (name) cache.delete(name)
}
