export type FeatureSignal = {
  key: string;
  salience: number;
};

export type OtherSignal = {
  key: string;
  salience: number;
};

export type ArticleFeatures = {
  primaryTopics: FeatureSignal[];
  mentionedTopics: FeatureSignal[];
  unknownTopics: string[];
  featureAxes: Record<string, FeatureSignal[]>;
  otherSignals: OtherSignal[];
};
