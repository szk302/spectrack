export const SPECTRACK_CONFIG_FILE = "spectrack.yml";
export const SPECTRACKIGNORE_FILE = ".spectrackignore";
export const TARGET_EXTENSIONS = ["md", "yml", "yaml"] as const;
export type TargetExtension = (typeof TARGET_EXTENSIONS)[number];
