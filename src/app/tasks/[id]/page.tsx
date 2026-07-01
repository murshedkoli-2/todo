import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import dbConnect from "@/lib/dbConnect";
import TodoModel from "@/models/Todo";
import { Todo } from "@/lib/types";
import TaskView from "@/components/TaskView";

interface Props {
  params: { id: string };
}

async function getTodo(id: string): Promise<Todo | null> {
  try {
    await dbConnect();
    const raw = await TodoModel.findById(id).lean();
    if (!raw) return null;
    return {
      _id:             raw._id.toString(),
      title:           raw.title,
      description:     raw.description,
      status:          raw.status as Todo["status"],
      dueDate:         raw.dueDate ? raw.dueDate.toISOString() : null,
      createdAt:       (raw.createdAt as Date).toISOString(),
      updatedAt:       (raw.updatedAt as Date).toISOString(),
      userId:          raw.userId.toString(),
      ownerName:       "Me",
      images:          (raw.images as string[]) ?? [],
      featureImage:    (raw.featureImage as string | undefined) ?? null,
      paymentAmount:   (raw.paymentAmount as number | undefined) ?? null,
      paymentCurrency: (raw.paymentCurrency as string) ?? "BDT",
      paymentStatus:   ((raw.paymentStatus as string) ?? "unpaid") as Todo["paymentStatus"],
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const todo = await getTodo(params.id);
  return {
    title: todo ? `${todo.title} — TaskFlow` : "Task Details — TaskFlow",
  };
}

export default async function TaskDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const todo = await getTodo(params.id);
  if (!todo || todo.userId !== session.user.id) notFound();

  return <TaskView todo={todo} />;
}
