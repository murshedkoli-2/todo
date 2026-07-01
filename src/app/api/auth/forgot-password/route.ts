import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { sendPasswordResetEmail } from "@/lib/mail";

// Apply DNS Patch for Vercel/MongoDB Atlas
import "@/lib/dnsPatch";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });

    if (!user || !user.emailVerified) {
      return NextResponse.json(
        { error: "No verified account found with this email address." },
        { status: 404 }
      );
    }

    // Generate 6-digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Upsert the reset token record
    await PasswordResetToken.findOneAndUpdate(
      { email: cleanEmail },
      { token: resetCode, expiresAt },
      { upsert: true, new: true }
    );

    // Send the email
    const emailSent = await sendPasswordResetEmail(cleanEmail, resetCode);
    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send password reset email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "A password reset code has been sent to your email address.",
      email: cleanEmail,
    });
  } catch (error: unknown) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
