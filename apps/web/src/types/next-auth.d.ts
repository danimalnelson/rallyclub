import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    businessId?: string;
    twoFactorVerified?: boolean;
    hasPassword?: boolean;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    businessId?: string;
    twoFactorVerified?: boolean;
    hasPassword?: boolean;
    isSuperAdmin?: boolean;
  }
}
