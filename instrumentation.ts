// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPathSync } = await import("./lib/server/path-sync")
    startPathSync()
  }
}
