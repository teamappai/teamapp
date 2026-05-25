"use server";

import { headers } from "next/headers";
import { Resend } from "resend";

import { contactSchema, type ContactInput } from "@/lib/validations/contact";
import { rateLimit } from "@/lib/rate-limit";

/** Where contact submissions are delivered and how replies are routed. */
const TO_ADDRESS = "phil@teamapp.ai";
const FROM_ADDRESS = "TeamApp <hello@teamapp.ai>";
const REPLY_TO = "phil@teamapp.ai";

const RATE = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 submissions / IP / hour

export type ContactResult = { ok: true } | { ok: false; error: string };

/** Best-effort client IP from common proxy headers (Vercel sets these). */
async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function submitContact(
  input: ContactInput & { company_website?: string },
): Promise<ContactResult> {
  // Honeypot: real users never fill a hidden field. Pretend success so bots
  // don't learn they were caught.
  if (input.company_website && input.company_website.trim() !== "") {
    return { ok: true };
  }

  const ip = await clientIp();
  const { allowed } = rateLimit(`contact:${ip}`, RATE);
  if (!allowed) {
    return {
      ok: false,
      error: "Too many submissions. Please try again later.",
    };
  }

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const { name, email, company, message } = parsed.data;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send contact email.");
    return {
      ok: false,
      error: "We couldn't send your message right now. Please try again later.",
    };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: TO_ADDRESS,
    replyTo: REPLY_TO,
    subject: `TeamApp contact form — ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || "—"}`,
      "",
      message,
    ].join("\n"),
  });

  if (error) {
    console.error("Resend failed to send contact email:", error);
    return {
      ok: false,
      error: "We couldn't send your message right now. Please try again later.",
    };
  }

  return { ok: true };
}
