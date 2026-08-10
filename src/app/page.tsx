import { auth } from "@/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import { listTodos } from "@/server/services/todo.service";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

/** Upper bound on the initial payload; the client filters within it. */
const INITIAL_PAGE_SIZE = 100;

export default async function HomePage() {
  // `middleware.ts` already gated this route; the session is re-read here for
  // the user id, and the redirect is a defence-in-depth fallback.
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await dbConnect();
  const { todos } = await listTodos(session.user.id, {
    page: 1,
    limit: INITIAL_PAGE_SIZE,
  });

  return <HomeClient initialTodos={todos} />;
}
