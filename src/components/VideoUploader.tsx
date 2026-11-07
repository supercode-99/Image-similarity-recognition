import React, { useRef } from 'react';
import { VideoMeta } from '../types/video';
import { UploadCloud, Film, PlayCircle, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';

interface VideoUploaderProps {
  metaA: VideoMeta | null;
  metaB: VideoMeta | null;
  onVideoSelected: (type: 'A' | 'B', file: File, meta: VideoMeta) => void;
  onLoadDemo: () => void;
  isGeneratingDemo: boolean;
  demoProgressText?: string;
  isProcessing: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  metaA,
  metaB,
  onVideoSelected,
  onLoadDemo,
  isGeneratingDemo,
  demoProgressText,
  isProcessing,
}) => {
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (type: 'A' | 'B', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadVideoMeta(type, file);
  };

  const handleDrop = (type: 'A' | 'B', e: React.DragEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      loadVideoMeta(type, file);
    }
  };

  const loadVideoMeta = (type: 'A' | 'B', file: File) => {
    const url = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url;

    tempVideo.onloadedmetadata = () => {
      const meta: VideoMeta = {
        file,
        url,
        name: file.name,
        duration: tempVideo.duration,
        width: tempVideo.videoWidth,
        height: tempVideo.videoHeight,
        size: file.size,
      };
      onVideoSelected(type, file, meta);
    };
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Demo helper banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 rounded-xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              快速测试短剧场景溯源
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono">
                自带3大剧情镜头+译制字幕+口型微调
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              没有现成视频？点击一键合成短剧母带 A 与拼接混剪视频 B，即刻体验毫秒级相似度比对。
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLoadDemo}
          disabled={isGeneratingDemo || isProcessing}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm rounded-lg shadow-lg shadow-blue-600/25 transition disabled:opacity-50 cursor-pointer"
        >
          {isGeneratingDemo ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{demoProgressText || '正在合成示例视频...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>一键加载短剧测试示例</span>
            </>
          )}
        </button>
      </div>

      {/* Dual Video Dropzones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Video A: Original Drama Video */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop('A', e)}
          onClick={() => !isProcessing && inputARef.current?.click()}
          className={`relative group rounded-xl border-2 border-dashed transition p-4 sm:p-5 flex flex-col items-center justify-center min-h-[170px] cursor-pointer ${
            metaA
              ? 'border-emerald-500/50 bg-emerald-950/10 hover:border-emerald-400'
              : 'border-slate-700 bg-slate-900/50 hover:border-blue-500/70 hover:bg-slate-800/40'
          }`}
        >
          <input
            ref={inputARef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileChange('A', e)}
            disabled={isProcessing}
          />

          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30">
            <span>视频 A</span>
            <span className="text-slate-400">·</span>
            <span>短剧原始母带</span>
          </div>

          {metaA ? (
            <div className="w-full flex items-center gap-4 mt-4">
              <div className="relative w-28 h-20 bg-black/60 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                <video src={metaA.url} className="w-full h-full object-cover" muted />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold text-slate-100 truncate">{metaA.name}</div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>时长: <strong className="text-slate-200">{formatDuration(metaA.duration)}</strong> ({metaA.duration.toFixed(2)}s)</span>
                  <span>分辨率: <strong className="text-slate-200">{metaA.width}x{metaA.height}</strong></span>
                  {metaA.size && <span>大小: <strong className="text-slate-200">{formatFileSize(metaA.size)}</strong></span>}
                </div>
                <div className="text-xs text-emerald-400/90 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已就绪 · 点击可重新替换
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-sm font-medium text-slate-200">
                点击或拖拽上传 <span className="text-blue-400 font-semibold">原剧完整视频 A</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">支持 MP4, WebM, MOV 等主流格式 (母带全长)</div>
            </div>
          )}
        </div>

        {/* Video B: Composite / Edited Video */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop('B', e)}
          onClick={() => !isProcessing && inputBRef.current?.click()}
          className={`relative group rounded-xl border-2 border-dashed transition p-4 sm:p-5 flex flex-col items-center justify-center min-h-[170px] cursor-pointer ${
            metaB
              ? 'border-purple-500/50 bg-purple-950/10 hover:border-purple-400'
              : 'border-slate-700 bg-slate-900/50 hover:border-purple-500/70 hover:bg-slate-800/40'
          }`}
        >
          <input
            ref={inputBRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileChange('B', e)}
            disabled={isProcessing}
          />

          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
            <span>视频 B</span>
            <span className="text-slate-400">·</span>
            <span>截取拼接/混剪视频</span>
          </div>

          {metaB ? (
            <div className="w-full flex items-center gap-4 mt-4">
              <div className="relative w-28 h-20 bg-black/60 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                <video src={metaB.url} className="w-full h-full object-cover" muted />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                  <CheckCircle2 className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold text-slate-100 truncate">{metaB.name}</div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>时长: <strong className="text-slate-200">{formatDuration(metaB.duration)}</strong> ({metaB.duration.toFixed(2)}s)</span>
                  <span>分辨率: <strong className="text-slate-200">{metaB.width}x{metaB.height}</strong></span>
                  {metaB.size && <span>大小: <strong className="text-slate-200">{formatFileSize(metaB.size)}</strong></span>}
                </div>
                <div className="text-xs text-purple-400/90 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已就绪 · 点击可重新替换
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition">
                <Film className="w-6 h-6" />
              </div>
              <div className="text-sm font-medium text-slate-200">
                点击或拖拽上传 <span className="text-purple-400 font-semibold">拼接混剪视频 B</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">包含A中片段截取与外部插入素材、字幕或翻配口型</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
