import React, { useState } from 'react';
import { MatchedSegment, VideoMeta } from '../types/video';
import { formatMsToHMS } from '../utils/cvAlgorithm';
import {
  Layers,
  Camera,
  Film,
  Download,
  Copy,
  Check,
  Play,
  Percent,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface SegmentResultsProps {
  segments: MatchedSegment[];
  metaA: VideoMeta;
  metaB: VideoMeta;
  activeSegment: MatchedSegment | null;
  onSelectSegment: (segment: MatchedSegment) => void;
}

export const SegmentResults: React.FC<SegmentResultsProps> = ({
  segments,
  metaA,
  metaB,
  activeSegment,
  onSelectSegment,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewTab, setViewTab] = useState<'cards' | 'table'>('cards');

  const totalOverlapDurationMs = segments.reduce((acc, s) => acc + s.durationMsB, 0);
  const totalB_Ms = (metaB.duration || 1) * 1000;
  const overlapRatio = Math.min(100, (totalOverlapDurationMs / totalB_Ms) * 100);
  const avgSimilarity = segments.length > 0
    ? segments.reduce((acc, s) => acc + s.similarity, 0) / segments.length
    : 0;
  const avgConfidence = segments.length > 0
    ? segments.reduce((acc, s) => acc + s.confidence, 0) / segments.length
    : 0;

  const handleCopySummary = () => {
    const text = segments
      .map(
        (s, idx) =>
          `片段 #${idx + 1}:\n` +
          `  - 视频B截取区间: ${s.formattedTimeB} (时长: ${(s.durationMsB / 1000).toFixed(3)}s)\n` +
          `  - 对应视频A区间: ${s.formattedTimeA} (时长: ${(s.durationMsA / 1000).toFixed(3)}s)\n` +
          `  - 相似度: ${(s.similarity * 100).toFixed(1)}%\n` +
          `  - 置信度: ${(s.confidence * 100).toFixed(1)}%\n` +
          `  - 是否同一镜头: ${s.isSameShot ? '是 (单镜头连贯)' : '否 (跨剪辑切镜)'}\n` +
          `  - 是否相同场景: ${s.isSameScene ? '是 (光照与布景高度一致)' : '否'}\n`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      videoA: {
        name: metaA.name,
        durationSeconds: metaA.duration,
        resolution: `${metaA.width}x${metaA.height}`,
      },
      videoB: {
        name: metaB.name,
        durationSeconds: metaB.duration,
        resolution: `${metaB.width}x${metaB.height}`,
      },
      summary: {
        totalMatchesFound: segments.length,
        totalOverlapMs: totalOverlapDurationMs,
        overlapPercentage: overlapRatio.toFixed(2) + '%',
        averageSimilarity: (avgSimilarity * 100).toFixed(2) + '%',
        averageConfidence: (avgConfidence * 100).toFixed(2) + '%',
      },
      matchedSegments: segments.map((s, idx) => ({
        index: idx + 1,
        segmentId: s.id,
        videoB: {
          startMs: s.startMsB,
          endMs: s.endMsB,
          durationMs: s.durationMsB,
          timecode: s.formattedTimeB,
        },
        videoA: {
          startMs: s.startMsA,
          endMs: s.endMsA,
          durationMs: s.durationMsA,
          timecode: s.formattedTimeA,
        },
        similarity: s.similarity,
        confidence: s.confidence,
        isSameShot: s.isSameShot,
        isSameScene: s.isSameScene,
        shotCutCountA: s.shotCutCountA,
        shotCutCountB: s.shotCutCountB,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_match_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = [
      '序号',
      '视频B开始时间',
      '视频B结束时间',
      '视频B开始毫秒',
      '视频B结束毫秒',
      '视频B时长(ms)',
      '视频A开始时间',
      '视频A结束时间',
      '视频A开始毫秒',
      '视频A结束毫秒',
      '视频A时长(ms)',
      '相似度',
      '置信度',
      '是否同一镜头',
      '是否相同场景',
    ];

    const rows = segments.map((s, idx) => [
      idx + 1,
      formatMsToHMS(s.startMsB),
      formatMsToHMS(s.endMsB),
      s.startMsB,
      s.endMsB,
      s.durationMsB,
      formatMsToHMS(s.startMsA),
      formatMsToHMS(s.endMsA),
      s.startMsA,
      s.endMsA,
      s.durationMsA,
      `${(s.similarity * 100).toFixed(2)}%`,
      `${(s.confidence * 100).toFixed(2)}%`,
      s.isSameShot ? '是' : '否',
      s.isSameScene ? '是' : '否',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_match_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>识别匹配片段</span>
            <Film className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1.5 flex items-baseline gap-1">
            <span>{segments.length}</span>
            <span className="text-xs font-normal text-slate-400">个独立区间</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            已分离外部插入广告/片段
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>混剪B原片引用总长</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-1.5 flex items-baseline gap-1 font-mono">
            <span>{(totalOverlapDurationMs / 1000).toFixed(3)}</span>
            <span className="text-xs font-normal text-slate-400">秒</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            精确至毫秒 ({totalOverlapDurationMs.toLocaleString()} ms)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>引用重合占比</span>
            <Percent className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-300 mt-1.5 flex items-baseline gap-1 font-mono">
            <span>{overlapRatio.toFixed(1)}</span>
            <span className="text-xs font-normal text-slate-400">%</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            占视频B全长 ({metaB.duration.toFixed(1)}s)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>平均相似度 / 置信度</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1.5 flex items-baseline gap-1 font-mono">
            <span>{(avgSimilarity * 100).toFixed(1)}%</span>
            <span className="text-xs font-normal text-slate-400">/ {(avgConfidence * 100).toFixed(1)}%</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            排除字幕与口型扰动
          </div>
        </div>
      </div>

      {/* Header and Export Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-semibold text-slate-100 text-sm">
              识别结果与时段明细 (精确到毫秒)
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              共检出 {segments.length} 个重合片段
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switch */}
            <div className="bg-slate-800 p-0.5 rounded-lg flex items-center text-xs">
              <button
                onClick={() => setViewTab('cards')}
                className={`px-2.5 py-1 rounded transition ${
                  viewTab === 'cards' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                卡片视图
              </button>
              <button
                onClick={() => setViewTab('table')}
                className={`px-2.5 py-1 rounded transition ${
                  viewTab === 'table' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                表格清单
              </button>
            </div>

            {/* Export buttons */}
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition border border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制摘要'}</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 JSON</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs rounded-lg transition border border-indigo-500/50 cursor-pointer shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 CSV</span>
            </button>
          </div>
        </div>

        {segments.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Film className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <div className="text-sm font-medium">暂无匹配片段</div>
            <div className="text-xs text-slate-500 mt-1">未能在视频 B 中检测到源自视频 A 的片段，或相似度低于阈值。</div>
          </div>
        ) : viewTab === 'cards' ? (
          /* Cards View */
          <div className="grid grid-cols-1 gap-3.5">
            {segments.map((seg, idx) => {
              const isActive = activeSegment?.id === seg.id;

              return (
                <div
                  key={seg.id}
                  onClick={() => onSelectSegment(seg)}
                  className={`relative rounded-xl border p-4 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-950/30 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Left: Index & Timecodes */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40 font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </div>

                      <div className="space-y-1.5">
                        {/* Video B range */}
                        <div className="flex items-center flex-wrap gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold">
                            混剪视频 B 区间
                          </span>
                          <span className="font-mono text-slate-200 font-bold text-sm">
                            {formatMsToHMS(seg.startMsB)}
                          </span>
                          <span className="text-slate-500">→</span>
                          <span className="font-mono text-slate-200 font-bold text-sm">
                            {formatMsToHMS(seg.endMsB)}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            (截取时长 {(seg.durationMsB / 1000).toFixed(3)}s / {seg.durationMsB}ms)
                          </span>
                        </div>

                        {/* Video A source range */}
                        <div className="flex items-center flex-wrap gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold">
                            原剧母带 A 对应
                          </span>
                          <span className="font-mono text-slate-300 text-sm">
                            {formatMsToHMS(seg.startMsA)}
                          </span>
                          <span className="text-slate-500">→</span>
                          <span className="font-mono text-slate-300 text-sm">
                            {formatMsToHMS(seg.endMsA)}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            (母带时长 {(seg.durationMsA / 1000).toFixed(3)}s / {seg.durationMsA}ms)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Metrics Badges */}
                    <div className="flex flex-wrap items-center gap-3 lg:gap-4 shrink-0">
                      {/* Similarity */}
                      <div className="text-left">
                        <div className="text-[10px] text-slate-400">综合相似度</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                          <span>{(seg.similarity * 100).toFixed(1)}%</span>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden inline-block">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${seg.similarity * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="text-left">
                        <div className="text-[10px] text-slate-400">识别置信度</div>
                        <div className="text-sm font-bold text-blue-400 font-mono">
                          {(seg.confidence * 100).toFixed(1)}%
                        </div>
                      </div>

                      {/* Same Shot Badge */}
                      <div className="text-left">
                        <div className="text-[10px] text-slate-400">是否同一镜头</div>
                        <div className="mt-0.5">
                          {seg.isSameShot ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <Camera className="w-3 h-3" />
                              同一镜头 (无切镜)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              含切镜转场
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Same Scene Badge */}
                      <div className="text-left">
                        <div className="text-[10px] text-slate-400">是否相同场景</div>
                        <div className="mt-0.5">
                          {seg.isSameScene ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                              相同场景
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300">
                              场景跨越
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Thumbnails preview */}
                      {(seg.previewThumbA || seg.previewThumbB) && (
                        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                          {seg.previewThumbA && (
                            <div className="relative group/thumb">
                              <img
                                src={seg.previewThumbA}
                                alt="母带帧"
                                className="w-14 h-9 object-cover rounded border border-blue-500/30"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-blue-300 text-center font-mono">A帧</span>
                            </div>
                          )}
                          {seg.previewThumbB && (
                            <div className="relative group/thumb">
                              <img
                                src={seg.previewThumbB}
                                alt="混剪帧"
                                className="w-14 h-9 object-cover rounded border border-purple-500/30"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-purple-300 text-center font-mono">B帧</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Jump Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSegment(seg);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isActive ? '正在联动' : '联动播放'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">混剪视频B区间 (毫秒)</th>
                  <th className="py-2.5 px-3">截取时长</th>
                  <th className="py-2.5 px-3">原剧母带A区间 (毫秒)</th>
                  <th className="py-2.5 px-3">相似度</th>
                  <th className="py-2.5 px-3">置信度</th>
                  <th className="py-2.5 px-3">是否同一镜头</th>
                  <th className="py-2.5 px-3">是否相同场景</th>
                  <th className="py-2.5 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {segments.map((seg, idx) => {
                  const isActive = activeSegment?.id === seg.id;
                  return (
                    <tr
                      key={seg.id}
                      onClick={() => onSelectSegment(seg)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition ${
                        isActive ? 'bg-blue-950/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-400">#{idx + 1}</td>
                      <td className="py-2.5 px-3 text-purple-300 font-semibold">{seg.formattedTimeB}</td>
                      <td className="py-2.5 px-3 text-slate-300">{(seg.durationMsB / 1000).toFixed(3)}s</td>
                      <td className="py-2.5 px-3 text-blue-300">{seg.formattedTimeA}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{(seg.similarity * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-blue-400">{(seg.confidence * 100).toFixed(1)}%</td>
                      <td className="py-2.5 px-3 font-sans">
                        {seg.isSameShot ? (
                          <span className="text-emerald-400">是 (单镜头)</span>
                        ) : (
                          <span className="text-amber-400">否 (含切镜)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {seg.isSameScene ? <span className="text-cyan-400">是</span> : <span className="text-slate-400">否</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSegment(seg);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                        >
                          播放定位
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
