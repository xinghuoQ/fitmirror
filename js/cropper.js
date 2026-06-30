/**
 * Cropper — 图片裁剪工具
 * Canvas 实现，支持拖拽、缩放、旋转
 */
export class Cropper {
  constructor(modalEl, canvasEl, onDone) {
    this.modal = modalEl;
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.onDone = onDone;

    this.image = null;
    this.category = null;
    this.rotation = 0;          // 度
    this.scale = 1;

    // 裁剪框（图像坐标空间）
    this.crop = { x: 0, y: 0, w: 200, h: 200 };

    // 交互状态
    this.dragging = false;
    this.dragType = null;       // 'move' | 'nw' | 'ne' | 'sw' | 'se'
    this.dragStart = { x: 0, y: 0 };
    this.cropStart = { x: 0, y: 0, w: 0, h: 0 };

    this.bindEvents();
  }

  open(fileOrBlobUrl, category) {
    this.category = category;
    this.rotation = 0;
    this.scale = 1;
    this.modal.classList.remove('hidden');

    const url = typeof fileOrBlobUrl === 'string'
      ? fileOrBlobUrl
      : URL.createObjectURL(fileOrBlobUrl);

    const img = new Image();
    img.onload = () => {
      this.image = img;
      // 初始裁剪框：图像中央 70%
      const cw = img.width * 0.7;
      const ch = img.height * 0.7;
      this.crop = {
        x: (img.width - cw) / 2,
        y: (img.height - ch) / 2,
        w: cw,
        h: ch,
      };
      this.fitCanvas();
      this.render();
    };
    img.src = url;
  }

  close() {
    this.modal.classList.add('hidden');
    this.image = null;
  }

  // ============================================================
  // 画布适配
  // ============================================================

  fitCanvas() {
    const maxSize = 400;
    if (this.image) {
      const s = Math.min(maxSize / this.image.width, maxSize / this.image.height);
      this.scale = s;
      this.canvas.width = this.image.width * s;
      this.canvas.height = this.image.height * s;
    }
  }

  // ============================================================
  // 渲染
  // ============================================================

  render() {
    if (!this.image) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 旋转处理
    ctx.save();
    ctx.translate(w / 2, h / 2);
    const rad = (this.rotation * Math.PI) / 180;
    ctx.rotate(rad);
    const s = this.scale;
    ctx.drawImage(this.image, -this.image.width * s / 2, -this.image.height * s / 2,
      this.image.width * s, this.image.height * s);
    ctx.restore();

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);
    // 裁剪区域清掉遮罩
    const cx = this.crop.x * this.scale;
    const cy = this.crop.y * this.scale;
    const cw = this.crop.w * this.scale;
    const ch = this.crop.h * this.scale;
    ctx.clearRect(cx, cy, cw, ch);

    // 重新绘制裁剪区内的图像
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.drawImage(this.image, -this.image.width * s / 2, -this.image.height * s / 2,
      this.image.width * s, this.image.height * s);
    ctx.restore();

