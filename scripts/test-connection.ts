import "../src/db/load-env"
import postgres from "postgres"

async function testConnection(name: string, url: string | undefined) {
  console.log(`\n--- Testing ${name} ---`)
  if (!url) {
    console.error(`❌ ${name} is NOT set in environment!`)
    return false
  }

  try {
    const parsed = new URL(url)
    console.log(`Host: ${parsed.hostname}`)
    console.log(`Port: ${parsed.port}`)
    console.log(`User: ${parsed.username}`)
    console.log(`Database: ${parsed.pathname.slice(1)}`)
  } catch (e: any) {
    console.error(`❌ Malformed URL: ${e.message}`)
    return false
  }

  const sql = postgres(url, {
    ssl: "require",
    connect_timeout: 10,
    max: 1,
    prepare: false,
  })

  try {
    const start = Date.now()
    const result = await sql`select version(), current_database(), current_user`
    const duration = Date.now() - start
    console.log(`✅ Connected successfully in ${duration}ms!`)
    console.log(`Server Info:`, result[0])
    return true
  } catch (err: any) {
    console.error(`❌ Connection failed:`, {
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      hostname: err.hostname,
      message: err.message,
    })
    return false
  } finally {
    await sql.end({ timeout: 2 })
  }
}

async function run() {
  const dbUrl = process.env.SUPABASE_DATABASE_URL
  const directUrl = process.env.SUPABASE_DIRECT_URL

  console.log("Starting Supabase connection diagnostic...")
  const dbOk = await testConnection("SUPABASE_DATABASE_URL (Port 6543 / Transaction Pooler)", dbUrl)
  const directOk = await testConnection("SUPABASE_DIRECT_URL (Port 5432 / Session Pooler)", directUrl)

  console.log("\n================ Summary ================")
  console.log(`SUPABASE_DATABASE_URL: ${dbOk ? "✅ PASSED" : "❌ FAILED"}`)
  console.log(`SUPABASE_DIRECT_URL:   ${directOk ? "✅ PASSED" : "❌ FAILED"}`)
  console.log("=========================================\n")
}

run()
