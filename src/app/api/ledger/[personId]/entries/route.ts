import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Ledger from "@/models/Ledger";
import LedgerEntry from "@/models/LedgerEntry";
import { Types } from "mongoose";

interface Params { params: { personId: string } }

// GET /api/ledger/[personId]/entries — list entries for a person
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

  const entries = await LedgerEntry.find({ personId, userId })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let runningBalance = 0;
  const mapped = entries.map((e) => {
    if (e.type === "receivable") runningBalance += e.amount;
    else runningBalance -= e.amount;
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

  return NextResponse.json(mapped);
}

// POST /api/ledger/[personId]/entries — add a new entry
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { personId } = params;
  if (!Types.ObjectId.isValid(personId)) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const body = await req.json();
  const { type, amount, note, date } = body;

  if (!type || !["receivable", "payable"].includes(type)) {
    return NextResponse.json({ error: "Type must be receivable or payable" }, { status: 400 });
  }
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  // Verify person belongs to this user
  const person = await Ledger.findOne({ _id: personId, userId });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const entry = await LedgerEntry.create({
    userId,
    personId: new Types.ObjectId(personId),
    type,
    amount: Number(amount),
    note: note?.trim(),
    date: date ? new Date(date) : new Date(),
  });

  return NextResponse.json({
    _id: entry._id.toString(),
    personId: entry.personId.toString(),
    userId: entry.userId.toString(),
    type: entry.type,
    amount: entry.amount,
    note: entry.note,
    date: entry.date.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }, { status: 201 });
}
