import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTx from "@/models/WalletTx";
import { Types } from "mongoose";

interface Params { params: { walletId: string } }

// GET /api/wallet/[walletId] — wallet + transactions
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { walletId } = params;
  if (!Types.ObjectId.isValid(walletId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const wallet = await Wallet.findOne({ _id: walletId, userId }).lean();
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const txs = await WalletTx.find({ walletId, userId }).sort({ date: -1, createdAt: -1 }).lean();

  return NextResponse.json({
    wallet: {
      _id: wallet._id.toString(),
      userId: wallet.userId.toString(),
      name: wallet.name,
      accountType: wallet.accountType,
      provider: wallet.provider,
      accountNumber: wallet.accountNumber,
      balance: wallet.balance,
      color: wallet.color,
      createdAt: (wallet.createdAt as Date).toISOString(),
      updatedAt: (wallet.updatedAt as Date).toISOString(),
    },
    transactions: txs.map((t) => ({
      _id: t._id.toString(),
      walletId: t.walletId.toString(),
      userId: t.userId.toString(),
      type: t.type,
      amount: t.amount,
      note: t.note,
      date: (t.date as Date).toISOString(),
      balanceAfter: t.balanceAfter,
      createdAt: (t.createdAt as Date).toISOString(),
      updatedAt: (t.updatedAt as Date).toISOString(),
    })),
  });
}

// PATCH /api/wallet/[walletId] — rename/update account
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { walletId } = params;
  if (!Types.ObjectId.isValid(walletId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const body = await req.json();
  const { name, provider, accountNumber, color } = body;

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);
  const update: Record<string, string | undefined> = {};
  if (name?.trim())      update.name = name.trim();
  if (provider !== undefined) update.provider = provider?.trim();
  if (accountNumber !== undefined) update.accountNumber = accountNumber?.trim();
  if (color !== undefined) update.color = color?.trim();

  const wallet = await Wallet.findOneAndUpdate({ _id: walletId, userId }, { $set: update }, { new: true }).lean();
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    _id: wallet._id.toString(),
    name: wallet.name,
    accountType: wallet.accountType,
    provider: wallet.provider,
    accountNumber: wallet.accountNumber,
    balance: wallet.balance,
    color: wallet.color,
    createdAt: (wallet.createdAt as Date).toISOString(),
    updatedAt: (wallet.updatedAt as Date).toISOString(),
  });
}

// DELETE /api/wallet/[walletId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { walletId } = params;
  if (!Types.ObjectId.isValid(walletId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const wallet = await Wallet.findOneAndDelete({ _id: walletId, userId });
  if (!wallet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await WalletTx.deleteMany({ walletId, userId });

  return NextResponse.json({ success: true });
}
