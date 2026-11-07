import React, { useRef, useState, useEffect } from 'react';
import { MatchedSegment, VideoMeta, AlgorithmConfig } from '../types/video';
import { formatMsToHMS } from '../utils/cvAlgorithm';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Columns,
  Eye,
  SkipBack,
  SkipForward,
  Layers,
  Sparkles,
} from 'lucide-react';

interface SyncPlayerProps {
  metaA: VideoMeta;
  metaB: VideoMeta;
  activeSegment: MatchedSegment | null;
  config: AlgorithmConfig;
}

export const SyncPlayer: React.FC<SyncPlayerProps> = ({
  metaA,
  metaB,
  activeSegment,
  config,
}) => {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMsA, setCurrentMsA] = useState(0);
  const [currentMsB, setCurrentMsB] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'split-slider' | 'roi-mask'>('side-by-side');
  const [splitPosition, setSplitPosition] = useState(50); // 0 - 100%
  const [showSubtitleMask, setShowSubtitleMask] = useState(true);

  // Sync to active segment start when selected
  useEffect(() => {
    if (activeSegment) {
      if (videoARef.current) {
        videoARef.current.currentTime = activeSegment.startMsA / 1000;
        setCurrentMsA(activeSegment.startMsA);
      }
      if (videoBRef.current) {
        videoBRef.current.currentTime = activeSegment.startMsB / 1000;
        setCurrentMsB(activeSegment.startMsB);
      }
      setIsPlaying(false);
    }
  }, [activeSegment]);

  // Sync animation loop when playing
  useEffect(() => {
    let animId: number;

    const checkSync = () => {
      if (videoARef.current && videoBRef.current) {
        const timeA = videoARef.current.currentTime * 1000;
        const timeB = videoBRef.current.currentTime * 1000;
        setCurrentMsA(Math.round(timeA));
        setCurrentMsB(Math.round(timeB));

        // If inside active segment, auto-loop or stop at segment end
        if (activeSegment && isPlaying) {
          if (timeB >= activeSegment.endMsB) {
            videoARef.current.currentTime = activeSegment.startMsA / 1000;
            videoBRef.current.currentTime = activeSegment.startMsB / 1000;
          }
        }
      }

      if (isPlaying) {
        animId = requestAnimationFrame(checkSync);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(checkSync);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, activeSegment]);

  const togglePlay = () => {
    if (!videoARef.current || !videoBRef.current) return;

    if (isPlaying) {
      videoARef.current.pause();
      videoBRef.current.pause();
      setIsPlaying(false);
    } else {
      // Align relative time offset if in active segment
      if (activeSegment) {
        const offset = currentMsB - activeSegment.startMsB;
        videoARef.current.currentTime = Math.max(0, (activeSegment.startMsA + offset) / 1000);
      }
      videoARef.current.playbackRate = playbackSpeed;
      videoBRef.current.playbackRate = playbackSpeed;
      videoARef.current.play();
      videoBRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleReplaySegment = () => {
    if (!activeSegment || !videoARef.current || !videoBRef.current) return;
    videoARef.current.currentTime = activeSegment.startMsA / 1000;
    videoBRef.current.currentTime = activeSegment.startMsB / 1000;
    setCurrentMsA(activeSegment.startMsA);
    setCurrentMsB(activeSegment.startMsB);
    videoARef.current.play();
    videoBRef.current.play();
    setIsPlaying(true);
  };

  const stepFrame = (deltaMs: number) => {
    if (!videoARef.current || !videoBRef.current) return;
    videoARef.current.pause();
    videoBRef.current.pause();
    setIsPlaying(false);

    const newTimeB = Math.max(0, videoBRef.current.currentTime + deltaMs / 1000);
    videoBRef.current.currentTime = newTimeB;
    setCurrentMsB(Math.round(newTimeB * 1000));

    if (activeSegment) {
      const offset = (newTimeB * 1000) - activeSegment.startMsB;
      const newTimeA = Math.max(0, (activeSegment.startMsA + offset) / 1000);
      videoARef.current.currentTime = newTimeA;
      setCurrentMsA(Math.round(newTimeA * 1000));
    } else {
      const newTimeA = Math.max(0, videoARef.current.currentTime + deltaMs / 1000);
      videoARef.current.currentTime = newTimeA;
      setCurrentMsA(Math.round(newTimeA * 1000));
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoARef.current) videoARef.current.playbackRate = speed;
    if (videoBRef.current) videoBRef.current.playbackRate = speed;
  };

  // Timeline scrubber for segment
  const segmentDuration = activeSegment ? activeSegment.durationMsB : (metaB.duration * 1000);
  const currentSegmentProgress = activeSegment
    ? Math.min(100, Math.max(0, ((currentMsB - activeSegment.startMsB) / activeSegment.durationMsB) * 100))
    : (currentMsB / (metaB.duration * 1000)) * 100;

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    if (activeSegment && videoARef.current && videoBRef.current) {
      const offsetMs = (percent / 100) * activeSegment.durationMsB;
      const targetB = (activeSegment.startMsB + offsetMs) / 1000;
      const targetA = (activeSegment.startMsA + offsetMs) / 1000;
      videoBRef.current.currentTime = targetB;
      videoARef.current.currentTime = targetA;
      setCurrentMsB(Math.round(targetB * 1000));
      setCurrentMsA(Math.round(targetA * 1000));
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Player Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-semibold text-slate-100 text-sm">双路同步帧级对比播放器</h3>
          </div>
          {activeSegment && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
              正在锁定时序匹配片段: {activeSegment.formattedTimeB}
            </span>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
              viewMode === 'side-by-side' ? 'bg-blue-600 text-white font-medium shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>左右并排</span>
          </button>
          <button
            onClick={() => setViewMode('split-slider')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
              viewMode === 'split-slider' ? 'bg-blue-600 text-white font-medium shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>卷帘叠合</span>
          </button>
          <button
            onClick={() => setViewMode('roi-mask')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition ${
              viewMode === 'roi-mask' ? 'bg-blue-600 text-white font-medium shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>抗字幕掩码</span>
          </button>
        </div>
      </div>

      {/* Screen Area */}
      <div className="relative bg-black aspect-video max-h-[460px] w-full flex items-center justify-center overflow-hidden select-none">
        {viewMode === 'side-by-side' && (
          <div className="w-full h-full grid grid-cols-2 gap-1 p-1">
            {/* Screen A */}
            <div className="relative w-full h-full bg-slate-950 flex items-center justify-center rounded overflow-hidden group">
              <video
                ref={videoARef}
                src={metaA.url}
                className="w-full h-full object-contain pointer-events-none"
                playsInline
                muted
              />
              <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/75 backdrop-blur border border-blue-500/40 text-[11px] text-blue-300 font-mono">
                原剧 A: {formatMsToHMS(currentMsA)}
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-blue-900/60 text-blue-200 text-[10px] font-semibold">
                母带基准源
              </div>
            </div>

            {/* Screen B */}
            <div className="relative w-full h-full bg-slate-950 flex items-center justify-center rounded overflow-hidden group">
              <video
                ref={videoBRef}
                src={metaB.url}
                className="w-full h-full object-contain pointer-events-none"
                playsInline
                muted
              />
              <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/75 backdrop-blur border border-purple-500/40 text-[11px] text-purple-300 font-mono">
                拼接 B: {formatMsToHMS(currentMsB)}
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 text-[10px] font-semibold">
                截取二创视频
              </div>

              {/* Subtitle ROI Mask visualizer overlay */}
              {showSubtitleMask && (
                <div
                  className="absolute left-0 right-0 bottom-0 bg-red-500/20 border-t-2 border-dashed border-red-500/70 pointer-events-none flex items-center justify-center text-[10px] text-red-200 font-mono tracking-wide backdrop-blur-[1px]"
                  style={{ height: `${config.subtitleMaskHeightPercent}%` }}
                >
                  [算法已排除字幕干扰区域 ({config.subtitleMaskHeightPercent}%)]
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'split-slider' && (
          <div className="relative w-full h-full overflow-hidden bg-black">
            {/* Background Layer: Video A */}
            <video
              ref={videoARef}
              src={metaA.url}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              playsInline
              muted
            />

            {/* Foreground Layer: Video B clipped */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
            >
              <video
                ref={videoBRef}
                src={metaB.url}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
            </div>

            {/* Split Slider Line */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center z-10 shadow-[0_0_10px_rgba(0,0,0,0.8)]"
              style={{ left: `${splitPosition}%` }}
            >
              <div className="w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg -translate-x-1/2">
                <Sliders className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>

            {/* Interactive draggable input on slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={splitPosition}
              onChange={(e) => setSplitPosition(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />

            <div className="absolute top-3 left-3 px-2 py-1 bg-black/80 rounded text-xs text-purple-300 font-mono z-10">
              左: 拼接B ({formatMsToHMS(currentMsB)})
            </div>
            <div className="absolute top-3 right-3 px-2 py-1 bg-black/80 rounded text-xs text-blue-300 font-mono z-10">
              右: 原剧A ({formatMsToHMS(currentMsA)})
            </div>
          </div>
        )}

        {viewMode === 'roi-mask' && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={videoBRef}
              src={metaB.url}
              className="w-full h-full object-contain pointer-events-none"
              playsInline
              muted
            />
            {/* Top Mask: Watermarks */}
            <div
              className="absolute top-0 left-0 right-0 bg-amber-500/30 border-b border-dashed border-amber-400 pointer-events-none flex items-center justify-center text-xs text-amber-200 font-mono"
              style={{ height: `${config.topMaskHeightPercent}%` }}
            >
              顶部台标水印排除区 ({config.topMaskHeightPercent}%)
            </div>

            {/* Bottom Mask: Subtitles */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-rose-500/30 border-t-2 border-dashed border-rose-400 pointer-events-none flex items-center justify-center text-xs text-rose-200 font-mono font-medium"
              style={{ height: `${config.subtitleMaskHeightPercent}%` }}
            >
              底部字幕排除区 ({config.subtitleMaskHeightPercent}% - 即使多国语言字幕文字变动亦完全免疫)
            </div>

            {/* Center Area: Lip sync DCT Low Frequency Feature */}
            <div className="absolute inset-x-[15%] inset-y-[20%] border border-cyan-400/40 rounded-lg pointer-events-none flex items-center justify-center">
              <span className="px-3 py-1 rounded bg-black/60 text-cyan-300 text-xs font-mono border border-cyan-500/30">
                主视觉与结构特征区 (DCT低频哈希 + HSV色彩布局，容差微弱口型变动)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Progress & Scrubbing Bar */}
      <div className="px-4 pt-3 pb-2 bg-slate-950/90 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={currentSegmentProgress}
            onChange={handleScrub}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Playback Controls & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition cursor-pointer shadow-md shadow-blue-600/30"
              title={isPlaying ? '暂停' : '双路同步播放'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={handleReplaySegment}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="重新从当前匹配片段起点开始播放"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <button
              onClick={() => stepFrame(-40)}
              className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
              title="上一帧 (-40ms)"
            >
              <SkipBack className="w-3.5 h-3.5" />
              <span>-40ms</span>
            </button>

            <button
              onClick={() => stepFrame(40)}
              className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
              title="下一帧 (+40ms)"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>+40ms</span>
            </button>
          </div>

          {/* Timecode Readouts */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-blue-300 bg-blue-950/40 px-2 py-1 rounded border border-blue-500/20">
              <span className="text-[10px] text-slate-400">母带A:</span>
              <span className="font-semibold">{formatMsToHMS(currentMsA)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-purple-300 bg-purple-950/40 px-2 py-1 rounded border border-purple-500/20">
              <span className="text-[10px] text-slate-400">混剪B:</span>
              <span className="font-semibold">{formatMsToHMS(currentMsB)}</span>
            </div>
          </div>

          {/* Playback speed selector */}
          <div className="flex items-center gap-1 bg-slate-800/70 p-0.5 rounded-lg border border-slate-700 text-xs">
            {[0.5, 1.0, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                className={`px-2 py-0.5 rounded transition ${
                  playbackSpeed === rate ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
