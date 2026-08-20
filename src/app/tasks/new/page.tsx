import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import TaskForm from "@/components/TaskForm";

export const metadata: Metadata = {
  title: "New Task — TaskFlow",
  description: "Create a new task in your TaskFlow dashboard.",
};

interface NewTaskPageProps {
  searchParams: { title?: string };
}

/**
 * `?title=` carries a draft over from the quick-add bar's "More options", so
 * switching to the full form never costs the user what they had already typed.
 */
export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Clamped to the schema's own limit rather than trusted from the query.
  const initialTitle = (searchParams.title ?? "").slice(0, 200);

  return <TaskForm initialTitle={initialTitle} />;
}
