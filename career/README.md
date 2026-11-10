# OpenSpot League — career kit

Copy-ready text for putting OpenSpot League on LinkedIn, a résumé and a CV, in English (`en/`) and Spanish (`es/`).
Open [`index.html`](index.html) in a browser for the same content with copy buttons.

This folder is private: it sits outside `src/` and `public/`, so it is never built, deployed or linked from the app.

| File | Use it for |
| --- | --- |
| `en/linkedin.md`, `es/linkedin.md` | Headline, About, Experience entry, Projects entry, Skills, Featured link |
| `en/resume.md`, `es/resume.md` | 1-page résumé: short entry with 4–5 bullets |
| `en/cv.md`, `es/cv.md` | Long-form CV: full description, architecture, features, stack |
| `en/brief.md`, `es/brief.md` | Online CVs and job portals: plain-text one-liner, short and standard descriptions, keywords |

Fill every `[placeholder]` before publishing.

## Two framings — pick one per application

**A. Experience (recommended).** List it as a job you hold:
*Founder & Full-Stack Engineer · OpenSpot League · Self-employed · [Month] 2026 – Present.*
Use it when you want it to count as professional experience (and to fill a gap in your timeline).
It is honest because you designed, built, deployed and run a production product on its own domain.

**B. Project.** List it under *Projects* when the application already has a strong Experience section,
or when the role asks specifically for "personal projects / portfolio".

Do not use both on the same résumé. On LinkedIn you can have the Experience entry and *also*
a Featured link to openspotleague.com.

## How to describe the stage (honest wording)

The site is live on openspotleague.com but not publicly launched. Say:

- EN: "Live at openspotleague.com in pre-launch (public beta), ahead of a public release."
- ES: "En línea en openspotleague.com en fase de pre-lanzamiento (beta pública), antes del lanzamiento oficial."

**Do not quote user numbers yet.** 5 sign-ups (3 real people) reads as small and recruiters may treat it as a red flag;
inflating it would be dishonest and is easy to check. Sell the engineering scope instead — it is real and verifiable:

- a production deployment on Cloudflare Workers with a real domain
- ~1,070 TypeScript source files, ~270 test files, strict TypeScript
- a rating engine, real-time multiplayer games, geospatial search, RBAC + row-level security

If asked in an interview: "It's in pre-launch with a handful of early testers; I'm finishing the contest flow before marketing it."
That is a strong, truthful answer.

### Metrics to add after launch

Replace the scope bullets with traction as soon as you have it (track these from day one):

- [ ] registered riders / monthly active users
- [ ] spots on the map, and how many were submitted by users
- [ ] contests created and runs judged
- [ ] cities / countries with activity
- [ ] page performance (e.g. Lighthouse score, p95 response time) and monthly infrastructure cost

A bullet like "Grew to 1,200 riders across 14 cities in 3 months" beats any technical bullet.

## Dates

The git history of this repository starts on 18 Oct 2026. If you started designing or building earlier
(prototype, previous repo), use that earlier month. Write "– Present" while you are still working on it.

## LinkedIn step by step

1. **Company page (optional but recommended).** LinkedIn → *For Business* → *Create a Company Page* →
   name "OpenSpot League", URL openspotleague.com, industry "Software Development" (or "Spectator Sports"),
   logo from `public/`. Without a page, the Experience entry shows a grey placeholder logo.
2. **Experience.** Profile → *Add profile section* → *Position*. Fields: Title, Employment type *Self-employed*,
   Company *OpenSpot League*, Location, *Remote*, start date, "I am currently working in this role",
   description (from `linkedin.md`), skills (up to 5), media: a screenshot of the map and of a contest page.
3. **Featured.** *Add featured* → *Link* → `https://openspotleague.com`, title and description from `linkedin.md`.
4. **Headline and About.** Update both; the headline is the first thing recruiters read.
5. **Skills.** Add the list from `linkedin.md` and pin the top 3 that match the jobs you want.
6. **Open to work / Providing services** as you prefer. Posting a short launch post when you go public helps a lot.

LinkedIn limits: headline 220 characters, About 2,600, position description 2,000. The texts in `linkedin.md` fit.
