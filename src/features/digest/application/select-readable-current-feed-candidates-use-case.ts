import { type CurrentFeedCandidate } from "src/domains/article";
import {
  selectReadableCurrentFeedCandidatesFromRegistry,
  type ArticleExtractionRegistry,
  type ReadableCurrentFeedCandidate,
} from "src/domains/article";

export type SelectReadableCurrentFeedCandidatesInput = {
  currentFeedCandidates: readonly CurrentFeedCandidate[];
  articleExtractionRegistry: ArticleExtractionRegistry;
};

export type SelectReadableCurrentFeedCandidatesResult = {
  readableCandidates: ReadableCurrentFeedCandidate[];
};

export function selectReadableCurrentFeedCandidates(
  input: SelectReadableCurrentFeedCandidatesInput,
): SelectReadableCurrentFeedCandidatesResult {
  return {
    readableCandidates: selectReadableCurrentFeedCandidatesFromRegistry(input),
  };
}
