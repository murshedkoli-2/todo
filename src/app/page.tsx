import { auth } from "@/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import { listTodos, todoStatusCounts } from "@/server/services/todo.service";
import { listAccounts } from "@/server/services/wallet.service";
import { listPersons } from "@/server/services/ledger.service";
import OverviewClient from "@/components/OverviewClient";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  await dbConnect();

  // Load all overview data concurrently
  const [{ todos }, counts, accounts, persons] = await Promise.all([
    listTodos(userId, { page: 1, limit: 10 }),
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
