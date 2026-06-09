import type { Blueprint } from '../blueprint/types';

export interface NarrativeResponse {
  intro: string;
  win: string;
  lose: string;
}

export type HintTier = 1 | 2 | 3;

export interface HintRequest {
  skill: string;
  prompt: string;
  hint?: string;
  explanation?: string;
  tier: HintTier;
}
export interface HintResponse {
  hint: string;
}

export interface BlueprintRequest {
  seed: number;
  theme: string;
}
export interface BlueprintResponse {
  blueprint: Blueprint;
}

export interface JudgeRequest {
  blueprint: Blueprint;
}
export interface JudgeResponse {
  score: number; // 0..1
  accept: boolean;
  reasons: string[];
}
