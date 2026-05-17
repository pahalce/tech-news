import {
  collectCurrentFeedCandidates,
  type CollectCurrentFeedCandidatesInput,
} from "src/features/digest/application/collect-current-feed-candidates-use-case";
import {
  extractCurrentFeedCandidateFeatures,
  type ExtractCurrentFeedCandidateFeaturesInput,
} from "src/features/digest/application/extract-current-feed-candidate-features-use-case";
import { selectReadableCurrentFeedCandidates } from "src/features/digest/application/select-readable-current-feed-candidates-use-case";
import type { FeatureVocabularyConfig } from "src/domains/article/article-feature-vocabulary-config";
import type { AgentState } from "src/shared/infrastructure/file-agent-state";
import {
  publishRecommendations,
  type RecommendationPublisher,
} from "src/features/digest/application/publish-recommendations-use-case";
import {
  createRecommendationContents,
  type RecommendationContentCreator,
} from "src/features/digest/application/create-recommendation-contents-use-case";
import {
  rerankCurrentFeedCandidates,
  type LlmReranker,
} from "src/features/digest/application/rerank-current-feed-candidates-use-case";
import { scoreCurrentFeedCandidates } from "src/features/digest/application/score-current-feed-candidates-use-case";
import {
  elapsedMs,
  silentWorkflowLogger,
  type WorkflowLogger,
} from "src/shared/infrastructure/workflow-logger";

export type PublishDigestAuditInput = {
  message: string;
};

export type DigestAuditPublisher = {
  publishDigestAudit(input: PublishDigestAuditInput): Promise<void>;
};

export type RunZennDigestWorkflowInput = {
  agentState: AgentState;
  featureVocabulary: FeatureVocabularyConfig;
  feeds: CollectCurrentFeedCandidatesInput["feeds"];
  feedReader: CollectCurrentFeedCandidatesInput["feedReader"];
  now: ExtractCurrentFeedCandidateFeaturesInput["now"];
  fetchArticleBody: ExtractCurrentFeedCandidateFeaturesInput["fetchArticleBody"];
  extractArticleFeatures: ExtractCurrentFeedCandidateFeaturesInput["extractArticleFeatures"];
  llmReranker: LlmReranker;
  recommendationContentCreator: RecommendationContentCreator;
  publisher: RecommendationPublisher;
  auditPublisher?: DigestAuditPublisher;
  logger?: WorkflowLogger;
};

export type RunZennDigestWorkflowResult = {
  agentState: AgentState;
};

const qualityCriteria = [
  "実務で再利用できる具体性がある",
  "薄いニュースまとめや汎用 AI hype ではない",
  "読む前に価値判断できる根拠がある",
] as const;

