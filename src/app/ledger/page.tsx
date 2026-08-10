import { auth } from "@/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import { listPersons } from "@/server/services/ledger.service";
import LedgerClient from "@/components/LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await dbConnect();
  // One aggregation for every balance — this page used to issue one query per
  // person on top of the list query.
  const persons = await listPersons(session.user.id);

  return <LedgerClient initialPersons={persons} />;
}
