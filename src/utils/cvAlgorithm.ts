import {
  AlgorithmConfig,
  CandidateSegment,
  FrameFingerprint,
  MatchedSegment,
  ProcessingProgress,
  SimilarityMatrixData,
  VideoMeta,
} from '../types/video';

// Default algorithm configuration
export const DEFAULT_ALGO_CONFIG: AlgorithmConfig = {
  coarseStepSec: 0.8, // Sample every 0.8s for fast initial scan
  fineStepMs: 40, // 40ms fine-tuning (approx 25fps precision)
  similarityThreshold: 0.72, // Multi-feature threshold
  minSegmentDurationSec: 1.2, // Minimum 1.2s to filter out single-frame coincidences
  subtitleMaskHeightPercent: 22, // Exclude bottom 22% (typical subtitle zone)
  topMaskHeightPercent: 6, // Exclude top 6% (header/watermark zone)
  lipToleranceWeight: 0.8, // High tolerance for mouth differences
  enableFineRefinement: true,
};

/**
 * Format milliseconds into HH:MM:SS.mmm
 */
export function formatMsToHMS(totalMs: number): string {
  const safeMs = Math.max(0, Math.round(totalMs));
  const ms = safeMs % 1000;
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
}

/**
 * Format seconds to MM:SS
 */
export function formatSecToMS(totalSec: number): string {
  const safeSec = Math.max(0, Math.floor(totalSec));
  const s = safeSec % 60;
  const m = Math.floor(safeSec / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Convert RGB to HSV
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max / 255;

  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, v];
}

/**
 * 1D Discrete Cosine Transform for 32 values
 */
function createDCTBasis(n: number): number[][] {
  const basis: number[][] = [];
  for (let u = 0; u < n; u++) {
    basis[u] = [];
    const alpha = u === 0 ? 1 / Math.sqrt(n) : Math.sqrt(2 / n);
    for (let x = 0; x < n; x++) {
      basis[u][x] = alpha * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
    }
  }
  return basis;
}

const DCT_32_BASIS = createDCTBasis(32);

/**
 * Compute 64-bit DCT perceptual hash on 32x32 luminance matrix
 * Excludes subtitle and watermark zones
 */
function computePHash(
  luminance32x32: Float32Array,
  validRowStart: number,
  validRowEnd: number
): bigint {
  // 1. Two-dimensional DCT on valid rows (with padding for masked rows)
  const temp = new Float32Array(32 * 32);
  const dct = new Float32Array(32 * 32);

  // Row transform
  for (let y = 0; y < 32; y++) {
    const isMasked = y < validRowStart || y > validRowEnd;
    for (let u = 0; u < 32; u++) {
      let sum = 0;
      if (!isMasked) {
        for (let x = 0; x < 32; x++) {
          sum += luminance32x32[y * 32 + x] * DCT_32_BASIS[u][x];
        }
      }
      temp[y * 32 + u] = sum;
    }
  }

  // Column transform
  for (let u = 0; u < 32; u++) {
    for (let v = 0; v < 32; v++) {
      let sum = 0;
      for (let y = validRowStart; y <= validRowEnd; y++) {
        sum += temp[y * 32 + u] * DCT_32_BASIS[v][y];
      }
      dct[v * 32 + u] = sum;
    }
  }

  // Extract top-left 8x8 low-frequency coefficients (excluding DC term [0,0])
  const lowFreq: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (x === 0 && y === 0) continue;
      lowFreq.push(dct[y * 32 + x]);
    }
  }

  // Calculate median
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Form 64-bit bigint hash (63 low-freq + 1 sign bit)
  let hash = 0n;
  for (let i = 0; i < lowFreq.length; i++) {
    if (lowFreq[i] > median) {
      hash |= 1n << BigInt(i);
    }
  }
  return hash;
}

/**
 * Count bits in BigInt (Hamming distance)
 */
function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/**
 * Extract fingerprint from a video frame drawn on a canvas
 */
