import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", async () => {
  const actual = await vi.importActual<typeof import("next-auth")>("next-auth");
  return {
    ...actual,
    getServerSession: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/slug-validator", () => ({
  validateBusinessSlug: vi.fn(),
}));

vi.mock("@wine-club/db", () => ({
  prisma: {
    business: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

const mockedImports = async () => {
  const auth = await import("next-auth");
  const slug = await import("@/lib/slug-validator");
  const db = await import("@wine-club/db");
  const create = await import("@/app/api/business/create/route");
  const connect = await import("@/app/api/stripe/connect/account-link/route");

  return {
    getServerSession: auth.getServerSession,
    validateBusinessSlug: slug.validateBusinessSlug,
    prisma: db.prisma,
    createBusiness: create.POST,
    createAccountLink: connect.POST,
  };
};

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("Business onboarding API", () => {
  let getServerSessionMock: any;
  let validateSlugMock: any;
  let prismaMock: any;
  let createBusiness: (req: NextRequest) => Promise<Response>;
  let createAccountLink: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.MOCK_STRIPE_CONNECT = "true";

    const imports = await mockedImports();
    getServerSessionMock = imports.getServerSession as any;
    validateSlugMock = imports.validateBusinessSlug as any;
    prismaMock = imports.prisma as any;
    createBusiness = imports.createBusiness;
    createAccountLink = imports.createAccountLink;
  });

  describe("create business route", () => {
    it("returns 401 when user is not authenticated", async () => {
      vi.mocked(getServerSessionMock).mockResolvedValueOnce(null as any);

      const response = await createBusiness(buildRequest({}));
      expect(response.status).toBe(401);
    });

    it("validates slug and returns error when invalid", async () => {
      vi.mocked(getServerSessionMock).mockResolvedValueOnce({ user: { id: "user_1" } } as any);
      vi.mocked(validateSlugMock).mockResolvedValueOnce("Slug invalid");

      const response = await createBusiness(
        buildRequest({ name: "Test Biz", slug: "valid-slug" })
      );

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error).toBe("Slug invalid");
    });

    it("creates business and audit log on success", async () => {
      vi.mocked(getServerSessionMock).mockResolvedValueOnce({ user: { id: "user_2" } } as any);
      vi.mocked(validateSlugMock).mockResolvedValueOnce(null);
      vi.mocked(prismaMock.business.create).mockResolvedValueOnce({
        id: "biz_123",
        name: "Vintigo Test",
        slug: "vintigo-test",
      } as any);

      const response = await createBusiness(
        buildRequest({
          name: "Vintigo Test",
          slug: "vintigo-test",
          country: "US",
          currency: "USD",
          timeZone: "America/New_York",
        })
      );

      expect(response.status).toBe(201);
      expect(prismaMock.business.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Vintigo Test",
            slug: "vintigo-test",
          }),
        })
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe("stripe connect account-link route (mock mode)", () => {
    it("returns 401 without auth", async () => {
      vi.mocked(getServerSessionMock).mockResolvedValueOnce(null as any);
      const response = await createAccountLink(
        buildRequest({ businessId: "biz_1", refreshUrl: "http://localhost", returnUrl: "http://localhost" })
      );
      expect(response.status).toBe(401);
    });

    it("creates mock link and marks business pending", async () => {
      vi.mocked(getServerSessionMock).mockResolvedValueOnce({ user: { id: "user_3", email: "test@example.com" } } as any);
      vi.mocked(prismaMock.business.findFirst).mockResolvedValueOnce({
        id: "biz_3",
        name: "Mock Biz",
        status: "CREATED",
        stripeAccountId: null,
        users: [{ userId: "user_3" }],
      } as any);
      vi.mocked(prismaMock.business.update).mockResolvedValueOnce({
        id: "biz_3",
        stripeAccountId: "acct_mock_biz_3",
        status: "ONBOARDING_PENDING",
      } as any);

      const response = await createAccountLink(
        buildRequest({
          businessId: "biz_3",
          refreshUrl: "http://localhost/onboarding/connect",
          returnUrl: "http://localhost/onboarding/success",
        })
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.url).toContain("/onboarding/success");
      expect(prismaMock.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "biz_3" },
          data: expect.objectContaining({ status: "ONBOARDING_PENDING" }),
        })
      );
    });
  });
});
