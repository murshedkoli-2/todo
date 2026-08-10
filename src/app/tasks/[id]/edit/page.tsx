import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import dbConnect from "@/lib/dbConnect";
import { getTodo } from "@/server/services/todo.service";
import { NotFoundError } from "@/lib/api/errors";
import type { TodoDTO } from "@/lib/dto/todo";
import TaskForm from "@/components/TaskForm";

interface Props {
  params: { id: string };
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Ownership is enforced by the query, not by a check after the fact. */
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
  if (!session?.user?.id) return { title: "Edit Task — TaskFlow" };

  const todo = await loadTodo(params.id, session.user.id);
  return { title: todo ? `Edit "${todo.title}" — TaskFlow` : "Edit Task — TaskFlow" };
}

export default async function EditTaskPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const todo = await loadTodo(params.id, session.user.id);
  if (!todo) notFound();

  return <TaskForm todo={todo} />;
}
