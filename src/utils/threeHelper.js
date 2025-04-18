import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 添加导入碰撞相关模块
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';


// 在文件顶部添加全局碰撞体缓存
const colliderCache = [];
/**
 * 创建 Three.js 场景
 * @param {HTMLElement} container - 容器元素
 * @returns {Object} 包含场景、相机、渲染器等对象
 */
export function createScene(container) {
  // 创建场景
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // 获取容器尺寸
  const width = container.clientWidth;
  const height = container.clientHeight;

  // 创建相机
  const camera = new THREE.PerspectiveCamera(
    60, // 减小FOV，使视野更集中
    width / height,
    0.1,
    1000
  );
  // 设置相机初始位置
  camera.position.set(4.45179922813061, 1.298441553000395, -4.99213612059558);

  // 设置相机看向方向
  const lookAtDirection = new THREE.Vector3(-0.011643051922633258, 0.010944584565890847, 0.9998723195541555);
  const lookAtPos = new THREE.Vector3().addVectors(camera.position, lookAtDirection);
  camera.lookAt(lookAtPos);

  // 创建渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // 添加环境光和方向光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // 添加轨道控制器
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 20;

  // 窗口大小变化时调整渲染器和相机
  const handleResize = () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  };
  window.addEventListener('resize', handleResize);

  let customAnimates = [];
  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    customAnimates.forEach(fn => fn && fn());
  };
  animate();

  return {
    scene,
    camera,
    renderer,
    controls,
    setCustomAnimates: (arr) => { customAnimates = arr || []; },
    dispose: () => {
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    }
  };
}

/**
 * 为模型添加碰撞体
 * @param {THREE.Object3D} model - 模型对象
 * @param {Object} collisionConfig - 碰撞体配置
 */
export function addColliders(model, collisionConfig = {}) {
  // 需要添加三角面碰撞体的物体名称列表
  // 在 addColliders 函数中更新 triangleColliderObjects 数组
  const triangleColliderObjects = collisionConfig.triangleColliders || [
    'SeparateSeparatingFunnel_Body', 'SeparateSeparatingFunnel_CockCover', 'SeparateSeparatingFunnel_GlassStoppers', // 分液漏斗
    'RoundBottomFlask_50ml', // 圆底烧瓶
    'Alcohol_lamp001', 'Alcohol_lamp001_1', 'Alcohol_lamp001_2', 'Alcohol_lamp001_3', 'Alcohol_lamp_cap', // 酒精灯
    'IronSupport_1', 'IronSupport_2', // 铁架台
    'Catheter_long', 'Catheter_long001', 'Catheter_long002', 'Catheter_long003', 'Catheter_longlong001', // 玻璃管
    'Catheter_short', 'Catheter_short001', 'Catheter_short002', // 玻璃管
    'RubberSeal', 'RubberSeal001', 'RubberSeal002', 'RubberSeal003', // 橡胶塞
    'RubberValve004', 'RubberValve005', 'RubberValve006', 'RubberValve007', // 橡胶阀
    'Beaker_50ml', // 烧杯
    'WildMouthBottle001', 'WildMouthBottle002', 'WildMouthBottle003' // 广口瓶
  ];

  // 碰撞体可见性（调试用）
  const collidersVisible = collisionConfig.collidersVisible || false;
  
  // 碰撞体材质
  const colliderMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    visible: collidersVisible
  });

  // 收集所有需要添加碰撞体的网格，避免在遍历过程中修改结构
  const meshesToProcess = [];
  
  // 首先遍历模型收集所有网格
  model.traverse((child) => {
    // 跳过RubberSeal及其变体
    if (
      child.isMesh &&
      !child.userData.isCollider
    ) {
      meshesToProcess.push(child);
    }
  });
  
  // 然后为收集到的网格添加碰撞体
  for (const mesh of meshesToProcess) {
    console.log(`为物体 ${mesh.name} 添加碰撞体`);
    
    // 判断是否需要添加三角面碰撞体
    if (triangleColliderObjects.includes(mesh.name)) {
      // 创建三角面碰撞体
      addTriangleCollider(mesh, colliderMaterial);
    } else {
      // 创建普通碰撞体（包围盒）
      addBoundingBoxCollider(mesh, colliderMaterial);
    }
  }
}

