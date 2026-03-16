import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OTP from '@/models/OTP';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    await connectDB();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to DB (expires in 5 mins as per model)
    await OTP.findOneAndUpdate(
      { email },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.MAIL_FROM,
      to: email,
      subject: `Your Verification Code: ${otp}`,
      text: `Your Open Gallery verification code is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="background-color: #fafafa; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
          <div style="max-width: 400px; margin: 0 auto; background-color: #ffffff; border: 1px solid #dbdbdb; border-radius: 1px; padding: 40px 20px;">
            <!-- Brand -->
            <h1 style="font-size: 28px; font-weight: 800; color: #262626; margin-bottom: 30px; letter-spacing: -1px; font-style: italic;">Open Gallery</h1>
            
            <div style="text-align: left; margin-bottom: 30px;">
                <p style="font-size: 16px; font-weight: 600; color: #262626; margin-bottom: 15px;">Hey there,</p>
                <p style="font-size: 14px; color: #737373; line-height: 1.5; margin-bottom: 25px;">
                    Someone tried to sign up or log in to Open Gallery with your email. If this was you, use the code below to verify your account:
                </p>
            </div>

            <!-- OTP Code -->
            <div style="margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #efefef; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: 700; color: #0095f6; letter-spacing: 10px;">${otp}</span>
            </div>

            <p style="font-size: 13px; color: #8e8e8e; margin-bottom: 30px;">
              This code is valid for <strong>5 minutes</strong>. If you didn't request this code, you can safely ignore this email.
            </p>

            <div style="border-top: 1px solid #efefef; padding-top: 20px; margin-top: 20px;">
                <p style="font-size: 12px; color: #c7c7c7; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                    From DS Open Community
                </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; color: #8e8e8e; font-size: 12px;">
            &copy; 2024 Open Gallery. All rights reserved.
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'OTP sent successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ message: 'Failed to send OTP' }, { status: 500 });
  }
}
