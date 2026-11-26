import { logger } from "@/lib/logger";
import {
  createSqliteConnection,
  createTables,
  resolveDbLocation,
} from "./index";

function main(): void {
  const location = resolveDbLocation();
  const { sqlite } = createSqliteConnection(location);
  createTables(sqlite);
  sqlite.close();
  logger.info({ location }, "[db:migrate] SQLite schema ready");
}

main();
