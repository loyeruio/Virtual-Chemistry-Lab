import * as THREE from 'three';

/**
 * 内部填充模拟类
 */
export class InternalSimulation {
  constructor(scene, model, config = {}) {
    this.scene = scene;
    this.model = model;
    this.config = {
      fillHeight: config.fillHeight || 0.5, // 填充高度（0到1，相对瓶子高度）
      scaleFactor: config.scaleFactor || 0.95, // 缩小比例
      color: config.color || 0x00aaff, // 默认青色
      opacity: config.opacity || 0.7, // 透明度
    };
    this.fillingMesh = null;
  }

  /**
   * 执行内部填充
   */
  fill() {
    // 移除旧的填充
    if (this.fillingMesh) {
      this.scene.remove(this.fillingMesh);
      this.fillingMesh.geometry.dispose();
      this.fillingMesh.material.dispose();
    }

    // 获取瓶子几何
    const sourceGeometry = this.model.geometry.clone();
    const bbox = new THREE.Box3().setFromObject(this.model);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    // 计算世界坐标高度范围
    const worldMaxY = bbox.max.y;
    const worldMinY = bbox.min.y;
    const worldAbsoluteHeight = worldMinY + this.config.fillHeight * (worldMaxY - worldMinY);

    console.log(`世界高度范围: ${worldMinY.toFixed(3)} 到 ${worldMaxY.toFixed(3)}, 填充高度: ${worldAbsoluteHeight.toFixed(3)}`);

    // 获取顶点（本地坐标）
    const positionAttribute = sourceGeometry.attributes.position;
    const vertices = new Float32Array(positionAttribute.array);
    const indices = sourceGeometry.index ? new Float32Array(sourceGeometry.index.array) : null;

    // 检查瓶子旋转
    console.log(`瓶子旋转: [${this.model.rotation.x.toFixed(3)}, ${this.model.rotation.y.toFixed(3)}, ${this.model.rotation.z.toFixed(3)}]`);

    // 创建一个新的几何体，使用原始几何体的顶点
    const fillingGeometry = new THREE.BufferGeometry();
    fillingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (indices && indices.length > 0) {
      fillingGeometry.setIndex(Array.from(indices));
    }

    // 创建一个临时网格来应用裁剪
    const tempMesh = new THREE.Mesh(fillingGeometry);
    
    // 创建裁剪平面 - 使用本地坐标系
    // 将世界坐标的裁剪高度转换回本地坐标
    const modelMatrixInverse = new THREE.Matrix4().copy(this.model.matrixWorld).invert();
    const localHeight = new THREE.Vector3(0, worldAbsoluteHeight, 0).applyMatrix4(modelMatrixInverse).y;
    
    console.log(`本地坐标裁剪高度: ${localHeight.toFixed(3)}`);
    
    // 使用BSP进行几何裁剪
    const planeGeometry = new THREE.PlaneGeometry(size.x * 2, size.z * 2);
    planeGeometry.rotateX(Math.PI / 2); // 使平面朝上
    planeGeometry.translate(0, localHeight, 0);
    
    // 创建裁剪后的几何体
    const clippedGeometry = this.clipGeometryByPlane(fillingGeometry, planeGeometry, true);
    
    // 缩小几何体
    const scaledGeometry = clippedGeometry.clone();
    const positions = scaledGeometry.attributes.position.array;
    
    // 计算几何中心（本地坐标）
    let geoCenter = new THREE.Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      geoCenter.x += positions[i];
      geoCenter.y += positions[i + 1];
      geoCenter.z += positions[i + 2];
    }
    geoCenter.divideScalar(positions.length / 3);
    
    // 缩小几何（本地坐标）
    for (let i = 0; i < positions.length; i += 3) {
      const localX = positions[i] - geoCenter.x;
      const localY = positions[i + 1] - geoCenter.y;
      const localZ = positions[i + 2] - geoCenter.z;
      positions[i] = geoCenter.x + localX * this.config.scaleFactor;
      positions[i + 1] = geoCenter.y + localY * this.config.scaleFactor;
      positions[i + 2] = geoCenter.z + localZ * this.config.scaleFactor;
    }
    
    scaledGeometry.computeVertexNormals();
    