export async function runZennDigestWorkflow(
  input: RunZennDigestWorkflowInput,
): Promise<RunZennDigestWorkflowResult> {
  const logger = input.logger ?? silentWorkflowLogger;
  const workflowStartedAt = performance.now();
  logger.info("workflow started", { feedCount: input.feeds.length });

  const collectStartedAt = performance.now();
  logger.info("collecting feed candidates", { feedCount: input.feeds.length });
  const collected = await collectCurrentFeedCandidates({
    feeds: input.feeds,
    feedReader: input.feedReader,
  });
  logger.info("collected feed candidates", {
    elapsedMs: elapsedMs(collectStartedAt),
    candidateCount: collected.candidates.length,
    fetchedEntryCount: collected.stats.fetchedEntryCount,
    duplicateEntryCount: collected.stats.duplicateEntryCount,
    failureCount: collected.failures.length,
  });
  for (const failure of collected.failures) {
    logger.warn("feed collection failed", {
      feedId: failure.feedId,
      message: failure.message,
    });
  }

  const extractionStartedAt = performance.now();
  const previousExtractionCount = input.agentState.featureExtractionState.extractions.length;
  const previousBodyFetchFailureCount =
    input.agentState.featureExtractionState.bodyFetchFailures.length;
  const previousFailedExtractionAttemptCount =
    input.agentState.featureExtractionState.failedExtractionAttempts.length;
  logger.info("extracting candidate features", {
    candidateCount: collected.candidates.length,
    existingExtractionCount: previousExtractionCount,
  });
  const extracted = await extractCurrentFeedCandidateFeatures({
    candidates: collected.candidates,
    featureExtractionState: input.agentState.featureExtractionState,
    featureVocabulary: input.featureVocabulary,
    now: input.now,
    fetchArticleBody: input.fetchArticleBody,
    extractArticleFeatures: input.extractArticleFeatures,
    onFeatureExtractionFailure: ({ candidate, progress, message, llmResponse }) => {
      logger.warn("feature extraction failed", {
        articleId: candidate.articleId,
        featureExtractionIndex: progress.index,
        featureExtractionTotal: progress.total,
        featureExtractionProgress: `${progress.index}/${progress.total}`,
        message,
        llmResponse,
      });
    },
  });
  logger.info("extracted candidate features", {
    elapsedMs: elapsedMs(extractionStartedAt),
    newExtractionCount: extracted.state.extractions.length - previousExtractionCount,
    newBodyFetchFailureCount:
      extracted.state.bodyFetchFailures.length - previousBodyFetchFailureCount,
    newFailedExtractionAttemptCount:
      extracted.state.failedExtractionAttempts.length - previousFailedExtractionAttemptCount,
  });

  const readable = selectReadableCurrentFeedCandidates({
    currentFeedCandidates: collected.candidates,
    featureExtractionState: extracted.state,
  });
  logger.info("selected readable candidates", {
    readableCandidateCount: readable.readableCandidates.length,
  });

  const scoreStartedAt = performance.now();
  const scored = scoreCurrentFeedCandidates({
    currentFeedCandidateFeatures: readable.readableCandidates,
    preferenceProfile: input.agentState.preferenceProfile,
    recommendedArticleIds: input.agentState.publicationState.recommendedArticles.map(
      (article) => article.articleId,
    ),
  });
  logger.info("scored candidates", {
    elapsedMs: elapsedMs(scoreStartedAt),
    scoredCandidateCount: scored.scoredCandidates.length,
  });

  if (scored.scoredCandidates.length === 0) {
    logger.warn("skipping rerank because there are no scored candidates");
    await publishDigestAuditIfConfigured({
      auditPublisher: input.auditPublisher,
      logger,
      message: formatDigestAuditMessage({
        collected,
        readableCandidates: readable.readableCandidates,
        scoredCandidates: [],
        selectedCandidates: [],
        publishedArticleIds: [],
        failedPublishedArticleIds: [],
        featureExtractionState: extracted.state,
        previousRecommendedArticleIds: input.agentState.publicationState.recommendedArticles.map(
          (article) => article.articleId,
        ),
      }),
    });
    logger.info("workflow finished", { elapsedMs: elapsedMs(workflowStartedAt) });
    return {
      agentState: {
        ...input.agentState,
        featureExtractionState: extracted.state,
      },
    };
  }

  const featuresByArticleId = new Map(
    readable.readableCandidates.map((candidate) => [
      candidate.candidate.articleId,
      candidate.articleFeatures,
    ]),
  );
  const rerankStartedAt = performance.now();
  logger.info("reranking scored candidates", {
    scoredCandidateCount: scored.scoredCandidates.length,
  });
  const reranked = await rerankCurrentFeedCandidates({
    scoredCandidates: scored.scoredCandidates.map((candidate) => ({
      ...candidate,
      articleFeatures: featuresByArticleId.get(candidate.articleId)!,
    })),
    longTermPreferenceSummary: input.agentState.preferenceSummaryHistory.long_term_summary,
    recentPreferenceSummary: input.agentState.preferenceSummaryHistory.recent_summary.summary,
    qualityCriteria,
    llmReranker: input.llmReranker,
  });
  logger.info("reranked candidates", {
    elapsedMs: elapsedMs(rerankStartedAt),
    selectedCandidateCount: reranked.selectedCandidates.length,
  });

  const contentStartedAt = performance.now();
  logger.info("creating recommendation contents", {
    selectedCandidateCount: reranked.selectedCandidates.length,
  });
  const contents = await createRecommendationContents({
    selectedCandidates: reranked.selectedCandidates,
    featureExtractions: extracted.state.extractions,
    recommendationContentCreator: input.recommendationContentCreator,
  });
  logger.info("created recommendation contents", {
    elapsedMs: elapsedMs(contentStartedAt),
    recommendationContentCount: contents.recommendationContents.length,
  });

  const publishStartedAt = performance.now();
  logger.info("publishing recommendations", {
    recommendationContentCount: contents.recommendationContents.length,
  });
  const selectedCandidatesByArticleId = new Map(
    reranked.selectedCandidates.map((candidate) => [candidate.articleId, candidate]),
  );
  const featureExtractionsByArticleId = new Map(
    extracted.state.extractions.map((featureExtraction) => [
      featureExtraction.articleId,
      featureExtraction,
    ]),
  );
  const published = await publishRecommendations({
    recommendationContents: contents.recommendationContents.map((content) => {
      const candidate = selectedCandidatesByArticleId.get(content.articleId);
      if (!candidate) {
        throw new Error("Recommendation Content Article ID must match selected candidate.");
      }

      return {
        ...content,
        canonicalUrl: candidate.canonicalUrl,
        title: candidate.title,
        author: featureExtractionsByArticleId.get(content.articleId)?.author ?? null,
      };
    }),
    existingPublicationRecords: input.agentState.publicationState.publicationRecords,
    existingRecommendedArticles: input.agentState.publicationState.recommendedArticles,
    publisher: input.publisher,
    onPublishFailure: ({ articleId, message }) => {
      logger.error("recommendation publish failed", { articleId, message });
    },
  });
  logger.info("published recommendations", {
    elapsedMs: elapsedMs(publishStartedAt),
    publicationRecordCount: published.publicationRecords.length,
    recommendedArticleCount: published.recommendedArticles.length,
    failedArticleCount: published.failedArticleIds.length,
  });
  await publishDigestAuditIfConfigured({
    auditPublisher: input.auditPublisher,
    logger,
    message: formatDigestAuditMessage({
      collected,
      readableCandidates: readable.readableCandidates,
      scoredCandidates: scored.scoredCandidates,
      selectedCandidates: reranked.selectedCandidates,
      publishedArticleIds: published.publicationRecords
        .slice(input.agentState.publicationState.publicationRecords.length)
        .map((record) => record.articleId),
      failedPublishedArticleIds: published.failedArticleIds,
      featureExtractionState: extracted.state,
      previousRecommendedArticleIds: input.agentState.publicationState.recommendedArticles.map(
        (article) => article.articleId,
      ),
    }),
  });
  logger.info("workflow finished", { elapsedMs: elapsedMs(workflowStartedAt) });

  return {
    agentState: {
      ...input.agentState,
      featureExtractionState: extracted.state,
      recommendationContentState: {
        version: input.agentState.recommendationContentState.version,
        recommendationContents: [
          ...input.agentState.recommendationContentState.recommendationContents,
          ...contents.recommendationContents,
        ],
      },
      publicationState: {
        version: input.agentState.publicationState.version,
        publicationRecords: published.publicationRecords,
        recommendedArticles: published.recommendedArticles,
      },
    },
  };
}