    // 裁剪框
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + cw / 3, cy); ctx.lineTo(cx + cw / 3, cy + ch);
    ctx.moveTo(cx + cw * 2 / 3, cy); ctx.lineTo(cx + cw * 2 / 3, cy + ch);
    ctx.moveTo(cx, cy + ch / 3); ctx.lineTo(cx + cw, cy + ch / 3);
    ctx.moveTo(cx, cy + ch * 2 / 3); ctx.lineTo(cx + cw, cy + ch * 2 / 3);
    ctx.stroke();

    // 四角手柄
    const handleSize = 14;
    [
      [cx, cy], [cx + cw, cy],
      [cx, cy + ch], [cx + cw, cy + ch]
    ].forEach(([hx, hy]) => {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    });
  }

  // ============================================================
  // 事件绑定
  // ============================================================

  bindEvents() {
    // 鼠标/触摸在 canvas 上
    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('touchstart', (e) => this.onPointerDown(e), { passive: false });
    window.addEventListener('mousemove', (e) => this.onPointerMove(e));
    window.addEventListener('touchmove', (e) => this.onPointerMove(e), { passive: false });
    window.addEventListener('mouseup', (e) => this.onPointerUp(e));
    window.addEventListener('touchend', (e) => this.onPointerUp(e));

    // 旋转按钮
    document.getElementById('rotateLeftBtn').addEventListener('click', () => {
      this.rotation = (this.rotation - 15) % 360;
      this.render();
    });
    document.getElementById('rotateRightBtn').addEventListener('click', () => {
      this.rotation = (this.rotation + 15) % 360;
      this.render();
    });
    document.getElementById('resetCropBtn').addEventListener('click', () => {
      this.resetCrop();
    });

    // 关闭/取消/确认
    document.getElementById('closeCropModal').addEventListener('click', () => this.close());
    document.getElementById('cancelCropBtn').addEventListener('click', () => this.close());
    document.getElementById('confirmCropBtn').addEventListener('click', () => this.confirm());

    // 重新选择文件
    document.getElementById('cropFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.open(file, this.category);
    });

    // 点击遮罩关闭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  resetCrop() {
    if (!this.image) return;
    const cw = this.image.width * 0.7;
    const ch = this.image.height * 0.7;
    this.crop = {
      x: (this.image.width - cw) / 2,
      y: (this.image.height - ch) / 2,
      w: cw, h: ch
    };
    this.rotation = 0;
    this.render();
  }

  // ============================================================
  // 指针交互
  // ============================================================

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (this.canvas.width / rect.width),
      y: (clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  onPointerDown(e) {
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    const cx = this.crop.x * this.scale;
    const cy = this.crop.y * this.scale;
    const cw = this.crop.w * this.scale;
    const ch = this.crop.h * this.scale;
    const handleSize = 20;

    // 检测是否在四角
    const corners = {
      nw: [cx, cy],
      ne: [cx + cw, cy],
      sw: [cx, cy + ch],
      se: [cx + cw, cy + ch],
    };

    let hitCorner = null;
    for (const [key, [hx, hy]] of Object.entries(corners)) {
      if (Math.abs(pos.x - hx) < handleSize && Math.abs(pos.y - hy) < handleSize) {
        hitCorner = key;
        break;
      }
    }

    if (hitCorner) {
      this.dragging = true;
      this.dragType = hitCorner;
    } else if (pos.x >= cx && pos.x <= cx + cw && pos.y >= cy && pos.y <= cy + ch) {
      this.dragging = true;
      this.dragType = 'move';
    } else {
      return;
    }

    this.dragStart = { x: pos.x, y: pos.y };
    this.cropStart = { ...this.crop };
  }

  onPointerMove(e) {
    if (!this.dragging) return;
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    const dx = (pos.x - this.dragStart.x) / this.scale;
    const dy = (pos.y - this.dragStart.y) / this.scale;

    const cs = this.cropStart;
    let { x, y, w, h } = cs;

    switch (this.dragType) {
      case 'move':
        x = cs.x + dx;
        y = cs.y + dy;
        break;
      case 'se':
        w = cs.w + dx;
        h = cs.h + dy;
        break;
      case 'sw':
        x = cs.x + dx;
        w = cs.w - dx;
        h = cs.h + dy;
        break;
      case 'ne':
        y = cs.y + dy;
        w = cs.w + dx;
        h = cs.h - dy;
        break;
      case 'nw':
        x = cs.x + dx;
        y = cs.y + dy;
        w = cs.w - dx;
        h = cs.h - dy;
        break;
    }

    // 最小尺寸
    const minSize = 40;
    if (w < minSize) w = minSize;
    if (h < minSize) h = minSize;

    // 边界约束
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > this.image.width) w = this.image.width - x;
    if (y + h > this.image.height) h = this.image.height - y;

    this.crop = { x, y, w, h };
    this.render();
  }

  onPointerUp(e) {
    this.dragging = false;
    this.dragType = null;
  }

  // ============================================================
  // 确认裁剪
  // ============================================================

  confirm() {
    if (!this.image) return;

    // 创建离屏 canvas 裁剪
    const off = document.createElement('canvas');
    off.width = this.crop.w;
    off.height = this.crop.h;
    const ctx = off.getContext('2d');

    // 处理旋转
    ctx.save();
    ctx.translate(off.width / 2, off.height / 2);
    if (this.rotation !== 0) {
      ctx.rotate((this.rotation * Math.PI) / 180);
    }
    ctx.drawImage(
      this.image,
      this.crop.x, this.crop.y, this.crop.w, this.crop.h,
      -off.width / 2, -off.height / 2, off.width, off.height
    );
    ctx.restore();

    const dataUrl = off.toDataURL('image/png', 0.9);
    const blobUrl = URL.createObjectURL(this.dataURLtoBlob(dataUrl));

    this.close();
    if (this.onDone) {
      this.onDone(this.category, dataUrl, blobUrl);
    }
  }

  dataURLtoBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bytes = atob(parts[1]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
}
