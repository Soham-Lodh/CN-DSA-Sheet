export const SCORING_POINTS = { EASY: 3, MEDIUM: 5, HARD: 8 } as const;

/** Per-sheet scoring configuration (Sheet.easyPoints/mediumPoints/hardPoints). */
export interface ScoringConfig {
  easyPoints: number;
  mediumPoints: number;
  hardPoints: number;
}

/** The global default every sheet starts with: Easy 3 · Medium 5 · Hard 8. */
export const DEFAULT_SHEET_SCORING: ScoringConfig = {
  easyPoints: SCORING_POINTS.EASY,
  mediumPoints: SCORING_POINTS.MEDIUM,
  hardPoints: SCORING_POINTS.HARD,
};

/** Points for a solved question by difficulty (UNKNOWN/unscored -> 0). */
export function pointsForDifficulty(
  difficulty: string | null | undefined,
  config: ScoringConfig = DEFAULT_SHEET_SCORING,
): number {
  switch (difficulty) {
    case "EASY":
      return config.easyPoints;
    case "MEDIUM":
      return config.mediumPoints;
    case "HARD":
      return config.hardPoints;
    default:
      return 0;
  }
}

export interface DifficultyCounts {
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

/** Sum of difficulty counts and the 3/5/8 score in one pass. */
export function tallyDifficulty(
  items: { difficulty: string | null | undefined }[],
): DifficultyCounts & { score: number } {
  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;
  let score = 0;
  for (const item of items) {
    const pts = pointsForDifficulty(item.difficulty);
    if (pts === 0) continue;
    score += pts;
    if (item.difficulty === "EASY") easySolved++;
    else if (item.difficulty === "MEDIUM") mediumSolved++;
    else hardSolved++;
  }
  return { easySolved, mediumSolved, hardSolved, score };
}
