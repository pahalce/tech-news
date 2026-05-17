import type {
  DeliveryReference,
  PublicationRecord,
  PublishedDigestRegistry,
  RecommendedArticle,
} from "src/domains/digest/publication-record";
import {
  createPublicationRecord,
  createRecommendedArticle,
} from "src/domains/digest/publication-record";
import type {
  RecommendationContent,
  RecommendationContentHistory,
} from "src/domains/digest/recommendation-content";

export function appendRecommendationContentsToHistory(
  history: RecommendationContentHistory,
  recommendationContents: readonly RecommendationContent[],
): RecommendationContentHistory {
  return {
    version: history.version,
    recommendationContents: [...history.recommendationContents, ...recommendationContents],
  };
}

export function replacePublishedDigestRegistryEntries(input: {
  version: 1;
  publicationRecords: readonly PublicationRecord[];
  recommendedArticles: readonly RecommendedArticle[];
}): PublishedDigestRegistry {
  let registry: PublishedDigestRegistry = {
    version: input.version,
    publicationRecords: [],
    recommendedArticles: [],
  };

  for (const publicationRecord of input.publicationRecords) {
    registry = recordPublishedDigestItem(registry, {
      articleId: publicationRecord.articleId,
      deliveryReference: publicationRecord.deliveryReference,
      publishedAt: publicationRecord.postedAt,
      reactionFeedback: publicationRecord.reactionFeedback,
    });
  }

  for (const recommendedArticle of input.recommendedArticles) {
    registry = recordRecommendedArticle(registry, recommendedArticle);
  }

  return registry;
}

export function recordPublishedDigestItem(
  registry: PublishedDigestRegistry,
  input: {
    articleId: string;
    deliveryReference: DeliveryReference;
    publishedAt: string;
    reactionFeedback?: PublicationRecord["reactionFeedback"];
  },
): PublishedDigestRegistry {
  const publicationRecord = withReactionFeedback(
    createPublicationRecord({
      articleId: input.articleId,
      deliveryReference: input.deliveryReference,
      postedAt: input.publishedAt,
    }),
    input.reactionFeedback,
  );

  if (
    registry.publicationRecords.some(
      (record) =>
        record.articleId === publicationRecord.articleId &&
        isSameDeliveryReference(record.deliveryReference, publicationRecord.deliveryReference),
    )
  ) {
    return {
      version: registry.version,
      publicationRecords: [...registry.publicationRecords],
      recommendedArticles: [...registry.recommendedArticles],
    };
  }

  return recordRecommendedArticle(
    {
      version: registry.version,
      publicationRecords: [...registry.publicationRecords, publicationRecord],
      recommendedArticles: [...registry.recommendedArticles],
    },
    {
      articleId: publicationRecord.articleId,
      firstRecommendedAt: publicationRecord.postedAt,
    },
  );
}

function recordRecommendedArticle(
  registry: PublishedDigestRegistry,
  recommendedArticle: RecommendedArticle,
): PublishedDigestRegistry {
  const parsedRecommendedArticle = createRecommendedArticle(recommendedArticle);
  const existingArticle = registry.recommendedArticles.find(
    (article) => article.articleId === parsedRecommendedArticle.articleId,
  );

  if (!existingArticle) {
    return {
      version: registry.version,
      publicationRecords: [...registry.publicationRecords],
      recommendedArticles: [...registry.recommendedArticles, parsedRecommendedArticle],
    };
  }

  const firstRecommendedAt =
    Date.parse(existingArticle.firstRecommendedAt) <=
    Date.parse(parsedRecommendedArticle.firstRecommendedAt)
      ? existingArticle.firstRecommendedAt
      : parsedRecommendedArticle.firstRecommendedAt;

  return {
    version: registry.version,
    publicationRecords: [...registry.publicationRecords],
    recommendedArticles: registry.recommendedArticles.map((article) =>
      article.articleId === parsedRecommendedArticle.articleId
        ? createRecommendedArticle({
            articleId: article.articleId,
            firstRecommendedAt,
          })
        : article,
    ),
  };
}

function withReactionFeedback(
  publicationRecord: PublicationRecord,
  reactionFeedback: PublicationRecord["reactionFeedback"] | undefined,
): PublicationRecord {
  if (!reactionFeedback) {
    return publicationRecord;
  }

  return {
    ...publicationRecord,
    reactionFeedback: reactionFeedback.map((feedback) => ({
      ...feedback,
      userIds: [...feedback.userIds],
    })),
  };
}

function isSameDeliveryReference(left: DeliveryReference, right: DeliveryReference): boolean {
  return (
    left.externalSystem === right.externalSystem &&
    left.destination === right.destination &&
    left.id === right.id
  );
}
