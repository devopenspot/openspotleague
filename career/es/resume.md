# Currículum (1 página) — Español

Máximo 4–6 viñetas; quita la menos relevante para cada puesto. Usa **una** de las dos versiones, nunca ambas.

## Versión A — Experiencia

**Fundador e Ingeniero Full-Stack** — OpenSpot League (autónomo) · [Ciudad, País] / Remoto · [Mes] 2026 – actualidad
*Plataforma de deportes de acción (mapa de spots, competiciones con jueces, juegos multijugador) · en pre-lanzamiento en openspotleague.com*

- Diseñé, desarrollé y desplegué el producto completo en solitario: Next.js 16 / React 19 / TypeScript en Cloudflare Workers, Supabase PostgreSQL + PostGIS, Cloudflare R2.
- Implementé un motor de puntuación de competiciones según los criterios de World Skate (cinco criterios, panel de jueces con media recortada, clasificaciones por división, puntos de liga), con jueceo en vivo y por vídeo.
- Construí juegos multijugador de trucos en tiempo real con concurrencia optimista, escrituras idempotentes y Supabase Realtime.
- Construí un sistema de notificaciones por email orientado a eventos en AWS (SQS FIFO → Lambda → SES, idempotencia en DynamoDB, programación con EventBridge), definido con AWS CDK.
- Diseñé un backend por capas (servicios/repositorios) con control de acceso por roles, seguridad a nivel de fila, límites de peticiones y cabeceras de seguridad.
- Reduje el tráfico de base de datos y el coste de alojamiento con caché en servidor (Next.js Cache Components, caché remota) e invalidación tras el commit; ~270 archivos de tests automatizados.

## Versión B — Proyectos

**OpenSpot League** — openspotleague.com · [Mes] 2026 – actualidad
*Proyecto full-stack individual · Next.js, React, TypeScript, PostgreSQL/PostGIS, Supabase, Cloudflare Workers*

- Plataforma de deportes de acción con mapa geoespacial de spots, competiciones con jueces y juegos multijugador en tiempo real; en pre-lanzamiento.
- Motor de puntuación basado en los criterios de World Skate y juegos en tiempo real con concurrencia optimista y Supabase Realtime.
- Notificaciones por email orientadas a eventos en AWS (CDK, SQS, Lambda, SES, DynamoDB, EventBridge).
- Desplegada en Cloudflare Workers con caché en servidor, RBAC + seguridad a nivel de fila y ~270 archivos de tests.

## Línea de aptitudes

**Lenguajes y frameworks:** TypeScript, JavaScript, SQL, React 19, Next.js 16, Node.js, Tailwind CSS
**Datos e infraestructura:** PostgreSQL, PostGIS, Supabase (Auth, Realtime), Drizzle ORM, Cloudflare Workers, R2, Hyperdrive, AWS (CDK, Lambda, SQS, SES, SNS, DynamoDB, EventBridge)
**Prácticas:** diseño de sistemas, arquitectura orientada a eventos, infraestructura como código, caché, sistemas en tiempo real, tests automatizados (Vitest), seguridad (RBAC, RLS)

## Consejos

- Pon primero la viñeta más relevante para cada puesto (backend → arquitectura/caché; frontend → sistema de UI/mapa; producto → la Liga).
- Cuando tengas usuarios, cambia la última viñeta por una de tracción (ver `../README.md`).
