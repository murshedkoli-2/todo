export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Ledger from "@/models/Ledger";
import LedgerEntry from "@/models/LedgerEntry";
import { LedgerPersonWithBalance } from "@/lib/types";
import LedgerClient from "@/components/LedgerClient";

async function getLedgerPersons(userId: string): Promise<LedgerPersonWithBalance[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  try {
    await dbConnect();
    const persons = await Ledger.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

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
    return results;
  } catch (err) {
    console.error("Failed to load ledger:", err);
    return [];
  }
}

export default async function LedgerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!Types.ObjectId.isValid(session.user.id)) redirect("/api/auth/signout?callbackUrl=/login");

  const persons = await getLedgerPersons(session.user.id);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <LedgerClient initialPersons={persons} />
    </div>
  );
}