/**
 * 为物体添加三角面碰撞体 - 优化版
 * @param {THREE.Mesh} mesh - 网格对象
 * @param {THREE.Material} material - 碰撞体材质
 */
function addTriangleCollider(mesh, material) {
  if (mesh.userData.hasColliders) return;
  mesh.userData.hasColliders = true;

  const geometry = mesh.geometry;
  if (!geometry.index) {
    console.warn(`${mesh.name} 没有索引几何体，无法创建三角网格碰撞体`);
    addBoundingBoxCollider(mesh, material);
    return;
  }

  try {
    // 只为外壁添加碰撞体
    const outerGeometry = geometry.clone();
    const worldMatrix = mesh.matrixWorld.clone();
    outerGeometry.applyMatrix4(worldMatrix);

    const outerCollider = new THREE.Mesh(outerGeometry, material.clone());
    outerCollider.name = `${mesh.name}_outerCollider`;
    outerCollider.userData.isCollider = true;
    outerCollider.userData.isOuterCollider = true;
    outerCollider.userData.originalMeshName = mesh.name;
    outerCollider.userData.originalMeshUUID = mesh.uuid;
    outerCollider.position.set(0, 0, 0);
    outerCollider.quaternion.set(0, 0, 0, 1);
    outerCollider.scale.set(1, 1, 1);
    mesh.parent.add(outerCollider);

    // 不再生成内层碰撞体
  } catch (e) {
    console.warn(`无法为 ${mesh.name} 创建三角面碰撞体:`, e);
    addBoundingBoxCollider(mesh, material);
  }
}

/**
 * 将场景中的物体添加到物理世界
 * @param {THREE.Scene} scene 
 * @param {THREE.Object3D} model 
 */
function addSceneObjectsToPhysicsWorld(scene, model) {
  const world = getCannonWorld();
  
  // 需要添加物理碰撞体的物体名称列表
  const physicsObjects = [
    'SeparateSeparatingFunnel_Body',
    'RoundBottomFlask_50ml', 
    'Beaker_50ml',
    'WildMouthBottle001', 'WildMouthBottle002', 'WildMouthBottle003',
    'LaboratoryTable001_1', 'LaboratoryTable001_2', 'LaboratoryTable001_3', 'LaboratoryTable001_4'
  ];
  
  model.traverse((object) => {
    if (object.isMesh && physicsObjects.includes(object.name) && !object.userData.hasPhysicsBody) {
      object.userData.hasPhysicsBody = true;

      if (object.name === 'RoundBottomFlask_50ml') {
        const geometry = object.geometry;
        // 1. 获取顶点并应用世界变换
        const position = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const worldVertices = [];
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i);
          vertex.applyMatrix4(object.matrixWorld);
          worldVertices.push(vertex.x, vertex.y, vertex.z);
        }
        const cannonVertices = new Float32Array(worldVertices);
      
        // 2. 获取索引
        let indices = geometry.index ? geometry.index.array : null;
        let cannonIndices;
        if (indices) {
          cannonIndices = new Int16Array(indices);
        } else {
          cannonIndices = new Int16Array(position.count);
          for (let i = 0; i < position.count; i++) {
            cannonIndices[i] = i;
          }
        }
      
        // 3. 创建Trimesh
        const shape = new CANNON.Trimesh(cannonVertices, cannonIndices);
      
        // 4. 创建物理刚体，位置设为(0,0,0)
        const body = new CANNON.Body({
          mass: 0,
          shape: shape,
          material: world.materials ? world.materials.glass : undefined
        });
        body.position.set(0, 0, 0);
        body.quaternion.set(0, 0, 0, 1);
      
        world.addBody(body);
        object.userData.physicsBody = body;
        console.log(`为 ${object.name} 添加了Trimesh物理碰撞体`);
        
        
      } else {
        // 其它物体仍然用Box
        const bbox = new THREE.Box3().setFromObject(object);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        const body = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2)),
          material: world.materials ? world.materials.glass : undefined
        });

        body.position.copy(center);

        const worldQuat = new THREE.Quaternion();
        object.getWorldQuaternion(worldQuat);
        body.quaternion.copy(worldQuat);

        world.addBody(body);
        object.userData.physicsBody = body;
        console.log(`为 ${object.name} 添加了物理碰撞体`);
      }
    }
  });
}

