export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Todo from "@/models/Todo";
import type { PaymentStatus } from "@/lib/types";

function serialize(todo: InstanceType<typeof Todo>) {
  return {
    _id:             todo._id.toString(),
    title:           todo.title,
    description:     todo.description,
    status:          todo.status,
    dueDate:         todo.dueDate ? todo.dueDate.toISOString() : null,
    createdAt:       todo.createdAt.toISOString(),
    updatedAt:       todo.updatedAt.toISOString(),
    userId:          todo.userId.toString(),
    ownerName:       "Me",
    images:          todo.images ?? [],
    featureImage:    todo.featureImage ?? null,
    paymentAmount:   todo.paymentAmount ?? null,
    paymentCurrency: todo.paymentCurrency ?? "BDT",
    paymentStatus:   todo.paymentStatus ?? "unpaid",
  };
}

// GET /api/todos
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const todos = await Todo.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean();

    const result = todos.map((t) => ({
      _id:             t._id.toString(),
      title:           t.title,
      description:     t.description,
      status:          t.status,
      dueDate:         t.dueDate ? t.dueDate.toISOString() : null,
      createdAt:       t.createdAt.toISOString(),
      updatedAt:       t.updatedAt.toISOString(),
      userId:          t.userId.toString(),
      ownerName:       "Me",
      images:          (t.images as string[]) ?? [],
      featureImage:    (t.featureImage as string | undefined) ?? null,
      paymentAmount:   (t.paymentAmount as number | undefined) ?? null,
      paymentCurrency: (t.paymentCurrency as string) ?? "BDT",
      paymentStatus:   ((t.paymentStatus as string) ?? "unpaid") as PaymentStatus,
    }));

    return NextResponse.json({ todos: result });
  } catch (error) {
    console.error("GET /api/todos error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/todos
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      title, description, status, dueDate,
      images, featureImage,
      paymentAmount, paymentCurrency, paymentStatus,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    await dbConnect();

    const todo = await Todo.create({
      userId:          session.user.id,
      title:           title.trim(),
      description:     description?.trim() || undefined,
      status:          status || "todo",
      dueDate:         dueDate ? new Date(dueDate) : undefined,
      images:          Array.isArray(images) ? images : [],
      featureImage:    featureImage || undefined,
      paymentAmount:   paymentAmount != null ? Number(paymentAmount) : undefined,
      paymentCurrency: paymentCurrency || "BDT",
      paymentStatus:   paymentStatus || "unpaid",
    });

    return NextResponse.json(serialize(todo), { status: 201 });
  } catch (error) {
    console.error("POST /api/todos error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
