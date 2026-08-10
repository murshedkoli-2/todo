import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import dbConnect from "@/lib/dbConnect";
import { getTodo } from "@/server/services/todo.service";
import { NotFoundError } from "@/lib/api/errors";
import type { TodoDTO } from "@/lib/dto/todo";
import TaskView from "@/components/TaskView";

interface Props {
  params: { id: string };
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Loads the task, scoped to the signed-in user.
 *
 * The previous version fetched by id alone and compared ownership afterwards;
 * the service filters on `userId` in the query itself, so another user's task
 * is never read into memory in the first place.
 */
async function loadTodo(id: string, userId: string): Promise<TodoDTO | null> {
  if (!OBJECT_ID.test(id)) return null;
  try {
    await dbConnect();
    return await getTodo(userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return { title: "Task Details — TaskFlow" };

  const todo = await loadTodo(params.id, session.user.id);
  return { title: todo ? `${todo.title} — TaskFlow` : "Task Details — TaskFlow" };
}

export default async function TaskDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const todo = await loadTodo(params.id, session.user.id);
  if (!todo) notFound();

  return <TaskView todo={todo} />;
}
