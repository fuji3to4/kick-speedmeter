'use client'

import { useEffect } from 'react';
import initApp from '../lib/initApp';

export default function Page() {
  useEffect(() => {
    initApp();
  }, []);

  return (
    <>
      <header>
        <h1>Kick Speedmeter</h1>
        <p>MediaPipe Pose を用いたキック速度計測（カメラ/動画/比較）</p>
      </header>

      <section className="controls">
        <div className="tabs">
          <button className="tab-button active" data-tab="live">ライブ計測</button>
          <button className="tab-button" data-tab="video">動画から計測</button>
          <button className="tab-button" data-tab="compare">動画比較</button>
        </div>

        <div className="settings">
          <label>
            フット（足）:
            <select id="footSelect">
              <option value="right">右</option>
              <option value="left">左</option>
            </select>
          </label>
          <label title="m/px 推定。正確にしたい場合は校正してください。">
            メートル/ピクセル(m/px):
            <input id="metersPerPixel" type="number" step="0.0001" defaultValue={0} />
          </label>
          <label title="3DのworldLandmarks（m単位, 相対スケール）でm/sを計算します。">
            <input id="useWorld3D" type="checkbox" /> 3Dワールド(m/s)を使用
          </label>
          <label title="PoseLandmarkerのモデルを選択 (lite=高速, full=高精度, heavy=最高精度/重い)">
            モデル:
            <select id="modelVariant" defaultValue="lite">
              <option value="lite">lite</option>
              <option value="full">full</option>
              <option value="heavy">heavy</option>
            </select>
          </label>
          <button id="resetMax">最大速度リセット</button>
        </div>
      </section>

      <main>
        {/* Live Tab */}
        <section id="tab-live" className="tab-panel active">
          <div className="panel-grid">
            <div className="video-wrap">
              <video id="liveVideo" autoPlay playsInline muted />
              <canvas id="liveCanvas"></canvas>
            </div>
            <div className="metrics">
              <h3>速度</h3>
              <div className="metric"><span>現在(px/s):</span><strong id="liveSpeedPx">-</strong></div>
              <div className="metric"><span>現在(m/s):</span><strong id="liveSpeedM">-</strong></div>
              <div className="metric"><span>最大(px/s):</span><strong id="liveMaxPx">-</strong></div>
              <div className="metric"><span>最大(m/s):</span><strong id="liveMaxM">-</strong></div>
            </div>
          </div>
          <div className="actions">
            <button id="startLive">カメラ開始</button>
            <button id="stopLive" disabled>停止</button>
          </div>
        </section>

        {/* Video Tab */}
        <section id="tab-video" className="tab-panel">
          <div className="panel-grid">
            <div className="video-wrap">
              <input id="videoFile" type="file" accept="video/*" title="解析する動画を選択" />
              <video id="fileVideo" controls />
              <canvas id="fileCanvas"></canvas>
            </div>
            <div className="metrics">
              <h3>速度</h3>
              <div className="metric"><span>現在(px/s):</span><strong id="fileSpeedPx">-</strong></div>
              <div className="metric"><span>現在(m/s):</span><strong id="fileSpeedM">-</strong></div>
              <div className="metric"><span>最大(px/s):</span><strong id="fileMaxPx">-</strong></div>
              <div className="metric"><span>最大(m/s):</span><strong id="fileMaxM">-</strong></div>
              <div className="metric"><span>最大速度時刻:</span><strong id="fileMaxAt">-</strong></div>
            </div>
          </div>
          <div className="chart-wrap">
            <canvas id="fileChart"></canvas>
          </div>
        </section>

        {/* Compare Tab */}
        <section id="tab-compare" className="tab-panel">
          <div className="panel-grid two-col">
            <div>
              <h3>お手本動画</h3>
              <input id="refVideoFile" type="file" accept="video/*" title="お手本動画を選択" />
              <video id="refVideo" controls />
              <canvas id="refCanvas"></canvas>
            </div>
            <div>
              <h3>自分の動画</h3>
              <input id="usrVideoFile" type="file" accept="video/*" title="自分の動画を選択" />
              <video id="usrVideo" controls />
              <canvas id="usrCanvas"></canvas>
            </div>
          </div>
          <div className="chart-wrap">
            <h3>速度・角度の比較</h3>
            <canvas id="compareChart"></canvas>
          </div>
          <div className="metrics">
            <div className="metric"><span>速度カーブ相関:</span><strong id="corrSpeed">-</strong></div>
            <div className="metric"><span>膝角カーブ相関:</span><strong id="corrKnee">-</strong></div>
          </div>
        </section>
      </main>

      <footer>
        <small>
          Powered by MediaPipe Tasks Vision (Pose Landmarker). 校正して m/s を有効化してください。
        </small>
      </footer>
    </>
  );
}
