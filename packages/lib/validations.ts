import { z } from "zod";

// ===== Checkout Session =====
export const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, "Price ID is required"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

// ===== Customer Portal =====
export const createPortalLinkSchema = z.object({
  returnUrl: z.string().url().optional(),
});

export type CreatePortalLinkInput = z.infer<typeof createPortalLinkSchema>;

// ===== Plan Creation =====
export const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  benefits: z.array(z.string()).optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

// ===== Price Creation =====
export const createPriceSchema = z.object({
  membershipPlanId: z.string().min(1, "Membership plan ID is required"),
  nickname: z.string().max(100).optional(),
  interval: z.enum(["month", "year"]),
  unitAmount: z.number().int().positive("Amount must be positive"),
  currency: z.string().length(3).default("USD"),
  trialDays: z.number().int().nonnegative().optional(),
  isDefault: z.boolean().default(false),
});

export type CreatePriceInput = z.infer<typeof createPriceSchema>;

// ===== Business Creation =====
export const createBusinessSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  country: z.string().length(2).default("US"),
  currency: z.string().length(3).default("USD"),
  timeZone: z.string().default("America/New_York"),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

// ===== Connect Account =====
export const connectAccountSchema = z.object({
  businessId: z.string().min(1),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
});

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;

// ===== Business Profile Update =====
export const updateBusinessProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  logoUrl: z.string().url("Invalid URL format").or(z.literal("")).optional().nullable(),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional().nullable(),
  website: z.string().url("Invalid website URL").or(z.literal("")).optional().nullable(),
  contactEmail: z.string().email("Invalid email format").or(z.literal("")).optional().nullable(),
  contactPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format").or(z.literal("")).optional().nullable(),
  brandColorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format").optional().nullable(),
  brandColorSecondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format").or(z.literal("")).optional().nullable(),
});

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;

