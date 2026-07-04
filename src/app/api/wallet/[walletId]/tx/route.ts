import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTx from "@/models/WalletTx";
import { Types } from "mongoose";

interface Params { params: { walletId: string } }

// POST /api/wallet/[walletId]/tx — add a transaction
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { walletId } = params;
  if (!Types.ObjectId.isValid(walletId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const { type, amount, note, date } = body;

  if (!["credit", "debit"].includes(type)) {
    return NextResponse.json({ error: "Type must be credit or debit" }, { status: 400 });
  }
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

  const amt = Number(amount);
  const newBalance = type === "credit" ? wallet.balance + amt : wallet.balance - amt;

  // Update wallet balance
  wallet.balance = newBalance;
  await wallet.save();

  const tx = await WalletTx.create({
    userId,
    walletId: new Types.ObjectId(walletId),
    type,
    amount: amt,
    note: note?.trim(),
    date: date ? new Date(date) : new Date(),
    balanceAfter: newBalance,
  });

  return NextResponse.json({
    _id: tx._id.toString(),
    walletId: tx.walletId.toString(),
    userId: tx.userId.toString(),
    type: tx.type,
    amount: tx.amount,
    note: tx.note,
    date: tx.date.toISOString(),
    balanceAfter: tx.balanceAfter,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    newWalletBalance: newBalance,
  }, { status: 201 });
}
