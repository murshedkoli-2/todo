import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTx from "@/models/WalletTx";
import { Types } from "mongoose";

interface Params { params: { walletId: string; txId: string } }

// DELETE /api/wallet/[walletId]/tx/[txId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { walletId, txId } = params;
  if (!Types.ObjectId.isValid(walletId) || !Types.ObjectId.isValid(txId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await dbConnect();
  const userId = new Types.ObjectId(session.user.id);

  const tx = await WalletTx.findOneAndDelete({ _id: txId, walletId, userId });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reverse the balance change on the wallet
  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (wallet) {
    wallet.balance = tx.type === "credit"
      ? wallet.balance - tx.amount
      : wallet.balance + tx.amount;
    await wallet.save();
  }

  return NextResponse.json({ success: true, newBalance: wallet?.balance ?? 0 });
}
