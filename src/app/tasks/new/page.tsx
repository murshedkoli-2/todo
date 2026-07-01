import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import TaskForm from "@/components/TaskForm";

export const metadata: Metadata = {
  title: "New Task — TaskFlow",
  description: "Create a new task in your TaskFlow dashboard.",
};

export default async function NewTaskPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <TaskForm />;
}