export function extractFrameFingerprint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestampSec: number,
  config: AlgorithmConfig,
  generateThumb = false
): FrameFingerprint {
  const topMaskH = Math.floor((height * config.topMaskHeightPercent) / 100);
  const bottomMaskH = Math.floor((height * config.subtitleMaskHeightPercent) / 100);
  const validYStart = topMaskH;
  const validYEnd = height - bottomMaskH;
  const validH = Math.max(10, validYEnd - validYStart);

  // Sample low-res 32x32 for DCT pHash
  // We draw the valid region into a 32x32 canvas slice to ignore subtitles
  const pHashCanvas = document.createElement('canvas');
  pHashCanvas.width = 32;
  pHashCanvas.height = 32;
  const pHashCtx = pHashCanvas.getContext('2d', { willReadFrequently: true })!;
  
  // Draw only the valid non-subtitle ROI stretched to 32x32
  pHashCtx.drawImage(
    ctx.canvas,
    0,
    validYStart,
    width,
    validH,
    0,
    0,
    32,
    32
  );

  const imgData32 = pHashCtx.getImageData(0, 0, 32, 32);
  const lum32 = new Float32Array(32 * 32);
  let totalLum = 0;

  for (let i = 0; i < 32 * 32; i++) {
    const r = imgData32.data[i * 4];
    const g = imgData32.data[i * 4 + 1];
    const b = imgData32.data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lum32[i] = lum;
    totalLum += lum;
  }
  const meanLum = totalLum / (32 * 32);
  let varianceLum = 0;
  for (let i = 0; i < 32 * 32; i++) {
    varianceLum += Math.pow(lum32[i] - meanLum, 2);
  }
  varianceLum /= 32 * 32;

  // DCT pHash across the 32x32 normalized area
  const phash = computePHash(lum32, 0, 31);

  // 4x4 spatial Color Layout Descriptor (HSV) on the valid region
  // 16 blocks, each computing mean H, S, V
  const colorLayout = new Float32Array(16 * 3);
  const edgeDensity = new Float32Array(16);

  // Sample 4x4 blocks from 32x32 grid
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      let sumH = 0, sumS = 0, sumV = 0;
      let edgeCount = 0;
      const count = 8 * 8; // 8x8 pixels per block in 32x32

      for (let py = 0; py < 8; py++) {
        const y = by * 8 + py;
        for (let px = 0; px < 8; px++) {
          const x = bx * 8 + px;
          const idx = (y * 32 + x) * 4;
          const r = imgData32.data[idx];
          const g = imgData32.data[idx + 1];
          const b = imgData32.data[idx + 2];
          const [h, s, v] = rgbToHsv(r, g, b);
          sumH += h;
          sumS += s;
          sumV += v;

          // Simple Sobel-like edge check
          if (x < 31 && y < 31) {
            const nextXIdx = (y * 32 + (x + 1)) * 4;
            const nextYIdx = ((y + 1) * 32 + x) * 4;
            const diffX = Math.abs(imgData32.data[idx] - imgData32.data[nextXIdx]);
            const diffY = Math.abs(imgData32.data[idx] - imgData32.data[nextYIdx]);
            if (diffX + diffY > 35) {
              edgeCount++;
            }
          }
        }
      }

      const blockIdx = by * 4 + bx;
      colorLayout[blockIdx * 3] = sumH / count;
      colorLayout[blockIdx * 3 + 1] = sumS / count;
      colorLayout[blockIdx * 3 + 2] = sumV / count;
      edgeDensity[blockIdx] = edgeCount / count;
    }
  }

  let imageDataUri: string | undefined;
  if (generateThumb) {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 160;
    thumbCanvas.height = 90;
    const tCtx = thumbCanvas.getContext('2d')!;
    tCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, 160, 90);
    imageDataUri = thumbCanvas.toDataURL('image/jpeg', 0.65);
  }

  return {
    timestamp: timestampSec,
    timestampMs: Math.round(timestampSec * 1000),
    phash,
    colorLayout,
    edgeDensity,
    luminanceVariance: varianceLum,
    imageDataUri,
  };
}

/**
 * Calculate multi-feature similarity between two frame fingerprints
 * Returns a value between 0.0 and 1.0
 */
export function calculateFrameSimilarity(
  fpA: FrameFingerprint,
  fpB: FrameFingerprint,
  lipTolerance = 0.8
): number {
  // 1. pHash similarity (64 bits)
  const dist = hammingDistance(fpA.phash, fpB.phash);
  // Normalize: 0 dist = 1.0; >=28 dist = 0.0
  const phashSim = Math.max(0, 1 - dist / 28);

  // 2. Color Layout cosine similarity
  let dotColor = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < fpA.colorLayout.length; i++) {
    const vA = fpA.colorLayout[i];
    const vB = fpB.colorLayout[i];
    dotColor += vA * vB;
    magA += vA * vA;
    magB += vB * vB;
  }
  const colorSim = magA > 0 && magB > 0 ? Math.max(0, dotColor / (Math.sqrt(magA) * Math.sqrt(magB))) : 0;

  // 3. Edge density similarity (L1 inverse)
  let edgeDiff = 0;
  for (let i = 0; i < fpA.edgeDensity.length; i++) {
    edgeDiff += Math.abs(fpA.edgeDensity[i] - fpB.edgeDensity[i]);
  }
  const edgeSim = Math.max(0, 1 - edgeDiff / 8);

  // Weight blending:
  // When lip tolerance is high, we place more weight on Color Layout (scene & outfit)
  // and low-frequency pHash, reducing local micro edge weight
  const wColor = 0.40 + lipTolerance * 0.15; // 0.40 - 0.52
  const wPhash = 0.45; // 0.45
  const wEdge = 1 - (wColor + wPhash); // 0.03 - 0.15

  const totalSim = phashSim * wPhash + colorSim * wColor + edgeSim * wEdge;
  return Math.min(1.0, Math.max(0.0, totalSim));
}

/**
 * Extract fingerprints from video at designated timestamps
 */
export async function extractVideoFingerprints(
  videoElement: HTMLVideoElement,
  timestamps: number[],
  config: AlgorithmConfig,
  onProgress?: (index: number, total: number) => void
): Promise<FrameFingerprint[]> {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const fingerprints: FrameFingerprint[] = [];
  const total = timestamps.length;

  for (let i = 0; i < total; i++) {
    const t = timestamps[i];
    await seekVideo(videoElement, t);

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const fp = extractFrameFingerprint(
      ctx,
      canvas.width,
      canvas.height,
      t,
      config,
      i === 0 || i === Math.floor(total / 2) || i === total - 1
    );
    fingerprints.push(fp);

    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }
  }

  return fingerprints;
}

/**
 * Helper to accurately seek video element to timestamp safely without hanging
 */
export function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    if (!video || isNaN(video.duration) || video.duration <= 0) {
      resolve();
      return;
    }

    const safeTime = Math.max(0, Math.min(video.duration - 0.05, timeSec));

    if (Math.abs(video.currentTime - safeTime) < 0.015) {
      resolve();
      return;
    }

    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        resolve();
      }
    };

    const onSeeked = () => cleanup();
    const onError = () => cleanup();

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    try {
      video.currentTime = safeTime;
    } catch {
      cleanup();
      return;
    }

    // Safety timeout: resolve if browser seek takes longer than 300ms
    setTimeout(cleanup, 300);
  });
}