type DigestAuditMessageInput = {
  collected: Awaited<ReturnType<typeof collectCurrentFeedCandidates>>;
  readableCandidates: ReturnType<typeof selectReadableCurrentFeedCandidates>["readableCandidates"];
  scoredCandidates: ReturnType<typeof scoreCurrentFeedCandidates>["scoredCandidates"];
  selectedCandidates: Awaited<ReturnType<typeof rerankCurrentFeedCandidates>>["selectedCandidates"];
  publishedArticleIds: readonly string[];
  failedPublishedArticleIds: readonly string[];
  featureExtractionState: AgentState["featureExtractionState"];
  previousRecommendedArticleIds: readonly string[];
};

function formatDigestAuditMessage(input: DigestAuditMessageInput): string {
  const candidates = input.collected.candidates;
  const readableArticleIds = new Set(
    input.readableCandidates.map((candidate) => candidate.candidate.articleId),
  );
  const scoredArticleIds = new Set(input.scoredCandidates.map((candidate) => candidate.articleId));
  const selectedArticleIds = new Set(
    input.selectedCandidates.map((candidate) => candidate.articleId),
  );
  const publishedArticleIds = new Set(input.publishedArticleIds);
  const failedPublishedArticleIds = new Set(input.failedPublishedArticleIds);
  const previousRecommendedArticleIds = new Set(input.previousRecommendedArticleIds);
  const extractionsByArticleId = new Map(
    input.featureExtractionState.extractions.map((extraction) => [
      extraction.articleId,
      extraction,
    ]),
  );
  const bodyFetchFailuresByArticleId = latestByArticleId(
    input.featureExtractionState.bodyFetchFailures,
  );
  const extractionFailuresByArticleId = latestByArticleId(
    input.featureExtractionState.failedExtractionAttempts,
  );
  const scoredCandidatesByArticleId = new Map(
    input.scoredCandidates.map((candidate) => [candidate.articleId, candidate]),
  );
  const selectedCandidatesByArticleId = new Map(
    input.selectedCandidates.map((candidate) => [candidate.articleId, candidate]),
  );
  const dropped = candidates
    .filter((candidate) => !publishedArticleIds.has(candidate.articleId))
    .map((candidate) => {
      const reason = explainUnrecommendedCandidate({
        articleId: candidate.articleId,
        readableArticleIds,
        scoredArticleIds,
        selectedArticleIds,
        failedPublishedArticleIds,
        previousRecommendedArticleIds,
        extractionsByArticleId,
        bodyFetchFailuresByArticleId,
        extractionFailuresByArticleId,
      });
      const score = scoredCandidatesByArticleId.get(candidate.articleId)?.ruleScore;
      return `• ${candidate.title} - ${reason}${typeof score === "number" ? ` / score ${score.toFixed(2)}` : ""}\n  ${candidate.canonicalUrl}`;
    });

  const selectedLines = input.selectedCandidates.map((candidate, index) => {
    const status = publishedArticleIds.has(candidate.articleId)
      ? "投稿済み"
      : failedPublishedArticleIds.has(candidate.articleId)
        ? "投稿失敗"
        : "推薦文未作成";
    const score = selectedCandidatesByArticleId.get(candidate.articleId)?.ruleScore;
    return `${index + 1}. ${candidate.title} - ${status}${typeof score === "number" ? ` / score ${score.toFixed(2)}` : ""}`;
  });

  const lines = [
    "**Zenn Digest 推薦監査**",
    "",
    "**集計**",
    `• RSS取得 entry: ${input.collected.stats.fetchedEntryCount}`,
    `• 重複統合: ${input.collected.stats.duplicateEntryCount}`,
    `• 候補: ${candidates.length}`,
    `• 読める記事: ${input.readableCandidates.length}`,
    `• スコア対象: ${input.scoredCandidates.length}`,
    `• Rerank選出: ${input.selectedCandidates.length}`,
    `• Discord投稿成功: ${publishedArticleIds.size}`,
    `• Discord投稿失敗: ${failedPublishedArticleIds.size}`,
  ];

  if (input.collected.failures.length > 0) {
    lines.push(
      "",
      "**Feed失敗**",
      ...input.collected.failures.map((failure) => `• ${failure.feedId}: ${failure.message}`),
    );
  }

  if (input.collected.stats.duplicateEntries.length > 0) {
    lines.push(
      "",
      "**重複があった記事**",
      ...input.collected.stats.duplicateEntries.map(
        (entry) => `• ${entry.keptTitle} - ${entry.feedId} でも取得\n  ${entry.canonicalUrl}`,
      ),
    );
  }

  if (selectedLines.length > 0) {
    lines.push("", "**推薦された記事**", ...selectedLines);
  }

  lines.push("", "**推薦されなかった記事と理由**");
  lines.push(...(dropped.length > 0 ? dropped : ["• なし"]));

  return lines.join("\n");
}

