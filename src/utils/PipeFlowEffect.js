import * as THREE from 'three';

export class PipeFlowEffect {
  constructor({ mesh, textureUrl, speed = 0.003, opacity = 0.7 }) {
    this.mesh = mesh;
    this.speed = speed;
    this.offset = 0;

    // 加载贴图
    const loader = new THREE.TextureLoader();
    loader.load(textureUrl, (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      this.material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      this.mesh.material = this.material;
      this.texture = texture;
    });

    this._animate = this._animate.bind(this);
    this._running = false;
  }

  start() {
    if (!this._running) {
      this._running = true;
      this._animate();
    }
  }

  stop() {
    this._running = false;
  }

  _animate() {
    if (!this._running) return;
    if (this.texture) {
      this.offset += this.speed;
      this.texture.offset.x = this.offset; // 确保贴图沿着管道流动
      // 如果管道是弯曲的，可能需要调整offset.y
    }
    requestAnimationFrame(this._animate);
  }
}