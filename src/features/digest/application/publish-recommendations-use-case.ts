import { type ArticleAuthor } from "src/domains/article";
import {
  recordPublishedDigestItem,
  type DeliveryReference,
  type PublicationRecord,
  type PublishedDigestRegistry,
  type RecommendedArticle,
} from "src/domains/digest";

type RecommendationContent = {
  articleId: string;
  canonicalUrl: string;
  title: string;
  summary: string;
  whyRecommended: string;
  learningPoints: readonly string[];
  signalsUsed: readonly string[];
  author?: ArticleAuthor | null;
};

export type PublishRecommendationMessageInput = {
  recommendationContent: RecommendationContent;
};

export type PublishRecommendationMessageResult = {
  deliveryReference: DeliveryReference;
  postedAt: string;
};

export type RecommendationPublisher = {
  publish(input: PublishRecommendationMessageInput): Promise<PublishRecommendationMessageResult>;
};

export type PublishRecommendationsInput = {
  recommendationContents: readonly RecommendationContent[];
  existingPublicationRecords?: readonly PublicationRecord[];
  existingRecommendedArticles?: readonly RecommendedArticle[];
  publisher: RecommendationPublisher;
  onPublishFailure?(failure: { articleId: string; message: string }): void;
};

export type PublishRecommendationsResult = {
  publicationRecords: PublicationRecord[];
  recommendedArticles: RecommendedArticle[];
  failedArticleIds: string[];
};

export async function publishRecommendations(
  input: PublishRecommendationsInput,
): Promise<PublishRecommendationsResult> {
  let registry: PublishedDigestRegistry = {
    version: 1,
    publicationRecords: [...(input.existingPublicationRecords ?? [])],
    recommendedArticles: [...(input.existingRecommendedArticles ?? [])],
  };
  const failedArticleIds: string[] = [];

  for (const recommendationContent of input.recommendationContents) {
    try {
      const published = await input.publisher.publish({
        recommendationContent: {
          ...recommendationContent,
          learningPoints: [...recommendationContent.learningPoints],
          signalsUsed: [...recommendationContent.signalsUsed],
        },
      });
      registry = recordPublishedDigestItem(registry, {
        articleId: recommendationContent.articleId,
        deliveryReference: published.deliveryReference,
        publishedAt: published.postedAt,
      });
    } catch (error) {
      failedArticleIds.push(recommendationContent.articleId);
      input.onPublishFailure?.({
        articleId: recommendationContent.articleId,
        message: errorMessage(error),
      });
    }
  }

  return {
    publicationRecords: [...registry.publicationRecords],
    recommendedArticles: [...registry.recommendedArticles],
    failedArticleIds,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
