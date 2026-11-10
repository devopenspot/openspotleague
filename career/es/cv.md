# CV (versión extendida) — Español

## Fundador e Ingeniero Full-Stack — OpenSpot League
Autónomo · [Ciudad, País] / Remoto · [Mes] 2026 – actualidad · https://openspotleague.com

### Resumen
OpenSpot League es una plataforma web para la comunidad de deportes de acción (skateboard, BMX, scooter y
patines). Reúne un mapa interactivo de spots, un sistema de competiciones ("la Liga") con jueceo real, juegos
multijugador de retos de trucos y TV de deportes de acción. Fundé el proyecto y soy su único ingeniero: me
encargo del producto, el diseño, la arquitectura, el desarrollo, el despliegue y la operación. La plataforma
está en línea en su dominio de producción en fase de pre-lanzamiento, antes de su lanzamiento oficial.

### Responsabilidades
- Definición de producto, hoja de ruta y experiencia de usuario para riders, organizadores y jueces.
- Desarrollo full-stack: interfaz, rutas de API, lógica de dominio, esquema de base de datos y migraciones.
- Infraestructura, despliegue y seguimiento del uso y coste de la base de datos.
- Seguridad, control de acceso y protección de datos (páginas de privacidad y términos).

### Funcionalidades principales
- **Mapa de spots.** Mapa interactivo (Leaflet) con consultas geoespaciales en PostGIS, filtros por disciplina
  y tipo de spot, páginas de spot, spots guardados y spots aportados por los usuarios.
- **La Liga (competiciones).** Los organizadores crean competiciones con divisiones (disciplina × formato),
  invitan a riders por QR o enlace y juzgan las rondas en vivo o a partir de vídeos. Un motor de puntuación
  implementa los criterios de World Skate (formatos Park, Street y Vert; cinco criterios; elementos obligatorios
  por disciplina; notas de 0 a 10; panel de jueces con media recortada; clasificaciones por división). Los
  resultados se publican en clasificaciones, tarjetas de resultado para compartir y un ranking global con puntos
  de liga. Los riders solo ven los totales del panel hasta que se publican los resultados.
- **Planes y visibilidad.** Las competiciones gratuitas son privadas (solo por invitación); para listarlas
  públicamente se necesita un plan de pago, con herramientas de administración de planes, cuotas y pagos.
- **Juegos multijugador.** Retos de trucos en tiempo real diseñados como máquinas de estados puras, con
  escrituras versionadas (concurrencia optimista) e idempotentes y señales de Supabase Realtime.
- **Notificaciones.** Notificaciones en la app con Supabase Realtime y un sistema de email orientado a eventos en AWS:
  un outbox transaccional envía los trabajos a una cola SQS FIFO (orden por usuario, deduplicación, cola de mensajes
  fallidos), una Lambda envía con SES v2 con baja en un clic e idempotencia en DynamoDB, los rebotes y quejas de SES
  vuelven por SNS para suprimir direcciones, y EventBridge Scheduler gestiona recordatorios y resúmenes. Las peticiones
  a AWS se firman con SigV4 desde el Worker y las respuestas a la app con HMAC. Infraestructura definida con AWS CDK.
- **TV de deportes de acción**, perfiles, notificaciones, herramientas de administración y curación, e imágenes
  Open Graph generadas para compartir.

### Arquitectura e ingeniería
- Next.js 16 App Router con React 19 y Cache Components, compilado con Vite (vinext) y desplegado en
  Cloudflare Workers; PostgreSQL a través de Cloudflare Hyperdrive; multimedia en Cloudflare R2.
- Diseño por capas: páginas y rutas → servicios (orquestación, escritor único) → repositorios (Drizzle ORM).
  Los motores de dominio (juegos, liga, puntuación) son puros, sin E/S y con tests unitarios.
- Escrituras transaccionales con concurrencia optimista, huellas de petición para idempotencia e invalidación
  de caché tras el commit.
- Estrategia de caché (caché remota compartida para lecturas públicas, caché privada para datos de usuario)
  diseñada en torno a un presupuesto de tráfico de base de datos; compilación sin base de datos; límites de
  tamaño de las respuestas RSC.
- Seguridad: Supabase Auth, control de acceso por roles, seguridad a nivel de fila en PostgreSQL, límites de
  peticiones por IP, identificadores de petición y cabeceras de seguridad estrictas.
- Calidad: TypeScript estricto, ESLint, ~270 archivos de tests con Vitest sobre ~1.070 archivos de código,
  migraciones SQL escritas a mano, un sistema de diseño basado en tokens y documentación de arquitectura.

### Tecnologías
TypeScript · React 19 · Next.js 16 · Vite · Node.js · Tailwind CSS 4 · Leaflet · Zustand · Zod ·
PostgreSQL · PostGIS · Supabase (Auth, Realtime) · Drizzle ORM · Cloudflare Workers · Hyperdrive · R2 ·
AWS (CDK, Lambda, SQS, SES, SNS, DynamoDB, EventBridge Scheduler) · Vitest ·
Testing Library
