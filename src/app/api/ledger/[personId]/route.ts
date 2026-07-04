import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Ledger from "@/models/Ledger";
import LedgerEntry from "@/models/LedgerEntry";
import { Types } from "mongoose";

interface Params { params: { personId: string } }

// GET /api/ledger/[personId] — get one person with all entries
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { personId } = params;
  if (!Types.ObjectId.isValid(personId)) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const person = await Ledger.findOne({ _id: personId, userId }).lean();
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await LedgerEntry.find({ personId, userId })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let runningBalance = 0;
  let totalReceivable = 0;
  let totalPayable = 0;

  const mappedEntries = entries.map((e) => {
    if (e.type === "receivable") {
      runningBalance += e.amount;
      totalReceivable += e.amount;
    } else {
      runningBalance -= e.amount;
      totalPayable += e.amount;
    }
    return {
      _id: e._id.toString(),
      personId: e.personId.toString(),
      userId: e.userId.toString(),
      type: e.type,
      amount: e.amount,
      note: e.note,
      date: (e.date as Date).toISOString(),
      createdAt: (e.createdAt as Date).toISOString(),
      updatedAt: (e.updatedAt as Date).toISOString(),
      runningBalance,
    };
  });

  return NextResponse.json({
    person: {
      _id: person._id.toString(),
      name: person.name,
      note: person.note,
      userId: person.userId.toString(),
      createdAt: (person.createdAt as Date).toISOString(),
      updatedAt: (person.updatedAt as Date).toISOString(),
      balance: runningBalance,
      totalReceivable,
      totalPayable,
    },
    entries: mappedEntries,
  });
}

// DELETE /api/ledger/[personId] — delete person + all their entries
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { personId } = params;
  if (!Types.ObjectId.isValid(personId)) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const person = await Ledger.findOneAndDelete({ _id: personId, userId });
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await LedgerEntry.deleteMany({ personId, userId });

  return NextResponse.json({ success: true });
}

// PATCH /api/ledger/[personId] — update person name/note
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { personId } = params;
  if (!Types.ObjectId.isValid(personId)) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const body = await req.json();
  const { name, note } = body;

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const update: Record<string, string> = {};
  if (name?.trim()) update.name = name.trim();
  if (note !== undefined) update.note = note?.trim() ?? "";

  const person = await Ledger.findOneAndUpdate(
    { _id: personId, userId },
    { $set: update },
    { new: true }
  ).lean();

  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    _id: person._id.toString(),
    name: person.name,
    note: person.note,
    userId: person.userId.toString(),
    createdAt: (person.createdAt as Date).toISOString(),
    updatedAt: (person.updatedAt as Date).toISOString(),
  });
}
