import { describe, expect, it } from "vitest"
import { allowEmails, DEFAULT_EMAIL_CAPS, utcDay, utcMonthStart } from "./budget"

const CAPS = { daily: 95, monthly: 2900, digestShare: 0.6 }

describe("allowEmails", () => {
  it("lets everything through on a quiet day", () => {
    expect(allowEmails({ today: 0, month: 0 }, CAPS, { immediate: 10, digest: 20 })).toEqual({
      immediate: 10,
      digest: 20,
    })
  })

  it("stops digests at 60% of the daily cap and keeps the rest for immediate mail", () => {
    // 57 = floor(95 * 0.6). 50 used, 5 immediate now: digests may add 2.
    expect(allowEmails({ today: 50, month: 50 }, CAPS, { immediate: 5, digest: 30 })).toEqual({
      immediate: 5,
      digest: 2,
    })
    expect(allowEmails({ today: 60, month: 60 }, CAPS, { immediate: 0, digest: 5 })).toEqual({
      immediate: 0,
      digest: 0,
    })
    expect(allowEmails({ today: 60, month: 60 }, CAPS, { immediate: 50, digest: 0 })).toEqual({
      immediate: 35,
      digest: 0,
    })
  })

  it("never passes the daily cap", () => {
    expect(allowEmails({ today: 95, month: 95 }, CAPS, { immediate: 3, digest: 3 })).toEqual({
      immediate: 0,
      digest: 0,
    })
  })

  it("applies the monthly cap and the monthly digest share", () => {
    expect(allowEmails({ today: 0, month: 2895 }, CAPS, { immediate: 10, digest: 0 }).immediate).toBe(5)
    // 1740 = floor(2900 * 0.6): digests are done for the month, immediate mail is not.
    expect(allowEmails({ today: 0, month: 1740 }, CAPS, { immediate: 2, digest: 9 })).toEqual({
      immediate: 2,
      digest: 0,
    })
  })

  it("treats negative requests as zero", () => {
    expect(allowEmails({ today: 0, month: 0 }, CAPS, { immediate: -1, digest: -4 })).toEqual({
      immediate: 0,
      digest: 0,
    })
  })

  it("defaults sit under Resend Free's 100/day and 3,000/month", () => {
    expect(DEFAULT_EMAIL_CAPS.daily).toBeLessThan(100)
    expect(DEFAULT_EMAIL_CAPS.monthly).toBeLessThan(3000)
  })
})

describe("utc helpers", () => {
  it("uses the UTC calendar", () => {
    const lateNight = new Date("2026-11-30T23:30:00.000-05:00") // 04:30 UTC on Dec 1
    expect(utcDay(lateNight)).toBe("2026-12-01")
    expect(utcMonthStart(lateNight)).toBe("2026-12-01")
    expect(utcMonthStart(new Date("2026-11-15T10:00:00.000Z"))).toBe("2026-11-01")
  })
})
