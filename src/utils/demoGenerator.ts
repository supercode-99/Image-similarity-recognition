/**
 * Generates synthetic realistic short drama test videos for instant algorithm verification
 * Uses HTML5 Canvas animation + MediaRecorder API
 */

export interface DemoVideosResult {
  blobA: Blob;
  blobB: Blob;
  urlA: string;
  urlB: string;
}

export async function generateDemoDramaVideos(
  onProgress?: (text: string, percent: number) => void
): Promise<DemoVideosResult> {
  const width = 480;
  const height = 270;
  const fps = 25;

  onProgress?.('正在合成母带视频 A (原剧3个独立场景: 天台对决、商海风云、雨夜追击)...', 15);
  const blobA = await renderDramaVideoA(width, height, fps, (p) => {
    onProgress?.(`渲染母带视频 A: ${Math.round(p * 100)}%`, 15 + p * 35);
  });

  onProgress?.('正在合成二创视频 B (混剪拼接: A剧片段1 + 营销广告 + A剧片段2 + 口型变动与外语字幕)...', 55);
  const blobB = await renderDramaVideoB(width, height, fps, (p) => {
    onProgress?.(`渲染拼接视频 B: ${Math.round(p * 100)}%`, 55 + p * 40);
  });

  const urlA = URL.createObjectURL(blobA);
  const urlB = URL.createObjectURL(blobB);

  onProgress?.('视频合成完成，准备开始识别！', 100);

  return { blobA, blobB, urlA, urlB };
}

/**
 * Scene 1: Sunset Rooftop Dialogue (0s - 6s)
 */
function drawSunsetRooftopScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  mouthModulation = 0
) {
  // Sunset sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#31103f');
  grad.addColorStop(0.5, '#993d52');
  grad.addColorStop(0.85, '#e07a5f');
  grad.addColorStop(1, '#f4a261');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Distant glowing sun
  const sunX = w * 0.75;
  const sunY = h * 0.65;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 70);
  sunGrad.addColorStop(0, '#fff3b0');
  sunGrad.addColorStop(0.5, 'rgba(255, 183, 3, 0.4)');
  sunGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
  ctx.fill();

  // Skyline Silhouettes
  ctx.fillStyle = '#1e112a';
  for (let i = 0; i < 8; i++) {
    const bw = 40 + (i % 3) * 20;
    const bh = 70 + ((i * 37) % 80);
    const bx = i * 65 - 10;
    ctx.fillRect(bx, h - bh, bw, bh);
  }

  // Balcony rail
  ctx.fillStyle = '#0f0a17';
  ctx.fillRect(0, h * 0.78, w, 6);
  ctx.fillRect(0, h * 0.88, w, 4);

  // Character 1 Silhouette (Left)
  const sway = Math.sin(timeSec * 2) * 3;
  ctx.fillStyle = '#140c1e';
  // Body
  ctx.beginPath();
  ctx.ellipse(w * 0.32 + sway, h * 0.68, 32, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(w * 0.32 + sway, h * 0.42, 22, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (for lip change simulation)
  const mouthOpen = 2 + Math.abs(Math.sin((timeSec + mouthModulation) * 8)) * 5;
  ctx.fillStyle = '#993d52';
  ctx.beginPath();
  ctx.ellipse(w * 0.35 + sway, h * 0.45, 4, mouthOpen, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wine glass in hand
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.58);
  ctx.lineTo(w * 0.42, h * 0.65);
  ctx.stroke();

  // Scene Title Watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('原剧镜头 01: 豪门天台夜宴对峙', 16, 24);
}

/**
 * Scene 2: Corporate Boardroom Dialogue (6s - 12s)
 */
function drawBoardroomScene(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number) {
  // Cold corporate slate blue gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#101d2d');
  grad.addColorStop(0.6, '#1e293b');
  grad.addColorStop(1, '#334155');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Big modern window blinds with city lights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  for (let y = 10; y < h * 0.6; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Conference Screen displaying financial charts
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(w * 0.1, h * 0.15, w * 0.4, h * 0.35);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w * 0.1, h * 0.15, w * 0.4, h * 0.35);

  // Dynamic stock line
  ctx.beginPath();
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const px = w * 0.12 + (i * (w * 0.36)) / 9;
    const py = h * 0.42 - Math.sin(timeSec + i * 0.8) * 18 - i * 3;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Conference Table (Perspective)
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h);
  ctx.lineTo(w * 0.25, h * 0.65);
  ctx.lineTo(w * 0.75, h * 0.65);
  ctx.lineTo(w * 0.95, h);
  ctx.closePath();
  ctx.fill();

  // Businessman gesture
  const charX = w * 0.55;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(charX, h * 0.62, 36, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(charX, h * 0.45, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('原剧镜头 02: 集团董事会股权质询', 16, 24);
}

/**
 * Scene 3: Rainy Street Neon Chase (12s - 18s)
 */
function drawRainyChaseScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  mouthModulation = 0
) {
  // Dark rainy night cyan/purple gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#020617');
  grad.addColorStop(0.5, '#091e36');
  grad.addColorStop(1, '#0a2540');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Neon signs blur in the background
  ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
  ctx.beginPath();
  ctx.arc(w * 0.25, h * 0.35, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.3, 50, 0, Math.PI * 2);
  ctx.fill();

  // Wet road reflection
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, h * 0.7, w, h * 0.3);

  ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.fillRect(w * 0.7, h * 0.75, 40, h * 0.25);

  // Car Headlights Beam
  const beamGrad = ctx.createRadialGradient(w * 0.15, h * 0.65, 5, w * 0.5, h * 0.7, 120);
  beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.8)');
  beamGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.2)');
  beamGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.ellipse(w * 0.35, h * 0.68, 120, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rain streaks
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
  ctx.lineWidth = 1;
  const rainSeed = Math.floor(timeSec * 25);
  for (let r = 0; r < 35; r++) {
    const rx = ((r * 47 + rainSeed * 31) % w);
    const ry = ((r * 89 + rainSeed * 63) % h);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 8, ry + 22);
    ctx.stroke();
  }

  // Running character holding umbrella
  const runOffset = Math.sin(timeSec * 5) * 8;
  const runX = w * 0.62 + runOffset;
  ctx.fillStyle = '#0f172a';
  // Umbrella
  ctx.beginPath();
  ctx.arc(runX, h * 0.45, 30, Math.PI, 0);
  ctx.fill();
  // Body
  ctx.fillRect(runX - 10, h * 0.5, 20, 50);

  // Mouth motion
  const mouthOpen = 2 + Math.abs(Math.sin((timeSec + mouthModulation) * 6)) * 4;
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(runX + 2, h * 0.48, 5, mouthOpen);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('原剧镜头 03: 暴雨霓虹街道生死追击', 16, 24);
}

/**
 * Unrelated Insert Clip: Flash Sale Commercial (4.5s - 9.0s in Video B)
 */
function drawUnrelatedCommercialClip(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number) {
  // Vibrant bright green / yellow commercial background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#84cc16');
  grad.addColorStop(0.5, '#eab308');
  grad.addColorStop(1, '#f97316');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Spinning starburst discount badge
  const cx = w * 0.5;
  const cy = h * 0.48;
  const rot = timeSec * 3;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? 60 : 38;
    const angle = (i * Math.PI) / spikes;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Promo text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('全网限时特惠 9.9包邮', w * 0.5, h * 0.52);

  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('外部拼接素材（完全无关广告）', w * 0.5, h * 0.8);
  ctx.textAlign = 'left';
}

/**
 * Draw Subtitle Banner at bottom (simulating multi-language translations)
 */
