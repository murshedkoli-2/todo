import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Ledger from "@/models/Ledger";
import LedgerEntry from "@/models/LedgerEntry";
import { Types } from "mongoose";

// GET /api/ledger — list all persons with computed balance
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const persons = await Ledger.find({ userId }).sort({ createdAt: -1 }).lean();

  // For each person, compute balance from entries
  const results = await Promise.all(
    persons.map(async (p) => {
      const entries = await LedgerEntry.find({ personId: p._id }).lean();

      let totalReceivable = 0;
      let totalPayable = 0;
      let lastEntryDate: string | null = null;

      for (const e of entries) {
        if (e.type === "receivable") totalReceivable += e.amount;
        else totalPayable += e.amount;

        const d = (e.date as Date).toISOString();
        if (!lastEntryDate || d > lastEntryDate) lastEntryDate = d;
      }

      return {
        _id: p._id.toString(),
        name: p.name,
        note: p.note,
        userId: p.userId.toString(),
        createdAt: (p.createdAt as Date).toISOString(),
        updatedAt: (p.updatedAt as Date).toISOString(),
        balance: totalReceivable - totalPayable,
        totalReceivable,
        totalPayable,
        lastEntryDate,
        entryCount: entries.length,
      };
    })
  );

  return NextResponse.json(results);
}

// POST /api/ledger — create a new person
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, note, initialAmount, initialType } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const person = await Ledger.create({ userId, name: name.trim(), note: note?.trim() });

  // If initial amount provided, create an initial entry
  if (initialAmount && Number(initialAmount) > 0) {
    const type = initialType === "payable" ? "payable" : "receivable";
    await LedgerEntry.create({
      userId,
      personId: person._id,
      type,
      amount: Number(initialAmount),
      note: "Opening balance",
      date: new Date(),
    });
  }

  return NextResponse.json({
    _id: person._id.toString(),
    name: person.name,
    note: person.note,
    userId: person.userId.toString(),
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
    balance: initialAmount && Number(initialAmount) > 0
      ? (initialType === "payable" ? -Number(initialAmount) : Number(initialAmount))
      : 0,
    totalReceivable: initialAmount && initialType !== "payable" ? Number(initialAmount) : 0,
    totalPayable: initialAmount && initialType === "payable" ? Number(initialAmount) : 0,
    lastEntryDate: initialAmount ? new Date().toISOString() : null,
    entryCount: initialAmount ? 1 : 0,
  }, { status: 201 });
}
