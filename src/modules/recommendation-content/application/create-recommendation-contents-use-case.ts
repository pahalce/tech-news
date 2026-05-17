import { type ArticleAuthor } from "../../article/application/article-author";
import type { ArticleFeatures } from "../../feature-extraction/domain/article-features";
import {
  parseRecommendationContent,
  type RecommendationContent,
} from "../domain/recommendation-content";

type SelectedRecommendationCandidate = {
  articleId: string;
  source: string;
  canonicalUrl: string;
  title: string;
  feedIds: readonly string[];
  firstSeenInCurrentFeedsAt: string | null;
  ruleScore: number;
  articleFeatures: ArticleFeatures;
};

type FeatureExtraction = {
  articleId: string;
  extractedAt: string;
  readability: {
    isReadable: boolean;
    reason: string | null;
  };
  articleFeatures: ArticleFeatures | null;
  author: ArticleAuthor | null;
};

export type RecommendationContentCreatorInput = {
  candidate: SelectedRecommendationCandidate;
  featureExtraction: FeatureExtraction | null;
};

export type RecommendationContentCreator = {
  create(input: RecommendationContentCreatorInput): Promise<RecommendationContent>;
};

export type CreateRecommendationContentsInput = {
  selectedCandidates: readonly SelectedRecommendationCandidate[];
  featureExtractions?: readonly FeatureExtraction[];
  recommendationContentCreator: RecommendationContentCreator;
};

export type CreateRecommendationContentsResult = {
  recommendationContents: RecommendationContent[];
  featureExtractions: FeatureExtraction[];
};

export async function createRecommendationContents(
  input: CreateRecommendationContentsInput,
): Promise<CreateRecommendationContentsResult> {
  const featureExtractions = [...(input.featureExtractions ?? [])];
  const featureExtractionsByArticleId = new Map(
    featureExtractions.map((featureExtraction) => [featureExtraction.articleId, featureExtraction]),
  );
  const recommendationContents: RecommendationContent[] = [];

  for (const candidate of input.selectedCandidates) {
    const content = await input.recommendationContentCreator.create({
      candidate: {
        ...candidate,
        feedIds: [...candidate.feedIds],
      },
      featureExtraction: featureExtractionsByArticleId.get(candidate.articleId) ?? null,
    });

    const recommendationContent = parseRecommendationContent(content);
    if (recommendationContent.articleId !== candidate.articleId) {
      throw new Error(
        "Recommendation Content Article ID must match selected candidate Article ID.",
      );
    }

    recommendationContents.push(recommendationContent);
  }

  return {
    recommendationContents,
    featureExtractions,
  };
}
