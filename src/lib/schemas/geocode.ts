import { z } from "zod"

export const CountryResponseSchema = z.object({
  country: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
})
