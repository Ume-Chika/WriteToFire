# WriteToFire 技術リファレンス (Technical Reference)

本書は、`scripts/` の共通モジュール群、設定ファイル（`configs/`）、MVP統合に必要なDOM/CSS構造とパラメータ仕様の正本メモです（200行以下厳守）。

---

## 1. モジュール一覧と公開API (scripts/)

全スクリプトは独立した即時関数（IIFE）で各グローバルオブジェクトを公開します（各200行以下）。

### 1.1 `scripts/audio.js` (`window.FireAudio`)
- `init()`: `AudioContext` 初期化（初回操作時に自動呼出）。
- `loadConfig(url = '../configs/audio-config.json')`: 音響設定を非同期ロード。
- `toggle(start?: boolean)`: 音声の再生/停止トグル（真偽値を返却）。
- `triggerCrackle()` / `triggerBurst()`: 薪のはぜる音 / 低域燃焼音を単発生成。
- `triggerBurnReaction(count = 24, intervalMs = 110)`: 着火時の連鎖燃焼音。
- `isPlaying()`: 現在の再生状態。

### 1.2 `scripts/campfire.js` (`window.CampfireStage`)
- `init(canvasEl, glowElement)`: 描画先Canvasと背面光彩DOMを渡しループ開始。
- `loadConfig(url = '../configs/fire-config.json')`: 炎設定をロード。
- `setFlareUp(val)` / `getFlareUp()`: 着火時の増炎倍率（例: 2.8）を設定・取得（毎フレーム自動減衰）。

### 1.3 `scripts/paper-bake.js` (`window.PaperBake`)
- `bake(text, maxPages = 4, targetCount = null)`:
  - 戻り値: `{ sheets: [{ frontCanvas, backCanvas, pageIndex, totalPages }], totalPages }`
  - 表面: 白地・罫線・文字・ページ番号（例: `1/3`）。裏面: 無地グレー（`#e2e8f0`、裏写り防止）。
- `paginate(text, maxPages, targetCount)`: 1行11文字・1ページ7行でテキスト分割。
- 定数: `CARD_W = 150`, `CARD_H = 205`。

### 1.4 `scripts/paper-burn.js` (`window.PaperBurnStage`)
- `init(elements, callbacks)`:
  - `elements`: `{ viewport, paperLayer, domInputCard, textarea, hint }`
  - `callbacks`: `{ onIgnite: (s) => void, onBurnComplete: () => void }`
- `loadConfig(url)` / `updateConfig(newConfig)`: パラメータ読込・インメモリ即時更新。
- `reset()`: 入力状態へ復帰。 `getConfig()` / `getDefaultConfig()`: 設定オブジェクト取得。
- `setSheetCount(n)`: 枚数指定（`null` で自動判定、`1〜4` で固定）。

---

## 2. 連携ライフサイクル

```
[ 入力 (textarea) ] ──(上スワイプ)──> [ PaperBake.bake() (表裏Canvas生成) ]
         │
         ▼ createSheet(): 各紙に物理パラメータの一様乱数 (0.8〜1.2倍) を付与
[ 放物線上昇 (|vz| >= 4.5) ] ──> ピッチ (rx) で前方へ自然に前傾
         │
         ▼ 失速・ヒラヒラ落下 (|vz| < 4.5) ──> ロール揺れ (rz)・旋回 (ry)・縦回転 (rx) で表裏反転
         │
         ▼ 焚き火突入 (|x| < 260 && -1150 < z < -300 && vy > 0 && y > ignitionY)
         │  ├─ onIgnite ──> CampfireStage.setFlareUp(2.8) & FireAudio.triggerBurnReaction()
         │  └─ 調和級数多層燃焼 (約3.6秒): 焦げ ➔ 火炎 ➔ 黄色コア ➔ destination-outくり抜き
         ▼
[ 全シート灰化消滅 ] ──> onBurnComplete: 余韻画面へ移行
```

---

## 3. 再構築に必要なDOM構造 & CSS

### 3.1 HTML構造
```html
<div class="campfire-stage">
  <div class="ambient-glow" id="stageGlow"></div>
  <svg class="campfire-structure" viewBox="0 0 220 100">
    <ellipse cx="110" cy="72" rx="36" ry="12" fill="#ff4400" class="wood-ember" />
    <ellipse cx="110" cy="72" rx="22" ry="7" fill="#ffbb44" class="wood-ember" />
    <ellipse cx="110" cy="72" rx="9" ry="3" fill="#ffffff" />
    <g transform="rotate(18, 110, 72)"><rect x="35" y="65" width="150" height="14" rx="6" fill="#1e130d"/></g>
    <g transform="rotate(-22, 110, 72)"><rect x="30" y="66" width="160" height="13" rx="6" fill="#241710"/></g>
    <g transform="rotate(4, 110, 78)"><rect x="40" y="72" width="140" height="15" rx="7" fill="#2b1a11"/></g>
  </svg>
  <canvas id="campfireCanvas"></canvas>
</div>

<div id="viewport">
  <div id="paper-layer">
    <div id="dom-input-card"><textarea class="paper-text" placeholder="..."></textarea></div>
  </div>
</div>
```

