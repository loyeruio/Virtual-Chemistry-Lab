import * as THREE from 'three';
import * as dat from 'dat.gui';
import Stats from 'stats.js';

// 默认参数
const defaultParams = {
  liquidVolume: 0.5, // 液体体积（0到1）
  resolution: 15, // 网格分辨率
  liquidColor: 0x00aaff, // 液体颜色
};

// 液体形状模拟类
export class FluidSimulation {
  constructor({
    container,
    liquidColor = 0x00aaff,
    liquidVolume = 0.5,
    scene,
    camera,
    renderer,
  }) {
    this.params = { ...defaultParams, liquidColor, liquidVolume };
    this.container = container;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.stats = new Stats();
    this.gui = new dat.GUI({ autoPlace: false });
    this.liquidMesh = null;

    this.init();
  }

  init() {
    // 添加灯光（避免重复添加）
    if (!this.scene.getObjectByName('ambientLight')) {
      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      ambientLight.name = 'ambientLight';
      this.scene.add(ambientLight);
    }
    if (!this.scene.getObjectByName('directionalLight')) {
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(1, 1, 1).normalize();
      directionalLight.name = 'directionalLight';
      this.scene.add(directionalLight);
    }

    this.initLiquidShape();
    this.setupGUI();
    document.body.appendChild(this.stats.dom);
    this.animate();
  }

  initLiquidShape() {
    // 获取烧杯边界
    const bounds = new THREE.Box3().setFromObject(this.container);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const center = bounds.getCenter(new THREE.Vector3());

    // 确定烧杯底部高度
    const raycaster = new THREE.Raycaster();
    raycaster.set(center.clone().setY(bounds.max.y), new THREE.Vector3(0, -1, 0));
    const intersects = raycaster.intersectObject(this.container, true);
    const bottomY = intersects.length > 0 ? intersects[0].point.y : bounds.min.y;

    // 确定烧杯半径（假设圆柱形）
    const radius = Math.min(size.x, size.z) / 2 * 1.9; // 缩小 10% 确保水体在烧杯内
    const liquidHeight = size.y * this.params.liquidVolume;
    const { resolution } = this.params;

    // 创建圆柱形水体几何
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const normals = [];

    const vertexMap = new Map();
    let vertexIndex = 0;

    // 顶面和底面顶点
    const topVertices = new Map();
    const bottomVertices = new Map();

    // 生成圆柱侧面顶点
    for (let angle = 0; angle < 2 * Math.PI; angle += (2 * Math.PI) / resolution) {
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);

      // 底面顶点
      vertices.push(x, 0, z);
      normals.push(0, -1, 0);
      const bottomKey = `${x.toFixed(2)},${z.toFixed(2)}`;
      bottomVertices.set(bottomKey, vertexIndex++);

      // 顶面顶点
      vertices.push(x, liquidHeight, z);
      normals.push(0, 1, 0);
      const topKey = `${x.toFixed(2)},${z.toFixed(2)}`;
      topVertices.set(topKey, vertexIndex++);
    }

    // 中心点（底面和顶面）
    vertices.push(0, 0, 0); // 底面中心
    normals.push(0, -1, 0);
    const bottomCenterIndex = vertexIndex++;

    vertices.push(0, liquidHeight, 0); // 顶面中心
    normals.push(0, 1, 0);
    const topCenterIndex = vertexIndex++;

    // 侧面三角形
    for (let i = 0; i < resolution; i++) {
      const i0 = i * 2;
      const i1 = ((i + 1) % resolution) * 2;
      const i2 = i0 + 1;
      const i3 = i1 + 1;

      // 侧面
      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);

      // 底面
      indices.push(bottomCenterIndex, i1, i0);

      // 顶面
      indices.push(topCenterIndex, i2, i3);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // 简单材质，仅颜色
    const material = new THREE.MeshBasicMaterial({
      color: this.params.liquidColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    this.liquidMesh = new THREE.Mesh(geometry, material);
    this.liquidMesh.position.y = bottomY - center.y; // 调整到烧杯底部
    this.container.add(this.liquidMesh);
  }

  setupGUI() {
    const guiContainer = document.createElement('div');
    guiContainer.style.position = 'absolute';
    guiContainer.style.top = '10px';
    guiContainer.style.right = '10px';
    document.body.appendChild(guiContainer);
    guiContainer.appendChild(this.gui.domElement);

    this.gui.add(this.params, 'liquidVolume', 0, 1).name('液体体积').onChange(() => this.resetLiquidShape());
    this.gui.add(this.params, 'resolution', 10, 30, 1).name('网格分辨率').onChange(() => this.resetLiquidShape());
    this.gui.addColor(this.params, 'liquidColor').name('液体颜色').onChange(() => this.updateMaterial());
  }

  updateMaterial() {
    if (this.liquidMesh) {
      this.liquidMesh.material.color.set(this.params.liquidColor);
    }
  }

  resetLiquidShape() {
    this.container.remove(this.liquidMesh);
    this.initLiquidShape();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.stats.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.container.remove(this.liquidMesh);
    this.stats.dom.remove();
    this.gui.destroy();
  }

  setContainerRotation(x, y) {
    this.container.rotation.x = x;
    this.container.rotation.y = y;
  }
}