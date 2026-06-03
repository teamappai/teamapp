import { z } from "zod";
import {
  licenseRequired,
  showsLicenseField,
  type UserRole,
} from "@/lib/constants/roles";

// Normalize before validating (SR-4): mobile keyboards autocapitalize and
// users add stray whitespace, which broke case-sensitive auth in the Bubble
// app. trim + lowercase runs first, then the format check.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Invitation signup: email comes from the invitation, never user input. */
export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Your name is required"),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

/**
 * Profile form schema, shaped by the user's role (audit F-009). The license
 * field only exists for agents/team_leads and is required only for agents.
 * Shared between the client form's resolver and the server action.
 */
export function profileSchema(role: UserRole) {
  const base = {
    fullName: z.string().trim().min(1, "Your name is required"),
    email,
    phone: z
      .string()
      .trim()
      .max(40, "Phone number is too long")
      .optional()
      .or(z.literal("")),
  };

  if (!showsLicenseField(role)) {
    return z.object(base);
  }

  const license = licenseRequired(role)
    ? z.string().trim().min(1, "License number is required")
    : z
        .string()
        .trim()
        .max(60, "License number is too long")
        .optional()
        .or(z.literal(""));

  return z.object({ ...base, licenseNumber: license });
}

export type ProfileInput = {
  fullName: string;
  email: string;
  phone?: string;
  licenseNumber?: string;
};
