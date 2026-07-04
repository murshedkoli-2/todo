export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import Todo from "@/models/Todo";
import { Todo as TodoType, PaymentStatus } from "@/lib/types";
import HomeClient from "@/components/HomeClient";
import { Types } from "mongoose";

async function getAllTodos(userId: string): Promise<TodoType[]> {
  // Guard: userId must be a valid MongoDB ObjectId (24-char hex string)
  if (!Types.ObjectId.isValid(userId)) {
    console.warn("getAllTodos called with invalid userId:", userId);
    return [];
  }

  try {
    await dbConnect();
    const rawTodos = await Todo.find({ userId }).sort({ createdAt: -1 }).lean();

    return rawTodos.map((t) => ({
      _id:             t._id.toString(),
      title:           t.title,
      description:     t.description,
      status:          t.status as TodoType["status"],
      dueDate:         t.dueDate ? t.dueDate.toISOString() : null,
      createdAt:       (t.createdAt as Date).toISOString(),
      updatedAt:       (t.updatedAt as Date).toISOString(),
      userId:          t.userId.toString(),
      ownerName:       "Me",
      images:          (t.images as string[]) ?? [],
      featureImage:    (t.featureImage as string | undefined) ?? null,
      paymentAmount:   (t.paymentAmount as number | undefined) ?? null,
      paymentCurrency: (t.paymentCurrency as string) ?? "BDT",
      paymentStatus:   ((t.paymentStatus as string) ?? "unpaid") as PaymentStatus,
    }));
  } catch (error) {
    console.error("Failed to fetch todos from database:", error);
    return [];
  }
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // If the session has a stale/invalid userId (e.g. "admin"), force re-login
  if (!Types.ObjectId.isValid(session.user.id)) {
    redirect("/api/auth/signout?callbackUrl=/login");
  }

  const todos = await getAllTodos(session.user.id);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main todo content (including menu, stats, grid, creation) */}
      <HomeClient
        initialTodos={todos}
      />
    </div>
  );
}