function explainUnrecommendedCandidate(input: {
  articleId: string;
  readableArticleIds: ReadonlySet<string>;
  scoredArticleIds: ReadonlySet<string>;
  selectedArticleIds: ReadonlySet<string>;
  failedPublishedArticleIds: ReadonlySet<string>;
  previousRecommendedArticleIds: ReadonlySet<string>;
  extractionsByArticleId: ReadonlyMap<
    string,
    AgentState["featureExtractionState"]["extractions"][number]
  >;
  bodyFetchFailuresByArticleId: ReadonlyMap<string, { message: string }>;
  extractionFailuresByArticleId: ReadonlyMap<string, { message: string }>;
}): string {
  if (input.failedPublishedArticleIds.has(input.articleId)) {
    return "Discord投稿に失敗した";
  }
  if (input.previousRecommendedArticleIds.has(input.articleId)) {
    return "過去に推薦済み";
  }
  const bodyFetchFailure = input.bodyFetchFailuresByArticleId.get(input.articleId);
  if (bodyFetchFailure) {
    return `本文取得に失敗した (${bodyFetchFailure.message})`;
  }
  const extractionFailure = input.extractionFailuresByArticleId.get(input.articleId);
  if (extractionFailure) {
    return `特徴抽出に失敗した (${extractionFailure.message})`;
  }
  const extraction = input.extractionsByArticleId.get(input.articleId);
  if (extraction && !extraction.readability.isReadable) {
    return `読める記事ではない (${extraction.readability.reason ?? "理由なし"})`;
  }
  if (!input.readableArticleIds.has(input.articleId)) {
    return "特徴抽出結果がなく、読める記事として扱えなかった";
  }
  if (!input.scoredArticleIds.has(input.articleId)) {
    return "スコア対象から除外された";
  }
  if (!input.selectedArticleIds.has(input.articleId)) {
    return "Rerankで落ちた";
  }

  return "推薦文作成または投稿前に除外された";
}

function latestByArticleId<T extends { articleId: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.articleId, item]));
}

async function publishDigestAuditIfConfigured(input: {
  auditPublisher: DigestAuditPublisher | undefined;
  logger: WorkflowLogger;
  message: string;
}): Promise<void> {
  if (!input.auditPublisher) {
    return;
  }

  try {
    await input.auditPublisher.publishDigestAudit({ message: input.message });
  } catch (error) {
    input.logger.error("digest audit publish failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
