import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { sendOtpEmail } from "@/lib/mail";

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

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "This email is already verified. You can log in directly." },
        { status: 400 }
      );
    }

    // Generate new 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save/update OTP in database
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, expiresAt },
      { upsert: true, new: true }
    );

    // Send email with OTP
    const emailSent = await sendOtpEmail(email, otpCode);
    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send OTP. Please check your SMTP configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "A new OTP code has been sent to your email",
    });
  } catch (error: unknown) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
