"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OverviewClient from "@/components/OverviewClient";
import TasksClient from "@/components/TasksClient";
import { TODOS, COUNTS } from "./fixtures";

function Screen() {
  const which = useSearchParams().get("s") ?? "overview";
  if (which === "tasks") return <TasksClient initialTodos={TODOS} />;
  return (
    <OverviewClient
      initialTodos={TODOS}
      taskCounts={COUNTS}
    />
  );
}

export default function DevPreview() {
  return <Suspense><Screen /></Suspense>;
}