    // 创建材质
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      transparent: true,
      opacity: this.config.opacity,
      side: THREE.DoubleSide,
    });

    // 创建填充 Mesh
    this.fillingMesh = new THREE.Mesh(scaledGeometry, material);
    this.fillingMesh.name = 'fillingMesh';
    
    // 应用与原模型相同的变换
    this.fillingMesh.position.copy(this.model.position);
    this.fillingMesh.rotation.copy(this.model.rotation);
    this.fillingMesh.scale.copy(this.model.scale);
    this.fillingMesh.updateMatrixWorld();

    this.scene.add(this.fillingMesh);

    console.log(`填充几何顶点数: ${scaledGeometry.attributes.position.count}, 三角面数: ${scaledGeometry.index ? scaledGeometry.index.count / 3 : 0}`);
  }

  /**
   * 使用平面裁剪几何体
   * @param {THREE.BufferGeometry} geometry 要裁剪的几何体
   * @param {THREE.PlaneGeometry} planeGeometry 裁剪平面
   * @param {boolean} keepBelow 是否保留平面以下部分
   * @returns {THREE.BufferGeometry} 裁剪后的几何体
   */
  clipGeometryByPlane(geometry, planeGeometry, keepBelow = true) {
    // 创建临时网格
    const mesh = new THREE.Mesh(geometry);
    const plane = new THREE.Mesh(planeGeometry);
    
    // 获取平面法线和点
    const planeNormal = new THREE.Vector3(0, 1, 0);
    const planePoint = new THREE.Vector3(0, planeGeometry.attributes.position.array[1], 0);
    
    // 裁剪几何体
    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    
    const newPositions = [];
    const newIndices = [];
    const vertexMap = new Map();
    
    // 收集有效顶点
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      if ((keepBelow && y <= planePoint.y) || (!keepBelow && y >= planePoint.y)) {
        const index = i / 3;
        vertexMap.set(index, newPositions.length / 3);
        newPositions.push(positions[i], positions[i + 1], positions[i + 2]);
      }
    }
    
    // 处理三角面
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i];
        const b = indices[i + 1];
        const c = indices[i + 2];
        
        const vaY = positions[a * 3 + 1];
        const vbY = positions[b * 3 + 1];
        const vcY = positions[c * 3 + 1];
        
        const condition = keepBelow ? 
          (vaY <= planePoint.y && vbY <= planePoint.y && vcY <= planePoint.y) :
          (vaY >= planePoint.y && vbY >= planePoint.y && vcY >= planePoint.y);
          
        if (condition) {
          const newA = vertexMap.get(a);
          const newB = vertexMap.get(b);
          const newC = vertexMap.get(c);
          if (newA !== undefined && newB !== undefined && newC !== undefined) {
            newIndices.push(newA, newB, newC);
          }
        }
      }
    } else {
      for (let i = 0; i < positions.length / 9; i++) {
        const baseIndex = i * 9;
        const vaY = positions[baseIndex + 1];
        const vbY = positions[baseIndex + 4];
        const vcY = positions[baseIndex + 7];
        
        const condition = keepBelow ? 
          (vaY <= planePoint.y && vbY <= planePoint.y && vcY <= planePoint.y) :
          (vaY >= planePoint.y && vbY >= planePoint.y && vcY >= planePoint.y);
          
        if (condition) {
          const a = baseIndex / 3;
          const b = (baseIndex / 3) + 1;
          const c = (baseIndex / 3) + 2;
          const newA = vertexMap.get(a);
          const newB = vertexMap.get(b);
          const newC = vertexMap.get(c);
          if (newA !== undefined && newB !== undefined && newC !== undefined) {
            newIndices.push(newA, newB, newC);
          }
        }
      }
    }
    
    // 创建新几何体
    const clippedGeometry = new THREE.BufferGeometry();
    if (newPositions.length === 0) {
      console.warn('裁剪后没有有效顶点！');
      return geometry.clone();
    }
    
    clippedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    if (newIndices.length > 0) {
      clippedGeometry.setIndex(newIndices);
    }
    
    clippedGeometry.computeVertexNormals();
    return clippedGeometry;
  }

  /**
   * 更新填充（例如模型移动后）
   */
  update() {
    if (this.fillingMesh) {
      this.fillingMesh.position.copy(this.model.position);
      this.fillingMesh.rotation.copy(this.model.rotation);
      this.fillingMesh.scale.copy(this.model.scale);
      this.fillingMesh.updateMatrixWorld();
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    if (this.fillingMesh) {
      this.scene.remove(this.fillingMesh);
      this.fillingMesh.geometry.dispose();
      this.fillingMesh.material.dispose();
      this.fillingMesh = null;
    }
  }
}

/**
 * 初始化内部填充
 */
export function initInternalSimulation(scene, model, config = {}) {
  const simulation = new InternalSimulation(scene, model, config);
  simulation.fill();
  return simulation;
}