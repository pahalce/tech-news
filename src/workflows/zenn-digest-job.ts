import type { ExtractCurrentFeedCandidateFeaturesInput } from "../modules/article/application/extract-current-feed-candidate-features-use-case";
import type { CollectCurrentFeedCandidatesInput } from "../modules/article/application/collect-current-feed-candidates-use-case";
import type { FeatureVocabularyConfig } from "../modules/feature/application/feature-vocabulary-config";
import type { AgentState } from "../modules/agent-state/infrastructure/file-agent-state";
import type { RecommendationPublisher } from "../modules/publication/application/publish-recommendations-use-case";
import type { RecommendationContentCreator } from "../modules/recommendation-content/application/create-recommendation-contents-use-case";
import type { LlmReranker } from "../modules/recommendation/application/rerank-current-feed-candidates-use-case";
import { runZennDigestWorkflow } from "../workflows/run-zenn-digest-workflow";

export type RunZennDigestJobInput = {
  loadAgentState(): Promise<AgentState>;
  saveAgentState(state: AgentState): Promise<void>;
  loadFeatureVocabulary(): Promise<FeatureVocabularyConfig>;
  feeds: CollectCurrentFeedCandidatesInput["feeds"];
  feedReader: CollectCurrentFeedCandidatesInput["feedReader"];
  now: ExtractCurrentFeedCandidateFeaturesInput["now"];
  fetchArticleBody: ExtractCurrentFeedCandidateFeaturesInput["fetchArticleBody"];
  extractArticleFeatures: ExtractCurrentFeedCandidateFeaturesInput["extractArticleFeatures"];
  llmReranker: LlmReranker;
  recommendationContentCreator: RecommendationContentCreator;
  publisher: RecommendationPublisher;
};

export async function runZennDigestJob(input: RunZennDigestJobInput): Promise<void> {
  const [agentState, featureVocabulary] = await Promise.all([
    input.loadAgentState(),
    input.loadFeatureVocabulary(),
  ]);
  const result = await runZennDigestWorkflow({
    agentState,
    featureVocabulary,
    feeds: input.feeds,
    feedReader: input.feedReader,
    now: input.now,
    fetchArticleBody: input.fetchArticleBody,
    extractArticleFeatures: input.extractArticleFeatures,
    llmReranker: input.llmReranker,
    recommendationContentCreator: input.recommendationContentCreator,
    publisher: input.publisher,
  });

  await input.saveAgentState(result.agentState);
}
