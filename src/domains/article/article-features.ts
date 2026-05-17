export type FeatureSignal = Readonly<{
  key: string;
  salience: number;
}>;

export type OtherSignal = Readonly<{
  key: string;
  salience: number;
}>;

export type ArticleFeatures = Readonly<{
  primaryTopics: readonly FeatureSignal[];
  mentionedTopics: readonly FeatureSignal[];
  unknownTopics: readonly string[];
  featureAxes: Readonly<Record<string, readonly FeatureSignal[]>>;
  otherSignals: readonly OtherSignal[];
}>;
