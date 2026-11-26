import { logger } from "@/lib/logger";
import { isLinkExpired } from "@/lib/ttl";
import { eq } from "drizzle-orm";
import { ensureInitialized } from "./index";
import { links } from "./schema";

async function main(): Promise<void> {
  const db = await ensureInitialized({ seed: false });
  const allLinks = await db.select().from(links);
  const now = new Date();
  let deactivated = 0;

  for (const link of allLinks) {
    if (!link.isActive) continue;
    const status = isLinkExpired(link, now);
    if (status.expired) {
      await db
        .update(links)
        .set({ isActive: false })
        .where(eq(links.id, link.id));
      deactivated += 1;
    }
  }

  logger.info(
    { checked: allLinks.length, deactivated },
    "[db:cleanup] Expired link cleanup finished",
  );
}

main().catch((err: unknown) => {
  logger.error({ err }, "[db:cleanup] Failed");
  process.exit(1);
});
