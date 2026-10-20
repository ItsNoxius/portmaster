export enum FeatureID {
  None = "",
  SPN = "spn",
  PrioritySupport = "support",
  History = "history",
  Bandwidth = "bw-vis",
  VPNCompat = "vpn-compat",
}

/** Features that run entirely on this device and need no subscription. */
export const LocalFeatures: FeatureID[] = [FeatureID.History, FeatureID.Bandwidth];

/** Returns whether the given plan feature IDs grant access to feature. */
export function hasFeature(featureIds: FeatureID[] | null | undefined, feature: FeatureID): boolean {
  return LocalFeatures.includes(feature) || (featureIds?.includes(feature) ?? false);
}
