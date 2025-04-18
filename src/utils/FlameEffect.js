import * as THREE from 'three';

export class FlameEffect {
  constructor(options = {}) {
    this.options = {
      position: options.position || new THREE.Vector3(0, 0, 0),
      size: options.size || 0.05,
      particleCount: options.particleCount || 100,
      color1: options.color1 || 0xff5500, // 深橙色
      color2: options.color2 || 0xff9500, // 橙色
      color3: options.color3 || 0xffff00, // 黄色
      height: options.height || 0.15,
      radius: options.radius || 0.02,
      flickerSpeed: options.flickerSpeed || 0.02,
      flickerIntensity: options.flickerIntensity || 0.1,
      lightIntensity: options.lightIntensity || 0.8,
      lightDistance: options.lightDistance || 0.2,
      lightDecay: options.lightDecay || 2,
    };

    this.particles = [];
    this.group = new THREE.Group();
    this.group.position.copy(this.options.position);
    this.time = 0;
    this.active = false;

    // 更新点光源配置
    this.light = new THREE.PointLight(
      0xff7700,
      this.options.lightIntensity,
      this.options.lightDistance,
      this.options.lightDecay
    );
    this.light.position.set(0, this.options.height * 0.3, 0);
    this.group.add(this.light);

    this._createParticles();
  }

  _createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    const lifetimes = [];
    const offsets = [];
    const turbulences = []; // 新增：湍流强度

    const color1 = new THREE.Color(this.options.color1);
    const color2 = new THREE.Color(this.options.color2);
    const color3 = new THREE.Color(this.options.color3);

    for (let i = 0; i < this.options.particleCount; i++) {
      // 使用抛物线分布使火焰更自然
      const t = i / this.options.particleCount;
      const radius = this.options.radius * Math.sqrt(1 - t) * Math.random();
      const theta = Math.random() * Math.PI * 2;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      const y = t * this.options.height;

      positions.push(x, y, z);

      // 改进颜色混合
      const heightRatio = y / this.options.height;
      let color;
      if (heightRatio < 0.3) {
        color = color1.clone().lerp(color2, Math.pow(heightRatio / 0.3, 0.5));
      } else {
        color = color2.clone().lerp(color3, Math.pow((heightRatio - 0.3) / 0.7, 2));
      }

      colors.push(color.r, color.g, color.b);
      
      // 粒子大小随高度变化
      const size = this.options.size * (1 - Math.pow(heightRatio, 1.5));
      sizes.push(size);
      
      lifetimes.push(Math.random());
      offsets.push(Math.random() * Math.PI * 2);
      // 添加湍流强度
      turbulences.push(Math.random() * 0.5 + 0.5);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('lifetime', new THREE.Float32BufferAttribute(lifetimes, 1));
    geometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsets, 1));
    geometry.setAttribute('turbulence', new THREE.Float32BufferAttribute(turbulences, 1));

    // 改进着色器
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        flickerSpeed: { value: this.options.flickerSpeed },
        flickerIntensity: { value: this.options.flickerIntensity },
        baseHeight: { value: this.options.height },
      },
      vertexShader: `
        attribute float size;
        attribute float lifetime;
        attribute float offset;
        attribute float turbulence;
        uniform float time;
        uniform float flickerSpeed;
        uniform float flickerIntensity;
        uniform float baseHeight;
        varying vec3 vColor;
        varying float vAlpha;
        
        // 改进的柏林噪声近似
        vec3 mod289(vec3 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        vec2 mod289(vec2 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        vec3 permute(vec3 x) {
          return mod289(((x*34.0)+1.0)*x);
        }
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187,
                         0.366025403784439,
                        -0.577350269189626,
                         0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                      + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          vColor = color;
          
          // 改进火焰运动
          float speed = 1.0 + turbulence * 0.5;
          float t = fract(lifetime + time * speed);
          
          // 复杂的火焰运动
          vec3 newPosition = position;
          
          // 使用改进的噪声函数
          float noiseTime = time * 2.0;
          float noiseX = snoise(vec2(noiseTime + offset, position.y * 4.0));
          float noiseZ = snoise(vec2(noiseTime + offset + 2.0, position.y * 4.0));
          
          // 螺旋上升 + 噪声
          float angle = time * 3.0 + offset + position.y * 8.0;
          float spiralRadius = turbulence * 0.003 * (1.0 - position.y / baseHeight);
          newPosition.x += sin(angle) * spiralRadius + noiseX * 0.003;
          newPosition.z += cos(angle) * spiralRadius + noiseZ * 0.003;
          
          // 上升运动
          float yOffset = sin(time * 4.0 + offset) * 0.001;
          newPosition.y = position.y * (1.0 - t) + (position.y + 0.02 + yOffset) * t;
          
          // 火焰摇曳
          float flicker = sin(time * flickerSpeed + offset) * flickerIntensity;
          
          // 计算透明度
          float heightRatio = newPosition.y / baseHeight;
          vAlpha = (1.0 - heightRatio * 1.2) * (1.0 - t * 0.8) * (1.0 + flicker);
          
          vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
          gl_PointSize = size * (1.0 - t * 0.3) * (1.0 + flicker) * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      // 修改片元着色器
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          // 改进的火焰形状
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          // 火焰形状
          float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;
          
          // 火焰亮度渐变
          float intensity = 1.0 - pow(dist * 2.0, 2.0);
          vec3 finalColor = vColor * (1.0 + intensity * 0.5);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.group.add(this.particleSystem);
  }

  update(deltaTime) {
    if (!this.active) return;
    
    this.time += deltaTime;
    if (this.particleSystem.material.uniforms) {
      this.particleSystem.material.uniforms.time.value = this.time;
    }

    // 更新点光源
    if (this.light) {
      const flicker = Math.sin(this.time * 15) * 0.15;
      const noise = (Math.random() - 0.5) * 0.1;
      this.light.intensity = this.options.lightIntensity * (1 + flicker + noise);
    }
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
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
      this.group.remove(this.particleSystem);
    }
    if (this.light) {
      this.group.remove(this.light);
    }
  }
}