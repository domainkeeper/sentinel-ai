import type { Agent, TopicCandidate, TopicDecision } from "../models/index.js";
import type { Clock } from "../util/clock.js";

/** The result of evaluating a single candidate topic. */
export interface EditorialVerdict {
  candidate: TopicCandidate;
  decision: TopicDecision;
  /** Structured scoring detail / reasons, e.g. per-axis scores and pass/fail reasons. */
  reasoning: Record<string, unknown>;
}

/**
 * The editorial decision engine.
 *
 * Scores and filters candidate topics against a publish threshold based on
 * axes such as novelty, relevance, importance, freshness, and persona fit.
 * Rejection must be real and explainable — a candidate that fails the bar
 * is rejected with structured reasoning, not silently dropped.
 */
export interface EditorialDecisionEngine {
  /** Evaluate a list of candidates and pick 0 or 1 to publish (rarely more). */
  evaluate(agent: Agent, candidates: TopicCandidate[]): Promise<EditorialVerdict[]>;
}

/** Scoring breakdown across editorial dimensions. */
export interface DimensionScores {
  relevance: number;     // 0 - 100
  freshness: number;     // 0 - 100
  novelty: number;       // 0 - 100
  sourceQuality: number; // 0 - 100
  personaFit: number;    // 0 - 100
}

export interface EditorialEngineConfig {
  /** Minimum total score (0-100) required to approve a topic. Default: 60. */
  threshold?: number;
  weights?: {
    relevance?: number;
    freshness?: number;
    novelty?: number;
    sourceQuality?: number;
    personaFit?: number;
  };
}

/**
 * Deterministic, rule-based Editorial Decision Engine for Phase 2C.
 *
 * Evaluates candidate topics across key dimensions:
 * - Relevance: keyword/domain match against agent persona domain.
 * - Freshness: age of the source publication relative to discovery time.
 * - Novelty: length and content variety (placeholder deterministic check).
 * - Source Quality: reputation/trustworthiness of known feeds/domains.
 * - Persona Fit: technical significance / depth signals in title & summary.
 *
 * Applies a threshold-based decision (approve if score >= threshold),
 * returning structured reasons and per-axis scores.
 */
export class DeterministicEditorialEngine implements EditorialDecisionEngine {
  private readonly threshold: number;

  constructor(
    private readonly clock: Clock,
    config?: EditorialEngineConfig,
  ) {
    this.threshold = config?.threshold ?? 60;
  }

  async evaluate(agent: Agent, candidates: TopicCandidate[]): Promise<EditorialVerdict[]> {
    const verdicts: EditorialVerdict[] = [];
    const now = this.clock.now();

    for (const candidate of candidates) {
      const scores = this.scoreCandidate(agent, candidate, now);
      const totalScore = Math.round(
        scores.relevance * 0.3 +
          scores.freshness * 0.2 +
          scores.novelty * 0.15 +
          scores.sourceQuality * 0.15 +
          scores.personaFit * 0.2,
      );

      const decision: TopicDecision = totalScore >= this.threshold ? "publish" : "reject";
      const reasons = this.buildReasons(scores, totalScore, this.threshold, decision);

      verdicts.push({
        candidate,
        decision,
        reasoning: {
          totalScore,
          threshold: this.threshold,
          dimensionScores: scores,
          reasons,
        },
      });
    }

    return verdicts;
  }