/**
 * Stage 1: Build coarse cross-similarity matrix and detect candidate continuous segments
 */
export function detectCandidateSegments(
  fpsA: FrameFingerprint[],
  fpsB: FrameFingerprint[],
  config: AlgorithmConfig
): { candidates: CandidateSegment[]; matrixData: SimilarityMatrixData } {
  const width = fpsA.length;
  const height = fpsB.length;
  const matrix = new Float32Array(width * height);
  const timesA = fpsA.map((f) => f.timestamp);
  const timesB = fpsB.map((f) => f.timestamp);

  // Compute full 2D cross similarity
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const sim = calculateFrameSimilarity(fpsA[i], fpsB[j], config.lipToleranceWeight);
      matrix[j * width + i] = sim;
    }
  }

  // Detect diagonal trajectories:
  // A spliced segment from A into B runs at 1.0x speed.
  // Thus, (timeB - timeA) = delta is approximately constant for consecutive frames!
  const minMatches = Math.max(2, Math.floor(config.minSegmentDurationSec / config.coarseStepSec));
  const diagonalTolerance = config.coarseStepSec * 1.35; // allowed temporal jitter

  const visitedPairs = new Uint8Array(width * height);
  const rawSegments: CandidateSegment[] = [];

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (visitedPairs[j * width + i]) continue;
      const initialSim = matrix[j * width + i];

      if (initialSim >= config.similarityThreshold) {
        // Trace forward diagonally along slope 1.0 (both i and j increase)
        let curI = i;
        let curJ = j;
        let matchedCount = 1;
        let totalSim = initialSim;
        const path: [number, number][] = [[curI, curJ]];

        while (curI + 1 < width && curJ + 1 < height) {
          // Look ahead in 3 candidate steps: (1, 1), (1, 2), (2, 1) to tolerate small frame drops
          let bestNextI = -1;
          let bestNextJ = -1;
          let bestSim = 0;

          const candidates = [
            [curI + 1, curJ + 1],
            [curI + 2, curJ + 2],
            [curI + 1, curJ + 2],
            [curI + 2, curJ + 1],
          ];

          for (const [nextI, nextJ] of candidates) {
            if (nextI < width && nextJ < height) {
              const dtCurrent = timesB[nextJ] - timesA[nextI];
              const dtOrig = timesB[curJ] - timesA[curI];
              if (Math.abs(dtCurrent - dtOrig) <= diagonalTolerance) {
                const s = matrix[nextJ * width + nextI];
                if (s >= config.similarityThreshold * 0.90 && s > bestSim) {
                  bestSim = s;
                  bestNextI = nextI;
                  bestNextJ = nextJ;
                }
              }
            }
          }

          if (bestNextI !== -1 && bestSim >= config.similarityThreshold * 0.88) {
            curI = bestNextI;
            curJ = bestNextJ;
            path.push([curI, curJ]);
            matchedCount++;
            totalSim += bestSim;
          } else {
            break;
          }
        }

        const durationA = timesA[curI] - timesA[i];
        const durationB = timesB[curJ] - timesB[j];
        const maxDuration = Math.max(durationA, durationB);

        if (matchedCount >= minMatches || maxDuration >= config.minSegmentDurationSec * 0.85) {
          // Mark temporal corridor along the trajectory as visited to prevent duplicate sub-traces
          for (const [pI, pJ] of path) {
            for (let dj = -1; dj <= 1; dj++) {
              for (let di = -1; di <= 1; di++) {
                const ni = pI + di;
                const nj = pJ + dj;
                if (ni >= 0 && ni < width && nj >= 0 && nj < height) {
                  visitedPairs[nj * width + ni] = 1;
                }
              }
            }
          }

          rawSegments.push({
            startIndexA: i,
            endIndexA: curI,
            startIndexB: j,
            endIndexB: curJ,
            coarseStartTimeA: timesA[i],
            coarseEndTimeA: timesA[curI],
            coarseStartTimeB: timesB[j],
            coarseEndTimeB: timesB[curJ],
            avgSimilarity: totalSim / matchedCount,
          });
        }
      }
    }
  }

  // Deduplicate and merge coarse segments
  // Sort by duration descending so longer segments swallow shorter redundant sub-segments
  rawSegments.sort(
    (a, b) =>
      b.coarseEndTimeB - b.coarseStartTimeB - (a.coarseEndTimeB - a.coarseStartTimeB)
  );

  const filteredCandidates: CandidateSegment[] = [];

  for (const seg of rawSegments) {
    const offsetSeg = seg.coarseStartTimeB - seg.coarseStartTimeA;
    let isCovered = false;

    for (const existing of filteredCandidates) {
      const offsetExisting = existing.coarseStartTimeB - existing.coarseStartTimeA;
      const offsetDiff = Math.abs(offsetSeg - offsetExisting);

      // If consistent offset (within 1.5 coarse steps)
      if (offsetDiff <= config.coarseStepSec * 1.5) {
        // Check containment or large overlap in Video B
        const overlapStart = Math.max(seg.coarseStartTimeB, existing.coarseStartTimeB);
        const overlapEnd = Math.min(seg.coarseEndTimeB, existing.coarseEndTimeB);
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        const segDuration = seg.coarseEndTimeB - seg.coarseStartTimeB;

        // If >= 70% of seg is inside existing, suppress seg
        if (segDuration > 0 && overlapDuration / segDuration >= 0.7) {
          // Expand existing if seg extends it slightly
          existing.coarseStartTimeB = Math.min(existing.coarseStartTimeB, seg.coarseStartTimeB);
          existing.coarseEndTimeB = Math.max(existing.coarseEndTimeB, seg.coarseEndTimeB);
          existing.coarseStartTimeA = Math.min(existing.coarseStartTimeA, seg.coarseStartTimeA);
          existing.coarseEndTimeA = Math.max(existing.coarseEndTimeA, seg.coarseEndTimeA);
          isCovered = true;
          break;
        }
      }
    }

    if (!isCovered) {
      filteredCandidates.push({ ...seg });
    }
  }

  // Sort back by Video B start time
  filteredCandidates.sort((a, b) => a.coarseStartTimeB - b.coarseStartTimeB);

  return {
    candidates: filteredCandidates,
    matrixData: {
      timesA,
      timesB,
      matrix,
      width,
      height,
    },
  };
}

