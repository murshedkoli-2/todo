import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTx from "@/models/WalletTx";
import { Types } from "mongoose";

// GET /api/wallet — list all accounts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);
  const wallets = await Wallet.find({ userId }).sort({ createdAt: 1 }).lean();

  const result = await Promise.all(
    wallets.map(async (w) => {
      const txCount = await WalletTx.countDocuments({ walletId: w._id });
      return {
        _id: w._id.toString(),
        userId: w.userId.toString(),
        name: w.name,
        accountType: w.accountType,
        provider: w.provider,
        accountNumber: w.accountNumber,
        balance: w.balance,
        color: w.color,
        createdAt: (w.createdAt as Date).toISOString(),
        updatedAt: (w.updatedAt as Date).toISOString(),
        txCount,
      };
    })
  );

  return NextResponse.json(result);
}

// POST /api/wallet — create a new account
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, accountType, provider, accountNumber, initialBalance, color } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!["cash", "mobile_banking", "bank_account"].includes(accountType)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);
  const opening = Number(initialBalance) || 0;

  const wallet = await Wallet.create({
    userId,
    name: name.trim(),
    accountType,
    provider: provider?.trim(),
    accountNumber: accountNumber?.trim(),
    balance: opening,
    color: color?.trim(),
  });

  // Record opening balance as a credit transaction if > 0
  if (opening > 0) {
    await WalletTx.create({
      userId,
      walletId: wallet._id,
      type: "credit",
      amount: opening,
      note: "Opening balance",
      date: new Date(),
      balanceAfter: opening,
    });
  }

  return NextResponse.json({
    _id: wallet._id.toString(),
    userId: wallet.userId.toString(),
    name: wallet.name,
    accountType: wallet.accountType,
    provider: wallet.provider,
    accountNumber: wallet.accountNumber,
    balance: wallet.balance,
    color: wallet.color,
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
    txCount: opening > 0 ? 1 : 0,
  }, { status: 201 });
}