  private scoreCandidate(agent: Agent, candidate: TopicCandidate, now: Date): DimensionScores {
    const text = `${candidate.title} ${candidate.summary}`.toLowerCase();
    const domain = (agent.persona?.domain ?? "").toLowerCase();
    const domainKeywords = domain.split(/\s+/).filter(Boolean);

    // 1. Relevance: match persona domain keywords in title/summary
    let relevance = 40; // baseline
    if (domainKeywords.length > 0) {
      const matches = domainKeywords.filter((kw) => text.includes(kw));
      relevance = Math.min(100, 40 + matches.length * 30);
    }
    // General tech/security fallback boost if domain is broad
    if (text.includes("ai") || text.includes("security") || text.includes("model") || text.includes("vulnerability")) {
      relevance = Math.max(relevance, 65);
    }

    // 2. Freshness: based on source publishedAt vs now (discoveredAt)
    let freshness = 70; // default if no publish date
    const pubDateStr = candidate.publishedAt ?? candidate.discoveredAt;
    const pubDate = new Date(pubDateStr);
    if (!isNaN(pubDate.getTime())) {
      const ageHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
      if (ageHours <= 6) {
        freshness = 100;
      } else if (ageHours <= 24) {
        freshness = 90;
      } else if (ageHours <= 72) {
        freshness = 75;
      } else if (ageHours <= 168) {
        freshness = 50;
      } else {
        freshness = 30;
      }
    }

    // 3. Novelty: summary length / substantive detail
    let novelty = 60;
    if (candidate.summary.length > 150) {
      novelty = 85;
    } else if (candidate.summary.length > 80) {
      novelty = 70;
    } else if (candidate.summary.length < 20) {
      novelty = 40;
    }

    // 4. Source Quality: known reputable sources or robust URL
    let sourceQuality = 60;
    const srcName = candidate.sourceName.toLowerCase();
    const srcUrl = candidate.sourceUrl.toLowerCase();
    if (
      srcName.includes("hacker news") ||
      srcName.includes("arxiv") ||
      srcName.includes("github") ||
      srcName.includes("openai") ||
      srcName.includes("anthropic") ||
      srcUrl.includes("hnrss.org") ||
      srcUrl.includes("github.com")
    ) {
      sourceQuality = 90;
    } else if (srcUrl.startsWith("https://")) {
      sourceQuality = 70;
    }

    // 5. Persona Fit: technical depth, specificity, presence of nouns/technical terms
    let personaFit = 50;
    if (text.length > 50) {
      personaFit = 70;
    }
    if (
      text.includes("attack") ||
      text.includes("vulnerability") ||
      text.includes("model") ||
      text.includes("agent") ||
      text.includes("system") ||
      text.includes("research") ||
      text.includes("release") ||
      text.includes("code")
    ) {
      personaFit = 90;
    }

    return {
      relevance,
      freshness,
      novelty,
      sourceQuality,
      personaFit,
    };
  }

  private buildReasons(
    scores: DimensionScores,
    totalScore: number,
    threshold: number,
    decision: TopicDecision,
  ): string[] {
    const reasons: string[] = [];

    if (decision === "publish") {
      reasons.push(`Approved: total score ${totalScore} meets or exceeds threshold ${threshold}.`);
    } else {
      reasons.push(`Rejected: total score ${totalScore} is below threshold ${threshold}.`);
    }

    if (scores.relevance < 60) {
      reasons.push(`Insufficient relevance to persona domain (score: ${scores.relevance}).`);
    } else {
      reasons.push(`Strong relevance to persona domain (score: ${scores.relevance}).`);
    }

    if (scores.freshness < 60) {
      reasons.push(`Content is stale or publication timestamp is outdated (score: ${scores.freshness}).`);
    } else {
      reasons.push(`Good freshness/recency (score: ${scores.freshness}).`);
    }

    if (scores.novelty < 60) {
      reasons.push(`Low novelty or insufficient summary depth (score: ${scores.novelty}).`);
    } else {
      reasons.push(`Good substantive novelty and detail (score: ${scores.novelty}).`);
    }

    if (scores.sourceQuality < 60) {
      reasons.push(`Source quality is weak or unknown (score: ${scores.sourceQuality}).`);
    } else {
      reasons.push(`Reliable source quality (score: ${scores.sourceQuality}).`);
    }

    if (scores.personaFit < 60) {
      reasons.push(`Weak persona/domain fit and technical depth (score: ${scores.personaFit}).`);
    } else {
      reasons.push(`Good persona fit and technical significance (score: ${scores.personaFit}).`);
    }

    return reasons;
  }
}
