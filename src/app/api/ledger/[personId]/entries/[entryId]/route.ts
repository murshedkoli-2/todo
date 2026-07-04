import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import LedgerEntry from "@/models/LedgerEntry";
import { Types } from "mongoose";

interface Params { params: { personId: string; entryId: string } }

// DELETE /api/ledger/[personId]/entries/[entryId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = params;
  if (!Types.ObjectId.isValid(entryId)) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const entry = await LedgerEntry.findOneAndDelete({ _id: entryId, userId });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
