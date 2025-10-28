import Chart from 'chart.js/auto';
import { ensurePoseLoaded, processVideoFrame, setRunningMode, setModelVariant } from './pose';
import { drawPose, drawFootOverlay } from './draw';
import { computeSpeed, computeSpeed3D, ema, landmarkBySide, worldLandmarkBySide, kneeAngle, pearson } from './utils';

export default function initApp() {
  // UI elements
  const tabs = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.tab-panel');
  const footSelect = document.getElementById('footSelect');
  const metersPerPixelInput = document.getElementById('metersPerPixel');
  const resetMaxBtn = document.getElementById('resetMax');
  const useWorld3D = document.getElementById('useWorld3D');
  const modelSelect = document.getElementById('modelVariant');

  // Live
  const startLiveBtn = document.getElementById('startLive');
  const stopLiveBtn = document.getElementById('stopLive');
  const liveVideo = document.getElementById('liveVideo');
  const liveCanvas = document.getElementById('liveCanvas');
  const liveSpeedPxEl = document.getElementById('liveSpeedPx');
  const liveSpeedMEl = document.getElementById('liveSpeedM');
  const liveMaxPxEl = document.getElementById('liveMaxPx');
  const liveMaxMEl = document.getElementById('liveMaxM');

  // File video
  const fileInput = document.getElementById('videoFile');
  const fileVideo = document.getElementById('fileVideo');
  const fileCanvas = document.getElementById('fileCanvas');
  const fileSpeedPxEl = document.getElementById('fileSpeedPx');
  const fileSpeedMEl = document.getElementById('fileSpeedM');
  const fileMaxPxEl = document.getElementById('fileMaxPx');
  const fileMaxMEl = document.getElementById('fileMaxM');
  const fileMaxAtEl = document.getElementById('fileMaxAt');
  let fileChart;

  // Compare
  const refInput = document.getElementById('refVideoFile');
  const usrInput = document.getElementById('usrVideoFile');
  const refVideo = document.getElementById('refVideo');
  const usrVideo = document.getElementById('usrVideo');
  const refCanvas = document.getElementById('refCanvas');
  const usrCanvas = document.getElementById('usrCanvas');
  const corrSpeedEl = document.getElementById('corrSpeed');
  const corrKneeEl = document.getElementById('corrKnee');
  let compareChart;

  // State
  let liveReqId = null;
  let livePrev = null;
  let livePrev3D = null;
  let liveEmaPx = null, liveEmaM = null;
  let liveEmaM3D = null;
  let liveMaxPx = 0, liveMaxM = 0;
  let liveMaxM3D = 0;
  let stream = null;

  function activateTab(name) {
    tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
    panels.forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  }
  tabs.forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  resetMaxBtn.addEventListener('click', () => {
    liveMaxPx = 0; liveMaxM = 0; liveMaxM3D = 0;
    liveMaxPxEl.textContent = '-';
    liveMaxMEl.textContent = '-';
    fileMaxPxEl.textContent = '-';
    fileMaxMEl.textContent = '-';
    fileMaxAtEl.textContent = '-';
  });

  // Switch model variant (lite/full/heavy)
  modelSelect?.addEventListener('change', async (e) => {
    const v = e.target.value;
    await setModelVariant(v);
  });

  function resizeCanvasToVideo(canvas, video) {
    const rect = video.getBoundingClientRect();
    canvas.width = video.videoWidth || rect.width;
    canvas.height = video.videoHeight || rect.height;
    canvas.style.width = video.clientWidth + 'px';
    canvas.style.height = video.clientHeight + 'px';
  }

  // Live camera processing
  async function startLive() {
    await ensurePoseLoaded();
    setRunningMode('VIDEO');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    liveVideo.srcObject = stream;
    await liveVideo.play();
    resizeCanvasToVideo(liveCanvas, liveVideo);
    livePrev = null; livePrev3D = null;
    liveEmaPx = null; liveEmaM = null; liveEmaM3D = null;
    liveMaxPx = 0; liveMaxM = 0; liveMaxM3D = 0;
    startLiveBtn.disabled = true; stopLiveBtn.disabled = false;
    liveLoop();
  }

  function stopLive() {
    if (liveReqId) cancelAnimationFrame(liveReqId);
    liveReqId = null;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    startLiveBtn.disabled = false; stopLiveBtn.disabled = true;
  }

  function liveLoop() {
    const now = performance.now();
    try {
      const result = processVideoFrame(liveVideo, now);
      const ctx = liveCanvas.getContext('2d');
      resizeCanvasToVideo(liveCanvas, liveVideo);
      if (result && result.landmarks && result.landmarks.length) {
        drawPose(ctx, result.landmarks);
        const side = footSelect.value;
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
        const ctx = liveCanvas.getContext('2d');
        ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      }
    } catch (e) { /* ignore */ }
    liveReqId = requestAnimationFrame(liveLoop);
  }

  startLiveBtn.addEventListener('click', startLive);
  stopLiveBtn.addEventListener('click', stopLive);

  // File video processing
  let fileSeries = [];
  let fileMax = { px: 0, mCal: 0, mWorld: 0, at: 0 };

  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
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
    const ts = fileVideo.currentTime * 1000;
    const result = processVideoFrame(fileVideo, ts);
    const ctx = fileCanvas.getContext('2d');
    resizeCanvasToVideo(fileCanvas, fileVideo);
    if (result && result.landmarks && result.landmarks.length) {
      drawPose(ctx, result.landmarks);
      const side = footSelect.value;
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
      const ctx = document.getElementById('fileChart').getContext('2d');
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
          stacked: false,
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'px/s' } },
            y1: { type: 'linear', position: 'right', title: { display: true, text: 'm/s' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    } else {
      fileChart.data.labels = labels;
      fileChart.data.datasets[0].data = px;
      fileChart.data.datasets[1].data = mCal;
      fileChart.data.datasets[2].data = mWorld;
      fileChart.update('none');
    }
    if (fileChart) {
      const use3D = useWorld3D.checked;
      fileChart.data.datasets[1].hidden = use3D;
      fileChart.data.datasets[2].hidden = !use3D;
      fileChart.update('none');
    }
  }

  // Compare helpers
  async function extractSeriesFromVideo(videoEl, side, canvasEl) {
    await ensurePoseLoaded();
    setRunningMode('VIDEO');
    return new Promise((resolve) => {
      const series = { t: [], speed: [], knee: [] };
      const onPlay = () => { step(); };
      const onEnded = () => { cleanup(); resolve(series); };
      const cleanup = () => {
        videoEl.removeEventListener('play', onPlay);
        videoEl.removeEventListener('ended', onEnded);
      };
      videoEl.addEventListener('play', onPlay);
      videoEl.addEventListener('ended', onEnded);
      if (!videoEl.paused) onPlay();
      let prevPt = null;
      const step = () => {
        if (videoEl.paused || videoEl.ended) return;
        const ts = videoEl.currentTime * 1000;
        const res = processVideoFrame(videoEl, ts);
        const ctx = canvasEl.getContext('2d');
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
            series.speed.push(spx);
            series.knee.push(kneeDeg);
            prevPt = curr;
          }
        }
        requestAnimationFrame(step);
      };
    });
  }

  function resample(series, n = 200) {
    if (!series.t.length) return { t: [], x: [] };
    const t0 = series.t[0];
    const t1 = series.t[series.t.length - 1];
    const step = (t1 - t0) / (n - 1);
    const tOut = Array.from({ length: n }, (_, i) => t0 + i * step);
    const interp = (t, arr) => {
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

  function updateCompareChart(refS, usrS) {
    const refR = resample(refS);
    const usrR = resample(usrS);
    const corrS = pearson(refR.speed, usrR.speed);
    const corrK = pearson(refR.knee, usrR.knee);
    corrSpeedEl.textContent = corrS.toFixed(2);
    corrKneeEl.textContent = corrK.toFixed(2);
    const labels = refR.t.map(t => (t - refR.t[0]).toFixed(2));
    if (!compareChart) {
      const ctx = document.getElementById('compareChart').getContext('2d');
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
          stacked: false,
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'px/s' } },
            y1: { type: 'linear', position: 'right', title: { display: true, text: '角度(°)' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    } else {
      compareChart.data.labels = labels;
      compareChart.data.datasets[0].data = refR.speed;
      compareChart.data.datasets[1].data = usrR.speed;
      compareChart.data.datasets[2].data = refR.knee;
      compareChart.data.datasets[3].data = usrR.knee;
      compareChart.update('none');
    }
  }

  let refSeries = null, usrSeries = null;
  refInput?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return; refVideo.src = URL.createObjectURL(f);
  });
  usrInput?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return; usrVideo.src = URL.createObjectURL(f);
  });
  async function runCompare() {
    const side = footSelect.value;
    if (refVideo.src) { refVideo.currentTime = 0; await refVideo.play(); refSeries = await extractSeriesFromVideo(refVideo, side, refCanvas); }
    if (usrVideo.src) { usrVideo.currentTime = 0; await usrVideo.play(); usrSeries = await extractSeriesFromVideo(usrVideo, side, usrCanvas); }
    if (refSeries && usrSeries) updateCompareChart(refSeries, usrSeries);
  }
  [refVideo, usrVideo].forEach(v => v?.addEventListener('ended', () => {
    if ((v === refVideo && usrVideo.ended) || (v === usrVideo && refVideo.ended)) runCompare();
  }));
}
