import { auth } from "@/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import { listAccounts } from "@/server/services/wallet.service";
import WalletClient from "@/components/WalletClient";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await dbConnect();
  const wallets = await listAccounts(session.user.id);

  return <WalletClient initialWallets={wallets} />;
}
