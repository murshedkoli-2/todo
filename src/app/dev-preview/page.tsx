"use client";

// TEMPORARY design-review harness. Deleted before commit.
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OverviewClient from "@/components/OverviewClient";
import TasksClient from "@/components/TasksClient";
import LedgerClient from "@/components/LedgerClient";
import WalletClient from "@/components/WalletClient";
import { TODOS, COUNTS, ACCOUNTS, PERSONS } from "./fixtures";

function Screen() {
  const which = useSearchParams().get("s") ?? "overview";
  if (which === "tasks") return <TasksClient initialTodos={TODOS} />;
  if (which === "ledger") return <LedgerClient initialPersons={PERSONS} />;
  if (which === "wallet") return <WalletClient initialWallets={ACCOUNTS} />;
  return (
    <OverviewClient
      initialTodos={TODOS}
      taskCounts={COUNTS}
      initialAccounts={ACCOUNTS}
      initialPersons={PERSONS}
    />
  );
}

export default function DevPreview() {
  return <Suspense><Screen /></Suspense>;
}
