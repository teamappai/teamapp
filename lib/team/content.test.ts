import { describe, it, expect } from "vitest";
import {
  findBannedContent,
  findBannedContentInBlocks,
  bannedContentError,
  type ContentBlock,
} from "./content";

/**
 * CR-2: content validation at publish time. Every placeholder / test / debug
 * value called out in the audit must be rejected before a save succeeds. These
 * tests pin each one so a regression can't quietly let it ship.
 */
describe("findBannedContent (CR-2)", () => {
  // Each entry: an input that MUST be rejected, and the label we expect back.
  const rejected: [string, string][] = [
    ["TODO", "TODO"],
    ["Finish this TODO before launch", "TODO"],
    ["TBD", "TBD"],
    ["Price TBD", "TBD"],
    ["{{ first_name }}", "{{"],
    ["closing }} tag", "}}"],
    ["Lorem ipsum dolor sit amet", "Lorem ipsum"],
    ["test123", "test123"],
    ["ALM Content goes here", "ALM Content goes here"],
    ["Acccepting", "Acccepting"],
    ["Acccepting Slack account invite", "Acccepting"],
    ["All Companies", "All Companies"],
    ["All Types", "All Types"],
    ["XYZ Test", "XYZ Test"],
    ["Flyer Design XYZ Test", "XYZ Test"],
    // Standalone-only values: rejected when they ARE the whole value.
    ["1234", "1234"],
    ["Demo", "Demo"],
    ["abc", "abc"],
  ];

  it.each(rejected)("rejects %j", (input, label) => {
    expect(findBannedContent(input)).toContain(label);
  });

  it("is case-insensitive", () => {
    expect(findBannedContent("todo")).toContain("TODO");
    expect(findBannedContent("LOREM IPSUM")).toContain("Lorem ipsum");
    expect(findBannedContent("DEMO")).toContain("Demo");
  });

  it("strips HTML before matching", () => {
    expect(findBannedContent("<p>Lorem ipsum</p>")).toContain("Lorem ipsum");
    expect(findBannedContent("<strong>1234</strong>")).toEqual(["1234"]);
  });

  // Standalone bans must NOT fire when embedded in a real value.
  it("allows standalone tokens inside legitimate values", () => {
    expect(findBannedContent("1234 Main St")).toEqual([]);
    expect(findBannedContent("Demo Day Recap")).toEqual([]);
    expect(findBannedContent("abcdef")).toEqual([]);
    expect(findBannedContent("Show 1234 Wilshire Blvd")).toEqual([]);
  });

  // Word-boundary anchoring must not flag legitimate substrings.
  it("does not flag legitimate text", () => {
    expect(findBannedContent("Mastodon migration guide")).toEqual([]);
    expect(findBannedContent("Listing presentation checklist")).toEqual([]);
    expect(findBannedContent("Accepting offers this week")).toEqual([]);
    expect(findBannedContent("")).toEqual([]);
  });
});

describe("findBannedContentInBlocks (CR-2)", () => {
  it("scans every text-bearing block", () => {
    const blocks: ContentBlock[] = [
      { type: "heading", level: 1, text: "Welcome" },
      { type: "paragraph", text: "Lorem ipsum dolor" },
      { type: "callout", variant: "tip", text: "{{ token }}" },
    ];
    const found = findBannedContentInBlocks(blocks);
    expect(found).toContain("Lorem ipsum");
    expect(found).toContain("{{");
  });

  it("flags a block whose entire text is a standalone token", () => {
    const blocks: ContentBlock[] = [{ type: "paragraph", text: "abc" }];
    expect(findBannedContentInBlocks(blocks)).toContain("abc");
  });

  it("returns clean for well-formed content", () => {
    const blocks: ContentBlock[] = [
      { type: "heading", level: 2, text: "Pricing your home" },
      { type: "paragraph", text: "A guide to comparative market analysis." },
    ];
    expect(findBannedContentInBlocks(blocks)).toEqual([]);
  });
});

describe("bannedContentError", () => {
  it("lists every offending value", () => {
    const msg = bannedContentError(["TODO", "Lorem ipsum"]);
    expect(msg).toContain("TODO");
    expect(msg).toContain("Lorem ipsum");
  });
});
