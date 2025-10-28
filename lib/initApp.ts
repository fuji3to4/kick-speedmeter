import Chart from 'chart.js/auto';
import { ensurePoseLoaded, processVideoFrame, setRunningMode } from './pose';
import { drawPose, drawFootOverlay } from './draw';
import { computeSpeed, computeSpeed3D, ema, landmarkBySide, worldLandmarkBySide, kneeAngle, pearson } from './utils';

export default function initApp() {
  // UI elements
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-button');
  const panels = document.querySelectorAll<HTMLElement>('.tab-panel');
  const footSelect = document.getElementById('footSelect') as HTMLSelectElement;
  const metersPerPixelInput = document.getElementById('metersPerPixel') as HTMLInputElement;
  const resetMaxBtn = document.getElementById('resetMax') as HTMLButtonElement;
  const useWorld3D = document.getElementById('useWorld3D') as HTMLInputElement;

  // Live
  const startLiveBtn = document.getElementById('startLive') as HTMLButtonElement;
  const stopLiveBtn = document.getElementById('stopLive') as HTMLButtonElement;
  const liveVideo = document.getElementById('liveVideo') as HTMLVideoElement;
  const liveCanvas = document.getElementById('liveCanvas') as HTMLCanvasElement;
  const liveSpeedPxEl = document.getElementById('liveSpeedPx') as HTMLElement;
  const liveSpeedMEl = document.getElementById('liveSpeedM') as HTMLElement;
  const liveMaxPxEl = document.getElementById('liveMaxPx') as HTMLElement;
  const liveMaxMEl = document.getElementById('liveMaxM') as HTMLElement;

  // File video
  const fileInput = document.getElementById('videoFile') as HTMLInputElement;
  const fileVideo = document.getElementById('fileVideo') as HTMLVideoElement;
  const fileCanvas = document.getElementById('fileCanvas') as HTMLCanvasElement;
  const fileSpeedPxEl = document.getElementById('fileSpeedPx') as HTMLElement;
  const fileSpeedMEl = document.getElementById('fileSpeedM') as HTMLElement;
  const fileMaxPxEl = document.getElementById('fileMaxPx') as HTMLElement;
  const fileMaxMEl = document.getElementById('fileMaxM') as HTMLElement;
  const fileMaxAtEl = document.getElementById('fileMaxAt') as HTMLElement;
  let fileChart: Chart | undefined;

  // Compare
  const refInput = document.getElementById('refVideoFile') as HTMLInputElement | null;
  const usrInput = document.getElementById('usrVideoFile') as HTMLInputElement | null;
  const refVideo = document.getElementById('refVideo') as HTMLVideoElement;
  const usrVideo = document.getElementById('usrVideo') as HTMLVideoElement;
  const refCanvas = document.getElementById('refCanvas') as HTMLCanvasElement;
  const usrCanvas = document.getElementById('usrCanvas') as HTMLCanvasElement;
  const corrSpeedEl = document.getElementById('corrSpeed') as HTMLElement;
  const corrKneeEl = document.getElementById('corrKnee') as HTMLElement;
  let compareChart: Chart | undefined;

  // State
  let liveReqId: number | null = null;
  let livePrev: { x: number; y: number; t: number } | null = null;
  let livePrev3D: { x: number; y: number; z?: number; t: number } | null = null;
  let liveEmaPx: number | null = null, liveEmaM: number | null = null;
  let liveEmaM3D: number | null = null;
  let liveMaxPx = 0, liveMaxM = 0;
  let liveMaxM3D = 0;
  let stream: MediaStream | null = null;
  let isLiveActive = false;

  function getCameraConstraints(facing: 'environment' | 'user') {
    return {
      video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false
    } as MediaStreamConstraints;
  }

  function attachStreamHandlers(s: MediaStream | null) {
    if (!s) return;
    const tracks = s.getVideoTracks();
    tracks.forEach(track => {
      track.onended = () => { if (isLiveActive) startLive().catch(() => {}); };
      track.onmute = () => { try { liveVideo.play().catch(()=>{}); } catch {} };
      track.onunmute = () => { try { liveVideo.play().catch(()=>{}); } catch {} };
    });
  }

  function activateTab(name: string) {
    tabs.forEach(btn => {
      const isActive = btn.dataset.tab === name;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.classList.toggle('bg-blue-600', isActive);
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('border-blue-600', isActive);
      btn.classList.toggle('bg-white', !isActive);
      btn.classList.toggle('text-gray-900', !isActive);
      btn.classList.toggle('border-gray-300', !isActive);
    });
    panels.forEach(p => {
      const isActive = p.id === `tab-${name}`;
      p.classList.toggle('hidden', !isActive);
    });
  }
  tabs.forEach(btn => btn.addEventListener('click', () => {
    const next = (btn as HTMLButtonElement).dataset.tab as string;
    const livePanel = document.getElementById('tab-live');
    const isLiveVisible = livePanel && !livePanel.classList.contains('hidden');
    if (isLiveVisible && next !== 'live' && stream) {
      stopLive();
    }
    activateTab(next);
  }));

  resetMaxBtn.addEventListener('click', () => {
    liveMaxPx = 0; liveMaxM = 0; liveMaxM3D = 0;
    liveMaxPxEl.textContent = '-';
    liveMaxMEl.textContent = '-';
    fileMaxPxEl.textContent = '-';
    fileMaxMEl.textContent = '-';
    fileMaxAtEl.textContent = '-';
  });

  // モデル選択や先読みのメカニクスは廃止（シンプル化）

  function resizeCanvasToVideo(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    const rect = video.getBoundingClientRect();
    // 内部ピクセルサイズは実動画サイズが取得できた時のみ更新する
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    // 見た目サイズは常に更新
    canvas.style.width = video.clientWidth + 'px';
    canvas.style.height = video.clientHeight + 'px';
  }

  // Live camera processing
  async function startLive() {
    await ensurePoseLoaded();
    setRunningMode('VIDEO');
    try {
      stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints('environment'));
    } catch (e) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints('user'));
      } catch (e2) {
        throw e;
      }
    }
    liveVideo.srcObject = stream;
    await new Promise<void>((res) => {
      const onLoaded = () => { liveVideo.removeEventListener('loadedmetadata', onLoaded); res(); };
      liveVideo.addEventListener('loadedmetadata', onLoaded);
    });
    await liveVideo.play();
    resizeCanvasToVideo(liveCanvas, liveVideo);
    livePrev = null; livePrev3D = null;
    liveEmaPx = null; liveEmaM = null; liveEmaM3D = null;
    liveMaxPx = 0; liveMaxM = 0; liveMaxM3D = 0;
    startLiveBtn.disabled = true; stopLiveBtn.disabled = false;
    isLiveActive = true;
    attachStreamHandlers(stream);
    liveLoop();
  }

  function stopLive() {
    if (liveReqId) cancelAnimationFrame(liveReqId);
    liveReqId = null;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    startLiveBtn.disabled = false; stopLiveBtn.disabled = true;
    isLiveActive = false;
  }

  function liveLoop() {
    const now = performance.now();
    try {
      // 初期フレームで video の寸法が 0 のことがあるため、準備完了までスキップ
      if (liveVideo.videoWidth === 0 || liveVideo.videoHeight === 0 || liveVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        liveReqId = requestAnimationFrame(liveLoop);
        return;
      }
      const result = processVideoFrame(liveVideo, now) as any;
      const ctx = liveCanvas.getContext('2d')!;
      resizeCanvasToVideo(liveCanvas, liveVideo);
      if (result && result.landmarks && result.landmarks.length) {
        drawPose(ctx, result.landmarks);
        const side = (footSelect.value as 'left' | 'right');
        const foot2D = landmarkBySide(result.landmarks, side, 'foot_index') || landmarkBySide(result.landmarks, side, 'ankle');
        const foot3D = result.worldLandmarks ? (worldLandmarkBySide(result.worldLandmarks, side, 'foot_index') || worldLandmarkBySide(result.worldLandmarks, side, 'ankle')) : null;
        if (foot2D) {
          const curr = { x: foot2D.x * liveCanvas.width, y: foot2D.y * liveCanvas.height, t: now };
          if (livePrev) {
            const dt = (curr.t - livePrev.t) / 1000;
            const mpp = parseFloat(metersPerPixelInput.value) || 0;
            const { pxPerSec, mPerSec } = computeSpeed(livePrev, curr, dt, mpp);
            liveEmaPx = ema(liveEmaPx, pxPerSec);
            liveEmaM = ema(liveEmaM, mPerSec);
            if (!useWorld3D.checked) {
              liveSpeedMEl.textContent = mpp > 0 ? (liveEmaM ?? 0).toFixed(2) : '-';
              if (mPerSec > liveMaxM && mpp > 0) { liveMaxM = mPerSec; liveMaxMEl.textContent = liveMaxM.toFixed(2); }
            }
            liveSpeedPxEl.textContent = (liveEmaPx ?? 0).toFixed(1);
            if (pxPerSec > liveMaxPx) { liveMaxPx = pxPerSec; liveMaxPxEl.textContent = liveMaxPx.toFixed(1); }
            const vel = { x: (curr.x - livePrev.x) / dt, y: (curr.y - livePrev.y) / dt };
            const label = useWorld3D.checked
              ? (liveEmaM3D != null ? `${(liveEmaM3D).toFixed(2)} m/s` : '')
              : (mpp > 0 && liveEmaM != null ? `${(liveEmaM).toFixed(2)} m/s` : `${(liveEmaPx ?? 0).toFixed(0)} px/s`);
            drawFootOverlay(ctx, curr, vel, label);
          }
          livePrev = curr;
        }
        if (foot3D) {
          const curr3D = { x: foot3D.x, y: foot3D.y, z: foot3D.z, t: now };
          if (livePrev3D) {
            const dt = (curr3D.t - livePrev3D.t) / 1000;
            const mps = computeSpeed3D(livePrev3D, curr3D, dt);
            liveEmaM3D = ema(liveEmaM3D, mps);
            if (useWorld3D.checked) {
              liveSpeedMEl.textContent = (liveEmaM3D ?? 0).toFixed(2);
              if (mps > liveMaxM3D) { liveMaxM3D = mps; liveMaxMEl.textContent = liveMaxM3D.toFixed(2); }
            }
          }
          livePrev3D = curr3D;
        }
      } else {
        const ctx = liveCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      }
    } catch (e) { /* ignore */ }
    liveReqId = requestAnimationFrame(liveLoop);
  }

  startLiveBtn.addEventListener('click', () => { startLive().catch(()=>{}); });
  stopLiveBtn.addEventListener('click', () => stopLive());

  // File video processing
  let fileSeries: Array<{ t: number; px: number; mCal: number; mWorld: number; pt: any; pt3D: any }> = [];
  let fileMax = { px: 0, mCal: 0, mWorld: 0, at: 0 };

  fileInput.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    fileVideo.src = URL.createObjectURL(f);
    await fileVideo.load();
  });

  fileVideo.addEventListener('play', async () => {
    await ensurePoseLoaded();
    setRunningMode('VIDEO');
    fileSeries = [];
    fileMax = { px: 0, mCal: 0, mWorld: 0, at: 0 };
    processFileVideo();
  });

  function processFileVideo() {
    if (fileVideo.paused || fileVideo.ended) return;
    // 動画の寸法が 0 のうちは推論しない
    if (fileVideo.videoWidth === 0 || fileVideo.videoHeight === 0 || fileVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      requestAnimationFrame(processFileVideo);
      return;
    }
    const ts = fileVideo.currentTime * 1000;
    const result = processVideoFrame(fileVideo, ts) as any;
    const ctx = fileCanvas.getContext('2d')!;
    resizeCanvasToVideo(fileCanvas, fileVideo);
    if (result && result.landmarks && result.landmarks.length) {
      drawPose(ctx, result.landmarks);
      const side = (footSelect.value as 'left' | 'right');
      const foot2D = landmarkBySide(result.landmarks, side, 'foot_index') || landmarkBySide(result.landmarks, side, 'ankle');
      const foot3D = result.worldLandmarks ? (worldLandmarkBySide(result.worldLandmarks, side, 'foot_index') || worldLandmarkBySide(result.worldLandmarks, side, 'ankle')) : null;
      if (foot2D || foot3D) {
        const curr = foot2D ? { x: foot2D.x * fileCanvas.width, y: foot2D.y * fileCanvas.height, t: ts } : null;
        const curr3D = foot3D ? { x: foot3D.x, y: foot3D.y, z: foot3D.z, t: ts } : null;
        const n = fileSeries.length;
        let px = 0, mCal = 0, mWorld = 0;
        if (n > 0) {
          const prev = fileSeries[n - 1].pt;
          const prev3D = fileSeries[n - 1].pt3D;
          const dt = curr && prev ? (curr.t - prev.t) / 1000 : (curr3D && prev3D ? (curr3D.t - prev3D.t) / 1000 : 0);
          const mpp = parseFloat(metersPerPixelInput.value) || 0;
          if (curr && prev) {
            const sp = computeSpeed(prev, curr, dt, mpp);
            px = sp.pxPerSec; mCal = sp.mPerSec;
            if (px > fileMax.px) { fileMax.px = px; fileMax.at = fileVideo.currentTime; }
            if (mCal > fileMax.mCal) { fileMax.mCal = mCal; }
            const vel = dt > 0 ? { x: (curr.x - prev.x) / dt, y: (curr.y - prev.y) / dt } : { x: 0, y: 0 };
            const label = useWorld3D.checked
              ? (mWorld ? `${mWorld.toFixed(2)} m/s` : '')
              : (mpp > 0 && mCal ? `${mCal.toFixed(2)} m/s` : `${px.toFixed(0)} px/s`);
            drawFootOverlay(ctx, curr, vel, label);
          }
          if (curr3D && prev3D && dt > 0) {
            mWorld = computeSpeed3D(prev3D, curr3D, dt);
            if (mWorld > fileMax.mWorld) { fileMax.mWorld = mWorld; }
          }
        }
        fileSeries.push({ t: ts / 1000, px, mCal, mWorld, pt: curr, pt3D: curr3D });
        fileSpeedPxEl.textContent = px.toFixed(1);
        const use3D = useWorld3D.checked;
        fileSpeedMEl.textContent = use3D ? (mWorld ? mWorld.toFixed(2) : '-') : ((parseFloat(metersPerPixelInput.value) > 0 && mCal) ? mCal.toFixed(2) : '-');
        fileMaxPxEl.textContent = fileMax.px ? fileMax.px.toFixed(1) : '-';
        fileMaxMEl.textContent = use3D ? (fileMax.mWorld ? fileMax.mWorld.toFixed(2) : '-') : ((parseFloat(metersPerPixelInput.value) > 0 && fileMax.mCal) ? fileMax.mCal.toFixed(2) : '-');
        fileMaxAtEl.textContent = fileMax.at ? fileMax.at.toFixed(2) + 's' : '-';
        updateFileChart();
      }
    } else {
      ctx.clearRect(0, 0, fileCanvas.width, fileCanvas.height);
    }
    requestAnimationFrame(processFileVideo);
  }

  function updateFileChart() {
    const labels = fileSeries.map(d => d.t);
    const px = fileSeries.map(d => d.px);
    const mCal = fileSeries.map(d => d.mCal);
    const mWorld = fileSeries.map(d => d.mWorld);
    if (!fileChart) {
      const ctx = (document.getElementById('fileChart') as HTMLCanvasElement).getContext('2d')!;
      fileChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: '速度(px/s)', data: px, borderColor: '#4da3ff', tension: 0.2 },
            { label: '速度(m/s, cal)', data: mCal, borderColor: '#38c172', tension: 0.2, yAxisID: 'y1' },
            { label: '速度(m/s, 3D)', data: mWorld, borderColor: '#ff7ab6', tension: 0.2, yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'px/s' } },
            y1: { type: 'linear', position: 'right', title: { display: true, text: 'm/s' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    } else {
      fileChart.data.labels = labels as any;
      fileChart.data.datasets[0].data = px as any;
      (fileChart.data.datasets[1] as any).data = mCal as any;
      (fileChart.data.datasets[2] as any).data = mWorld as any;
      fileChart.update('none');
    }
    if (fileChart) {
      const use3D = useWorld3D.checked;
      (fileChart.data.datasets[1] as any).hidden = use3D;
      (fileChart.data.datasets[2] as any).hidden = !use3D;
      fileChart.update('none');
    }
  }

  // Compare helpers
  async function extractSeriesFromVideo(videoEl: HTMLVideoElement, side: 'left' | 'right', canvasEl: HTMLCanvasElement) {
    await ensurePoseLoaded();
    setRunningMode('VIDEO');
    return new Promise<{ t: number[]; speed: number[]; knee: number[] }>((resolve) => {
      const series = { t: [], speed: [], knee: [] as number[] } as { t: number[]; speed: number[]; knee: number[] };
      const onPlay = () => { step(); };
      const onEnded = () => { cleanup(); resolve(series); };
      const cleanup = () => {
        videoEl.removeEventListener('play', onPlay);
        videoEl.removeEventListener('ended', onEnded);
      };
      videoEl.addEventListener('play', onPlay);
      videoEl.addEventListener('ended', onEnded);
      if (!videoEl.paused) onPlay();
      let prevPt: { x: number; y: number; t: number } | null = null;
      const step = () => {
        if (videoEl.paused || videoEl.ended) return;
        // 寸法が 0 のうちはスキップ
        if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0 || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          requestAnimationFrame(step);
          return;
        }
        const ts = videoEl.currentTime * 1000;
        const res = processVideoFrame(videoEl, ts) as any;
        const ctx = canvasEl.getContext('2d')!;
        resizeCanvasToVideo(canvasEl, videoEl);
        if (res && res.landmarks && res.landmarks.length) {
          drawPose(ctx, res.landmarks);
          const foot = landmarkBySide(res.landmarks, side, 'foot_index') || landmarkBySide(res.landmarks, side, 'ankle');
          const kneeDeg = kneeAngle(res.landmarks, side);
          if (foot) {
            const curr = { x: foot.x * canvasEl.width, y: foot.y * canvasEl.height, t: ts };
            let spx = 0;
            if (prevPt) {
              const dt = (curr.t - prevPt.t) / 1000;
              spx = computeSpeed(prevPt, curr, dt, 0).pxPerSec;
            }
            series.t.push(ts / 1000);
            (series.speed as number[]).push(spx);
            (series.knee as number[]).push(kneeDeg);
            prevPt = curr;
          }
        }
        requestAnimationFrame(step);
      };
    });
  }

  function resample(series: { t: number[]; speed: number[]; knee: number[] }, n = 200) {
    if (!series.t.length) return { t: [] as number[], speed: [] as number[], knee: [] as number[] };
    const t0 = series.t[0];
    const t1 = series.t[series.t.length - 1];
    const step = (t1 - t0) / (n - 1);
    const tOut = Array.from({ length: n }, (_, i) => t0 + i * step);
    const interp = (t: number, arr: number[]) => {
      let i = series.t.findIndex(tt => tt >= t);
      if (i <= 0) return arr[0] ?? 0;
      if (i === -1) return arr[arr.length - 1] ?? 0;
      const t1i = series.t[i - 1], t2i = series.t[i];
      const a = arr[i - 1], b = arr[i];
      const r = (t - t1i) / (t2i - t1i);
      return a + (b - a) * r;
    };
    return { t: tOut, speed: tOut.map(t => interp(t, series.speed)), knee: tOut.map(t => interp(t, series.knee)) };
  }

  function updateCompareChart(refS: { t: number[]; speed: number[]; knee: number[] }, usrS: { t: number[]; speed: number[]; knee: number[] }) {
    const refR = resample(refS);
    const usrR = resample(usrS);
    const corrS = pearson(refR.speed, usrR.speed);
    const corrK = pearson(refR.knee, usrR.knee);
    corrSpeedEl.textContent = corrS.toFixed(2);
    corrKneeEl.textContent = corrK.toFixed(2);
    const labels = refR.t.map(t => (t - refR.t[0]).toFixed(2));
    if (!compareChart) {
      const ctx = (document.getElementById('compareChart') as HTMLCanvasElement).getContext('2d')!;
      compareChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'お手本 速度(px/s)', data: refR.speed, borderColor: '#4da3ff', tension: 0.2 },
            { label: '自分 速度(px/s)', data: usrR.speed, borderColor: '#ff7ab6', tension: 0.2 },
            { label: 'お手本 膝角(°)', data: refR.knee, borderColor: '#38c172', tension: 0.2, yAxisID: 'y1' },
            { label: '自分 膝角(°)', data: usrR.knee, borderColor: '#ffd166', tension: 0.2, yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'px/s' } },
            y1: { type: 'linear', position: 'right', title: { display: true, text: '角度(°)' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    } else {
      compareChart.data.labels = labels as any;
      compareChart.data.datasets[0].data = refR.speed as any;
      (compareChart.data.datasets[1] as any).data = usrR.speed as any;
      (compareChart.data.datasets[2] as any).data = refR.knee as any;
      (compareChart.data.datasets[3] as any).data = usrR.knee as any;
      compareChart.update('none');
    }
  }

  let refSeries: { t: number[]; speed: number[]; knee: number[] } | null = null;
  let usrSeries: { t: number[]; speed: number[]; knee: number[] } | null = null;
  refInput?.addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return; refVideo.src = URL.createObjectURL(f);
  });
  usrInput?.addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return; usrVideo.src = URL.createObjectURL(f);
  });
  async function runCompare() {
    const side = (footSelect.value as 'left' | 'right');
    if (refVideo.src) { refVideo.currentTime = 0; await refVideo.play(); refSeries = await extractSeriesFromVideo(refVideo, side, refCanvas); }
    if (usrVideo.src) { usrVideo.currentTime = 0; await usrVideo.play(); usrSeries = await extractSeriesFromVideo(usrVideo, side, usrCanvas); }
    if (refSeries && usrSeries) updateCompareChart(refSeries, usrSeries);
  }
  [refVideo, usrVideo].forEach(v => v?.addEventListener('ended', () => {
    if ((v === refVideo && usrVideo.ended) || (v === usrVideo && refVideo.ended)) runCompare();
  }));
}
