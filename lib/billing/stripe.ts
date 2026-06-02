import "server-only";
import Stripe from "stripe";
import { stripeEnv } from "@/lib/billing/env";

/**
 * Server-only Stripe client singleton. Never import this into client code — it
 * holds the secret key. The API version is pinned to the SDK's bundled default
 * (omit `apiVersion` to track the installed `stripe` package).
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const env = stripeEnv();
  client = new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: { name: "TeamApp", url: "https://teamapp.ai" },
  });
  return client;
}