### 3.2 必須CSS
```css
#viewport {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  perspective: 1000px; display: flex; justify-content: center; align-items: center; pointer-events: none;
}
#paper-layer, .paper-sheet {
  position: absolute; width: 150px; height: 205px; cursor: grab; transform-style: preserve-3d;
  pointer-events: auto; transform: translate3d(0px, 150px, 0px); touch-action: none;
}
.bake-canvas {
  position: absolute; top: 0; left: 0; width: 150px; height: 205px; border-radius: 6px;
  transition: box-shadow 3.5s ease-out;
}
.canvas-front { box-shadow: 0 14px 32px rgba(0,0,0,0.55); }
.canvas-back  { transform: rotateY(180deg); box-shadow: 0 14px 32px rgba(0,0,0,0.55); }
.burning .bake-canvas { box-shadow: 0 14px 32px rgba(0,0,0,0); }
.ambient-glow {
  position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); width: 400px; height: 250px;
  background: radial-gradient(ellipse at 50% 80%, rgba(255,120,30,0.38) 0%, rgba(255,70,10,0.18) 40%, transparent 75%);
  border-radius: 50%; filter: blur(22px); animation: flicker 3s infinite ease-in-out alternate;
}
@keyframes flicker { 0% { opacity: 0.85; } 50% { opacity: 1.05; } 100% { opacity: 0.95; } }
.wood-ember { filter: drop-shadow(0 0 8px #ff4400); animation: emberGlow 1.8s infinite ease-in-out alternate; }
@keyframes emberGlow { 0% { opacity: 0.75; } 100% { opacity: 1.0; filter: drop-shadow(0 0 14px #ff7700); } }
```

---

## 4. 全設定パラメータ仕様 (configs/)

### 4.1 `configs/paper-burn-config.json`
- **`physics`**: 各紙ごとに `0.8〜1.2倍` の一様乱数を個別乗算して適用。
  - `drag`: `0.035` (空気抵抗減衰率) / `gravity`: `0.22` (重力加速度)
  - `terminal`: `2.8` (最大降下速度) / `sway`: `1.5` (水平揺れ幅 px)
  - `tumble`: `0.6` (縦回転ピッチ速度倍率) / `rollAmp`: `24` (ロール揺れ角度 deg) / `yawDrift`: `0.3` (水平旋回ヨー倍率)
- **`throw`**:
  - `minSwipeDelta`: `-30` (投擲最小スワイプ量 px)
  - `vxFactor`: `0.035` / `vyFactor`: `0.038` (初速度係数) / `vyMin`: `-6.5` (Y最小初速度)
  - `vzFactor`: `0.08` / `vzMin`: `12` (Z奥進係数・最小初速度)
  - `spreadX`: `3.0` / `spreadY`: `1.4` / `spreadZ`: `3.2` (複数枚の扇状拡散幅)
- **`burn`**:
  - `duration`: `3600` (燃焼所要時間 ms) / `seedsCount`: `5` (着火シード数)
  - `flareUpIntensity`: `2.8` (焚き火増炎倍率) / `sinkSpeed`: `0.11` (灰沈下速度)
  - `ignitionY`: `55` (着火高さ判定閾値。薪の直上 = 55)

### 4.2 `configs/fire-config.json`
- `glowIntensity`: `0.37` (背面光彩強度) / `flickerSpeed`: `3.0` (ゆらぎ速度)
- `particleCount`: `45` (最大パーティクル数) / `sparkRatio`: `0.20` (火の粉比率)
- `width`: `80` (炎ベース横幅 px) / `speed`: `1.0` (上昇速度) / `wind`: `2.0` (風力揺れ)

### 4.3 `configs/audio-config.json`
- `masterVol`: `0.7` (マスター音量)
- `rumble`: `{ vol: 0.4, tone: 240, air: 0.25, speed: 2.4 }` (低周波ピンクノイズ)
- `crackle`: `{ vol: 0.1, rate: 13, rateJitter: 0.85, ... }` (薪のはぜる音)
- `pop`: `{ vol: 0.75, rate: 0.5, ... }` (破裂音) / `burst`: `{ vol: 0.85, interval: 16, decay: 65 }` (低域燃焼音)
