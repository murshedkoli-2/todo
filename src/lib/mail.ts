import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Sends a 6-digit OTP verification code to the user's email.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD not set in environment variables");
    return false;
  }

  const mailOptions = {
    from: `"TaskFlow" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Verify your email - TaskFlow",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0969da; margin: 0;">TaskFlow</h2>
        </div>
        <hr style="border: 0; border-top: 1px solid #e1e8ed; margin-bottom: 20px;" />
        <p style="font-size: 16px; color: #1c2128; line-height: 1.5;">Hello,</p>
        <p style="font-size: 16px; color: #1c2128; line-height: 1.5;">Thank you for registering with TaskFlow. Please use the following One-Time Password (OTP) to verify your email address. This OTP is valid for 10 minutes:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0969da; background-color: #f6f8fa; padding: 12px 24px; border-radius: 8px; border: 1px solid #d0d7de;">
            ${otp}
          </span>
        </div>

        <p style="font-size: 14px; color: #57606a; line-height: 1.5;">If you did not request this verification, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e1e8ed; margin-top: 20px; margin-bottom: 20px;" />
        <p style="font-size: 12px; color: #8c959f; text-align: center; margin: 0;">
          TaskFlow © ${new Date().getFullYear()}
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
}

/**
 * Sends a 6-digit password reset verification code to the user's email.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD not set in environment variables");
    return false;
  }

  const mailOptions = {
    from: `"TaskFlow Support" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Reset your password - TaskFlow",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #bc4c00; margin: 0;">TaskFlow Password Reset</h2>
        </div>
        <hr style="border: 0; border-top: 1px solid #e1e8ed; margin-bottom: 20px;" />
        <p style="font-size: 16px; color: #1c2128; line-height: 1.5;">Hello,</p>
        <p style="font-size: 16px; color: #1c2128; line-height: 1.5;">We received a request to reset the password for your TaskFlow account. Please use the following One-Time Code to reset your password. This code is valid for 10 minutes:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #bc4c00; background-color: #f6f8fa; padding: 12px 24px; border-radius: 8px; border: 1px solid #d0d7de;">
            ${token}
          </span>
        </div>

        <p style="font-size: 14px; color: #57606a; line-height: 1.5;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
        <hr style="border: 0; border-top: 1px solid #e1e8ed; margin-top: 20px; margin-bottom: 20px;" />
        <p style="font-size: 12px; color: #8c959f; text-align: center; margin: 0;">
          TaskFlow © ${new Date().getFullYear()}
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}
