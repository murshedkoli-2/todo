import { auth } from "@/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import { listTodos, todoStatusCounts } from "@/server/services/todo.service";
import { listAccounts } from "@/server/services/wallet.service";
import { listPersons } from "@/server/services/ledger.service";
import OverviewClient from "@/components/OverviewClient";

/**
 * Ceiling on the tasks the overview loads. The page shows every active task as
 * a card rather than a capped preview, but "every" still needs a bound — an
 * unbounded find() on a busy account would render hundreds of cards into the
 * first paint. Anyone past this has the "View all tasks" link, which is the
 * paginated surface built for it.
 */
const OVERVIEW_TASK_LIMIT = 100;

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  await dbConnect();

  // Load all overview data concurrently
  const [{ todos }, counts, accounts, persons] = await Promise.all([
    listTodos(userId, { page: 1, limit: OVERVIEW_TASK_LIMIT }),
    todoStatusCounts(userId),
    listAccounts(userId),
    listPersons(userId),
  ]);

  return (
    <OverviewClient
      initialTodos={todos}
      taskCounts={counts}
      initialAccounts={accounts}
      initialPersons={persons}
    />
  );
}
