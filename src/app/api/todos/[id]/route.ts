import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Todo from "@/models/Todo";

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

// PATCH /api/todos/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json();
    const {
      title, description, status, dueDate,
      images, featureImage,
      paymentAmount, paymentCurrency, paymentStatus,
    } = body;

    await dbConnect();

    const todo = await Todo.findById(id);
    if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 404 });

    if (todo.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (title       !== undefined) todo.title       = title.trim();
    if (description !== undefined) todo.description = description?.trim() || undefined;
    if (status      !== undefined) todo.status      = status;
    if (dueDate     !== undefined) todo.dueDate     = dueDate ? new Date(dueDate) : undefined;
    if (images      !== undefined) todo.images      = images;
    if (featureImage !== undefined) todo.featureImage = featureImage || undefined;

    // Payment fields
    if (paymentAmount   !== undefined) todo.paymentAmount   = paymentAmount != null ? Number(paymentAmount) : undefined;
    if (paymentCurrency !== undefined) todo.paymentCurrency = paymentCurrency || "BDT";
    if (paymentStatus   !== undefined) todo.paymentStatus   = paymentStatus;

    await todo.save();
    return NextResponse.json(serialize(todo));
  } catch (error) {
    console.error("PATCH /api/todos/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/todos/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    await dbConnect();

    const todo = await Todo.findById(id);
    if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 404 });

    if (todo.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await todo.deleteOne();
    return NextResponse.json({ message: "Todo deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/todos/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
