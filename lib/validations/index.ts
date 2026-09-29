import { z } from "zod";
import { Difficulty, SheetStatus, VerificationStatus, Role } from "@prisma/client";

export const difficultyEnum = z.nativeEnum(Difficulty);
export const sheetStatusEnum = z.nativeEnum(SheetStatus);
export const verificationStatusEnum = z.nativeEnum(VerificationStatus);
export const roleEnum = z.nativeEnum(Role);

/** Promote/demote a user between USER and ADMIN (admin panel + API). */
export const updateProfileRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: roleEnum,
});

/** Permanently remove a profile from the admin panel (also unlinks the auth user). */
export const deleteAdminUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

/** Connect a LeetCode handle. */
export const connectPlatformSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(100, "Username is too long")
    .regex(/^[a-zA-Z0-9_\-]+$/, "Username contains invalid characters"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rollNumber: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

const pointsField = (label: string) =>
  z
    .number()
    .min(0, `${label} points cannot be negative`)
    .max(1000, `${label} points cannot exceed 1000`)
    .int(`${label} points must be a whole number`);

export const createSheetSchema = z.object({
  name: z.string().min(1, "Sheet name is required").max(150),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(1000).optional().nullable(),
  status: sheetStatusEnum.default(SheetStatus.DRAFT),
  // Per-sheet scoring; defaults mirror the global 1/4/8 scheme.
  easyPoints: pointsField("Easy").default(1),
  mediumPoints: pointsField("Medium").default(4),
  hardPoints: pointsField("Hard").default(8),
});

export const updateSheetSchema = createSheetSchema.partial();

export const createQuestionSchema = z.object({
  url: z.string().url("Valid URL is required"),
  title: z.string().min(1, "Title is required").max(300),
  topic: z.string().min(1, "Topic is required").max(100),
  tags: z.array(z.string()).default([]),
  difficulty: difficultyEnum.default(Difficulty.UNKNOWN),
  sheetId: z.string().min(1, "Sheet ID is required"),
  position: z.number().int().min(0).optional(),
});

export const updateQuestionSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  topic: z.string().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
  difficulty: difficultyEnum.optional(),
  position: z.number().int().min(0).optional(),
});

export const verifyPlatformAccountSchema = z.object({
  accountId: z.string().min(1),
  status: verificationStatusEnum,
});

export const parseUrlSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});