/**
 * 为物体添加包围盒碰撞体
 * @param {THREE.Mesh} mesh - 网格对象
 * @param {THREE.Material} material - 碰撞体材质
 */
function addBoundingBoxCollider(mesh, material) {
  // 如果已经有碰撞体，则不再添加
  if (mesh.userData.hasColliders) return;
  
  // 标记该网格已经添加了碰撞体
  mesh.userData.hasColliders = true;
  
  try {
    // 计算包围盒（在世界坐标系中）
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    
    // 创建包围盒几何体
    const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const boxCollider = new THREE.Mesh(boxGeometry, material.clone());
    
    // 设置碰撞体属性
    boxCollider.name = `${mesh.name}_boxCollider`;
    boxCollider.userData.isCollider = true;
    boxCollider.userData.isOuterCollider = true; // 与三角面碰撞体保持一致
    boxCollider.userData.originalMeshName = mesh.name;
    boxCollider.userData.originalMeshUUID = mesh.uuid;
    
    // 重要：将碰撞体添加到父节点，与三角面碰撞体保持一致
    // 并设置世界位置
    boxCollider.position.copy(center);
    boxCollider.quaternion.set(0, 0, 0, 1);
    boxCollider.scale.set(1, 1, 1);
    
    // 将碰撞体添加到场景而非原始网格
    mesh.parent.add(boxCollider);
    
    console.log(`为 ${mesh.name} 创建了包围盒碰撞体`);
  } catch (e) {
    console.warn(`无法为 ${mesh.name} 创建包围盒碰撞体:`, e);
  }
}

/**
 * 加载 GLTF/GLB 模型
 * @param {string} url - 模型文件路径
 * @param {THREE.Scene} scene - Three.js 场景
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 加载选项
 * @returns {Promise} 加载完成的 Promise
 */
export function loadModel(url, scene, onProgress = null, options = {}) {
  const loader = new GLTFLoader();
  
  // 设置 DRACO 加载器
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');  // 设置 DRACO 解码器路径
  loader.setDRACOLoader(dracoLoader);
  
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        const modelName = url.split('/').pop();
        
        console.log(`----- 模型 ${modelName} 信息 -----`);
        
        // 打印模型中的所有物体名称
        console.log(`\n【${modelName}】物体列表:`);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            console.log(`物体: ${child.name || '未命名'}, 类型: ${child.type}`);
          } else if (child.isObject3D) {
            console.log(`对象: ${child.name || '未命名'}, 类型: ${child.type}`);
          }
        });
        
        // 打印模型中的所有动画名称
        if (gltf.animations && gltf.animations.length > 0) {
          console.log(`\n【${modelName}】动画列表:`);
          gltf.animations.forEach((animation, index) => {
            console.log(`动画 ${index}: ${animation.name || '未命名'}`);
          });
        } else {
          console.log(`\n【${modelName}】没有动画`);
        }
        
        console.log(`----- ${modelName} 信息结束 -----\n`);
        
        // 添加到场景
        scene.add(model);
        
        // 如果是实验室模型，添加碰撞体并更新缓存
        if (modelName === 'lab.glb' && options.addColliders !== false) {
          try {
            addColliders(model, options.collisionConfig);
            updateColliderCache(scene); // 更新碰撞体缓存
          } catch (error) {
            console.error(`为模型 ${modelName} 添加碰撞体失败:`, error);
          }
        }
        
        // 将动画信息也一并返回
        resolve({
          model: model,
          animations: gltf.animations || []
        });
      },
      (progress) => {
        if (onProgress) {
          const percentComplete = Math.round((progress.loaded / progress.total) * 100);
          onProgress(percentComplete, url);
        }
      },
      (error) => {
        console.error(`模型加载失败: ${url}`, error);
        reject(error);
      }
    );
  });
}

