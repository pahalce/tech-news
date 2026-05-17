import { type ArticleAuthor } from "src/features/digest/application/article-author";
import {
  createPublicationRecord,
  createRecommendedArticle,
  type PublicationRecord,
  type RecommendedArticle,
} from "src/domains/digest/publication-record";

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
  messageId: string;
  channelId: string;
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
  const publicationRecords = [...(input.existingPublicationRecords ?? [])];
  const recommendedArticles = [...(input.existingRecommendedArticles ?? [])];
  const failedArticleIds: string[] = [];
  const recommendedArticleIds = new Set(recommendedArticles.map((article) => article.articleId));

  for (const recommendationContent of input.recommendationContents) {
    try {
      const published = await input.publisher.publish({
        recommendationContent: {
          ...recommendationContent,
          learningPoints: [...recommendationContent.learningPoints],
          signalsUsed: [...recommendationContent.signalsUsed],
        },
      });
      publicationRecords.push(
        createPublicationRecord({
          articleId: recommendationContent.articleId,
          messageId: published.messageId,
          channelId: published.channelId,
          postedAt: published.postedAt,
        }),
      );

      if (!recommendedArticleIds.has(recommendationContent.articleId)) {
        recommendedArticleIds.add(recommendationContent.articleId);
        recommendedArticles.push(
          createRecommendedArticle({
            articleId: recommendationContent.articleId,
            firstRecommendedAt: published.postedAt,
          }),
        );
      }
    } catch (error) {
      failedArticleIds.push(recommendationContent.articleId);
      input.onPublishFailure?.({
        articleId: recommendationContent.articleId,
        message: errorMessage(error),
      });
    }
  }

  return {
    publicationRecords,
    recommendedArticles,
    failedArticleIds,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
