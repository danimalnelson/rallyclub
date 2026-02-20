import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@wine-club/db";
import type { Adapter } from "next-auth/adapters";
import { Resend } from "resend";
import bcrypt from "bcryptjs";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const isDev = process.env.NODE_ENV === "development";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          select: { id: true, email: true, name: true, password: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    EmailProvider({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      async sendVerificationRequest({ identifier: email, url }) {
        if (isDev) {
          console.log(`[AUTH] Magic link for ${email}: ${url}`);
        }

        if (!resend) {
          console.error("[AUTH] Resend not configured - RESEND_API_KEY missing");
          throw new Error("Email service not configured");
        }

        const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";

        const result = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "Sign in to Vintigo",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Sign in to Vintigo</h2>
              <p>Click the button below to sign in:</p>
              <a href="${url}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Sign In</a>
              <p style="color: #666; font-size: 14px;">This link expires in 24 hours. If you didn't request this email, you can safely ignore it.</p>
            </div>
          `,
        });

        if (result.error) {
          console.error(`[AUTH] Resend error: ${result.error.message}`);
          throw new Error(`Resend error: ${result.error.message}`);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }) {
      // Send welcome email for new users (non-blocking)
      if (user?.id) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { businesses: true },
          });

          if (existingUser && existingUser.businesses.length === 0) {
            const accounts = await prisma.account.findMany({
              where: { userId: user.id },
            });

            if (accounts.length === 1 && resend && user.email) {
              resend.emails
                .send({
                  from: process.env.EMAIL_FROM || "onboarding@resend.dev",
                  to: user.email,
                  subject: "Welcome to Vintigo!",
                  html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to Vintigo!</h2>
                    <p>Your account has been successfully created.</p>
                    <p>Get started by creating your first wine club business and begin accepting members.</p>
                    <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/onboarding" 
                       style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                      Get Started
                    </a>
                    <p style="color: #666; font-size: 14px;">Need help? Contact our support team.</p>
                  </div>
                `,
                })
                .catch((error) => {
                  console.error("[AUTH] Failed to send welcome email:", error);
                });
            }
          }
        } catch (error) {
          console.error("[AUTH] Error checking new user status:", error);
        }
      }

      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.businessId = token.businessId as string | undefined;
        session.twoFactorVerified = token.twoFactorVerified ?? false;
        session.hasPassword = token.hasPassword ?? false;
        session.isSuperAdmin = token.isSuperAdmin ?? false;
      }
      return session;
    },
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.twoFactorVerified = false;

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { password: true, isSuperAdmin: true },
        });
        token.hasPassword = !!dbUser?.password;
        token.isSuperAdmin = dbUser?.isSuperAdmin ?? false;
      }

      // Allow updating via session.update()
      if (trigger === "update") {
        if (session?.businessId) {
          token.businessId = session.businessId;
        }
        if (session?.userName) {
          token.name = session.userName;
        }
        if (typeof session?.twoFactorVerified === "boolean") {
          token.twoFactorVerified = session.twoFactorVerified;
        }
        if (typeof session?.hasPassword === "boolean") {
          token.hasPassword = session.hasPassword;
        }
      }

      if (token.sub && (!token.businessId || !token.name)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            name: true,
            password: true,
            isSuperAdmin: true,
            businesses: {
              select: { businessId: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        });
        if (dbUser) {
          if (!token.name && dbUser.name) {
            token.name = dbUser.name;
          }
          if (!token.businessId && dbUser.businesses[0]) {
            token.businessId = dbUser.businesses[0].businessId;
          }
          token.hasPassword = !!dbUser.password;
          token.isSuperAdmin = dbUser.isSuperAdmin;
        }
      }

      return token;
    },
  },
};