/**
 * 调整相机以适应模型
 * @param {THREE.Object3D} model - 加载的模型
 * @param {THREE.Camera} camera - 相机
 * @param {THREE.OrbitControls} controls - 轨道控制器
 */
export function fitCameraToModel(model, camera, controls) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // 计算合适的相机位置
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  
  // 减小额外距离系数，使相机更靠近模型
  cameraZ *= 1.2;
  
  // 更新相机位置和目标
  camera.position.set(center.x, center.y + size.y / 3, center.z + cameraZ);
  controls.target.set(center.x, center.y, center.z);
  controls.update();
}

/**
 * 检测碰撞
 * @param {THREE.Raycaster} raycaster - 射线投射器
 * @param {THREE.Scene} scene - 场景
 * @returns {Array} 碰撞结果
 */
export function detectCollisions(raycaster, scene) {
  // 仅在必要时更新碰撞体缓存
  if (colliderCache.length === 0) {
    scene.traverse((object) => {
      if (object.userData && object.userData.isCollider) {
        colliderCache.push(object);
      }
    });
  }
  
  // 使用缓存的碰撞体进行碰撞检测
  return raycaster.intersectObjects(colliderCache, false);
}


/**
 * 获取模型中的特定物体
 * @param {THREE.Object3D} model - 模型
 * @param {string} name - 物体名称
 * @returns {THREE.Object3D} 找到的物体
 */
export function getObjectByName(model, name) {
  let result = null;
  model.traverse((object) => {
    if (object.name === name) {
      result = object;
    }
  });
  return result;
}



/**
 * 更新碰撞体缓存（在模型加载或碰撞体变化时调用）
 * @param {THREE.Scene} scene - 场景
 */
export function updateColliderCache(scene) {
  colliderCache.length = 0; // 清空缓存
  scene.traverse((object) => {
    if (object.userData && object.userData.isCollider) {
      colliderCache.push(object);
    }
  });
}


/**
 * 在分液漏斗嘴部添加粒子下落效果
 * @param {THREE.Scene} scene - threejs 场景
 * @param {THREE.Object3D} model - lab.glb 模型根节点
 * @param {boolean} enabled - 是否启用粒子效果
 * @returns {THREE.Points|null} 返回粒子对象，便于后续移除
 */
export function setFunnelParticles(scene, model, enabled) {
  // 先移除已存在的粒子
  const old = scene.getObjectByName('FunnelParticles');
  if (old) scene.remove(old);

  if (!enabled) return null;

  // 找到分液漏斗主体
  const funnel = getObjectByName(model, 'SeparateSeparatingFunnel_Body');
  if (!funnel || !funnel.isMesh) return null;

  // 直接用模型原点的世界坐标作为嘴部
  const mouthWorldPos = new THREE.Vector3();
  funnel.getWorldPosition(mouthWorldPos);

  // 创建粒子几何体
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < particleCount; i++) {
    positions.push(
      mouthWorldPos.x,
      mouthWorldPos.y + 0.05,
      mouthWorldPos.z
    );
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  // 粒子材质（球形贴图）
  const textureLoader = new THREE.TextureLoader();
  const circleTexture = textureLoader.load('/textures/white_circle.png');
  const material = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 0.008,
    map: circleTexture,
    alphaTest: 0.5,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  
  // 创建粒子对象
  const points = new THREE.Points(geometry, material);
  points.name = 'FunnelParticles';

  // 添加到场景
  scene.add(points);
  console.log('添加粒子到场景', points);
  // 简单动画：每帧下落并循环
  points.tick = function () {
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) - 0.01); // 下落
      // 如果粒子低于一定高度则重置
      if (pos.getY(i) < mouthWorldPos.y - 0.2) {
        pos.setY(i, mouthWorldPos.y);
      }
    }
    pos.needsUpdate = true;
  };

  return points;
}

