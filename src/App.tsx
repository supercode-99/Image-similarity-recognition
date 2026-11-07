import React, { useState, useRef } from 'react';
import {
  AlgorithmConfig,
  MatchedSegment,
  ProcessingProgress,
  SimilarityMatrixData,
  VideoMeta,
} from './types/video';
import {
  DEFAULT_ALGO_CONFIG,
  runVideoSimilarityAnalysis,
} from './utils/cvAlgorithm';
import { generateDemoDramaVideos } from './utils/demoGenerator';
import { VideoUploader } from './components/VideoUploader';
import { SyncPlayer } from './components/SyncPlayer';
import { TimelineVisualizer } from './components/TimelineVisualizer';
import { HeatmapViewer } from './components/HeatmapViewer';
import { SegmentResults } from './components/SegmentResults';
import { AlgorithmSettingsModal } from './components/AlgorithmSettingsModal';
import {
  Film,
  Sparkles,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Cpu,
  Layers,
  Activity,
} from 'lucide-react';

export default function App() {
  const [metaA, setMetaA] = useState<VideoMeta | null>(null);
  const [metaB, setMetaB] = useState<VideoMeta | null>(null);

  const [config, setConfig] = useState<AlgorithmConfig>(DEFAULT_ALGO_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Demo generator state
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoProgressText, setDemoProgressText] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Analysis Results
  const [segments, setSegments] = useState<MatchedSegment[] | null>(null);
  const [matrixData, setMatrixData] = useState<SimilarityMatrixData | null>(null);
  const [activeSegment, setActiveSegment] = useState<MatchedSegment | null>(null);

  // Hidden video elements used for frame extraction
  const hiddenVideoARef = useRef<HTMLVideoElement>(null);
  const hiddenVideoBRef = useRef<HTMLVideoElement>(null);

  const handleVideoSelected = (type: 'A' | 'B', file: File, meta: VideoMeta) => {
    if (type === 'A') {
      setMetaA(meta);
    } else {
      setMetaB(meta);
    }
    // Clear previous results on new video
    setSegments(null);
    setMatrixData(null);
    setActiveSegment(null);
    setProgress(null);
    setErrorMessage(null);
  };

  const handleLoadDemo = async () => {
    try {
      setIsGeneratingDemo(true);
      setErrorMessage(null);
      const demoResult = await generateDemoDramaVideos((text, pct) => {
        setDemoProgressText(`${text} (${Math.round(pct)}%)`);
      });

      const demoMetaA: VideoMeta = {
        url: demoResult.urlA,
        name: '豪门风云短剧_原版母带_全长18s.webm',
        duration: 18.0,
        width: 480,
        height: 270,
        size: demoResult.blobA.size,
      };

      const demoMetaB: VideoMeta = {
        url: demoResult.urlB,
        name: '短剧外语二创混剪_带广告与译制字幕_15.5s.webm',
        duration: 15.5,
        width: 480,
        height: 270,
        size: demoResult.blobB.size,
      };

      setMetaA(demoMetaA);
      setMetaB(demoMetaB);
      setSegments(null);
      setMatrixData(null);
      setActiveSegment(null);
      setProgress(null);
    } catch (err: any) {
      setErrorMessage(`生成演示短剧失败: ${err.message || '未知错误'}`);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!metaA || !metaB) {
      setErrorMessage('请先上传原剧视频 A 与混剪拼接视频 B。');
      return;
    }

    const videoA = hiddenVideoARef.current;
    const videoB = hiddenVideoBRef.current;

    if (!videoA || !videoB) {
      setErrorMessage('解码器未就绪，请刷新重试。');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSegments(null);
      setMatrixData(null);
      setActiveSegment(null);

      // Ensure video source metadata is loaded
      videoA.src = metaA.url;
      videoB.src = metaB.url;

      await Promise.all([
        new Promise<void>((res, rej) => {
          if (videoA.readyState >= 1) {
            res();
            return;
          }
          const timer = setTimeout(() => res(), 3000);
          videoA.onloadedmetadata = () => {
            clearTimeout(timer);
            res();
          };
          videoA.onerror = () => {
            clearTimeout(timer);
            rej(new Error('视频 A 加载或解码失败，请确认视频格式'));
          };
        }),
        new Promise<void>((res, rej) => {
          if (videoB.readyState >= 1) {
            res();
            return;
          }
          const timer = setTimeout(() => res(), 3000);
          videoB.onloadedmetadata = () => {
            clearTimeout(timer);
            res();
          };
          videoB.onerror = () => {
            clearTimeout(timer);
            rej(new Error('视频 B 加载或解码失败，请确认视频格式'));
          };
        }),
      ]);

      const result = await runVideoSimilarityAnalysis(
        videoA,
        videoB,
        config,
        (p) => setProgress(p)
      );

      setSegments(result.segments);
      setMatrixData(result.matrixData);

      if (result.segments.length > 0) {
        setActiveSegment(result.segments[0]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`分析失败: ${err.message || '未知错误'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAll = () => {
    setMetaA(null);
    setMetaB(null);
    setSegments(null);
    setMatrixData(null);
    setActiveSegment(null);
    setProgress(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Hidden processing video elements */}
      <video
        ref={hiddenVideoARef}
        className="hidden"
        preload="auto"
        muted
        playsInline
      />
      <video
        ref={hiddenVideoBRef}
        className="hidden"
        preload="auto"
        muted
        playsInline
      />

      {/* App Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  短剧视频相似度与溯源片段识别系统
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono hidden md:inline">
                  纯算法引擎 · 毫秒级精确定位
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                粗精两级高维视觉指纹 · 抗字幕干扰 · 容差译制口型微动 · 多片段精准匹配
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition border border-slate-700 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>算法调参</span>
            </button>

            {(metaA || metaB) && (
              <button
                type="button"
                onClick={handleResetAll}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition border border-slate-700/80 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-200 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-300 hover:text-white underline cursor-pointer"
            >
              关闭
            </button>
          </div>
        )}

        {/* Video Uploader Card */}
        <VideoUploader
          metaA={metaA}
          metaB={metaB}
          onVideoSelected={handleVideoSelected}
          onLoadDemo={handleLoadDemo}
          isGeneratingDemo={isGeneratingDemo}
          demoProgressText={demoProgressText}
          isProcessing={isProcessing}
        />

        {/* Start Analysis Bar */}
        {metaA && metaB && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-left w-full sm:w-auto">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span>准备开始相似度识别与片段溯源</span>
                <span className="text-xs text-slate-400 font-mono">
                  (原剧A: {metaA.duration.toFixed(2)}s | 混剪B: {metaB.duration.toFixed(2)}s)
                </span>
              </div>
              <div className="text-xs text-slate-400">
                算法配置：粗定位步长 <strong className="text-slate-300 font-mono">{config.coarseStepSec}s</strong>，
                精细收敛 <strong className="text-slate-300 font-mono">{config.fineStepMs}ms</strong>，
                底部屏蔽 <strong className="text-rose-400 font-mono">{config.subtitleMaskHeightPercent}%</strong>，
                口型容差 <strong className="text-cyan-400 font-mono">{Math.round(config.lipToleranceWeight * 100)}%</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={isProcessing}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              <Cpu className="w-4 h-4 animate-spin-slow" />
              <span>{isProcessing ? '正在高精度多尺度比对中...' : '开始智能相似度比对识别'}</span>
            </button>
          </div>
        )}

        {/* Real-time Progress Bar */}
        {isProcessing && progress && (
          <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-5 shadow-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <Activity className="w-4 h-4 text-blue-400 animate-spin" />
                <span>{progress.stageName}</span>
              </div>
              <span className="font-mono text-blue-400 font-bold">{progress.percent}%</span>
            </div>

            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
              <span>{progress.detail}</span>
              <span className="text-slate-500">双阶段高维特征计算</span>
            </div>
          </div>
        )}

        {/* Results Area */}
        {segments && metaA && metaB && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Synchronized Player */}
            <SyncPlayer
              metaA={metaA}
              metaB={metaB}
              activeSegment={activeSegment}
              config={config}
            />

            {/* Dual Timeline Ribbon Visualizer */}
            <TimelineVisualizer
              metaA={metaA}
              metaB={metaB}
              segments={segments}
              activeSegment={activeSegment}
              onSelectSegment={(seg) => setActiveSegment(seg)}
            />

            {/* 2D Similarity Matrix Heatmap */}
            {matrixData && (
              <HeatmapViewer
                matrixData={matrixData}
                segments={segments}
                activeSegment={activeSegment}
                onSelectSegment={(seg) => setActiveSegment(seg)}
              />
            )}

            {/* Detailed Segments Results Table & Badges */}
            <SegmentResults
              segments={segments}
              metaA={metaA}
              metaB={metaB}
              activeSegment={activeSegment}
              onSelectSegment={(seg) => setActiveSegment(seg)}
            />
          </div>
        )}

        {/* Algorithm Technical Principle Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>算法核心架构与抗干扰原理说明</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-400">
            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                1. 智能选区抗字幕干扰 (ROI Exclusion)
              </div>
              <p>
                短剧由于翻译、多端发布常在画面底部（通常占 15%~25%）出现中英字幕。算法在提取图像特征时严格屏蔽该下边缘区域与顶部水印，彻底排除动态字幕变动对指纹相关性的负面影响。
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                2. 频域拓扑容差人物微动 (DCT pHash)
              </div>
              <p>
                多语种配音导致口型发音不同。算法提取 32x32 DCT 的前 8x8 低频交流分量感知哈希与 4x4 空间网格 HSV 宏观色彩布局，抓取镜头大结构与光影，天然抑制局部唇部像素抖动。
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                3. 粗精两级毫秒收敛 (Coarse-to-Fine)
              </div>
              <p>
                视频通常较长，算法首先以 0.6s~0.8s 粗步长进行全局扫描，构建 2D 矩阵并通过对角线轨迹聚类圈定候选段；随后在入点与出点处启动高频边界探查，锁定精确毫秒级起止点。
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                4. 亚帧时钟校准与重叠融合 (NMS Fusion)
              </div>
              <p>
                利用抛物线插值搜索最佳交叉互相关峰值，消除粗采样网格引起的毫秒相位偏移；对互相包含的子区间实施非极大值抑制，对部分重叠区间根据时序偏移一致性智能合并或按切镜精确切割。
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        视频相似度识别工具 · Video Match Pro · 毫秒级片段溯源与镜头研判系统
      </footer>

      {/* Algorithm Tuning Modal */}
      <AlgorithmSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onChangeConfig={setConfig}
      />
    </div>
  );
}
