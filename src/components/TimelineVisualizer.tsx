import React, { useState } from 'react';
import { MatchedSegment, VideoMeta } from '../types/video';
import { formatMsToHMS, formatSecToMS } from '../utils/cvAlgorithm';
import { GitCommit, Clock, CheckCircle } from 'lucide-react';

interface TimelineVisualizerProps {
  metaA: VideoMeta;
  metaB: VideoMeta;
  segments: MatchedSegment[];
  activeSegment: MatchedSegment | null;
  onSelectSegment: (segment: MatchedSegment) => void;
}

export const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({
  metaA,
  metaB,
  segments,
  activeSegment,
  onSelectSegment,
}) => {
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

  const durationA = metaA.duration || 1;
  const durationB = metaB.duration || 1;

  // Colors for different segments
  const colors = [
    { bg: 'bg-emerald-500', fill: '#10b981', border: 'border-emerald-400', text: 'text-emerald-400' },
    { bg: 'bg-blue-500', fill: '#3b82f6', border: 'border-blue-400', text: 'text-blue-400' },
    { bg: 'bg-purple-500', fill: '#a855f7', border: 'border-purple-400', text: 'text-purple-400' },
    { bg: 'bg-amber-500', fill: '#f59e0b', border: 'border-amber-400', text: 'text-amber-400' },
    { bg: 'bg-rose-500', fill: '#f43f5e', border: 'border-rose-400', text: 'text-rose-400' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-slate-100 text-sm">双轨时序映射与溯源连线图</h3>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> 母带A
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> 混剪B
          </span>
          <span className="text-slate-500">|</span>
          <span>点击色块可在播放器中精确定位</span>
        </div>
      </div>

      <div className="relative pt-2 pb-2">
        {/* Track A (Top: Original Video A) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-blue-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              母带原片 A (全长 {formatSecToMS(durationA)})
            </span>
            <span>{formatSecToMS(durationA)}</span>
          </div>

          <div className="relative h-9 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
            {/* Background ticks */}
            <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="h-full w-px bg-slate-500" />
              ))}
            </div>

            {/* Segment blocks on Track A */}
            {segments.map((seg, idx) => {
              const startPct = Math.max(0, Math.min(100, (seg.startMsA / 1000 / durationA) * 100));
              const widthPct = Math.max(1, Math.min(100 - startPct, (seg.durationMsA / 1000 / durationA) * 100));
              const color = colors[idx % colors.length];
              const isActive = activeSegment?.id === seg.id;
              const isHovered = hoveredSegmentId === seg.id;

              return (
                <div
                  key={`trackA-${seg.id}`}
                  onClick={() => onSelectSegment(seg)}
                  onMouseEnter={() => setHoveredSegmentId(seg.id)}
                  onMouseLeave={() => setHoveredSegmentId(null)}
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-md ${
                    color.bg
                  } ${isActive ? 'ring-2 ring-white scale-y-105 z-10' : 'opacity-90'} ${
                    isHovered ? 'brightness-125' : ''
                  }`}
                  title={`片段 #${idx + 1} | A: ${seg.formattedTimeA} | 相似度 ${(seg.similarity * 100).toFixed(1)}%`}
                >
                  <span className="truncate px-1">#{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG Bezier Ribbons connecting Track A and Track B */}
        <div className="h-16 relative w-full pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
            {segments.map((seg, idx) => {
              const startA_pct = (seg.startMsA / 1000 / durationA) * 1000;
              const endA_pct = (seg.endMsA / 1000 / durationA) * 1000;
              const startB_pct = (seg.startMsB / 1000 / durationB) * 1000;
              const endB_pct = (seg.endMsB / 1000 / durationB) * 1000;

              const color = colors[idx % colors.length];
              const isActive = activeSegment?.id === seg.id;
              const isHovered = hoveredSegmentId === seg.id;

              const opacity = isActive || isHovered ? 0.65 : 0.25;

              // Bezier ribbon polygon
              const path = `
                M ${startA_pct} 0
                L ${endA_pct} 0
                C ${endA_pct} 50, ${endB_pct} 50, ${endB_pct} 100
                L ${startB_pct} 100
                C ${startB_pct} 50, ${startA_pct} 50, ${startA_pct} 0
                Z
              `;

              return (
                <path
                  key={`ribbon-${seg.id}`}
                  d={path}
                  fill={color.fill}
                  fillOpacity={opacity}
                  stroke={color.fill}
                  strokeWidth={isActive || isHovered ? 1.5 : 0.5}
                  strokeOpacity={isActive || isHovered ? 0.9 : 0.4}
                />
              );
            })}
          </svg>
        </div>

        {/* Track B (Bottom: Spliced Video B) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-purple-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              混剪拼接视频 B (全长 {formatSecToMS(durationB)})
            </span>
            <span>{formatSecToMS(durationB)}</span>
          </div>

          <div className="relative h-9 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
            {/* Background ticks */}
            <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} className="h-full w-px bg-slate-500" />
              ))}
            </div>

            {/* Segment blocks on Track B */}
            {segments.map((seg, idx) => {
              const startPct = Math.max(0, Math.min(100, (seg.startMsB / 1000 / durationB) * 100));
              const widthPct = Math.max(1, Math.min(100 - startPct, (seg.durationMsB / 1000 / durationB) * 100));
              const color = colors[idx % colors.length];
              const isActive = activeSegment?.id === seg.id;
              const isHovered = hoveredSegmentId === seg.id;

              return (
                <div
                  key={`trackB-${seg.id}`}
                  onClick={() => onSelectSegment(seg)}
                  onMouseEnter={() => setHoveredSegmentId(seg.id)}
                  onMouseLeave={() => setHoveredSegmentId(null)}
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold text-white shadow-md ${
                    color.bg
                  } ${isActive ? 'ring-2 ring-white scale-y-105 z-10' : 'opacity-90'} ${
                    isHovered ? 'brightness-125' : ''
                  }`}
                  title={`片段 #${idx + 1} | B: ${seg.formattedTimeB} | 相似度 ${(seg.similarity * 100).toFixed(1)}%`}
                >
                  <span className="truncate px-1">#{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
