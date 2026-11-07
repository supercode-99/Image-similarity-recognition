export interface VideoMeta {
  file?: File;
  url: string;
  name: string;
  duration: number; // in seconds
  width: number;
  height: number;
  size?: number;
}

export interface FrameFingerprint {
  timestamp: number; // in seconds
  timestampMs: number; // in ms
  phash: bigint; // 64-bit DCT perceptual hash (ignoring subtitle zone)
  colorLayout: Float32Array; // 4x4 spatial HSV grid (48 values)
  edgeDensity: Float32Array; // 4x4 spatial edge density (16 values)
  luminanceVariance: number;
  imageDataUri?: string; // Optional low-res preview frame for UI
}

export interface CandidateSegment {
  startIndexA: number;
  endIndexA: number;
  startIndexB: number;
  endIndexB: number;
  coarseStartTimeA: number;
  coarseEndTimeA: number;
  coarseStartTimeB: number;
  coarseEndTimeB: number;
  avgSimilarity: number;
}

export interface MatchedSegment {
  id: string;
  // Millisecond-precision timestamps
  startMsA: number;
  endMsA: number;
  durationMsA: number;
  formattedTimeA: string; // e.g. "00:01:23.450 -> 00:02:10.120"
  
  startMsB: number;
  endMsB: number;
  durationMsB: number;
  formattedTimeB: string;

  similarity: number; // 0.0 - 1.0 (e.g. 0.942 -> 94.2%)
  confidence: number; // 0.0 - 1.0 (e.g. 0.965 -> 96.5%)
  
  isSameShot: boolean; // 是否处于同一镜头 (Single continuous shot without cut)
  isSameScene: boolean; // 是否处于相同场景 (Same scene lighting & background)
  
  shotCutCountA: number;
  shotCutCountB: number;
  
  // Keyframe previews for visual inspection
  previewThumbA?: string;
  previewThumbB?: string;
  
  // Fine-tuned frame count
  sampleCount: number;
}

export interface AlgorithmConfig {
  coarseStepSec: number; // Coarse sampling step (e.g. 0.6s)
  fineStepMs: number; // Fine boundary step (e.g. 40ms)
  similarityThreshold: number; // Base match threshold (e.g. 0.74)
  minSegmentDurationSec: number; // Minimum match duration (e.g. 1.2s)
  subtitleMaskHeightPercent: number; // Bottom subtitle exclusion % (e.g. 22%)
  topMaskHeightPercent: number; // Top watermark/logo exclusion % (e.g. 6%)
  lipToleranceWeight: number; // 0-1, higher means less weight on mouth/face micro-texture
  enableFineRefinement: boolean; // Refine to millisecond precision
}

export interface ProcessingProgress {
  stage: 'idle' | 'extract_a' | 'extract_b' | 'coarse_matrix' | 'fine_refinement' | 'metrics_eval' | 'done';
  stageName: string;
  percent: number;
  detail: string;
  currentFps?: number;
}

export interface SimilarityMatrixData {
  timesA: number[];
  timesB: number[];
  matrix: Float32Array; // Flattened timesB.length x timesA.length
  width: number; // timesA.length
  height: number; // timesB.length
}
