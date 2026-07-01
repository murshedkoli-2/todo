import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Todo from "@/models/Todo";

export const dynamic = "force-dynamic";

function serializeTodo(todo: InstanceType<typeof Todo>) {
  return {
    _id: todo._id.toString(),
    title: todo.title,
    description: todo.description,
    status: todo.status,
    dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    userId: todo.userId.toString(),
    ownerName: "Me",
    images: todo.images ?? [],
    featureImage: todo.featureImage ?? null,
  };
}

// DELETE /api/todos/[id]/images — remove one image URL from the todo's images array
// Body: { url: string }
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    await dbConnect();

    const todo = await Todo.findById(id);
    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    if (todo.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Remove from images array
    todo.images = todo.images.filter((img: string) => img !== url);

    // If the deleted image was the feature image, promote the next one
    if (todo.featureImage === url) {
      todo.featureImage = todo.images[0] ?? undefined;
    }

    await todo.save();

    // Note: ImgBB images are hosted on their CDN.
    // Deletion via the ImgBB delete URL is a browser action, not an API call,
    // so we only remove the reference from our database here.

    return NextResponse.json(serializeTodo(todo));
  } catch (error) {
    console.error("DELETE /api/todos/[id]/images error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/todos/[id]/images — set feature image or add an image URL
// Body: { featureImage?: string; addUrl?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { featureImage, addUrl } = body as { featureImage?: string; addUrl?: string };

    await dbConnect();

    const todo = await Todo.findById(id);
    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    if (todo.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (featureImage !== undefined) {
      todo.featureImage = featureImage || undefined;
    }

    if (addUrl) {
      if (!todo.images.includes(addUrl)) {
        todo.images.push(addUrl);
      }
      // Auto-set as feature image if it's the first one
      if (!todo.featureImage) {
        todo.featureImage = addUrl;
      }
    }

    await todo.save();

    return NextResponse.json(serializeTodo(todo));
  } catch (error) {
    console.error("PATCH /api/todos/[id]/images error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
