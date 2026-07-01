import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { sendOtpEmail } from "@/lib/mail";

// Apply DNS Patch for Vercel/MongoDB Atlas
import "@/lib/dnsPatch";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    // Check if verified user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { error: "Email is already in use" },
          { status: 400 }
        );
      } else {
        // Update the unverified user with new details
        const hashedPassword = await bcrypt.hash(password, 12);
        existingUser.name = name;
        existingUser.password = hashedPassword;
        await existingUser.save();
      }
    } else {
      // Create new unverified user
      const hashedPassword = await bcrypt.hash(password, 12);
      await User.create({
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
      });
    }

    // Generate 6-digit OTP
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
        { error: "Failed to send OTP verification email. Please check your email or SMTP configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent to your email",
      email,
    });
  } catch (error: unknown) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
