import assert from "node:assert/strict";
import test from "node:test";
import {
  rankClusters,
  repairClusters,
  type RawEventCluster,
} from "./eventSelection.js";
import { readMoreHref } from "./format.js";
import { digestForLocale } from "./summarize.js";
import { summarizeCost, type AiCallTelemetry } from "./telemetry.js";
import type { BilingualDigest, NewsItem } from "./types.js";

function item(index: number): NewsItem {
  return {
    id: String(index),
    title: `Story ${index}`,
    link: `https://example.com/${index}`,
    source: "Test",
    summary: `Summary ${index}`,
    publishedAt: new Date(`2026-08-29T${String(index).padStart(2, "0")}:00:00Z`),
  };
}

test("repairs cluster coverage and ranks event representatives", () => {
  const raw: RawEventCluster[] = [
    {
      representative: 1,
      members: [1, 2],
      score: 95,
      category: "disaster",
      rationale: "Two articles cover the same flood.",
    },
    {
      representative: 3,
      members: [2, 3],
      score: 80,
      category: "politics",
      rationale: "Second event.",
    },
  ];

  const clusters = repairClusters(raw, 4);
  assert.deepEqual(
    clusters.map((cluster) => cluster.memberIndices),
    [[1, 2], [3], [4]],
  );

  const ranked = rankClusters(clusters, [item(1), item(2), item(3), item(4)], 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.representativeIndex, 1);
  assert.deepEqual(ranked[0]?.memberIndices, [1, 2]);
});

test("Telegram digest is the exact Mini App prefix", () => {
  const stories = Array.from({ length: 15 }, (_, index) => ({
    link: `https://example.com/${index}`,
    source: "Test",
    title: { ru: `Новость ${index}`, en: `Story ${index}` },
    summary: { ru: `Текст ${index}`, en: `Summary ${index}` },
    category: { ru: "Мир", en: "World" },
  }));
  const digest: BilingualDigest = {
    intro: { ru: "Вступление", en: "Intro" },
    stories,
  };

  const telegram = digestForLocale(digest, "en", 10);
  assert.deepEqual(
    telegram.stories.map((story) => story.link),
    stories.slice(0, 10).map((story) => story.link),
  );
});

test("Telegram digest uses channel intro without story count", () => {
  const stories = Array.from({ length: 30 }, (_, index) => ({
    link: `https://example.com/${index}`,
    source: "Test",
    title: { ru: `Новость ${index}`, en: `Story ${index}` },
    summary: { ru: `Текст ${index}`, en: `Summary ${index}` },
    category: { ru: "Мир", en: "World" },
  }));
  const digest: BilingualDigest = {
    intro: {
      ru: "Главные мировые события за последние несколько часов — 30 коротких новостей.",
      en: "The latest major world events in 30 concise stories.",
    },
    stories,
  };

  const telegram = digestForLocale(digest, "ru", 10);
  assert.equal(telegram.intro, "Главные мировые события за последние несколько часов.");
  assert.doesNotMatch(telegram.intro, /30/);
});

test("Telegram read-more prefers Telegraph URL when present", () => {
  const base = {
    title: "T",
    summary: "S",
    link: "https://source.example/a",
    source: "BBC",
    category: "World",
  };

  assert.equal(readMoreHref({ ...base, telegraphUrl: "https://telegra.ph/A" }), "https://telegra.ph/A");
  assert.equal(readMoreHref(base), "https://source.example/a");
});

test("AI cost includes responses later rejected by validation", () => {
  const calls: AiCallTelemetry[] = [
    {
      stage: "cluster",
      attempt: 1,
      ok: false,
      model: "gpt-4o-mini",
      latencyMs: 100,
      usage: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500 },
      estimatedCostUsd: 0.00045,
      error: "Invalid schema",
    },
    {
      stage: "localize",
      attempt: 1,
      ok: true,
      model: "gpt-4o-mini",
      latencyMs: 100,
      usage: { inputTokens: 500, outputTokens: 500, totalTokens: 1_000 },
      estimatedCostUsd: 0.000375,
    },
  ];

  const cost = summarizeCost(calls);
  assert.equal(cost.complete, true);
  assert.equal(cost.inputTokens, 1_500);
  assert.equal(cost.outputTokens, 1_000);
  assert.equal(cost.estimatedTotalUsd, 0.000825);
});
