import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { authConfig } from "@/auth.config";

/**
 * A bcrypt hash of a throwaway value, compared against when no user matches.
 *
 * Returning early on an unknown email makes the request measurably faster than
 * one for a real account, which turns login timing into a user-enumeration
 * oracle. Hashing regardless keeps both paths on the same order of magnitude.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Kl7Y6oqQ6P4pJ1x8Q9YKgQ5nQ8Xy2a";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await dbConnect();
        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const user = await User.findOne({ email });
        const passwordMatches = await bcrypt.compare(
          password,
          user?.password ?? DUMMY_HASH
        );

        // One message for "no such user" and "wrong password" — distinguishing
        // them tells an attacker which addresses are registered.
        if (!user || !passwordMatches) {
          throw new Error("Incorrect email or password");
        }

        if (!user.emailVerified) {
          throw new Error("Please verify your email before logging in");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
});
