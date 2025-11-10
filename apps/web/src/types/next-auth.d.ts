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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    businessId?: string;
  }
}

