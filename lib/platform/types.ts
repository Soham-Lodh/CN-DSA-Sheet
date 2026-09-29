import { Difficulty } from "@prisma/client";

/** Shape every platform provider must implement. */
export interface ProviderValidationResult {
  valid: boolean;
  username: string;
  normalizedUsername: string;
  error?: string;
}

export interface PlatformProfile {
  username: string;
  name?: string;
  avatarUrl?: string;
  ranking?: number;
  rating?: number;
  rank?: string;
}

export interface PlatformStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  rating?: number;
  rank?: string;
  rawMetadata?: Record<string, any>;
}

export interface SolvedProblemRecord {
  externalKey: string;
  title?: string;
  difficulty?: Difficulty;
  solvedAt?: Date;
  sourceSubmissionId?: string;
  source?: string;
}

export interface PlatformProblemMetadata {
  externalKey: string;
  title: string;
  difficulty: Difficulty;
  topic?: string;
  url: string;
  tags?: string[];
}

export interface PlatformProvider {
  validateUsername(username: string): Promise<ProviderValidationResult>;
  fetchProfile(username: string): Promise<PlatformProfile>;
  fetchStats(username: string): Promise<PlatformStats>;
  fetchSolvedProblems(username: string): Promise<SolvedProblemRecord[]>;
  fetchProblemMetadata(externalKey: string): Promise<PlatformProblemMetadata | null>;
}
