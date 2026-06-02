import {
  Award,
  Target,
  Home,
  Briefcase,
  GraduationCap,
  Rocket,
  TrendingUp,
  Users,
  Star,
  Trophy,
  BookOpen,
  Lightbulb,
  Sparkles,
  Compass,
  Map,
  Flag,
  Building2,
  Handshake,
  Phone,
  Megaphone,
  DollarSign,
  LineChart,
  Calendar,
  Clipboard,
  FileText,
  Key,
  Shield,
  Zap,
  Heart,
  Bot,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/index";
import { DEFAULT_PLAYBOOK_ICON } from "@/lib/constants/playbooks";

/** Lucide icons offered in the playbook icon picker, keyed by name. */
export const PLAYBOOK_ICON_MAP: Record<string, LucideIcon> = {
  Award,
  Target,
  Home,
  Briefcase,
  GraduationCap,
  Rocket,
  TrendingUp,
  Users,
  Star,
  Trophy,
  BookOpen,
  Lightbulb,
  Sparkles,
  Compass,
  Map,
  Flag,
  Building2,
  Handshake,
  Phone,
  Megaphone,
  DollarSign,
  LineChart,
  Calendar,
  Clipboard,
  FileText,
  Key,
  Shield,
  Zap,
  Heart,
  Bot,
};

/** Resolve a stored icon name to its component, falling back to the default. */
export function resolvePlaybookIcon(
  name: string | null | undefined,
): LucideIcon {
  return (
    (name && PLAYBOOK_ICON_MAP[name]) ||
    PLAYBOOK_ICON_MAP[DEFAULT_PLAYBOOK_ICON]!
  );
}

export function PlaybookIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = resolvePlaybookIcon(name);
  return <Icon className={cn("size-5", className)} />;
}
