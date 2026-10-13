/* Shared, reversible image treatment. These parameters are visual hypotheses,
   not pigment measurements or the simulation of a conservation intervention. */
(() => {
  const stages = [
    { name: '现状影像', short: '现状', description: '保留来源图像中的斑驳与色彩。', brightness: 1, contrast: 1, saturation: 1, warmth: 0 },
    { name: '明暗调整', short: '调明暗', description: '轻微提亮暗部，调整图像对比；不清除病害或补画。', brightness: 1.035, contrast: 1.08, saturation: 1, warmth: 0 },
    { name: '色彩增强', short: '显色彩', description: '增强现存色彩的差别，让山水与殿宇更易辨读。', brightness: 1.035, contrast: 1.13, saturation: 1.65, warmth: 0 },
    { name: '复色设想', short: '复色设想', description: '以更鲜明的绿、赭色关系进行视觉设想；并非历史原色复原。', brightness: 1.025, contrast: 1.21, saturation: 2.5, warmth: 3 }
  ];
  function transform(data, index) {
    const p = stages[Math.max(0, Math.min(3, Math.round(index)))];
    const result = new Uint8ClampedArray(data);
    if (p === stages[0]) return result;
    for (let i = 0; i < result.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = .2126 * r + .7152 * g + .0722 * b;
      // Preserve near-black borders and prevent exaggerating neutral damage areas.
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const saturation = 1 + (p.saturation - 1) * Math.min(1, chroma / 20);
      const shift = [p.warmth, p.warmth * .2, -p.warmth * .3];
      for (let c = 0; c < 3; c++) {
        const value = (gray + (data[i + c] - gray) * saturation) * p.brightness;
        result[i + c] = gray < 10 ? data[i + c] : (value - 127.5) * p.contrast + 127.5 + shift[c];
      }
    }
    return result;
  }
  window.QianbiColor = { stages, transform };
})();
