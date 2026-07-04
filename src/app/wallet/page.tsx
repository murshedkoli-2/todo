export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTx from "@/models/WalletTx";
import { WalletAccount } from "@/lib/types";
import WalletClient from "@/components/WalletClient";

async function getWallets(userId: string): Promise<WalletAccount[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  try {
    await dbConnect();
    const wallets = await Wallet.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: 1 })
      .lean();
    return await Promise.all(
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
  } catch (err) {
    console.error("Failed to load wallets:", err);
    return [];
  }
}

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!Types.ObjectId.isValid(session.user.id)) redirect("/api/auth/signout?callbackUrl=/login");

  const wallets = await getWallets(session.user.id);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <WalletClient initialWallets={wallets} />
    </div>
  );
}
