import React from 'react';
import { AlgorithmConfig } from '../types/video';
import { DEFAULT_ALGO_CONFIG } from '../utils/cvAlgorithm';
import { Sliders, X, RotateCcw, Shield, MicOff, Clock, Sparkles } from 'lucide-react';

interface AlgorithmSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AlgorithmConfig;
  onChangeConfig: (newConfig: AlgorithmConfig) => void;
}

export const AlgorithmSettingsModal: React.FC<AlgorithmSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
}) => {
  if (!isOpen) return null;

  const handleChange = <K extends keyof AlgorithmConfig>(key: K, value: AlgorithmConfig[K]) => {
    onChangeConfig({
      ...config,
      [key]: value,
    });
  };

  const handleReset = () => {
    onChangeConfig({ ...DEFAULT_ALGO_CONFIG });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">高维指纹识别算法参数调优</h3>
              <p className="text-xs text-slate-400">两级多尺度检索与抗字幕/口型抗干扰配置</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Subtitle Exclusion */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" />
                <span className="font-semibold text-slate-200 text-xs sm:text-sm">
                  底部字幕区域屏蔽比例 (ROI Mask)
                </span>
              </div>
              <span className="font-mono text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                底部 {config.subtitleMaskHeightPercent}%
              </span>
            </div>
            <p className="text-xs text-slate-400">
              短剧通常在画面底部 15%~25% 带有中文或外语翻配字幕。算法在提取哈希与色彩特征时将完全剔除该选区，避免字幕文字变动干扰视频主内容。
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="35"
                step="1"
                value={config.subtitleMaskHeightPercent}
                onChange={(e) => handleChange('subtitleMaskHeightPercent', parseInt(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>
          </div>

          {/* Lip Movement Tolerance */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MicOff className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-slate-200 text-xs sm:text-sm">
                  译制配音口型变动容差权重
                </span>
              </div>
              <span className="font-mono text-cyan-400 font-bold text-xs bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                {Math.round(config.lipToleranceWeight * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-400">
              短剧翻译出海后人物嘴部动作会因语种发音而改变。提高该权重时，算法着重依靠低频 DCT 频域拓扑、全局空间 HSV 色彩分布与大轮廓，大幅降低微弱唇形像素抖动的惩罚。
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={config.lipToleranceWeight}
                onChange={(e) => handleChange('lipToleranceWeight', parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {/* Sampling & Accuracy Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Coarse Step */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">粗定位采样步长</span>
                <span className="font-mono text-blue-400 font-bold">{config.coarseStepSec}s</span>
              </div>
              <p className="text-[11px] text-slate-400">
                快速初筛全片的时间跨度，越小越细腻，越大速度越快。
              </p>
              <input
                type="range"
                min="0.4"
                max="1.5"
                step="0.1"
                value={config.coarseStepSec}
                onChange={(e) => handleChange('coarseStepSec', parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Fine Step */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">精定位毫秒步长</span>
                <span className="font-mono text-indigo-400 font-bold">{config.fineStepMs}ms</span>
              </div>
              <p className="text-[11px] text-slate-400">
                在候选片段边界进行微观收敛的步长 (~25fps-50fps)。
              </p>
              <input
                type="range"
                min="20"
                max="80"
                step="10"
                value={config.fineStepMs}
                onChange={(e) => handleChange('fineStepMs', parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Threshold */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">相似度判定基准</span>
                <span className="font-mono text-emerald-400 font-bold">{Math.round(config.similarityThreshold * 100)}%</span>
              </div>
              <p className="text-[11px] text-slate-400">
                达到该阈值时判定为有效命中帧并建立时序对角关联。
              </p>
              <input
                type="range"
                min="0.60"
                max="0.88"
                step="0.02"
                value={config.similarityThreshold}
                onChange={(e) => handleChange('similarityThreshold', parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Min Duration */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">最短有效片段时长</span>
                <span className="font-mono text-amber-400 font-bold">{config.minSegmentDurationSec}s</span>
              </div>
              <p className="text-[11px] text-slate-400">
                过滤过短的偶然雷同帧，保留真实剪辑片段。
              </p>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={config.minSegmentDurationSec}
                onChange={(e) => handleChange('minSegmentDurationSec', parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Enable Fine Boundary Switch */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
            <div>
              <div className="font-semibold text-slate-200 text-xs sm:text-sm">开启毫秒级边界精细拟合 (Stage 2)</div>
              <div className="text-xs text-slate-400 mt-0.5">
                粗精两级流水线核心：先粗略锁定连续区间，再高频采样收敛至具体毫秒出入点。
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableFineRefinement}
                onChange={(e) => handleChange('enableFineRefinement', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认参数</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition cursor-pointer"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};