// 新增：物理世界单例
let cannonWorld = null;
export function getCannonWorld() {
  if (!cannonWorld) {
    cannonWorld = new CANNON.World();
    cannonWorld.gravity.set(0, -3, 0); // 减小重力
    cannonWorld.defaultContactMaterial.friction = 0.3;
    cannonWorld.defaultContactMaterial.restitution = 0.2;
    
    // 添加特殊材质
    cannonWorld.materials = {
      glass: new CANNON.Material('glass'),
      metal: new CANNON.Material('metal')
    };
    
    // 设置材质间交互
    cannonWorld.addContactMaterial(
      new CANNON.ContactMaterial(
        cannonWorld.materials.glass,
        cannonWorld.materials.glass,
        { restitution: 0.2, friction: 0.3 }
      )
    );
  }
  return cannonWorld;
}

/**
 * 在分液漏斗嘴部添加实体化小球粒子（cannon-es物理）
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D} model
 * @param {boolean} enabled
 * @param {Object} options - 粒子选项
 * @param {number} options.radius - 粒子半径，默认0.01
 * @param {number} options.color - 粒子颜色，默认红色
 * @param {number} options.spawnRate - 粒子生成概率，0-1之间，默认0.1
 * @returns {Object|null} { meshes, bodies, tick }
 */
export function setFunnelBallParticles(scene, model, enabled, options = {}) {
  // 先移除已存在的粒子
  if (scene.userData.funnelBallParticles) {
    scene.userData.funnelBallParticles.meshes.forEach(mesh => scene.remove(mesh));
    scene.userData.funnelBallParticles.bodies.forEach(body => getCannonWorld().removeBody(body));
    scene.userData.funnelBallParticles = null;
  }
  if (!enabled) return null;

  // 默认选项
  const particleOptions = {
    radius: options.radius || 0.01,
    color: options.color || 0xff0000,
    spawnRate: options.spawnRate || 0.1
  };

  const funnel = getObjectByName(model, 'SeparateSeparatingFunnel_Body');
  if (!funnel || !funnel.isMesh) return null;

  // 漏斗嘴部世界坐标
  const mouthWorldPos = new THREE.Vector3();
  funnel.getWorldPosition(mouthWorldPos);

  // 物理世界 - 确保重力设置正确
  const world = getCannonWorld();
  world.gravity.set(0, -9.82, 0); // 确保重力方向向下

  // 创建地面碰撞体 - 放在更低的位置
  if (!scene.userData.funnelBallParticles_ground) {
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      position: new CANNON.Vec3(0, 0, 0), // 调整地面位置，使其在实验台下方
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    scene.userData.funnelBallParticles_ground = groundBody;
  }

  // 将场景中的其他物体添加到物理世界 - 取消注释这一行
  addSceneObjectsToPhysicsWorld(scene, model);

  const meshes = [];
  const bodies = [];
  
  // 创建一个新粒子的函数
  function addNewParticle() {
    const radius = particleOptions.radius;
    
    // 添加随机偏移，使粒子不会完全重叠
    const randomOffset = {
      x: 0,
      z: 0
    };
    
    // 修改：使用透明、似水的材质
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x66ccff,           // 淡蓝色
        transparent: true,
        opacity: 0.6,              // 半透明
        metalness: 0.0,            // 非金属
        roughness: 0.15,           // 微微粗糙
        transmission: 0.9,         // 透光性（玻璃/水珠效果）
        thickness: 0.01,           // 厚度
        ior: 1.33,                 // 折射率，水约为1.33
        reflectivity: 0.1,         // 低反射
        clearcoat: 1.0,            // 清漆层
        clearcoatRoughness: 0.05
      })
    );
    
    // 设置初始位置，添加随机偏移
    mesh.position.set(
      mouthWorldPos.x + randomOffset.x, 
      mouthWorldPos.y - 0.01, 
      mouthWorldPos.z + randomOffset.z
    );
    scene.add(mesh);
    meshes.push(mesh);

    // Cannon Body - 确保质量足够大以受重力影响
    const body = new CANNON.Body({
      mass: 0.1, // 增加质量，使重力效果更明显
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      linearDamping: 0.1, // 增加阻尼，使运动更自然
      material: new CANNON.Material({ restitution: 0.3 }) // 添加弹性
    });
    
    // 添加初始速度 - 向下的轻微初速度
    body.velocity.set(
      randomOffset.x * 2, 
      -0.01, // 减小向下的初速度
      randomOffset.z * 2
    );
    
    world.addBody(body);
    bodies.push(body);
    
    // 如果粒子太多，移除最早的粒子
    if (meshes.length > 50) {
      const oldMesh = meshes.shift();
      const oldBody = bodies.shift();
      scene.remove(oldMesh);
      world.removeBody(oldBody);
    }
  }

  // 初始添加一个粒子
  addNewParticle();

  // tick函数：每帧同步物理和Three.js
  function tick() {
    // 确保物理世界每帧都更新
    world.step(1 / 60);
    
    // 每隔一定帧数添加新粒子
    if (Math.random() < particleOptions.spawnRate) {
      addNewParticle();
    }
    
    // 同步所有粒子位置和旋转
    for (let i = 0; i < meshes.length; i++) {
      if (meshes[i] && bodies[i]) {
        // 检查粒子是否掉得太远，如果是则移除
        if (bodies[i].position.y < mouthWorldPos.y - 5) {
          scene.remove(meshes[i]);
          world.removeBody(bodies[i]);
          meshes.splice(i, 1);
          bodies.splice(i, 1);
          i--;
          continue;
        }
        
        // 更新网格位置和旋转
        meshes[i].position.copy(bodies[i].position);
        meshes[i].quaternion.copy(bodies[i].quaternion);
      }
    }
  }

  // 记录到scene，便于后续移除
  scene.userData.funnelBallParticles = { 
    meshes, 
    bodies, 
    tick,
    addNewParticle,
    options: particleOptions
  };

  return scene.userData.funnelBallParticles;
}

