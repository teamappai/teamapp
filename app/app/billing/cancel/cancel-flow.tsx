"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PauseCircle,
  ArrowDownCircle,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils/format";
import { pauseSubscriptionAction } from "../actions";
import { scheduleCancellation, type CancelReason } from "./actions";

const REASONS: { value: CancelReason; label: string; followUp?: string }[] = [
  { value: "price", label: "Price — too expensive" },
  {
    value: "switching",
    label: "Switching to another tool",
    followUp: "Which tool?",
  },
  { value: "not_using", label: "Not using it enough" },
  {
    value: "missing_features",
    label: "Missing features I need",
    followUp: "Which features?",
  },
  { value: "support", label: "Customer support issues" },
  { value: "bugs", label: "Product bugs / unreliability" },
  { value: "shutdown", label: "Company shut down / restructuring" },
  {
    value: "temporary",
    label: "Temporarily not needed",
    followUp: "Any specific reason?",
  },
  { value: "other", label: "Other" },
];

export function CancelFlow({ canDowngrade }: { canDowngrade: boolean }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<"save" | "reason">("save");
  const [pausing, setPausing] = React.useState(false);

  const [category, setCategory] = React.useState<CancelReason | "">("");
  const [reasonText, setReasonText] = React.useState("");
  const [feedback, setFeedback] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);

  const selected = REASONS.find((r) => r.value === category);

  async function pause() {
    setPausing(true);
    const res = await pauseSubscriptionAction();
    setPausing(false);
    if (res.ok) {
      toast.success(res.message ?? "Subscription paused.");
      router.push("/app/billing");
    } else {
      toast.error(res.error);
    }
  }

  async function submit() {
    if (!category) {
      toast.error("Please choose a reason.");
      return;
    }
    if (category === "other" && !reasonText.trim()) {
      toast.error("Please tell us a bit more.");
      return;
    }
    if (confirmText.trim() !== "CANCEL") {
      toast.error('Type "CANCEL" to confirm.');
      return;
    }
    setSubmitting(true);
    const res = await scheduleCancellation({
      reasonCategory: category,
      reasonText: reasonText || null,
      optionalFeedback: feedback || null,
      confirmText,
    });
    setSubmitting(false);
    if (res.ok) {
      setDone(res.accessUntil);
    } else {
      toast.error(res.error);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <CheckCircle2 className="text-primary mx-auto size-8" />
          <h2 className="text-lg font-semibold">Cancellation scheduled</h2>
          <p className="text-muted-foreground text-sm">
            You&rsquo;ll keep full access until {formatDate(done, "long")}.
            We&rsquo;ve emailed you a confirmation. Changed your mind? You can
            resume anytime before then.
          </p>
          <Button asChild>
            <Link href="/app/billing">Back to Billing</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save-flow options */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SaveCard
          icon={<PauseCircle className="size-5" />}
          title="Pause your subscription"
          body="Take a 30-day break. Your data stays, no charges, resume anytime."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={pause}
              disabled={pausing}
            >
              {pausing ? "Pausing…" : "Pause 30 days"}
            </Button>
          }
        />
        {canDowngrade ? (
          <SaveCard
            icon={<ArrowDownCircle className="size-5" />}
            title="Downgrade your plan"
            body="Keep the essentials at a lower price instead of leaving."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/app/billing">See plans</Link>
              </Button>
            }
          />
        ) : null}
        <SaveCard
          icon={<MessageCircle className="size-5" />}
          title="Talk to support"
          body="Let us help — sometimes the right solution is a quick chat."
          action={
            <Button asChild size="sm" variant="outline">
              <a href="mailto:phil@teamapp.ai?subject=TeamApp%20support">
                Contact us
              </a>
            </Button>
          }
        />
      </div>

      {stage === "save" ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setStage("reason")}>
            I still want to cancel
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Why are you canceling?</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as CancelReason)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected?.followUp ? (
              <div className="space-y-1.5">
                <Label htmlFor="follow-up">{selected.followUp}</Label>
                <Input
                  id="follow-up"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>
            ) : null}

            {category === "other" ? (
              <div className="space-y-1.5">
                <Label htmlFor="other-reason">Tell us more</Label>
                <Textarea
                  id="other-reason"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="feedback">
                Tell us what we could do better — your honest feedback helps us
                improve.
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 border-t pt-4">
              <Label htmlFor="confirm">
                Type <span className="font-semibold">CANCEL</span> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CANCEL"
              />
              <p className="text-muted-foreground text-xs">
                Your subscription will cancel at the end of your current billing
                period. You keep access until then.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setStage("save")}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={submit}
                disabled={submitting || confirmText.trim() !== "CANCEL"}
              >
                {submitting ? "Submitting…" : "Confirm cancellation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SaveCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-2 p-5">
        <div className="text-primary">{icon}</div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground flex-1 text-xs">{body}</p>
        <div className="pt-2">{action}</div>
      </CardContent>
    </Card>
  );
}
