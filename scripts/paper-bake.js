/**
 * WriteToFire - Paper Text Pagination & Texture Baker
 * File: scripts/paper-bake.js (Under 200 lines)
 */
(function(global) {
  const CARD_W = 150, CARD_H = 205;
  const LINES_PER_PAGE = 7, CHARS_PER_LINE = 16;

  function paginate(text, maxPages = 4, targetCount = null) {
    const rawLines = (text || '').replace(/\r\n/g, '\n').split('\n');
    const wrappedLines = [];
    for (let line of rawLines) {
      if (!line) { wrappedLines.push(''); continue; }
      for (let i = 0; i < line.length; i += CHARS_PER_LINE) wrappedLines.push(line.slice(i, i + CHARS_PER_LINE));
    }
    while (wrappedLines.length < 1) wrappedLines.push('');
    const pagesCount = (targetCount && targetCount >= 1 && targetCount <= maxPages)
      ? targetCount
      : Math.min(Math.max(Math.ceil(wrappedLines.length / LINES_PER_PAGE), 1), maxPages);
    const linesPerP = Math.max(Math.ceil(wrappedLines.length / pagesCount), 1);
    const pages = [];
    for (let p = 0; p < pagesCount; p++) {
      pages.push(wrappedLines.slice(p * linesPerP, (p + 1) * linesPerP));
    }
    return pages;
  }

  function createBackCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W; canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, CARD_W, CARD_H);
    return canvas;
  }

  function createFrontCanvas(lines, pageIndex, totalPages) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W; canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    // 紙の地と罫線
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    for (let y = 36; y < CARD_H; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke();
    }

    // 文字描画 (16文字が綺麗に収まるサイズ)
    ctx.font = '8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#2d3748';
    lines.forEach((line, i) => ctx.fillText(line, 8, 32 + i * 24));

    // 複数枚ある場合は右下にページ番号を薄く表示
    if (totalPages > 1) {
      ctx.font = '9px sans-serif'; ctx.fillStyle = '#a0aec0';
      ctx.fillText(`${pageIndex + 1}/${totalPages}`, CARD_W - 26, CARD_H - 10);
    }
    return canvas;
  }

  function bake(text, maxPages = 4, targetCount = null) {
    const pages = paginate(text, maxPages, targetCount);
    const totalPages = pages.length;
    const sheets = pages.map((lines, i) => ({
      frontCanvas: createFrontCanvas(lines, i, totalPages),
      backCanvas: createBackCanvas(),
      pageIndex: i,
      totalPages
    }));
    return { sheets, totalPages };
  }

  function bakePages(pagesArray) {
    const rawPages = (Array.isArray(pagesArray) && pagesArray.length > 0) ? pagesArray : [''];
    const totalPages = rawPages.length;
    const sheets = rawPages.map((pageText, i) => {
      const lines = [];
      const rawLines = (pageText || '').replace(/\r\n/g, '\n').split('\n');
      for (let line of rawLines) {
        if (!line) { lines.push(''); continue; }
        for (let c = 0; c < line.length; c += CHARS_PER_LINE) lines.push(line.slice(c, c + CHARS_PER_LINE));
      }
      return {
        frontCanvas: createFrontCanvas(lines.slice(0, LINES_PER_PAGE), i, totalPages),
        backCanvas: createBackCanvas(),
        pageIndex: i,
        totalPages
      };
    });
    return { sheets, totalPages };
  }

  global.PaperBake = { bake, bakePages, paginate, CARD_W, CARD_H };
})(window);