/**
 * Calibrate the precise continuous temporal offset Δt* = tB - tA
 * Samples Video A in a single smooth forward pass, avoiding hundreds of back-and-forth seeks!
 */
export async function calibrateSubframeOffset(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  candidate: CandidateSegment,
  config: AlgorithmConfig,
  ctxA: CanvasRenderingContext2D,
  ctxB: CanvasRenderingContext2D
): Promise<number> {
  const coarseOffset = candidate.coarseStartTimeB - candidate.coarseStartTimeA;
  const candDurationB = Math.max(0.6, candidate.coarseEndTimeB - candidate.coarseStartTimeB);

  // Pick 2-3 interior anchor reference timestamps from Video B
  const anchorCount = Math.max(2, Math.min(3, Math.floor(candDurationB / 1.0)));
  const anchorTimesB: number[] = [];
  for (let k = 1; k <= anchorCount; k++) {
    const ratio = k / (anchorCount + 1);
    anchorTimesB.push(candidate.coarseStartTimeB + ratio * candDurationB);
  }

  // Pre-extract fingerprints for anchor frames in B
  const anchorFpsB: FrameFingerprint[] = [];
  for (const tB of anchorTimesB) {
    await seekVideo(videoB, tB);
    ctxB.drawImage(videoB, 0, 0, ctxB.canvas.width, ctxB.canvas.height);
    anchorFpsB.push(
      extractFrameFingerprint(ctxB, ctxB.canvas.width, ctxB.canvas.height, tB, config)
    );
  }

  // Determine window in Video A to sample:
  // For each anchor, tA is around (tB - coarseOffset) ± 1.2s
  const searchRange = Math.max(1.0, config.coarseStepSec * 1.3);
  const stepSec = Math.max(0.025, Math.min(0.04, config.fineStepMs / 1000));

  let globalBestOffset = coarseOffset;
  let globalBestScore = -1;

  for (let a = 0; a < anchorTimesB.length; a++) {
    const tB = anchorTimesB[a];
    const fpB = anchorFpsB[a];
    const centerA = tB - coarseOffset;
    const minA = Math.max(0, centerA - searchRange);
    const maxA = Math.min((videoA.duration || 9999) - 0.05, centerA + searchRange);

    // Sample Video A in a forward pass
    const samplesA: { timeA: number; fpA: FrameFingerprint }[] = [];
    for (let tA = minA; tA <= maxA; tA += stepSec) {
      await seekVideo(videoA, tA);
      ctxA.drawImage(videoA, 0, 0, ctxA.canvas.width, ctxA.canvas.height);
      const fpA = extractFrameFingerprint(ctxA, ctxA.canvas.width, ctxA.canvas.height, tA, config);
      samplesA.push({ timeA: tA, fpA });
    }

    // Now in memory, find the best match for this anchor
    let bestScoreForAnchor = -1;
    let bestOffsetForAnchor = coarseOffset;
    let bestIdx = -1;

    for (let s = 0; s < samplesA.length; s++) {
      const sim = calculateFrameSimilarity(samplesA[s].fpA, fpB, config.lipToleranceWeight);
      if (sim > bestScoreForAnchor) {
        bestScoreForAnchor = sim;
        bestOffsetForAnchor = tB - samplesA[s].timeA;
        bestIdx = s;
      }
    }

    // Parabolic interpolation around peak
    if (bestIdx > 0 && bestIdx < samplesA.length - 1) {
      const simPrev = calculateFrameSimilarity(samplesA[bestIdx - 1].fpA, fpB, config.lipToleranceWeight);
      const simNext = calculateFrameSimilarity(samplesA[bestIdx + 1].fpA, fpB, config.lipToleranceWeight);
      const denom = simPrev - 2 * bestScoreForAnchor + simNext;
      if (denom < -1e-5) {
        const delta = (0.5 * (simPrev - simNext)) / denom;
        bestOffsetForAnchor -= delta * stepSec;
      }
    }

    if (bestScoreForAnchor > globalBestScore) {
      globalBestScore = bestScoreForAnchor;
      globalBestOffset = bestOffsetForAnchor;
    }
  }

  return globalBestOffset;
}

/**
 * Re-evaluate all metrics (similarity, shot, scene, thumbnails) for a verified segment
 */