function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  primaryText: string,
  secondaryText?: string
) {
  const subY = h * 0.86;

  // Subtitle backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(16, subY - 14, w - 32, 28);

  // Yellow & White text
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(primaryText, w * 0.5, subY);

  if (secondaryText) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.fillText(secondaryText, w * 0.5, subY + 11);
  }
  ctx.textAlign = 'left';
}

/**
 * Render Video A: 18 seconds total
 * 0.0 - 6.0: Rooftop Dialogue
 * 6.0 - 12.0: Boardroom Deal
 * 12.0 - 18.0: Rain Chase
 */
function renderDramaVideoA(
  width: number,
  height: number,
  fps: number,
  onProgress: (p: number) => void
): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    recorder.start(100);

    const totalSeconds = 18;
    const totalFrames = totalSeconds * fps;
    let currentFrame = 0;

    const interval = setInterval(() => {
      if (currentFrame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
        return;
      }

      const t = currentFrame / fps;

      // Draw scenes
      if (t < 6.0) {
        drawSunsetRooftopScene(ctx, width, height, t);
      } else if (t < 12.0) {
        drawBoardroomScene(ctx, width, height, t);
      } else {
        drawRainyChaseScene(ctx, width, height, t);
      }

      // Timecode watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px monospace';
      ctx.fillText(`A [母带] ${t.toFixed(2)}s / 18.00s`, width - 150, height - 12);

      currentFrame++;
      onProgress(currentFrame / totalFrames);
    }, 1000 / fps);
  });
}

/**
 * Render Video B: 15.5 seconds total
 * 0.0s - 4.5s: From Video A Scene 1 (0.8s - 5.3s) with foreign subtitle & shifted mouth!
 * 4.5s - 9.0s: Unrelated commercial ad (flash sale)!
 * 9.0s - 15.0s: From Video A Scene 3 (12.2s - 18.2s) with bilingual subtitles!
 * 15.0s - 15.5s: Ending brand card
 */
function renderDramaVideoB(
  width: number,
  height: number,
  fps: number,
  onProgress: (p: number) => void
): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    recorder.start(100);

    const totalSeconds = 15.5;
    const totalFrames = totalSeconds * fps;
    let currentFrame = 0;

    const interval = setInterval(() => {
      if (currentFrame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
        return;
      }

      const t = currentFrame / fps;

      if (t < 4.5) {
        // MATCH 1: Corresponds to Video A: 0.8s -> 5.3s
        const tSourceA = 0.8 + t;
        // Mouth modulation shift (simulating different language dubbing)
        drawSunsetRooftopScene(ctx, width, height, tSourceA, 1.45);
        // Added Subtitles (testing anti-subtitle exclusion)
        drawSubtitles(
          ctx,
          width,
          height,
          '“You think you hold all the cards now?”',
          '【配音译制字幕】“你以为你已经掌控了一切？”'
        );
      } else if (t < 9.0) {
        // Unrelated Commercial insert (Should NOT match anything in A!)
        const tAd = t - 4.5;
        drawUnrelatedCommercialClip(ctx, width, height, tAd);
      } else if (t < 15.0) {
        // MATCH 2: Corresponds to Video A: 12.2s -> 18.2s (Rain Chase)
        const tSourceA = 12.2 + (t - 9.0);
        drawRainyChaseScene(ctx, width, height, tSourceA, 2.1);
        // Added Subtitles
        drawSubtitles(
          ctx,
          width,
          height,
          '“Hold on! The backup is right behind!”',
          '【二创双语字幕】“坚持住！援军马上赶到！”'
        );
      } else {
        // Ending outro
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('感谢观看 · 剪辑创作者联盟', width * 0.5, height * 0.5);
        ctx.textAlign = 'left';
      }

      // Timecode watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px monospace';
      ctx.fillText(`B [混剪] ${t.toFixed(2)}s / 15.50s`, width - 150, height - 12);

      currentFrame++;
      onProgress(currentFrame / totalFrames);
    }, 1000 / fps);
  });
}
