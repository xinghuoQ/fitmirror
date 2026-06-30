/**
 * FitCharacter — 3D虚拟人物
 * Three.js 构建，成人比例，可爱脸
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
// 材质预设
// ============================================================

const SKIN = 0xf5d0c5;
const SKIN_DARK = 0xe8bca8;
const HAIR = 0x4a3728;
const EYE_WHITE = 0xffffff;
const PUPIL = 0x2d2a26;
const MOUTH = 0xd4837a;
const BLUSH = 0xf0b0a8;
const DEFAULT_TOP = 0xffffff;
const DEFAULT_BOTTOM = 0x6080b0;
const DEFAULT_SHOES = 0x3a3a3a;

// ============================================================
// FitCharacter 类
// ============================================================

export class FitCharacter {
  constructor(viewportEl) {
    this.viewportEl = viewportEl;
    this.animGroups = {};
    this.clothingMeshes = {};  // { hat, top, bottom, shoes }
    this.defaultMaterials = {}; // 保存默认材质以便还原
    this.animState = {
      breathPhase: 0,
      blinkTimer: 0,
      blinkActive: false,
      blinkDuration: 0,
      hairTouchTimer: 0,
      hairTouchActive: false,
      hairTouchPhase: 0,
      swayPhase: 0,
    };
    this.clock = new THREE.Clock();

    this.initScene();
    this.buildCharacter();
    this.startLoop();
  }

  // ============================================================
  // 场景初始化
  // ============================================================

  initScene() {
    const rect = this.viewportEl.getBoundingClientRect();

    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.viewportEl.appendChild(this.renderer.domElement);

    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f3f0);
    this.scene.fog = new THREE.Fog(0xf5f3f0, 3, 8);

    // 相机
    this.camera = new THREE.PerspectiveCamera(40, rect.width / rect.height, 0.1, 20);
    this.camera.position.set(0, 1.0, 3.2);
    this.camera.lookAt(0, 1.0, 0);

    // 灯光
    const ambient = new THREE.AmbientLight(0xfff5ee, 1.8);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(2, 3, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.bias = -0.0001;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffeedd, 1.5);
    fill.position.set(-1.5, 0.5, -1);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 2);
    rim.position.set(0, 1.5, -2.5);
    this.scene.add(rim);

    // 地面
    const groundGeo = new THREE.CircleGeometry(1.5, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dd, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 5;
    this.controls.maxPolarAngle = Math.PI * 0.7;
    this.controls.minPolarAngle = 0.3;
    this.controls.update();
  }

  // ============================================================
  // 构建人物
  // ============================================================

  buildCharacter() {
    this.root = new THREE.Group();
    this.scene.add(this.root);

    // 材质
    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
    const skinDarkMat = new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.7 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: PUPIL, roughness: 0.2 });
    const blushMat = new THREE.MeshStandardMaterial({ color: BLUSH, roughness: 0.3, transparent: true, opacity: 0.4 });

    // ---------- 身体摇晃组 ----------
    const swayGroup = new THREE.Group();
    swayGroup.name = 'sway';
    this.root.add(swayGroup);
    this.animGroups.sway = swayGroup;

    // ---------- 呼吸组 ----------
    const breathGroup = new THREE.Group();
    breathGroup.name = 'breath';
    swayGroup.add(breathGroup);
    this.animGroups.breath = breathGroup;

    // ---------- 躯干 ----------
    // 上身
    const upperTorsoGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.45, 16);
    const upperTorso = new THREE.Mesh(upperTorsoGeo, skinMat.clone());
    upperTorso.position.y = 1.28;
    upperTorso.castShadow = true;
    breathGroup.add(upperTorso);

    // 下身（腹部）
    const lowerTorsoGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.3, 16);
    const lowerTorso = new THREE.Mesh(lowerTorsoGeo, skinMat.clone());
    lowerTorso.position.y = 0.9;
    lowerTorso.castShadow = true;
    breathGroup.add(lowerTorso);

    // ---------- 上衣遮罩（默认白色）----------
    const topGeo = new THREE.CylinderGeometry(0.235, 0.255, 0.50, 16, 1, true, 0, Math.PI * 1.0);
    const topMat = new THREE.MeshStandardMaterial({
      color: DEFAULT_TOP,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.y = 1.28;
    topMesh.name = 'clothing-top';
    breathGroup.add(topMesh);
    this.clothingMeshes.top = topMesh;
    this.defaultMaterials.top = topMat.clone();

    // ---------- 裤子遮罩 ----------
    // 左腿裤
    const leftLegGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.55, 12);
    const leftLegMat = new THREE.MeshStandardMaterial({ color: DEFAULT_BOTTOM, roughness: 0.5 });
    const leftLegMesh = new THREE.Mesh(leftLegGeo, leftLegMat);
    leftLegMesh.position.set(-0.1, 0.55, 0);
    leftLegMesh.name = 'clothing-bottom-l';
    breathGroup.add(leftLegMesh);

    // 右腿裤
    const rightLegGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.55, 12);
    const rightLegMat = new THREE.MeshStandardMaterial({ color: DEFAULT_BOTTOM, roughness: 0.5 });
    const rightLegMesh = new THREE.Mesh(rightLegGeo, rightLegMat);
    rightLegMesh.position.set(0.1, 0.55, 0);
    rightLegMesh.name = 'clothing-bottom-r';
    breathGroup.add(rightLegMesh);

    this.clothingMeshes.bottom = [leftLegMesh, rightLegMesh];
    this.defaultMaterials.bottom = leftLegMat.clone();

    // ---------- 腿（皮肤）----------
    // 左小腿
    const leftCalfGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.35, 12);
    const leftCalf = new THREE.Mesh(leftCalfGeo, skinMat.clone());
    leftCalf.position.set(-0.1, 0.15, 0);
    leftCalf.castShadow = true;
    breathGroup.add(leftCalf);
    // 右小腿
    const rightCalfGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.35, 12);
    const rightCalf = new THREE.Mesh(rightCalfGeo, skinMat.clone());
    rightCalf.position.set(0.1, 0.15, 0);
    rightCalf.castShadow = true;
    breathGroup.add(rightCalf);

    // ---------- 鞋子 ----------
    const leftShoeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.22);
    const leftShoeMat = new THREE.MeshStandardMaterial({ color: DEFAULT_SHOES, roughness: 0.4 });
    const leftShoe = new THREE.Mesh(leftShoeGeo, leftShoeMat);
    leftShoe.position.set(-0.1, -0.06, 0.04);
    leftShoe.name = 'clothing-shoes-l';
    breathGroup.add(leftShoe);
    const rightShoeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.22);
    const rightShoe = new THREE.Mesh(rightShoeGeo, leftShoeMat.clone());
    rightShoe.position.set(0.1, -0.06, 0.04);
    rightShoe.name = 'clothing-shoes-r';
    breathGroup.add(rightShoe);
    this.clothingMeshes.shoes = [leftShoe, rightShoe];
    this.defaultMaterials.shoes = leftShoeMat.clone();

    // ---------- 头 ----------
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;
    headGroup.name = 'head';
    breathGroup.add(headGroup);

    // 头部主体
    const headGeo = new THREE.SphereGeometry(0.2, 24, 24);
    // 稍微压扁一点更像人头
    headGeo.scale(1, 1.08, 0.95);
    const headMesh = new THREE.Mesh(headGeo, skinMat.clone());
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // 头发（简单的半球盖）
    const hairGeo = new THREE.SphereGeometry(0.21, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hairGeo.scale(1, 1.08, 0.95);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.y = 0.02;
    headGroup.add(hairMesh);

    // 眼睛
    const eyeGroup = new THREE.Group();
    eyeGroup.name = 'eyes';
    headGroup.add(eyeGroup);

    [-0.07, 0.07].forEach(x => {
      // 眼白
      const whiteGeo = new THREE.SphereGeometry(0.045, 12, 12);
      whiteGeo.scale(1, 0.85, 0.4);
      const white = new THREE.Mesh(whiteGeo, new THREE.MeshStandardMaterial({ color: EYE_WHITE, roughness: 0.1 }));
      white.position.set(x, 0.04, -0.17);
      eyeGroup.add(white);
      // 瞳孔
      const pupilGeo = new THREE.SphereGeometry(0.025, 8, 8);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(x, 0.04, -0.20);
      pupil.name = x < 0 ? 'pupil-l' : 'pupil-r';
      eyeGroup.add(pupil);
    });

    // 眉毛
    [-0.07, 0.07].forEach(x => {
      const browGeo = new THREE.BoxGeometry(0.06, 0.012, 0.015);
      const brow = new THREE.Mesh(browGeo, new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.7 }));
      brow.position.set(x, 0.08, -0.17);
      eyeGroup.add(brow);
    });

    // 鼻子
    const noseGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.4 }));
    nose.position.set(0, -0.01, -0.195);
    headGroup.add(nose);

    // 嘴
    const mouthGeo = new THREE.TorusGeometry(0.03, 0.008, 6, 8, Math.PI);
    const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshStandardMaterial({ color: MOUTH, roughness: 0.3 }));
    mouth.position.set(0, -0.04, -0.19);
    mouth.rotation.z = Math.PI;
    headGroup.add(mouth);

    // 腮红
    [-0.09, 0.09].forEach(x => {
      const blushGeo = new THREE.CircleGeometry(0.025, 12);
      const blushMesh = new THREE.Mesh(blushGeo, blushMat);
      blushMesh.position.set(x, -0.01, -0.18);
      headGroup.add(blushMesh);
    });

    // ---------- 帽子挂点 ----------
    const hatGroup = new THREE.Group();
    hatGroup.position.y = 0.22;
    hatGroup.name = 'hat-position';
    headGroup.add(hatGroup);

    // 默认无帽子时不显示
    const hatGeo = new THREE.CylinderGeometry(0.18, 0.20, 0.12, 16);
    const hatMesh = new THREE.Mesh(hatGeo, new THREE.MeshStandardMaterial({ visible: false }));
    hatMesh.position.y = 0.02;
    hatGroup.add(hatMesh);
    this.clothingMeshes.hat = hatMesh;
    this.defaultMaterials.hat = new THREE.MeshStandardMaterial({ visible: false });

    // ---------- 脖子 ----------
    const neckGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12);
    const neck = new THREE.Mesh(neckGeo, skinMat.clone());
    neck.position.y = 1.47;
    neck.castShadow = true;
    breathGroup.add(neck);

    // ---------- 手臂 ----------
    [-1, 1].forEach(side => {
      const x = side * 0.3;

      // 上臂
      const upperArmGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.35, 10);
      const upperArm = new THREE.Mesh(upperArmGeo, skinMat.clone());
      upperArm.position.set(x, 1.35, 0);
      upperArm.castShadow = true;
      upperArm.name = `upper-arm-${side}`;
      breathGroup.add(upperArm);

      // 前臂
      const lowerArmGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.32, 10);
      const lowerArm = new THREE.Mesh(lowerArmGeo, skinMat.clone());
      lowerArm.position.set(x, 0.98, 0);
      lowerArm.castShadow = true;
      lowerArm.name = `lower-arm-${side}`;
      breathGroup.add(lowerArm);

      // 手
      const handGeo = new THREE.SphereGeometry(0.055, 10, 10);
      handGeo.scale(1, 0.7, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMat.clone());
      hand.position.set(x, 0.65, 0.02);
      hand.castShadow = true;
      hand.name = `hand-${side}`;
      breathGroup.add(hand);
    });

    // ---------- 保存引用用于动画 ----------
    this.headGroup = headGroup;
    this.eyeGroup = eyeGroup;
    this.breathGroup = breathGroup;
    this.swayGroup = swayGroup;
  }

  // ============================================================
  // 服装应用
  // ============================================================

  applyClothing(category, imageDataUrl) {
    const texture = new THREE.TextureLoader().load(imageDataUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    switch (category) {
      case 'hat': {
        const mesh = this.clothingMeshes.hat;
        mesh.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.5,
          side: THREE.DoubleSide,
        });
        mesh.material.visible = true;
        mesh.scale.set(1, 1, 1);
        break;
      }
      case 'top': {
        const mesh = this.clothingMeshes.top;
        mesh.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.5,
          side: THREE.DoubleSide,
        });
        break;
      }
      case 'bottom': {
        this.clothingMeshes.bottom.forEach(m => {
          m.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.5,
          });
        });
        break;
      }
      case 'shoes': {
        this.clothingMeshes.shoes.forEach(m => {
          m.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.4,
          });
        });
        break;
      }
    }
  }

  removeClothing(category) {
    switch (category) {
      case 'hat':
        this.clothingMeshes.hat.material = this.defaultMaterials.hat.clone();
        this.clothingMeshes.hat.material.visible = false;
        break;
      case 'top':
        this.clothingMeshes.top.material = this.defaultMaterials.top.clone();
        break;
      case 'bottom':
        this.clothingMeshes.bottom.forEach(m => {
          m.material = this.defaultMaterials.bottom.clone();
        });
        break;
      case 'shoes':
        this.clothingMeshes.shoes.forEach(m => {
          m.material = this.defaultMaterials.shoes.clone();
        });
        break;
    }
  }

  // ============================================================
  // 空闲动画循环
  // ============================================================

  startLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.updateAnimations(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  updateAnimations(dt) {
    const s = this.animState;

    // 呼吸
    s.breathPhase += dt * 2.5;
    const breathScale = 1 + Math.sin(s.breathPhase) * 0.015;
    this.breathGroup.scale.set(breathScale, 1 + Math.sin(s.breathPhase) * 0.012, breathScale);

    // 身体微晃
    s.swayPhase += dt * 1.2;
    this.swayGroup.rotation.z = Math.sin(s.swayPhase) * 0.03;
    this.swayGroup.rotation.x = Math.cos(s.swayPhase * 1.3) * 0.02;

    // 眨眼
    if (!s.blinkActive) {
      s.blinkTimer += dt;
      if (s.blinkTimer > 2.5 + Math.random() * 4) {
        s.blinkActive = true;
        s.blinkTimer = 0;
        s.blinkDuration = 0;
      }
    } else {
      s.blinkDuration += dt;
      const t = s.blinkDuration / 0.15; // 150ms 眨眼
      if (t >= 1) {
        this.eyeGroup.scale.y = 1;
        s.blinkActive = false;
      } else {
        // 快速闭合再张开
        const v = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
        this.eyeGroup.scale.y = Math.max(0.05, v);
      }
    }

    // 摸头发
    if (!s.hairTouchActive) {
      s.hairTouchTimer += dt;
      if (s.hairTouchTimer > 8 + Math.random() * 12) {
        s.hairTouchActive = true;
        s.hairTouchTimer = 0;
        s.hairTouchPhase = 0;
      }
    } else {
      s.hairTouchPhase += dt;
      const total = 2.0; // 2秒动画
      const t = s.hairTouchPhase / total;
      if (t >= 1) {
        s.hairTouchActive = false;
      }
      // 简单的手臂微动模拟
      // （完整实现需要骨骼系统，这里做简化版：头部微转）
      if (t < 0.3) {
        this.headGroup.rotation.z = THREE.MathUtils.lerp(0, 0.15, t / 0.3);
      } else if (t < 0.7) {
        this.headGroup.rotation.z = 0.15;
      } else {
        this.headGroup.rotation.z = THREE.MathUtils.lerp(0.15, 0, (t - 0.7) / 0.3);
      }
    }
  }

  // ============================================================
  // 响应窗口大小变化
  // ============================================================

  onResize() {
    const rect = this.viewportEl.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }
}
