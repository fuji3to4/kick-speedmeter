'use client'

import { useEffect } from 'react';
import initApp from '../lib/initApp';

export default function Page() {
  useEffect(() => {
    initApp();
  }, []);

  return (
    <>
  <header className="px-5 py-4 border-b">
        <h1 className="m-0 text-xl">Kick Speedmeter</h1>
    <p className="m-0 text-sm text-gray-600">MediaPipe Pose を用いたキック速度計測（カメラ/動画/比較）</p>
      </header>

      <section className="px-5 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-2 overflow-x-auto">
            <button aria-pressed="true" className="tab-button border border-blue-600 bg-blue-600 text-white px-3 py-2 rounded appearance-none" data-tab="live">ライブ計測</button>
            <button aria-pressed="false" className="tab-button border border-gray-300 bg-white text-gray-900 px-3 py-2 rounded appearance-none" data-tab="video">動画から計測</button>
            <button aria-pressed="false" className="tab-button border border-gray-300 bg-white text-gray-900 px-3 py-2 rounded appearance-none" data-tab="compare">動画比較</button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
          <label className="grid gap-1 text-gray-700">
            測定部位:
            <select id="footSelect" className="border rounded px-2 py-2">
              <option value="right_foot">右足</option>
              <option value="left_foot">左足</option>
              <option value="right_hand">右手</option>
              <option value="left_hand">左手</option>
            </select>
          </label>
          {/* 仕様簡素化: 3D m/s のみ対応。m/px と 2D 切替は撤去 */}
          <label className="grid gap-1 text-gray-700" title="速度の瞬間値を平滑化する係数 (0=平滑化なし, 1=即時追従)">
            平滑化係数 α (0:平滑化なし, 0.05:滑らか-1:敏感):
            <input id="emaAlpha" type="number" min={0} max={1} step={0.05} defaultValue={0.3} className="border rounded px-2 py-2" />
          </label>
          {/* スクショ閾値は負荷影響が小さいため撤去（最大更新時のみ保存） */}
          {/* モデル選択は廃止（シンプル化） */}
        </div>
      </section>

      <main>
        {/* Live Tab */}
        <section id="tab-live" className="tab-panel">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] items-start px-5 pb-5">
            <div className="relative border rounded overflow-hidden">
              <video id="liveVideo" autoPlay playsInline muted className="block w-full max-h-[60vh] bg-black" />
              <canvas id="liveCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
            </div>
            <div className="border rounded p-3 bg-white">
              <h3 className="m-0 mb-2 text-base">速度 (3D m/s)</h3>
              <div className="flex justify-between py-1 border-b border-dashed"><span>現在(m/s):</span><strong id="liveSpeedM">-</strong></div>
              <div className="flex justify-between py-1"><span>最大(m/s):</span><strong id="liveMaxM">-</strong></div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input id="captureOnMax" type="checkbox" />
                  <label htmlFor="captureOnMax" className="text-gray-700">最大速度時にスクショを保存</label>
                </div>
                <div className="flex gap-2">
                  <button id="resetMax" className="border bg-white text-gray-900 px-3 py-2 rounded appearance-none">最大速度リセット</button>
                  <a id="downloadMaxShot" className="border bg-white text-gray-900 px-3 py-2 rounded appearance-none hidden" download="max-speed-shot.png">スクショをダウンロード</a>
                </div>
                <div id="maxShotWrap" className="hidden">
                  <p className="text-sm text-gray-600 m-0">最大時のスクショ</p>
                  <img id="liveMaxShot" alt="最大速度時のスクリーンショット" className="border rounded max-w-full h-auto" />
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 pb-4 flex gap-2">
            <button id="startLive" className="border bg-white text-gray-900 px-4 py-2 rounded appearance-none">カメラ開始</button>
            <button id="stopLive" disabled className="border bg-white text-gray-900 px-4 py-2 rounded disabled:opacity-50 appearance-none">停止</button>
          </div>
        </section>

        {/* Video Tab */}
        <section id="tab-video" className="tab-panel hidden">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] items-start px-5 pb-5">
            <div>
              <input id="videoFile" type="file" accept="video/*" title="解析する動画を選択" className="mb-2" />
              <div className="relative border rounded overflow-hidden">
                <video id="fileVideo" controls className="block w-full max-h-[60vh] bg-black" />
                <canvas id="fileCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
              </div>
            </div>
            <div className="border rounded p-3 bg-white">
              <h3 className="m-0 mb-2 text-base">速度 (3D m/s)</h3>
              <div className="flex justify-between py-1 border-b border-dashed"><span>現在(m/s):</span><strong id="fileSpeedM">-</strong></div>
              <div className="flex justify-between py-1 border-b border-dashed"><span>最大(m/s):</span><strong id="fileMaxM">-</strong></div>
              <div className="flex justify-between py-1"><span>最大速度時刻:</span><strong id="fileMaxAt">-</strong></div>
            </div>
          </div>
          <div className="px-5 pb-5 border rounded mx-5 bg-white">
            <canvas id="fileChart"></canvas>
          </div>
        </section>

        {/* Compare Tab */}
        <section id="tab-compare" className="tab-panel hidden">
          <div className="grid gap-4 md:grid-cols-2 items-start px-5 pb-5">
            <div>
              <h3 className="mb-2">お手本動画</h3>
              <input id="refVideoFile" type="file" accept="video/*" title="お手本動画を選択" className="mb-2" />
              <div className="relative border rounded overflow-hidden">
                <video id="refVideo" controls className="block w-full max-h-[60vh] bg-black" />
                <canvas id="refCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
              </div>
            </div>
            <div>
              <h3 className="mb-2">自分の動画</h3>
              <input id="usrVideoFile" type="file" accept="video/*" title="自分の動画を選択" className="mb-2" />
              <div className="relative border rounded overflow-hidden">
                <video id="usrVideo" controls className="block w-full max-h-[60vh] bg-black" />
                <canvas id="usrCanvas" className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
              </div>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="border rounded p-3 bg-white">
              <h3 className="mb-2">速度(m/s)・角度の比較</h3>
              <canvas id="compareChart"></canvas>
            </div>
          </div>
          <div className="px-5 pb-8">
            <div className="border rounded p-3 bg-white">
              <div className="flex justify-between py-1 border-b border-dashed border-slate-700"><span>速度カーブ相関(m/s):</span><strong id="corrSpeed">-</strong></div>
              <div className="flex justify-between py-1"><span>膝角カーブ相関:</span><strong id="corrKnee">-</strong></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-3 text-gray-600 border-t">
        <small>Powered by MediaPipe Tasks Vision (Pose Landmarker). 現在は 3D ワールド座標の m/s のみ対応です。</small>
      </footer>
    </>
  );
}