/**
 * 在圆底烧瓶中创建物理小球
 * @param {THREE.Scene} scene - Three.js 场景
 * @param {THREE.Mesh} flask - 圆底烧瓶网格
 * @param {Object} config - 配置项
 * @returns {Object} 包含清理方法的对象
 */
export function createFlaskBalls(scene, flask, config) {
  const world = getCannonWorld();
  const meshes = [];
  const bodies = [];

  // 确保圆底烧瓶有物理碰撞体
  if (!flask.userData.hasPhysicsBody) {
    const model = flask.parent;
    addSceneObjectsToPhysicsWorld(scene, model);
  }

  // 创建小球
  for (let i = 0; i < config.count; i++) {
    // Three.js 可视化球体
    const ballGeometry = new THREE.SphereGeometry(config.radius, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.4,
      metalness: 0.6
    });
    const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    
    // 随机位置偏移
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02
    );
    
    ballMesh.position.copy(config.position).add(offset);
    scene.add(ballMesh);
    meshes.push(ballMesh);

    // Cannon.js 物理球体
    const ballBody = new CANNON.Body({
      mass: 0.1, // 较小的质量
      shape: new CANNON.Sphere(config.radius),
      position: new CANNON.Vec3(
        ballMesh.position.x,
        ballMesh.position.y,
        ballMesh.position.z
      ),
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.6
      })
    });
    
    world.addBody(ballBody);
    bodies.push(ballBody);
  }

  // 更新函数
  function update() {
    world.step(1/60); // 添加物理世界步进
    for (let i = 0; i < meshes.length; i++) {
      meshes[i].position.copy(bodies[i].position);
      meshes[i].quaternion.copy(bodies[i].quaternion);
    }
  }

  // 添加到动画循环
  scene.userData.flaskBallsUpdate = update;

  // 返回清理函数
  return {
    update,
    dispose: () => {
      meshes.forEach(mesh => scene.remove(mesh));
      bodies.forEach(body => world.removeBody(body));
      delete scene.userData.flaskBallsUpdate;
    }
  };
}

