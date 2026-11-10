# LinkedIn — Español

Perfil: https://www.linkedin.com/in/gabriel-alfonso-bernal/

LinkedIn permite tener el perfil en dos idiomas (*Añadir perfil en otro idioma*). Usa este texto en el perfil en español.

## Titular (≤ 220 caracteres)

```
Ingeniero Full-Stack · Fundador de OpenSpot League | Next.js · React · TypeScript · PostgreSQL/PostGIS · Supabase · Cloudflare Workers
```

## Acerca de (≤ 2.600 caracteres)

```
[1–2 frases sobre ti: años de experiencia, el tipo de productos que construyes, qué buscas.]

Soy fundador y único ingeniero de OpenSpot League (openspotleague.com), una plataforma para la comunidad de deportes de acción: un mapa interactivo de spots, competiciones con jueceo real, juegos multijugador de trucos y TV de deportes de acción para riders de skateboard, BMX, scooter y patines.

La diseñé y construí de principio a fin —producto, sistema de UI, arquitectura, base de datos y despliegue— con Next.js 16, React 19 y TypeScript, sobre Cloudflare Workers y Supabase (PostgreSQL + PostGIS, Auth, Realtime). Está en línea en fase de pre-lanzamiento, antes de su lanzamiento oficial.

Lo que más disfruto: convertir reglas complejas del mundo real en lógica de dominio limpia y probada (como un motor de puntuación de competiciones basado en los criterios de World Skate), construir funciones en tiempo real que se mantienen correctas con concurrencia, y mantener producción rápida y barata con una buena estrategia de caché.

Stack: TypeScript · Next.js · React · Node.js · PostgreSQL · PostGIS · Supabase · Drizzle ORM · Cloudflare Workers / R2 · AWS (CDK, Lambda, SQS, SES, SNS, DynamoDB, EventBridge) · Tailwind CSS · Vitest
```

## Opción A — Experiencia

| Campo | Valor |
| --- | --- |
| Cargo | Fundador e Ingeniero Full-Stack |
| Tipo de empleo | Autónomo |
| Empresa | OpenSpot League |
| Fechas | [Mes] 2026 – actualidad |
| Ubicación | [Ciudad, País] · En remoto |
| Aptitudes (elige 5) | Next.js · TypeScript · React · PostgreSQL · Cloudflare Workers |
| Contenido multimedia | Captura del mapa, de una página de competición, enlace a openspotleague.com |

Descripción (≤ 2.000 caracteres):

```
OpenSpot League (openspotleague.com) es una plataforma web para la comunidad de deportes de acción: skateboard, BMX, scooter y patines. La diseñé, construí y opero de principio a fin. Está en línea en su dominio de producción en fase de pre-lanzamiento, antes de su lanzamiento oficial.

• Construí un mapa interactivo de spots con búsqueda geoespacial (PostGIS) y spots aportados por los usuarios.
• Construí la Liga: los organizadores crean competiciones con divisiones, invitaciones por QR o enlace y jueceo en vivo o por vídeo, puntuadas por un motor que implementé a partir de los criterios de World Skate (cinco criterios, escala 0–10, panel de jueces con media recortada, clasificaciones por división y puntos de liga globales).
• Desarrollé juegos multijugador de trucos en tiempo real con control de concurrencia optimista, escrituras idempotentes y Supabase Realtime.
• Construí un sistema de notificaciones por email orientado a eventos en AWS para cambios de competición, recordatorios y resultados: outbox transaccional → SQS FIFO (con cola de mensajes fallidos) → Lambda → SES, idempotencia en DynamoDB, gestión de rebotes con SNS y resúmenes programados con EventBridge Scheduler, todo definido como código con AWS CDK.
• Diseñé una arquitectura por capas en Next.js 16 / React 19 (páginas → servicios → repositorios) desplegada en Cloudflare Workers, con PostgreSQL vía Hyperdrive y multimedia en Cloudflare R2.
• Reduje los costes de alojamiento con caché en servidor (Next.js Cache Components, caché remota compartida), invalidación tras el commit y un presupuesto de tráfico de base de datos.
• Protegí la plataforma con control de acceso por roles, seguridad a nivel de fila en PostgreSQL, límites de peticiones por IP y cabeceras de seguridad estrictas.
• Mantuve la calidad con TypeScript estricto, ~270 archivos de tests automatizados (Vitest) y un sistema de diseño basado en tokens.
```

## Opción B — Sección Proyectos

| Campo | Valor |
| --- | --- |
| Nombre del proyecto | OpenSpot League |
| Fechas | [Mes] 2026 – actualidad |
| Asociado con | (vacío, o tu puesto actual) |
| URL del proyecto | https://openspotleague.com |
| Aptitudes | Next.js · TypeScript · PostgreSQL · Supabase · Cloudflare Workers |

Descripción:

```
Plataforma full-stack para riders de deportes de acción (skateboard, BMX, scooter, patines), desarrollada en solitario y en pre-lanzamiento en openspotleague.com.

• Mapa de spots con búsqueda geoespacial (PostGIS).
• Competiciones con jueceo en vivo o por vídeo, puntuadas por un motor basado en los criterios de World Skate.
• Juegos multijugador de trucos en tiempo real (Supabase Realtime, concurrencia optimista).
• Notificaciones por email orientadas a eventos en AWS (CDK, SQS, Lambda, SES, DynamoDB, EventBridge).
• Next.js 16 + React 19 en Cloudflare Workers, PostgreSQL con Drizzle y Hyperdrive, multimedia en R2; ~270 archivos de tests.
```

## Enlace destacado

- URL: `https://openspotleague.com`
- Título: `OpenSpot League — spots, competiciones y juegos de deportes de acción`
- Descripción: `Plataforma que fundé y construí en solitario: mapa de spots, competiciones con jueces, juegos multijugador de trucos y TV de deportes de acción. En pre-lanzamiento.`

## Aptitudes

Next.js · React · TypeScript · JavaScript · Node.js · PostgreSQL · PostGIS · Supabase · Drizzle ORM · SQL ·
Cloudflare Workers · AWS · AWS Lambda · Amazon SQS · Amazon SES · AWS CDK · DynamoDB · Serverless · Arquitectura orientada a eventos · Tailwind CSS · Vitest · Sistemas en tiempo real · Diseño de sistemas ·
Rendimiento web · Caché · APIs REST · Desarrollo de producto · Diseño de interfaces
