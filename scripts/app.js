/**
 * WriteToFire - Main Application Controller
 * File: scripts/app.js
 */
(function(global) {
  // DOM Elements
  const els = {
    stageCampfire: document.getElementById('stage-campfire'),
    stateStandby: document.getElementById('state-standby'),
    stateWriting: document.getElementById('state-writing'),
    stateThrowing: document.getElementById('state-throwing'),
    campfireCanvas: document.getElementById('campfireCanvas'),
    woodSelect: document.getElementById('woodSelect'),
    woodEstimate: document.getElementById('woodEstimate'),
    btnIgnite: document.getElementById('btnIgnite'),
    letterWrapper: document.getElementById('letterWrapper'),
    letterTextarea: document.getElementById('letterTextarea'),
    pageInfo: document.getElementById('pageInfo'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    btnAddPage: document.getElementById('btnAddPage'),
    paperLayer: document.getElementById('paper-layer'),
    throwHint: document.getElementById('throwHint'),
    viewport: document.getElementById('viewport')
  };

  // State & Data
  let currentState = 'standby';
  let writingTimer = null;
  let idleTimeout = null;
  let pages = [''];
  let currentPageIndex = 0;
  const MAX_PAGES = 6;
  const MAX_LINES_PER_PAGE = 7;
  const CHARS_PER_LINE = 16;
  let isComposing = false;

  const WOOD_TIMES = {
    '1': 60,   // 1本: 1分 (60秒)
    '3': 300,  // 3本: 5分 (300秒)
    '5': 600   // 5本: 10分 (600秒)
  };

  // ==========================================
  // 状態管理 (State Machine)
  // ==========================================
  function setState(newState) {
    currentState = newState;
    [els.stateStandby, els.stateWriting, els.stateThrowing].forEach(el => {
      if (el) el.classList.remove('active');
    });

    if (newState === 'standby' && els.stateStandby) {
      els.stateStandby.classList.add('active');
    } else if (newState === 'writing' && els.stateWriting) {
      els.stateWriting.classList.add('active');
      setTimeout(() => els.letterTextarea && els.letterTextarea.focus(), 300);
    } else if (newState === 'throwing' && els.stateThrowing) {
      els.stateThrowing.classList.add('active');
    } else if (newState === 'extinguish') {
      // 鎮火フェーズ: 全UIを非表示
    }
  }

  // ==========================================
  // 待機画面: 薪選択 & 着火
  // ==========================================
  function initStandby() {
    if (els.woodSelect) {
      els.woodSelect.addEventListener('change', () => {
        const val = els.woodSelect.value;
        const minutes = Math.round((WOOD_TIMES[val] || 300) / 60);
        if (els.woodEstimate) els.woodEstimate.textContent = `目安 ${minutes}分`;
      });
    }

    if (els.btnIgnite) {
      els.btnIgnite.addEventListener('click', () => {
        const val = els.woodSelect ? els.woodSelect.value : '3';
        const durationSec = WOOD_TIMES[val] || 300;

        // 炎と音の開始
        if (global.CampfireStage) global.CampfireStage.ignite(2.0);
        if (global.FireAudio) global.FireAudio.start();

        // 執筆画面へ
        setState('writing');

        // 裏タイマー開始 (画面には非表示)
        writingTimer = setTimeout(onTimeUp, durationSec * 1000);
      });
    }
  }

  // ==========================================
  // 執筆画面: 便箋エディタ
  // ==========================================
  function updatePageUI() {
    if (els.letterTextarea) {
      els.letterTextarea.value = pages[currentPageIndex] || '';
    }
    if (els.pageInfo) {
      els.pageInfo.textContent = `${currentPageIndex + 1} / ${pages.length}`;
    }
    if (els.btnPrevPage) {
      els.btnPrevPage.disabled = (currentPageIndex <= 0);
    }
    if (els.btnNextPage) {
      els.btnNextPage.disabled = (currentPageIndex >= pages.length - 1);
    }
    if (els.btnAddPage) {
      const isCurrentEmpty = (pages[currentPageIndex] || '').trim().length === 0;
      els.btnAddPage.disabled = (pages.length >= MAX_PAGES || isCurrentEmpty);
    }
  }

  function saveCurrentPage() {
    if (els.letterTextarea) {
      pages[currentPageIndex] = els.letterTextarea.value;
    }
  }

  /**
   * 別のページへ遷移する処理
   * 遷移元が空（trim().length === 0）かつ全体が2ページ以上なら、その空ページを削除（環境配慮）
   */
  function navigateToPage(targetIndex) {
    if (targetIndex < 0 || targetIndex >= pages.length || targetIndex === currentPageIndex) {
      return;
    }

    saveCurrentPage();

    const currentText = pages[currentPageIndex] || '';
    let nextIndex = targetIndex;

    // 現在のページが空かつ全体が2ページ以上なら削除
    if (currentText.trim().length === 0 && pages.length > 1) {
      pages.splice(currentPageIndex, 1);
      // 後続ページへ進もうとしていた場合、削除によって1つ手前に詰まる
      if (targetIndex > currentPageIndex) {
        nextIndex = currentPageIndex;
      }
    }

    currentPageIndex = Math.max(0, Math.min(nextIndex, pages.length - 1));
    updatePageUI();
    if (els.letterTextarea) {
      els.letterTextarea.focus();
    }
  }

  function handleTextInput() {
    if (isComposing || !els.letterTextarea) return;

    const ta = els.letterTextarea;
    // 実際に画面上で7行（clientHeight: 224px）の高さを超えたか？
    // ※文字数ではなく、Enter改行および幅超過での自動折り返し改行の両方をDOM高さで正確に検知
    if (ta.scrollHeight > ta.clientHeight + 4) {
      const fullText = ta.value;
      const maxHeight = ta.clientHeight;

      // 二分探索で7行にちょうど収まる限界文字位置を見つける
      let low = 0, high = fullText.length, bestFit = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        ta.value = fullText.slice(0, mid);
        if (ta.scrollHeight <= maxHeight + 4) {
          bestFit = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const kept = fullText.slice(0, bestFit);
      let overflow = fullText.slice(bestFit);
      if (overflow.startsWith('\n')) overflow = overflow.slice(1);

      pages[currentPageIndex] = kept;

      if (pages.length < MAX_PAGES) {
        if (currentPageIndex === pages.length - 1) {
          pages.push(overflow);
          currentPageIndex++;
        } else {
          pages[currentPageIndex + 1] = overflow + (pages[currentPageIndex + 1] ? '\n' + pages[currentPageIndex + 1] : '');
          currentPageIndex++;
        }
        updatePageUI();
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      } else {
        // 最大ページ到達時は7行目末尾で打ち切って留まる
        ta.value = kept;
        pages[currentPageIndex] = kept;
      }
    } else {
      saveCurrentPage();
      if (els.btnAddPage) {
        const isCurrentEmpty = (pages[currentPageIndex] || '').trim().length === 0;
        els.btnAddPage.disabled = (pages.length >= MAX_PAGES || isCurrentEmpty);
      }
    }
  }

  function initWritingEditor() {
    if (!els.letterTextarea) return;

    // IME変換制御
    els.letterTextarea.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    els.letterTextarea.addEventListener('compositionend', () => {
      isComposing = false;
      handleTextInput();
    });

    // 通常入力監視
    els.letterTextarea.addEventListener('input', () => {
      handleTextInput();
    });

    // スクロール位置の常時トップ固定
    els.letterTextarea.addEventListener('scroll', () => {
      els.letterTextarea.scrollTop = 0;
    });

    // 左右矢印ボタン
    if (els.btnPrevPage) {
      els.btnPrevPage.addEventListener('click', () => {
        navigateToPage(currentPageIndex - 1);
      });
    }

    if (els.btnNextPage) {
      els.btnNextPage.addEventListener('click', () => {
        navigateToPage(currentPageIndex + 1);
      });
    }

    // ＋ ページ追加ボタン
    if (els.btnAddPage) {
      els.btnAddPage.addEventListener('click', () => {
        saveCurrentPage();
        if ((pages[currentPageIndex] || '').trim().length === 0) {
          return; // 空のときは増やさない（環境配慮）
        }
        if (pages.length < MAX_PAGES) {
          pages.splice(currentPageIndex + 1, 0, '');
          currentPageIndex++;
          updatePageUI();
          if (els.letterTextarea) els.letterTextarea.focus();
        }
      });
    }

    // タッチスワイプによる左右ページめくり
    let touchStartX = 0, touchStartY = 0;
    els.letterWrapper.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    els.letterWrapper.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 40) {
        if (deltaX < 0) {
          navigateToPage(currentPageIndex + 1);
        } else if (deltaX > 0) {
          navigateToPage(currentPageIndex - 1);
        }
      }
    }, { passive: true });

    updatePageUI();
  }

  // ==========================================
  // 時間満了 & 投擲画面への空間遷移
  // ==========================================
  function onTimeUp() {
    if (currentState !== 'writing') return;
    saveCurrentPage();

    if (els.letterTextarea) els.letterTextarea.blur();

    // 空ページのトリミング（最低1枚は確保）
    const validPages = pages.filter(p => (p || '').trim().length > 0);
    const pagesToThrow = validPages.length > 0 ? validPages : [''];
    pages = pagesToThrow;
    currentPageIndex = Math.min(currentPageIndex, pages.length - 1);

    // 画面中央の便箋が中央下・小さめへ縮小移動
    if (els.letterWrapper) {
      els.letterWrapper.classList.add('shrink-to-throw');
    }

    // 0.8秒のアニメーション後に投擲スタンバイへ
    setTimeout(() => {
      setState('throwing');
      if (global.PaperBurnStage) {
        global.PaperBurnStage.prepareThrow(pagesToThrow);
      }

      // 未投擲のまま放置された場合のタイマー (45秒で自然鎮火)
      idleTimeout = setTimeout(() => {
        startExtinguish();
      }, 45000);
    }, 800);
  }

  // ==========================================
  // 鎮火フェーズ (Extinguish)
  // ==========================================
  function startExtinguish() {
    if (currentState === 'extinguish') return;
    setState('extinguish');

    if (idleTimeout) clearTimeout(idleTimeout);

    // 焚き火全体を30秒かけて徐々に暗くし、最後は完全な漆黒（真っ暗）にする
    if (els.stageCampfire) {
      els.stageCampfire.classList.add('extinguishing');
    }

    // 手元の紙レイヤーをフェードアウト
    if (els.paperLayer) {
      els.paperLayer.style.transition = 'opacity 2s ease';
      els.paperLayer.style.opacity = '0';
    }
    if (els.throwHint) {
      els.throwHint.classList.add('hidden');
    }

    // 焚き火と音を約30秒かけて徐々に消滅
    if (global.CampfireStage) global.CampfireStage.fadeOut(30);
    if (global.FireAudio) global.FireAudio.fadeOut(30);
  }

  // ==========================================
  // アプリケーション初期化
  // ==========================================
  async function init() {
    // 焚き火ステージの初期化 (初期は種火)
    if (global.CampfireStage && els.campfireCanvas) {
      await global.CampfireStage.loadConfig('configs/fire-config.json');
      global.CampfireStage.init(els.campfireCanvas);
    }

    // 音響エンジンの初期化
    if (global.FireAudio) {
      await global.FireAudio.loadConfig('configs/audio-config.json');
    }

    // 投擲・燃焼ステージの初期化
    if (global.PaperBurnStage && els.paperLayer && els.viewport) {
      await global.PaperBurnStage.loadConfig('configs/paper-burn-config.json');
      global.PaperBurnStage.init({
        paperLayer: els.paperLayer,
        viewport: els.viewport,
        hint: els.throwHint
      }, {
        onThrow: () => {
          if (idleTimeout) clearTimeout(idleTimeout);
        },
        onIgnite: () => {
          if (global.CampfireStage) global.CampfireStage.setFlareUp(2.8);
          if (global.FireAudio) global.FireAudio.triggerBurnReaction();
        },
        onBurnComplete: () => {
          // 全シート燃焼完了後、約30秒の鎮火フェーズへ
          startExtinguish();
        }
      });
    }

    initStandby();
    initWritingEditor();
    setState('standby');
  }

  // DOMロード時に開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.WriteToFireApp = { init, onTimeUp, startExtinguish, getState: () => currentState };
})(window);
