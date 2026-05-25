import { z } from "zod";

/** Public contact form. Shared between the client form resolver and the server
 * action. The honeypot field (`company_website`) is validated server-side. */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Your name is required")
    .max(120, "Name is too long"),
  email: z.email("Enter a valid email address"),
  company: z
    .string()
    .trim()
    .max(160, "Company name is too long")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please add a few more details")
    .max(5000, "Message is too long"),
});

export type ContactInput = z.infer<typeof contactSchema>;
