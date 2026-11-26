import { logger } from "@/lib/logger";
import { ensureInitialized } from "./index";
import { seedDatabase } from "./seed-data";

async function main(): Promise<void> {
  const db = await ensureInitialized({ seed: false });
  const result = await seedDatabase(db);
  if (result.seeded) {
    logger.info(
      {
        linksInserted: result.linksInserted,
        clicksInserted: result.clicksInserted,
      },
      "[db:seed] Seeded demo links and clicks",
    );
  } else {
    logger.info("[db:seed] Database already contains links; skipping seed");
  }
}

main().catch((err: unknown) => {
  logger.error({ err }, "[db:seed] Failed");
  process.exit(1);
});
