import React, { useRef, useEffect, useState } from 'react';
import { SimilarityMatrixData, MatchedSegment } from '../types/video';
import { formatSecToMS } from '../utils/cvAlgorithm';
import { Grid, Info } from 'lucide-react';

interface HeatmapViewerProps {
  matrixData: SimilarityMatrixData | null;
  segments: MatchedSegment[];
  activeSegment: MatchedSegment | null;
  onSelectSegment: (segment: MatchedSegment) => void;
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({
  matrixData,
  segments,
  activeSegment,
  onSelectSegment,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    timeA: number;
    timeB: number;
    sim: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!matrixData || !canvasRef.current) return;

    const { timesA, timesB, matrix, width, height } = matrixData;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    // Set canvas dimensions to display size
    const displayW = canvas.width;
    const displayH = canvas.height;

    ctx.clearRect(0, 0, displayW, displayH);

    // Render similarity matrix
    const imgData = ctx.createImageData(width, height);
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const val = matrix[j * width + i]; // 0.0 - 1.0
        const idx = (j * width + i) * 4;

        // Custom heatmap colormap: dark navy -> violet -> orange -> bright yellow
        let r = 0, g = 0, b = 0;
        if (val < 0.4) {
          // 0.0 - 0.4: Deep dark blue / purple
          const t = val / 0.4;
          r = Math.floor(15 + t * 25);
          g = Math.floor(20 + t * 30);
          b = Math.floor(40 + t * 80);
        } else if (val < 0.7) {
          // 0.4 - 0.7: Violet to Magenta
          const t = (val - 0.4) / 0.3;
          r = Math.floor(40 + t * 150);
          g = Math.floor(50 + t * 20);
          b = Math.floor(120 + t * 80);
        } else {
          // 0.7 - 1.0: Warm Gold / Hot Yellow
          const t = (val - 0.7) / 0.3;
          r = Math.floor(190 + t * 65);
          g = Math.floor(70 + t * 185);
          b = Math.floor(200 - t * 150);
        }

        imgData.data[idx] = r;
        imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = b;
        imgData.data[idx + 3] = 255;
      }
    }

    // Scale up using intermediate canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, displayW, displayH);

    // Overlay detected match trajectories/boxes
    const maxTimeA = timesA[timesA.length - 1] || 1;
    const maxTimeB = timesB[timesB.length - 1] || 1;

    segments.forEach((seg, idx) => {
      const x1 = (seg.startMsA / 1000 / maxTimeA) * displayW;
      const x2 = (seg.endMsA / 1000 / maxTimeA) * displayW;
      const y1 = (seg.startMsB / 1000 / maxTimeB) * displayH;
      const y2 = (seg.endMsB / 1000 / maxTimeB) * displayH;

      const isActive = activeSegment?.id === seg.id;

      // Draw match diagonal line
      ctx.beginPath();
      ctx.strokeStyle = isActive ? '#ffffff' : '#22c55e';
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw bounding box
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(34, 197, 94, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x1, y1, Math.max(4, x2 - x1), Math.max(4, y2 - y1));
      ctx.setLineDash([]);

      // Label badge
      ctx.fillStyle = isActive ? '#3b82f6' : '#15803d';
      ctx.fillRect(x1, y1 - 16, 26, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`#${idx + 1}`, x1 + 4, y1 - 6);
    });
  }, [matrixData, segments, activeSegment]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!matrixData || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { timesA, timesB, matrix, width, height } = matrixData;
    const col = Math.floor((x / canvasRef.current.width) * width);
    const row = Math.floor((y / canvasRef.current.height) * height);

    if (col >= 0 && col < width && row >= 0 && row < height) {
      const sim = matrix[row * width + col];
      const timeA = timesA[col];
      const timeB = timesB[row];
      setHoverInfo({ timeA, timeB, sim, x, y });
    }
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  if (!matrixData) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100 text-sm">2D 跨视频相似度热力阵列 (矩阵对角线识别)</h3>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> 高相似连续对角段
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> 算法截获候选框
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="flex">
          {/* Y Axis Label */}
          <div className="w-16 flex flex-col justify-between py-2 text-[10px] text-slate-400 font-mono text-right pr-2 select-none">
            <span>B: 00:00</span>
            <span className="rotate-[-90deg] my-auto text-purple-400 font-semibold whitespace-nowrap">
              混剪视频 B 时序 ↓
            </span>
            <span>B: {formatSecToMS(matrixData.timesB[matrixData.timesB.length - 1] || 0)}</span>
          </div>

          {/* Canvas Box */}
          <div className="relative flex-1 bg-black rounded-lg border border-slate-800 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={560}
              height={260}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="w-full h-[260px] object-fill cursor-crosshair block"
            />

            {hoverInfo && (
              <div
                className="absolute pointer-events-none bg-slate-950/95 border border-slate-700 rounded px-2.5 py-1 text-xs shadow-xl z-20 font-mono"
                style={{
                  left: `${Math.min(hoverInfo.x + 12, 420)}px`,
                  top: `${Math.min(hoverInfo.y + 12, 210)}px`,
                }}
              >
                <div className="text-slate-300">A (原剧): {hoverInfo.timeA.toFixed(2)}s</div>
                <div className="text-purple-300">B (混剪): {hoverInfo.timeB.toFixed(2)}s</div>
                <div className="text-amber-400 font-bold">相似度: {(hoverInfo.sim * 100).toFixed(1)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* X Axis Label */}
        <div className="flex ml-16 justify-between pt-1 text-[10px] text-slate-400 font-mono select-none">
          <span>A: 00:00</span>
          <span className="text-blue-400 font-semibold">母带原剧 A 时序 →</span>
          <span>A: {formatSecToMS(matrixData.timesA[matrixData.timesA.length - 1] || 0)}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 p-2.5 bg-slate-950/60 rounded-lg text-xs text-slate-400 border border-slate-800/80">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong>原理解释：</strong> 当视频 B 中的某一段由视频 A 剪辑而来且以常规 1.0x 速率播放时，两者在交叉相似度矩阵中会产生一条斜率约为 1.0 的<strong>对角线高亮轨迹</strong>。该算法通过搜索时空对角连通分量，从而无死角截获所有散落在各处的截取片段。
        </div>
      </div>
    </div>
  );
};