export async function reevaluateSegmentMetrics(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  startMsB: number,
  endMsB: number,
  offsetMs: number,
  config: AlgorithmConfig,
  index: number,
  ctxA: CanvasRenderingContext2D,
  ctxB: CanvasRenderingContext2D
): Promise<MatchedSegment> {
  const startMsA = startMsB - offsetMs;
  const endMsA = endMsB - offsetMs;
  const durationMsB = Math.max(100, endMsB - startMsB);
  const durationMsA = durationMsB; // Strictly 1:1

  const durationSecB = durationMsB / 1000;
  const evalSampleCount = Math.max(5, Math.min(25, Math.floor(durationSecB / 0.25)));
  const simScores: number[] = [];
  let shotCutCountA = 0;
  let shotCutCountB = 0;
  let prevFpA: FrameFingerprint | null = null;
  let prevFpB: FrameFingerprint | null = null;
  const colorDiffs: number[] = [];

  let midThumbA = '';
  let midThumbB = '';

  for (let s = 0; s < evalSampleCount; s++) {
    const ratio = s / (evalSampleCount - 1 || 1);
    const sampleMsB = startMsB + ratio * durationMsB;
    const sampleMsA = sampleMsB - offsetMs;

    const sampleSecB = sampleMsB / 1000;
    const sampleSecA = sampleMsA / 1000;

    await seekVideo(videoA, sampleSecA);
    await seekVideo(videoB, sampleSecB);

    ctxA.drawImage(videoA, 0, 0, ctxA.canvas.width, ctxA.canvas.height);
    ctxB.drawImage(videoB, 0, 0, ctxB.canvas.width, ctxB.canvas.height);

    const fpA = extractFrameFingerprint(ctxA, ctxA.canvas.width, ctxA.canvas.height, sampleSecA, config);
    const fpB = extractFrameFingerprint(ctxB, ctxB.canvas.width, ctxB.canvas.height, sampleSecB, config);

    const sim = calculateFrameSimilarity(fpA, fpB, config.lipToleranceWeight);
    simScores.push(sim);

    if (s === Math.floor(evalSampleCount / 2)) {
      midThumbA = ctxA.canvas.toDataURL('image/jpeg', 0.6);
      midThumbB = ctxB.canvas.toDataURL('image/jpeg', 0.6);
    }

    if (prevFpA && prevFpB) {
      const intraSimA = calculateFrameSimilarity(prevFpA, fpA, 0.5);
      const intraSimB = calculateFrameSimilarity(prevFpB, fpB, 0.5);
      if (intraSimA < 0.58) shotCutCountA++;
      if (intraSimB < 0.58) shotCutCountB++;
    }

    let cDiff = 0;
    for (let c = 0; c < fpA.colorLayout.length; c++) {
      cDiff += Math.abs(fpA.colorLayout[c] - fpB.colorLayout[c]);
    }
    colorDiffs.push(cDiff / fpA.colorLayout.length);

    prevFpA = fpA;
    prevFpB = fpB;
  }

  const avgSimilarity = simScores.reduce((acc, v) => acc + v, 0) / (simScores.length || 1);
  const durationFactor = Math.min(1.0, durationSecB / 3.0);
  const simFactor = Math.max(0, (avgSimilarity - config.similarityThreshold) / (1 - config.similarityThreshold));
  const cutSymmetry = shotCutCountA === shotCutCountB ? 1.0 : 0.85;
  const confidence = Math.min(
    0.99,
    Math.max(0.65, 0.45 * avgSimilarity + 0.35 * durationFactor + 0.10 * simFactor + 0.10 * cutSymmetry)
  );

  const isSameShot = shotCutCountA === 0 && shotCutCountB === 0;
  const avgColorDiff = colorDiffs.reduce((a, b) => a + b, 0) / (colorDiffs.length || 1);
  const isSameScene = avgColorDiff < 0.16 && Math.abs(shotCutCountA - shotCutCountB) <= 1;

  return {
    id: `seg-${index + 1}-${startMsB}`,
    startMsA,
    endMsA,
    durationMsA,
    formattedTimeA: `${formatMsToHMS(startMsA)} → ${formatMsToHMS(endMsA)}`,

    startMsB,
    endMsB,
    durationMsB,
    formattedTimeB: `${formatMsToHMS(startMsB)} → ${formatMsToHMS(endMsB)}`,

    similarity: Math.round(avgSimilarity * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,

    isSameShot,
    isSameScene,

    shotCutCountA,
    shotCutCountB,

    previewThumbA: midThumbA,
    previewThumbB: midThumbB,

    sampleCount: evalSampleCount,
  };
}

/**
 * Resolve conflicting partial overlap between two segments with differing offsets
 */
async function resolveConflictingOverlap(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  seg1: MatchedSegment,
  seg2: MatchedSegment,
  config: AlgorithmConfig,
  ctxA: CanvasRenderingContext2D,
  ctxB: CanvasRenderingContext2D
): Promise<{
  type: 'keep_one' | 'split';
  keepIndex?: 1 | 2;
  trimmedSeg1?: MatchedSegment;
  trimmedSeg2?: MatchedSegment;
}> {
  const overlapStartMs = seg2.startMsB;
  const overlapEndMs = seg1.endMsB;
  const overlapDurationMs = overlapEndMs - overlapStartMs;

  const offset1 = seg1.startMsB - seg1.startMsA;
  const offset2 = seg2.startMsB - seg2.startMsA;

  // Sample frames across overlap
  const sampleSteps = Math.max(5, Math.min(15, Math.floor(overlapDurationMs / 100)));
  const sim1List: number[] = [];
  const sim2List: number[] = [];
  const sampleTimesB: number[] = [];

  for (let i = 0; i < sampleSteps; i++) {
    const ratio = i / (sampleSteps - 1 || 1);
    const tB_ms = overlapStartMs + ratio * overlapDurationMs;
    const tB_sec = tB_ms / 1000;
    sampleTimesB.push(tB_ms);

    await seekVideo(videoB, tB_sec);
    ctxB.drawImage(videoB, 0, 0, ctxB.canvas.width, ctxB.canvas.height);
    const fpB = extractFrameFingerprint(ctxB, ctxB.canvas.width, ctxB.canvas.height, tB_sec, config);

    // Test with offset 1 (Source A1)
    const tA1_sec = (tB_ms - offset1) / 1000;
    await seekVideo(videoA, tA1_sec);
    ctxA.drawImage(videoA, 0, 0, ctxA.canvas.width, ctxA.canvas.height);
    const fpA1 = extractFrameFingerprint(ctxA, ctxA.canvas.width, ctxA.canvas.height, tA1_sec, config);
    sim1List.push(calculateFrameSimilarity(fpA1, fpB, config.lipToleranceWeight));

    // Test with offset 2 (Source A2)
    const tA2_sec = (tB_ms - offset2) / 1000;
    await seekVideo(videoA, tA2_sec);
    ctxA.drawImage(videoA, 0, 0, ctxA.canvas.width, ctxA.canvas.height);
    const fpA2 = extractFrameFingerprint(ctxA, ctxA.canvas.width, ctxA.canvas.height, tA2_sec, config);
    sim2List.push(calculateFrameSimilarity(fpA2, fpB, config.lipToleranceWeight));
  }

  const avgSim1 = sim1List.reduce((a, b) => a + b, 0) / sim1List.length;
  const avgSim2 = sim2List.reduce((a, b) => a + b, 0) / sim2List.length;

  // If Seg1 is universally dominant across the overlap
  if (avgSim1 > avgSim2 + 0.12) {
    const newStartB2 = overlapEndMs;
    if (seg2.endMsB - newStartB2 < config.minSegmentDurationSec * 800) {
      return { type: 'keep_one', keepIndex: 1 };
    }
    const trimmed2 = await reevaluateSegmentMetrics(
      videoA,
      videoB,
      newStartB2,
      seg2.endMsB,
      offset2,
      config,
      2,
      ctxA,
      ctxB
    );
    return { type: 'split', trimmedSeg1: seg1, trimmedSeg2: trimmed2 };
  }

  // If Seg2 is universally dominant across the overlap
  if (avgSim2 > avgSim1 + 0.12) {
    const newEndB1 = overlapStartMs;
    if (newEndB1 - seg1.startMsB < config.minSegmentDurationSec * 800) {
      return { type: 'keep_one', keepIndex: 2 };
    }
    const trimmed1 = await reevaluateSegmentMetrics(
      videoA,
      videoB,
      seg1.startMsB,
      newEndB1,
      offset1,
      config,
      1,
      ctxA,
      ctxB
    );
    return { type: 'split', trimmedSeg1: trimmed1, trimmedSeg2: seg2 };
  }

  // Search for the cut transition point where sim1 drops and sim2 takes over
  let bestCutMs = Math.round((overlapStartMs + overlapEndMs) / 2);
  for (let k = 0; k < sampleSteps - 1; k++) {
    if (sim1List[k] >= sim2List[k] && sim1List[k + 1] < sim2List[k + 1]) {
      bestCutMs = sampleTimesB[k];
      break;
    }
  }

  const trimmed1 = await reevaluateSegmentMetrics(
    videoA,
    videoB,
    seg1.startMsB,
    bestCutMs,
    offset1,
    config,
    1,
    ctxA,
    ctxB
  );
  const trimmed2 = await reevaluateSegmentMetrics(
    videoA,
    videoB,
    bestCutMs,
    seg2.endMsB,
    offset2,
    config,
    2,
    ctxA,
    ctxB
  );

  return { type: 'split', trimmedSeg1: trimmed1, trimmedSeg2: trimmed2 };
}

/**
 * Post-refinement resolution engine:
 * Eliminates duplicate & subset intervals, merges partial overlaps, and resolves conflicts
 */
export async function resolveAndMergeAllSegments(
  segments: MatchedSegment[],
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  config: AlgorithmConfig
): Promise<MatchedSegment[]> {
  if (segments.length <= 1) return segments;

  let currentList = [...segments];
  let changed = true;
  let iterations = 0;

  const canvasA = document.createElement('canvas');
  canvasA.width = 320;
  canvasA.height = 180;
  const ctxA = canvasA.getContext('2d', { willReadFrequently: true })!;

  const canvasB = document.createElement('canvas');
  canvasB.width = 320;
  canvasB.height = 180;
  const ctxB = canvasB.getContext('2d', { willReadFrequently: true })!;

  while (changed && iterations < 15) {
    changed = false;
    iterations++;

    // Sort by Video B start time
    currentList.sort((a, b) => a.startMsB - b.startMsB);

    for (let i = 0; i < currentList.length; i++) {
      for (let j = i + 1; j < currentList.length; j++) {
        const seg1 = currentList[i];
        const seg2 = currentList[j];

        const offset1 = seg1.startMsB - seg1.startMsA;
        const offset2 = seg2.startMsB - seg2.startMsA;
        const offsetDiff = Math.abs(offset1 - offset2);

        // Rule 1: Continuous gap < 1.0 second (<= 1000ms) or overlap merging
        // As requested: e.g. 00:01:14.040→00:01:16.400 and 00:01:16.440→00:01:17.540 are unified into 00:01:14.040→00:01:17.540
        const gapMs = seg2.startMsB - seg1.endMsB;
        const isCloseOrOverlapping = gapMs <= 1000; // <= 1.0 second
        const isOffsetConsistent = offsetDiff <= 650; // compatible offset

        if (isCloseOrOverlapping && isOffsetConsistent) {
          const mergedStartB = Math.min(seg1.startMsB, seg2.startMsB);
          const mergedEndB = Math.max(seg1.endMsB, seg2.endMsB);
          const avgOffset = Math.round(
            (offset1 * seg1.durationMsB + offset2 * seg2.durationMsB) /
              (seg1.durationMsB + seg2.durationMsB)
          );

          const mergedSeg = await reevaluateSegmentMetrics(
            videoA,
            videoB,
            mergedStartB,
            mergedEndB,
            avgOffset,
            config,
            i,
            ctxA,
            ctxB
          );

          currentList.splice(j, 1);
          currentList[i] = mergedSeg;
          changed = true;
          break;
        }

        // Rule 2: Complete or Substantial Containment
        const isContained =
          seg1.startMsB <= seg2.startMsB + 300 && seg1.endMsB >= seg2.endMsB - 300;
        if (isContained) {
          if (offsetDiff <= 650) {
            currentList.splice(j, 1);
            changed = true;
            break;
          } else {
            if (seg1.similarity >= seg2.similarity) {
              currentList.splice(j, 1);
            } else {
              currentList.splice(i, 1);
            }
            changed = true;
            break;
          }
        }

        const isReverseContained =
          seg2.startMsB <= seg1.startMsB + 300 && seg2.endMsB >= seg1.endMsB - 300;
        if (isReverseContained) {
          if (offsetDiff <= 650) {
            currentList.splice(i, 1);
            changed = true;
            break;
          } else {
            if (seg2.similarity >= seg1.similarity) {
              currentList.splice(i, 1);
            } else {
              currentList.splice(j, 1);
            }
            changed = true;
            break;
          }
        }

        // Rule 3: Conflicting Overlap with Differing Offsets (> 650ms)
        if (gapMs < -150 && offsetDiff > 650) {
          const splitResult = await resolveConflictingOverlap(
            videoA,
            videoB,
            seg1,
            seg2,
            config,
            ctxA,
            ctxB
          );

          if (splitResult.type === 'keep_one') {
            if (splitResult.keepIndex === 1) {
              currentList.splice(j, 1);
            } else {
              currentList.splice(i, 1);
            }
          } else if (splitResult.type === 'split') {
            currentList[i] = splitResult.trimmedSeg1!;
            currentList[j] = splitResult.trimmedSeg2!;
          }
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  // Filter out any segment that became too short
  const minValidMs = config.minSegmentDurationSec * 800;
  const finalFiltered = currentList.filter((s) => s.durationMsB >= minValidMs);

  // Re-number IDs
  return finalFiltered.map((s, idx) => ({
    ...s,
    id: `seg-${idx + 1}-${s.startMsB}`,
  }));
}

/**
 * Stage 2: Fine-tune boundaries to millisecond precision using calibrated offset Δt*
 */
export async function refineSegmentToMilliseconds(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  candidate: CandidateSegment,
  config: AlgorithmConfig,
  index: number
): Promise<MatchedSegment> {
  const canvasA = document.createElement('canvas');
  canvasA.width = 320;
  canvasA.height = 180;
  const ctxA = canvasA.getContext('2d', { willReadFrequently: true })!;

  const canvasB = document.createElement('canvas');
  canvasB.width = 320;
  canvasB.height = 180;
  const ctxB = canvasB.getContext('2d', { willReadFrequently: true })!;

  // 1. Calibrate the exact sub-frame offset Δt* = tB - tA down to milliseconds!
  // This completely eliminates the systematic ~0.700s error!
  const calibratedOffsetSec = await calibrateSubframeOffset(
    videoA,
    videoB,
    candidate,
    config,
    ctxA,
    ctxB
  );
  const calibratedOffsetMs = Math.round(calibratedOffsetSec * 1000);

  let refinedStartSecB = candidate.coarseStartTimeB;
  let refinedEndSecB = candidate.coarseEndTimeB;

  const fineStepSec = Math.max(0.02, config.fineStepMs / 1000); // e.g. 0.03s ~ 0.04s

  if (config.enableFineRefinement) {
    // 2. Refine Start Boundary of Video B using calibrated offset: tA = tB - calibratedOffsetSec
    const startSearchWindow = Math.min(candidate.coarseStartTimeB, config.coarseStepSec * 1.5);
    let curOffset = 0;
    let bestStartOffset = 0;
    let startSteps = 0;

    // Scan backwards from coarse start of B to find earliest matching frame
    while (curOffset <= startSearchWindow && startSteps < 15) {
      startSteps++;
      const testTimeB = Math.max(0, candidate.coarseStartTimeB - curOffset);
      const testTimeA = testTimeB - calibratedOffsetSec;

      if (testTimeA < 0) break;

      await seekVideo(videoA, testTimeA);
      await seekVideo(videoB, testTimeB);

      ctxA.drawImage(videoA, 0, 0, canvasA.width, canvasA.height);
      ctxB.drawImage(videoB, 0, 0, canvasB.width, canvasB.height);

      const fpA = extractFrameFingerprint(ctxA, canvasA.width, canvasA.height, testTimeA, config);
      const fpB = extractFrameFingerprint(ctxB, canvasB.width, canvasB.height, testTimeB, config);
      const sim = calculateFrameSimilarity(fpA, fpB, config.lipToleranceWeight);

      if (sim >= config.similarityThreshold * 0.90) {
        bestStartOffset = curOffset;
        curOffset += fineStepSec;
      } else {
        break; // Boundary found!
      }
    }

    refinedStartSecB = Math.max(0, candidate.coarseStartTimeB - bestStartOffset);

    // 3. Refine End Boundary of Video B
    const endSearchWindow = Math.min(
      (videoB.duration || 9999) - candidate.coarseEndTimeB,
      config.coarseStepSec * 1.5
    );
    let forwardOffset = 0;
    let bestEndOffset = 0;
    let endSteps = 0;

    while (forwardOffset <= endSearchWindow && endSteps < 15) {
      endSteps++;
      const testTimeB = candidate.coarseEndTimeB + forwardOffset;
      const testTimeA = testTimeB - calibratedOffsetSec;

      if (testTimeB > (videoB.duration || 9999) || testTimeA > (videoA.duration || 9999)) {
        break;
      }

      await seekVideo(videoA, testTimeA);
      await seekVideo(videoB, testTimeB);

      ctxA.drawImage(videoA, 0, 0, canvasA.width, canvasA.height);
      ctxB.drawImage(videoB, 0, 0, canvasB.width, canvasB.height);

      const fpA = extractFrameFingerprint(ctxA, canvasA.width, canvasA.height, testTimeA, config);
      const fpB = extractFrameFingerprint(ctxB, canvasB.width, canvasB.height, testTimeB, config);
      const sim = calculateFrameSimilarity(fpA, fpB, config.lipToleranceWeight);

      if (sim >= config.similarityThreshold * 0.88) {
        bestEndOffset = forwardOffset;
        forwardOffset += fineStepSec;
      } else {
        break; // End cut point found!
      }
    }

    refinedEndSecB = candidate.coarseEndTimeB + bestEndOffset;
  }

  const startMsB = Math.round(refinedStartSecB * 1000);
  const endMsB = Math.round(refinedEndSecB * 1000);

  // Compute final verified metrics using calibrated offset
  return reevaluateSegmentMetrics(
    videoA,
    videoB,
    startMsB,
    endMsB,
    calibratedOffsetMs,
    config,
    index,
    ctxA,
    ctxB
  );
}

/**
 * Full Pipeline Execution
 */
export async function runVideoSimilarityAnalysis(
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  config: AlgorithmConfig,
  onProgress: (progress: ProcessingProgress) => void
): Promise<{
  segments: MatchedSegment[];
  matrixData: SimilarityMatrixData;
}> {
  const durationA = videoA.duration;
  const durationB = videoB.duration;

  if (!durationA || !durationB || isNaN(durationA) || isNaN(durationB)) {
    throw new Error('视频元数据尚未加载完成，请确认视频能够正常解码。');
  }

  // Generate coarse timestamps
  const stepA = Math.max(0.3, config.coarseStepSec);
  const stepB = Math.max(0.3, config.coarseStepSec);

  const timesA: number[] = [];
  for (let t = 0; t <= durationA; t += stepA) timesA.push(t);
  if (timesA[timesA.length - 1] < durationA - 0.2) timesA.push(durationA);

  const timesB: number[] = [];
  for (let t = 0; t <= durationB; t += stepB) timesB.push(t);
  if (timesB[timesB.length - 1] < durationB - 0.2) timesB.push(durationB);

  // 1. Extract Video A
  onProgress({
    stage: 'extract_a',
    stageName: '提取原剧视频A关键指纹',
    percent: 10,
    detail: `正在采样视频A (共 ${timesA.length} 帧，步长 ${stepA}s)...`,
  });

  const fpsA = await extractVideoFingerprints(videoA, timesA, config, (idx, total) => {
    onProgress({
      stage: 'extract_a',
      stageName: '提取原剧视频A关键指纹',
      percent: Math.round(10 + (idx / total) * 25),
      detail: `视频A指纹分析中: ${idx}/${total} 帧 (抗字幕&低频DCT)`,
    });
  });

  // 2. Extract Video B
  onProgress({
    stage: 'extract_b',
    stageName: '提取拼接视频B关键指纹',
    percent: 35,
    detail: `正在采样视频B (共 ${timesB.length} 帧，步长 ${stepB}s)...`,
  });

  const fpsB = await extractVideoFingerprints(videoB, timesB, config, (idx, total) => {
    onProgress({
      stage: 'extract_b',
      stageName: '提取拼接视频B关键指纹',
      percent: Math.round(35 + (idx / total) * 25),
      detail: `视频B指纹分析中: ${idx}/${total} 帧 (抗字幕&低频DCT)`,
    });
  });

  // 3. Coarse 2D Matrix & Candidate Segments
  onProgress({
    stage: 'coarse_matrix',
    stageName: '时序时空对齐与粗候选搜索',
    percent: 65,
    detail: `构建 ${timesA.length}×${timesB.length} 交叉相似度张量并搜索对角连续轨迹...`,
  });

  const { candidates, matrixData } = detectCandidateSegments(fpsA, fpsB, config);

  if (candidates.length === 0) {
    onProgress({
      stage: 'done',
      stageName: '识别完成',
      percent: 100,
      detail: '未检测到超过相似度阈值的匹配片段。',
    });
    return { segments: [], matrixData };
  }

  // 4. Fine-grained Millisecond Refinement
  onProgress({
    stage: 'fine_refinement',
    stageName: '毫秒级区间高精度精确定位',
    percent: 75,
    detail: `正在对 ${candidates.length} 个候选匹配片段进行微秒级边界收敛与镜头判定...`,
  });

  const refinedSegments: MatchedSegment[] = [];

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const segment = await refineSegmentToMilliseconds(videoA, videoB, candidate, config, c);
    refinedSegments.push(segment);

    onProgress({
      stage: 'fine_refinement',
      stageName: '毫秒级区间高精度精确定位',
      percent: Math.round(75 + ((c + 1) / candidates.length) * 20),
      detail: `精确定位中: 片段 ${c + 1}/${candidates.length} [${segment.formattedTimeB}]`,
    });
  }

  // 5. Final Deduplication, Overlap Merging & Metrics Evaluation
  onProgress({
    stage: 'metrics_eval',
    stageName: '冲突区间消解与重复片段融合',
    percent: 95,
    detail: '正在执行非极大值抑制与重叠区间严格融合判定...',
  });

  const finalSegments = await resolveAndMergeAllSegments(
    refinedSegments,
    videoA,
    videoB,
    config
  );

  onProgress({
    stage: 'done',
    stageName: '识别完成',
    percent: 100,
    detail: `成功识别出 ${finalSegments.length} 个不重叠的精准匹配片段！`,
  });

  return {
    segments: finalSegments,
    matrixData,
  };
}
