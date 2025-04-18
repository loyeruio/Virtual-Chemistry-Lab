import * as THREE from 'three';

export class BubbleEffect {
  constructor(options = {}) {
    this.options = {
      container: options.container, // 容器网格
      particleCount: options.particleCount || 20,
      size: options.size || 0.002,
      speed: options.speed || 0.02,
      color: options.color || 0xffffff,
      opacity: options.opacity || 0.3,
      range: options.range || { x: 0.02, y: 0.04, z: 0.02 },
    };

    this.particles = [];
    this.group = new THREE.Group();
    this.active = false;
    this.time = 0;

    this._createBubbles();
  }

  _createBubbles() {
    const geometry = new THREE.SphereGeometry(1, 8, 8);
    const material = new THREE.MeshPhongMaterial({
      color: this.options.color,
      transparent: true,
      opacity: this.options.opacity,
      shininess: 100,
    });

    // 获取容器边界
    const box = new THREE.Box3().setFromObject(this.options.container);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    for (let i = 0; i < this.options.particleCount; i++) {
      const bubble = new THREE.Mesh(geometry, material.clone());
      bubble.scale.setScalar(this.options.size * (0.5 + Math.random() * 0.5));
      
      // 保存基础缩放值
      bubble.userData.baseScale = bubble.scale.x;
      
      // 随机初始位置
      this._resetBubblePosition(bubble, center, size, box); // 传入 box 参数
      
      // 添加随机速度和生命周期
      bubble.userData.velocity = this.options.speed * (0.5 + Math.random() * 0.5);
      bubble.userData.lifetime = Math.random();
      
      this.particles.push(bubble);
      this.group.add(bubble);
    }
  }

  _resetBubblePosition(bubble, center, size, box) { // 添加 box 参数
    const { range } = this.options;
    bubble.position.set(
      center.x + (Math.random() - 0.5) * range.x,
      box.min.y + Math.random() * range.y * 0.2, // 使用传入的 box
      center.z + (Math.random() - 0.5) * range.z
    );
  }

  update(deltaTime) {
    if (!this.active) return;

    this.time += deltaTime;
    const { range } = this.options;
    const box = new THREE.Box3().setFromObject(this.options.container);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    this.particles.forEach(bubble => {
      // 上升运动
      bubble.position.y += bubble.userData.velocity * deltaTime;
      
      // 随机水平运动
      bubble.position.x += Math.sin(this.time * 2 + bubble.userData.lifetime * Math.PI) * 0.0002;
      bubble.position.z += Math.cos(this.time * 2 + bubble.userData.lifetime * Math.PI) * 0.0002;
      
      // 如果超出范围，重置位置
      if (bubble.position.y > box.max.y - range.y * 0.1) {
        this._resetBubblePosition(bubble, center, size, box); // 传入 box 参数
      }
      
      // 更新气泡大小
      const scale = bubble.userData.baseScale * (1 + Math.sin(this.time * 3 + bubble.userData.lifetime * Math.PI) * 0.1);
      bubble.scale.setScalar(scale);
    });
  }

  start() {
    this.active = true;
    return this;
  }

  stop() {
    this.active = false;
    return this;
  }

  dispose() {
    this.particles.forEach(bubble => {
      bubble.geometry.dispose();
      bubble.material.dispose();
      this.group.remove(bubble);
    });
    this.particles = [];
  }
}