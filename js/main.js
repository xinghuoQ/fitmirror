/**
 * FitMirror — 虚拟试穿
 * 主入口：UI 逻辑 + 衣柜管理 + 3D 场景初始化
 */
import { FitCharacter } from './character.js';
import { Cropper } from './cropper.js';

// ============================================================
// 状态管理
// ============================================================

const state = {
  currentCategory: 'hat',
  wardrobe: {
    hat: [],
    top: [],
    bottom: [],
    shoes: []
  },
  selectedItems: {
    hat: null,
    top: null,
    bottom: null,
    shoes: null
  },
  pendingFile: null
};

let character;
let cropper;

// ============================================================
// DOM 引用
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const wardrobePanel = $('#wardrobePanel');
const clothesGrid = $('#clothesGrid');
const categoryTabs = $('#categoryTabs');
const addClothBtn = $('#addClothBtn');
const cropModal = $('#cropModal');
const cropCanvas = $('#cropCanvas');
const categoryModal = $('#categoryModal');
const viewport = $('#viewport');
const toggleWardrobeBtn = $('#toggleWardrobeBtn');

// ============================================================
// 衣柜渲染
// ============================================================

function renderWardrobe() {
  const items = state.wardrobe[state.currentCategory];
  clothesGrid.innerHTML = '';

  if (items.length === 0) {
    clothesGrid.innerHTML = `
      <div class="cloth-empty">还没有${categoryLabel(state.currentCategory)}<br>点击下方按钮添加</div>
    `;
    return;
  }

  items.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'cloth-item';
    if (state.selectedItems[state.currentCategory] === index) {
      div.classList.add('selected');
    }
    div.innerHTML = `
      <img src="${item.dataUrl}" alt="${state.currentCategory}">
      <button class="delete-btn" data-index="${index}">✕</button>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      selectItem(index);
    });
    div.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(index);
    });
    clothesGrid.appendChild(div);
  });
}

function categoryLabel(cat) {
  const map = { hat: '帽子', top: '上衣', bottom: '裤子', shoes: '鞋子' };
  return map[cat] || '';
}

function selectItem(index) {
  const cat = state.currentCategory;
  if (state.selectedItems[cat] === index) {
    // 取消选择（回到默认）
    state.selectedItems[cat] = null;
    character.removeClothing(cat);
  } else {
    state.selectedItems[cat] = index;
    const item = state.wardrobe[cat][index];
    character.applyClothing(cat, item.dataUrl);
  }
  renderWardrobe();
}

function deleteItem(index) {
  const cat = state.currentCategory;
  const item = state.wardrobe[cat][index];
  // 释放 blob URL
  if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
  state.wardrobe[cat].splice(index, 1);
  // 调整选中索引
  if (state.selectedItems[cat] === index) {
    state.selectedItems[cat] = null;
    character.removeClothing(cat);
  } else if (state.selectedItems[cat] > index) {
    state.selectedItems[cat]--;
  }
  renderWardrobe();
}

// ============================================================
// 分类切换
// ============================================================

categoryTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-btn');
  if (!btn) return;
  state.currentCategory = btn.dataset.cat;
  $$('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWardrobe();
});

// ============================================================
// 上传流程
// ============================================================

let pendingFile = null;

addClothBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingFile = file;
    showCategoryModal();
  };
  input.click();
});

function showCategoryModal() {
  categoryModal.classList.remove('hidden');
}

function hideCategoryModal() {
  categoryModal.classList.add('hidden');
  pendingFile = null;
}

$('#categoryModal').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-select-btn');
  if (btn) {
    const cat = btn.dataset.cat;
    hideCategoryModal();
    if (pendingFile) {
      cropper.open(pendingFile, cat);
    }
  }
  if (e.target.id === 'cancelCategoryBtn') {
    hideCategoryModal();
  }
});

// ============================================================
// 裁剪完成回调
// ============================================================

function onCropDone(category, dataUrl, blobUrl) {
  state.wardrobe[category].push({ dataUrl, blobUrl });
  state.currentCategory = category;
  // 切换到对应分类
  $$('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === category);
  });
  // 自动选中新添加的
  const newIndex = state.wardrobe[category].length - 1;
  state.selectedItems[category] = newIndex;
  character.applyClothing(category, dataUrl);
  renderWardrobe();
}

// ============================================================
// 移动端衣柜折叠
// ============================================================

toggleWardrobeBtn.addEventListener('click', () => {
  wardrobePanel.classList.toggle('collapsed');
  toggleWardrobeBtn.querySelector('.arrow').textContent =
    wardrobePanel.classList.contains('collapsed') ? '▲' : '▼';
});

// ============================================================
// 窗口大小适配
// ============================================================

window.addEventListener('resize', () => {
  if (character) character.onResize();
});

// ============================================================
// 键盘快捷键
// ============================================================

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const keys = { '1': 'hat', '2': 'top', '3': 'bottom', '4': 'shoes' };
  const cat = keys[e.key];
  if (cat) {
    state.currentCategory = cat;
    $$('.cat-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    renderWardrobe();
  }
});

// ============================================================
// 启动
// ============================================================

function init() {
  // 裁剪工具
  cropper = new Cropper(cropModal, cropCanvas, onCropDone);

  // 3D 角色
  character = new FitCharacter(viewport);

  // 默认衣柜渲染
  renderWardrobe();

  console.log('🪞 FitMirror ready!');
  console.log('  拖拽旋转 | 滚轮缩放 | 右键平移');
  console.log('  键盘 1-4 切换分类');
}

init();
