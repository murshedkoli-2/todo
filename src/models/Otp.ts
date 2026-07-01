import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOtp extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: [true, "OTP is required"],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: document will expire at the exact date in expiresAt
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Ensure there is an index on email as well for faster queries
OtpSchema.index({ email: 1 });

const Otp: Model<IOtp> =
  mongoose.models.Otp || mongoose.model<IOtp>("Otp", OtpSchema);

export default Otp;
