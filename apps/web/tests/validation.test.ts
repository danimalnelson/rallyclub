import { describe, it, expect } from "vitest";
import { createCheckoutSessionSchema, createPlanSchema, createPriceSchema } from "@wine-club/lib";

describe("Validation Schemas", () => {
  describe("createCheckoutSessionSchema", () => {
    it("should validate valid checkout session input", () => {
      const input = {
        priceId: "price_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      };

      const result = createCheckoutSessionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid price ID", () => {
      const input = {
        priceId: "",
      };

      const result = createCheckoutSessionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("createPlanSchema", () => {
    it("should validate valid plan input", () => {
      const input = {
        name: "Premium Plan",
        description: "Best plan for wine lovers",
        benefits: ["Benefit 1", "Benefit 2"],
      };

      const result = createPlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject plan name that's too long", () => {
      const input = {
        name: "a".repeat(101),
        description: "Description",
      };

      const result = createPlanSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("createPriceSchema", () => {
    it("should validate valid price input", () => {
      const input = {
        membershipPlanId: "plan_123",
        nickname: "Monthly",
        interval: "month" as const,
        unitAmount: 4900,
        currency: "USD",
        isDefault: true,
      };

      const result = createPriceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject negative amount", () => {
      const input = {
        membershipPlanId: "plan_123",
        interval: "month" as const,
        unitAmount: -100,
        currency: "USD",
      };

      const result = createPriceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid interval", () => {
      const input = {
        membershipPlanId: "plan_123",
        interval: "weekly",
        unitAmount: 4900,
        currency: "USD",
      };

      const result = createPriceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

