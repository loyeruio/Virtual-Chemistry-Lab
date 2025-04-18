<template>
  <div class="lab-scene-container">
    <LoadingIndicator :visible="isLoading" :text="loadingText" />
    <div ref="sceneContainer" class="scene-container"></div>
    <div class="model-info" v-if="!isLoading">
      <div>已加载模型:</div>
      <ul>
        <li v-for="(model, index) in loadedModels" :key="index">
          {{ model }}
        </li>
      </ul>
    </div>
    <button @click="toggleFunnelParticles">
      {{ showFunnelParticles ? '关闭' : '开启' }}分液漏斗粒子
    </button>
    <button @click="toggleFlameEffects">
      {{ showFlameEffects ? '关闭' : '开启' }}火焰效果
    </button>
    <button @click="toggleBubbleEffects">
      {{ showBubbleEffects ? '关闭' : '开启' }}气泡效果
    </button>
    <button @click="togglePipeFlow">
      {{ showPipeFlow ? '关闭' : '开启' }}管道液体流动
    </button>
    <button @click="toggleColliderVisibility" class="debug-button">
      {{ showColliders ? '隐藏' : '显示' }}碰撞体
    </button>
    <button @click="toggleBubbleColor">
      {{ useSpecialBubbleColor ? '恢复' : '改变' }}特定气泡颜色
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { 
  createScene, 
  loadModel, 
  fitCameraToModel, 
  detectCollisions, 
  getCannonWorld,
  createFlaskBalls
} from '../utils/threeHelper';
import LoadingIndicator from './LoadingIndicator.vue';
import * as THREE from 'three';
import { throttle } from 'lodash';
import { PipeFlowEffect } from '../utils/PipeFlowEffect';
import { setFunnelBallParticles } from '../utils/threeHelper';
import { FlameEffect } from '../utils/FlameEffect';
import { BubbleEffect } from '../utils/BubbleEffect';

// 场景容器引用
const sceneContainer = ref(null);
const showFunnelParticles = ref(false);
const showFlameEffects = ref(false);
const showBubbleEffects = ref(false);
const showPipeFlow = ref(false);

let funnelParticles = null;
let pipeFlowEffect = null;

// 加载状态
const isLoading = ref(true);
const loadingText = ref('初始化场景...');
const loadedModels = ref([]);
const bubbleEffects = ref([]);
let sceneObjects = null;
const modelReferences = ref({});
const flameEffects = ref([]);
const flaskBalls = ref(null);
// 新增：氯气填充相关状态
const chlorineFillPercent = ref(0); // 0 到 1
const isFillingChlorine = ref(false);
const chlorineFillSpeed = 0.01; // 每秒填充10%
let wildMouthBottle001 = null;
let chlorineShaderMaterial = null;
let bottleBounds = { minY: 0, maxY: 0 };

// 鼠标交互状态
let isMouseDown = false;
let prevMouse = { x: 0, y: 0 };

// 添加新的状态变量
const experimentState = ref({
  step: 0,
  liquids: {
    NaOH_Liquor: false,
    H2SO4_Liquor: false,
    Nacl_Liquor: false,
    HCL_Liquor: false
  },
  bubbleColors: {
    NaOH_Liquor: 0xC0FF3E,
    H2SO4_Liquor: 0xC0FF3E,
    Nacl_Liquor: 0xC0FF3E
  },
  autoTriggeredAbsorption: false, // 新增：标记是否已自动触发吸收步骤
  completedSteps: [], // 新增：记录已完成的步骤
  currentStep: null // 新增：当前正在执行的步骤
});
// 新增：播放实验室模型动画的方法
const playLabAnimation = (animationName) => {
  const labModel = modelReferences.value['lab.glb'];
  if (!labModel) {
    console.warn(`无法播放动画 ${animationName}: 实验室模型未加载`);
    return;
  }

  const mixer = new THREE.AnimationMixer(labModel);
  const clip = labModel.animations.find(anim => anim.name === animationName);
  if (!clip) {
    console.warn(`动画 ${animationName} 未找到`);
    return;
  }

  const action = mixer.clipAction(clip);
  action.reset().play();
  console.log(`播放动画: ${animationName}`);
};
// 修改检查步骤是否完成的方法
const isStepCompleted = (stepId) => {
  // 检查步骤顺序
  const stepOrder = {
    'check_setup': 0,
    'add_mno2': 1,
    'add_hcl': 2,
    'heat_flask': 3,
    'drip_hcl': 4,
    'observe_reaction': 5,
    'purify_cl2': 6,
    'dry_cl2': 7,
    'collect_cl2': 8,
    'absorb_excess_cl2': 9
  };
  
  // 如果是第一个步骤，可以直接执行
  if (stepOrder[stepId] === 0) {
    return true;
  }
  
  // 检查前一个步骤是否已完成
  const prevStepId = Object.keys(stepOrder).find(key => stepOrder[key] === stepOrder[stepId] - 1);
  return experimentState.value.completedSteps.includes(prevStepId);
};

// 添加实验步骤控制方法
const handleExperimentStep = (stepId) => {
    // 检查当前步骤是否已完成
    if (!isStepCompleted(stepId)) {
    console.warn(`步骤 ${stepId} 的前置步骤未完成，无法执行`);
    // 返回错误信息，让调用者知道步骤无法执行
    return {
      success: false,
      message: '请先完成前一个步骤'
    };
  }
  
  // 设置当前步骤
  experimentState.value.currentStep = stepId;
  switch(stepId) {
    case 'check_setup':
      // 步骤1：检查装置气密性
      experimentState.value.liquids.Nacl_Liquor = true;
      experimentState.value.liquids.H2SO4_Liquor = true;
      experimentState.value.liquids.NaOH_Liquor = true;
      updateLiquidsVisibility();
      
      // 设置无色气泡
      experimentState.value.bubbleColors.Nacl_Liquor = 0xffffff;
      experimentState.value.bubbleColors.H2SO4_Liquor = 0xffffff;
      experimentState.value.bubbleColors.NaOH_Liquor = 0xffffff;
      
      showFlameEffects.value = true;
      showBubbleEffects.value = true;
      updateAllEffects();
      
      // 3秒后关闭效果
      setTimeout(() => {
        showFlameEffects.value = false;
        showBubbleEffects.value = false;
        updateAllEffects();
      }, 3000);
      break;

    case 'add_mno2':
      // 步骤2：添加二氧化锰
      const roundBottomFlask = modelReferences.value['lab.glb'].getObjectByName('RoundBottomFlask_50ml');
      if (roundBottomFlask && roundBottomFlask.isMesh) {
        const box = new THREE.Box3().setFromObject(roundBottomFlask);
        const center = box.getCenter(new THREE.Vector3());
        
        const ballsConfig = {
          count: 4,
          radius: 0.01,
          color: 0x8B4513,
          position: new THREE.Vector3(
            center.x,
            center.y - 0.05, // 将小球生成位置稍微降低
            center.z
          )
        };
        
        if (flaskBalls.value) {
          flaskBalls.value.dispose();
        }
        flaskBalls.value = createFlaskBalls(sceneObjects.scene, roundBottomFlask, ballsConfig);
      }
      break;

    case 'add_hcl':
      // 步骤3：添加浓盐酸
      experimentState.value.liquids.HCL_Liquor = true;
      updateLiquidsVisibility();
      break;

    case 'heat_flask':
      // 步骤4：加热圆底烧瓶
      showFlameEffects.value = true;
      break;

    case 'drip_hcl':
      // 步骤5：滴加浓盐酸
      showFunnelParticles.value = true;

      // 播放 CockCover_Open 动画
      playLabAnimation('CockCover_Open');
      break;
    case 'observe_reaction':
      // 步骤6：观察氯气生成
      showPipeFlow.value = true;
      updatePipeFlow(2); // 前两根管道
      break;

    case 'purify_cl2':
      // 步骤7：通过食盐水洗气瓶
      experimentState.value.bubbleColors.Nacl_Liquor = 0xC0FF3E; // 黄绿色
      showBubbleEffects.value = true;
      break;

    case 'dry_cl2':
      // 步骤8：通过浓硫酸干燥
      updatePipeFlow(4); // 前四根管道
      experimentState.value.bubbleColors.H2SO4_Liquor = 0xC0FF3E; // 黄绿色
      break;

    case 'collect_cl2':
      // 步骤9：收集氯气
      updatePipeFlow(6); // 前六根管道
      startChlorineFill();
      break;

    case 'absorb_excess_cl2':
    // 步骤10：吸收多余氯气
    // 检查氯气瓶子填充是否达到100%
    if (chlorineFillPercent.value >= 1) {
      // 如果氯气瓶子已填满，则生成黄绿色泡泡
      experimentState.value.bubbleColors.NaOH_Liquor = 0xC0FF3E; // 黄绿色
    } else {
      // 如果氯气瓶子未填满，则生成白色泡泡
      experimentState.value.bubbleColors.NaOH_Liquor = 0xffffff; // 白色
    }
    showBubbleEffects.value = true;
    break;
  }
  
  updateAllEffects();

  // 记录步骤已完成
  if (!experimentState.value.completedSteps.includes(stepId)) {
    experimentState.value.completedSteps.push(stepId);
  }
  
  // 返回成功信息
  return {
    success: true,
    message: '步骤执行成功'
  };
};

// 更新液体可见性
const updateLiquidsVisibility = () => {
  if (!modelReferences.value['lab.glb']) return;
  
  Object.entries(experimentState.value.liquids).forEach(([name, isVisible]) => {
    const mesh = modelReferences.value['lab.glb'].getObjectByName(name);
    if (mesh) {
      mesh.visible = isVisible;
    }
  });
};

// 更新管道流动
const updatePipeFlow = (numPipes) => {
  // 停止所有现有的管道流动效果
  pipeFlowEffects.forEach(effectObj => {
    if (effectObj.effect) effectObj.effect.stop();  // 修复这里的变量名 obj -> effectObj
  });
  pipeFlowEffects = [];
  
  if (showPipeFlow.value) {
    // 获取需要激活的管道
    const activeCatheters = [];
    
    // 特殊处理第7、8根管道（使用不同贴图）
    const specialPipes = ['Catheter_long', 'Catheter_short'];
    
    for (let i = 0; i < Math.min(numPipes, catheterOrder.length); i++) {
      const catheterName = catheterOrder[i];
      // 跳过特殊管道，它们将使用startAdditionalPipeFlow方法处理
      if (numPipes >= 8 && specialPipes.includes(catheterName)) {
        continue;
      }
      
      const catheter = sceneObjects.scene.getObjectByName(catheterName);
      if (catheter && catheter.isMesh) {
        activeCatheters.push(catheter);
      }
    }
    
    // 使用 startPipeFlowSerial 方法按顺序启动管道流动
    startPipeFlowSerial(activeCatheters, 500);
    
    // 如果需要激活第7、8根管道，使用startAdditionalPipeFlow方法
    if (numPipes >= 8) {
      startAdditionalPipeFlow();
    }
  }
};

// 切换分液漏斗粒子
function toggleFunnelParticles() {
  showFunnelParticles.value = !showFunnelParticles.value;
  updateAllEffects();
}

// 切换火焰
function toggleFlameEffects() {
  showFlameEffects.value = !showFlameEffects.value;
  updateAllEffects();
}

// 切换气泡
function toggleBubbleEffects() {
  showBubbleEffects.value = !showBubbleEffects.value;
  updateAllEffects();
}

// 切换管道流动
function togglePipeFlow() {
  showPipeFlow.value = !showPipeFlow.value;
  if (pipeFlowEffect) {
    if (showPipeFlow.value) {
      pipeFlowEffect.start();
    } else {
      pipeFlowEffect.stop();
    }
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (sceneObjects && sceneObjects.camera && sceneObjects.renderer) {
    const container = sceneContainer.value;
    const width = container.clientWidth;
    const height = container.clientHeight;

    sceneObjects.camera.aspect = width / height;
    sceneObjects.camera.updateProjectionMatrix();
    sceneObjects.renderer.setSize(width, height);
    sceneObjects.renderer.setPixelRatio(window.devicePixelRatio);
  }
};

// 添加视角控制相关变量
const mouseSensitivity = 0.002; // 鼠标灵敏度
const verticalRotation = ref(0);
const horizontalRotation = ref(0);
const maxVerticalRotation = Math.PI / 2; // 最大垂直旋转角度（90度）

// 添加鼠标移动处理函数
const handleMouseMove = (event) => {
  if (!isFirstPerson.value || !characterModel.value) return;

  // 只有在鼠标锁定状态下才处理鼠标移动
  if (document.pointerLockElement === document.body) {
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    horizontalRotation.value -= movementX * mouseSensitivity;
    verticalRotation.value = Math.max(
      -maxVerticalRotation,
      Math.min(maxVerticalRotation, verticalRotation.value - movementY * mouseSensitivity)
    );

    // 更新角色朝向
    characterModel.value.rotation.y = horizontalRotation.value;

    // 更新相机朝向
    if (eyeBone.value) {
      const eyeWorldPos = new THREE.Vector3();
      eyeBone.value.getWorldPosition(eyeWorldPos);
      sceneObjects.camera.position.copy(eyeWorldPos);

      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), verticalRotation.value);
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalRotation.value);

      const lookAtPos = new THREE.Vector3();
      lookAtPos.copy(eyeWorldPos).add(direction);
      sceneObjects.camera.lookAt(lookAtPos);
    }
  }
};

// 鼠标按下
const handleMouseDown = (event) => {
  isMouseDown = true;
  prevMouse = { x: event.clientX, y: event.clientY };
};

// 鼠标抬起
const handleMouseUp = () => {
  isMouseDown = false;
};

// 气泡效果
const useSpecialBubbleColor = ref(false);

const toggleBubbleColor = () => {
  useSpecialBubbleColor.value = !useSpecialBubbleColor.value;
  updateAllEffects();
};

const addBubbleEffects = () => {
  bubbleEffects.value.forEach(effect => {
    effect.dispose();
    sceneObjects.scene.remove(effect.group);
  });
  bubbleEffects.value = [];

  if (!showBubbleEffects.value) return;

  const liquidMeshes = [
    'NaOH_Liquor',
    'H2SO4_Liquor',
    'Nacl_Liquor',
  ];

  liquidMeshes.forEach(liquidName => {
    const liquid = sceneObjects.scene.getObjectByName(liquidName);
    if (liquid && liquid.visible) {
      const bubbleColor = experimentState.value.bubbleColors[liquidName];
      
      const bubble = new BubbleEffect({
        container: liquid,
        particleCount: 15,
        size: 0.008,
        speed: 0.02,
        color: bubbleColor,
        opacity: 0.3,
        range: {
          x: 0.02,
          y: 0.04,
          z: 0.02
        }
      });

      sceneObjects.scene.add(bubble.group);
      bubble.start();
      bubbleEffects.value.push(bubble);
    }
  });
};

// 火焰效果
const addFlameEffects = () => {
  flameEffects.value.forEach(effect => {
    effect.dispose();
    sceneObjects.scene.remove(effect.group);
  });
  flameEffects.value = [];

  if (!showFlameEffects.value) return;

  const alcoholLamps = [
    'Alcohol_lamp001_2',
  ];

  alcoholLamps.forEach(lampName => {
    const lamp = sceneObjects.scene.getObjectByName(lampName);
    if (lamp) {
      const box = new THREE.Box3().setFromObject(lamp);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const flamePosition = new THREE.Vector3(
        center.x,
        center.y + size.y / 2,
        center.z
      );

      const flame = new FlameEffect({
        position: flamePosition,
        size: 0.012,
        particleCount: 200,
        height: 0.04,
        radius: 0.004,
        color1: 0xff2200,
        color2: 0xff6600,
        color3: 0xffaa00,
        flickerSpeed: 0.08,
        flickerIntensity: 0.25,
        lightIntensity: 0.8,
        lightDistance: 0.2,
        lightDecay: 2,
      });
      sceneObjects.scene.add(flame.group);
      flame.start();
      flameEffects.value.push(flame);
    }
  });
};
// 新增：更新氯气填充效果的函数
const updateChlorineFill = (deltaTime) => {
  if (isFillingChlorine.value && wildMouthBottle001 && chlorineShaderMaterial) {
    if (chlorineFillPercent.value < 1) {
      chlorineFillPercent.value += chlorineFillSpeed * deltaTime;
      chlorineFillPercent.value = Math.min(chlorineFillPercent.value, 1);
      chlorineShaderMaterial.uniforms.fillPercent.value = chlorineFillPercent.value;
    }

    // 当填充达到100%时，启动新的管道流动效果并自动触发下一步
    if (chlorineFillPercent.value >= 1) {
      startAdditionalPipeFlow();
      
      // 新增：自动触发吸收多余氯气步骤
      if (!experimentState.value.autoTriggeredAbsorption) {
        experimentState.value.autoTriggeredAbsorption = true;
        console.log('氯气瓶子已填满，自动触发吸收多余氯气步骤');
        setTimeout(() => {
          handleExperimentStep('absorb_excess_cl2');
        }, 1000); // 延迟1秒触发，给用户一个视觉过渡
      }
      
      // stopChlorineFill(); // 停止填充
    }
  }
};

// 新增：启动额外管道流动的方法
const startAdditionalPipeFlow = () => {
  // 先检查这些管道是否已经有流动效果
  const existingEffects = pipeFlowEffects.filter(obj => 
    obj.catheter === 'Catheter_long' || obj.catheter === 'Catheter_short'
  );
  
  // 如果已经有流动效果，则不重复添加
  if (existingEffects.length > 0) {
    return;
  }
  
  const additionalCatheters = ['Catheter_long', 'Catheter_short']
    .map(name => sceneObjects.scene.getObjectByName(name))
    .filter(obj => obj && obj.isMesh);

  additionalCatheters.forEach(catheter => {
    const effect = new PipeFlowEffect({
      mesh: catheter,
      textureUrl: '/textures/fluid1.png', // 使用不同的贴图
      speed: 0.003,
      opacity: 0.7,
    });
    effect.start();
    pipeFlowEffects.push({ 
      effect, 
      catheter: catheter.name 
    });
  });
};
// 分液漏斗粒子
const addFunnelParticles = () => {
  if (funnelParticles) {
    if (funnelParticles.meshes) {
      funnelParticles.meshes.forEach(mesh => sceneObjects.scene.remove(mesh));
    }
    funnelParticles = null;
  }
  if (showFunnelParticles.value) {
    funnelParticles = setFunnelBallParticles(
      sceneObjects.scene,
      modelReferences.value['lab.glb'],
      true,
      {
        radius: 0.005,
        color: 0x0000ff,
        spawnRate: 0.05
      }
    );
  }
};

// 管道流动
// 1. 定义导管的物理顺序
const catheterOrder = [
  'Catheter_long001',         // 入口
  'Catheter_longlong001',
  'Catheter_long002',
  'Catheter_short001',
  'Catheter_long003',
  'Catheter_short002',
  'Catheter_long',
  'Catheter_short',
  'Catheter_custom001',
  'Catheter_custom002'
];

let pipeFlowEffects = [];

// 串行启动每段管道流动
const startPipeFlowSerial = (catheters, delay = 500) => {
  catheters.forEach((catheter, index) => {
    setTimeout(() => {
      const effect = new PipeFlowEffect({
        mesh: catheter,
        textureUrl: '/textures/fluid.png',
        speed: 0.003,
        opacity: 0.7
      });
      
      effect.start();
      pipeFlowEffects.value.push({
        catheter: catheter.name,
        effect: effect
      });
    }, index * delay);
  });
};

const addPipeFlow = () => {
  // 停止并移除所有旧的流动效果
  pipeFlowEffects.forEach(effectObj => {
    effectObj.effect.stop();
  });
  pipeFlowEffects = [];

  if (showPipeFlow.value) {
  }
};

// 统一动画循环
function updateAllEffects() {
  addBubbleEffects();
  addFlameEffects();
  addFunnelParticles();
  addPipeFlow();

  sceneObjects.setCustomAnimates([
    (delta) => {
      // 步进物理世界
      const world = getCannonWorld();
      world.step(1/60);

      // 同步小球 mesh 位置
      if (flaskBalls.value && flaskBalls.value.update) {
        flaskBalls.value.update();
      }

      if (showFunnelParticles.value && funnelParticles && funnelParticles.tick) {
        funnelParticles.tick();
      }
      if (showFlameEffects.value) {
        flameEffects.value.forEach(effect => effect.update(delta || 1/60));
      }
      if (showBubbleEffects.value) {
        bubbleEffects.value.forEach(effect => effect.update(delta || 1/60));
      }
      if (showPipeFlow.value && pipeFlowEffects.length > 0) {
        pipeFlowEffects.forEach(obj => {
          if (obj.effect && obj.effect.update) obj.effect.update(delta || 1/60);
        });
      }
      updateChlorineFill(delta || 1/60);
    }
  ]);
}

// 添加新的状态变量
const isFirstPerson = ref(false);
const characterAnimations = ref({});
const currentAnimation = ref(null);
const characterMixer = ref(null);
const moveSpeed = 0.1;
const moveDirection = new THREE.Vector3();
const characterModel = ref(null);
const eyeBone = ref(null);

// 修改键盘状态，添加空格键
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false
};

// 修改handleKeyDown
const handleKeyDown = (event) => {
  if (event.key === 'f' || event.key === 'F') {
    toggleFirstPerson();
    return;
  }
  
  if (isFirstPerson.value) {
    const key = event.key.toLowerCase();
    if (key === ' ') {
      keys.space = true;
      handleJump();
    } else {
      keys[key] = true;
      if (['w', 'a', 's', 'd'].includes(key)) {
        playAnimation('action4'); // walking animation
      }
    }
  }
};

// 修改handleKeyUp
const handleKeyUp = (event) => {
  if (isFirstPerson.value) {
    const key = event.key.toLowerCase();
    if (key === ' ') {
      keys.space = false;
    } else {
      keys[key] = false;
      if (['w', 'a', 's', 'd'].includes(key)) {
        // 检查是否还有其他移动键被按下
        if (!keys.w && !keys.a && !keys.s && !keys.d) {
          playAnimation('action2'); // idle animation
        }
      }
    }
  }
};

// 修改toggleFirstPerson函数，添加鼠标锁定
const toggleFirstPerson = async () => {
  isFirstPerson.value = !isFirstPerson.value;
  
  if (isFirstPerson.value) {
    // 保存相机原始位置
    sceneObjects.camera.userData.originalPosition = sceneObjects.camera.position.clone();
    sceneObjects.camera.userData.originalRotation = sceneObjects.camera.rotation.clone();
    
    // 禁用 OrbitControls
    sceneObjects.controls.enabled = false;
    
    // 重置旋转角度
    verticalRotation.value = 0;
    horizontalRotation.value = characterModel.value ? characterModel.value.rotation.y : 0;
    
    // 请求鼠标锁定
    try {
      await document.body.requestPointerLock();
    } catch (error) {
      console.warn('无法锁定鼠标:', error);
    }
    
    // 将相机移动到眼睛骨骼位置
    if (eyeBone.value) {
      const eyeWorldPos = new THREE.Vector3();
      eyeBone.value.getWorldPosition(eyeWorldPos);
      sceneObjects.camera.position.copy(eyeWorldPos);
      
      // 初始化视角方向
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalRotation.value);
      
      const lookAtPos = new THREE.Vector3();
      lookAtPos.copy(eyeWorldPos).add(direction);
      sceneObjects.camera.lookAt(lookAtPos);
    }
  } else {
    // 恢复相机原始位置
    if (sceneObjects.camera.userData.originalPosition) {
      sceneObjects.camera.position.copy(sceneObjects.camera.userData.originalPosition);
      sceneObjects.camera.rotation.copy(sceneObjects.camera.userData.originalRotation);
    }
    
    // 启用 OrbitControls
    sceneObjects.controls.enabled = true;
    
    // 退出鼠标锁定
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
  }
};

// 播放动画
const playAnimation = (actionName) => {
  console.log(`尝试播放动画: ${actionName}`);
  if (!characterMixer.value || !characterAnimations.value[actionName]) {
    console.warn(`无法播放动画 ${actionName}: 动画混合器或动画不存在`);
    return;
  }

  if (currentAnimation.value && currentAnimation.value.name === actionName) {
    console.log(`动画 ${actionName} 已经在播放`);
    return;
  }

  const action = characterAnimations.value[actionName];
  console.log(`切换到动画: ${actionName}`);

  if (currentAnimation.value) {
    currentAnimation.value.fadeOut(0.5);
  }
  
  action.reset().fadeIn(0.5).play();
  currentAnimation.value = action;
};

// 添加跳跃相关变量和函数
const isJumping = ref(false);
const jumpVelocity = ref(0);
const jumpForce = 0.2;
const gravity = 0.01;
const groundLevel = 0;

const handleJump = () => {
  if (!isJumping.value && characterModel.value) {
    isJumping.value = true;
    jumpVelocity.value = jumpForce;
  }
};

// 修改updateCharacterMovement函数中的移动逻辑
const updateCharacterMovement = () => {
  if (!isFirstPerson.value || !characterModel.value) return;

  moveDirection.set(0, 0, 0);
  let isMoving = false;

  if (keys.w) { moveDirection.z -= 1; isMoving = true; }
  if (keys.s) { moveDirection.z += 1; isMoving = true; }
  if (keys.a) { moveDirection.x -= 1; isMoving = true; }
  if (keys.d) { moveDirection.x += 1; isMoving = true; }

  if (isMoving) {
    moveDirection.normalize().multiplyScalar(moveSpeed);
    const rotatedDirection = moveDirection.clone();
    rotatedDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalRotation.value);
    characterModel.value.position.add(rotatedDirection);
    
    // 播放走路动画
    playAnimation('action4');
  } else if (!isJumping.value) {
    // 如果没有移动且不在跳跃，播放待机动画
    playAnimation('action2');
  }

  // 更新跳跃
  if (isJumping.value) {
    characterModel.value.position.y += jumpVelocity.value;
    jumpVelocity.value -= gravity;

    if (characterModel.value.position.y <= groundLevel) {
      characterModel.value.position.y = groundLevel;
      isJumping.value = false;
      jumpVelocity.value = 0;
      
      // 跳跃结束后，根据是否在移动决定播放哪个动画
      if (!isMoving) {
        playAnimation('action2');
      }
    }
  }

  // 更新相机位置和朝向
  if (eyeBone.value) {
    const eyeWorldPos = new THREE.Vector3();
    eyeBone.value.getWorldPosition(eyeWorldPos);
    sceneObjects.camera.position.copy(eyeWorldPos);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), verticalRotation.value);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalRotation.value);

    // const lookAtPos = new THREE.Vector3();
    // lookAtPos.copy(eyeWorldPos).add(direction);
    // sceneObjects.camera.lookAt(lookAtPos);
  }
};

// 修改loadModels函数，添加动画加载
const loadModels = async () => {
  try {
    const modelPaths = ['https://raw.githubusercontent.com/loyeruio/Virtual-Chemistry-Lab/refs/heads/master/public/models/lab.glb'];

    for (let i = 0; i < modelPaths.length; i++) {
      const path = modelPaths[i];
      const modelName = path.split('/').pop();

      loadingText.value = `加载模型 ${modelName} (${i + 1}/${modelPaths.length})...`;

      const options = {
        addColliders: modelName === 'lab.glb',
        collisionConfig: { 
          collidersVisible: false,
        },
      };
      
      const result = await loadModel(path, sceneObjects.scene, (percent) => {
        loadingText.value = `加载模型 ${modelName} (${i + 1}/${modelPaths.length}): ${percent}%`;
      }, options);

      loadedModels.value.push(modelName);
      modelReferences.value[modelName] = result.model;
      if (modelName === 'lab.glb') {
        // 确保动画正确加载
        const mixer = new THREE.AnimationMixer(result.model);
        result.animations.forEach((clip) => {
          mixer.clipAction(clip);
        });
      }
      if (modelName === 'bob.glb') {
        characterModel.value = result.model;
        
        // 设置角色初始位置和缩放
        result.model.scale.set(0.5, 0.5, 0.5);
        result.model.position.set(0, groundLevel, 2);
        result.model.rotation.y = Math.PI; // 让角色面向前方
        
        // 查找眼睛骨骼
        result.model.traverse((object) => {
          if (object.name === 'mixamorigeye') {
            eyeBone.value = object;
          }
        });
        
        // 设置动画混合器
        characterMixer.value = new THREE.AnimationMixer(result.model);
        
        // 创建动画动作
        const actionMap = {
          'action1': 'grab',
          'action2': 'idle',
          'action3': 'pick_up',
          'action4': 'walking'
        };
        
        result.animations.forEach((clip) => {
          Object.entries(actionMap).forEach(([key, value]) => {
            if (clip.name.toLowerCase().includes(value.toLowerCase())) {
              const action = characterMixer.value.clipAction(clip);
              characterAnimations.value[key] = action;
              console.log(`创建动画: ${key} - ${value}`);
            }
          });
        });
        
        // 立即播放idle动画
        if (characterAnimations.value['action2']) {
          console.log('开始播放idle动画');
          playAnimation('action2');
        } else {
          console.warn('未找到idle动画');
        }
      }
      
      // 如果是实验室模型，初始化时隐藏所有液体
      if (modelName === 'lab.glb') {
        const liquidsToHide = ['NaOH_Liquor', 'H2SO4_Liquor', 'Nacl_Liquor', 'HCL_Liquor'];
        liquidsToHide.forEach(liquidName => {
          const liquid = result.model.getObjectByName(liquidName);
          if (liquid) {
            liquid.visible = false;
          }
        });
        
        // --- 氯气填充着色器设置 ---
        wildMouthBottle001 = result.model.getObjectByName('WildMouthBottle002');
        if (wildMouthBottle001 && wildMouthBottle001.isMesh) {
          // 保存原始材质
          const originalMaterial = wildMouthBottle001.material;
          
          // 1. 计算边界 (本地坐标)
          wildMouthBottle001.geometry.computeBoundingBox();
          bottleBounds.minY = wildMouthBottle001.geometry.boundingBox.min.y;
          bottleBounds.maxY = wildMouthBottle001.geometry.boundingBox.max.y;

          // 2. 创建 ShaderMaterial
          chlorineShaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
              fillPercent: { value: chlorineFillPercent.value },
              minY: { value: bottleBounds.minY },
              maxY: { value: bottleBounds.maxY },
              originalColor: { 
                value: originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color(0xffffff) 
              },
              fillColor: { value: new THREE.Color(0xC0FF3E) },
              opacity: { 
                value: originalMaterial.opacity !== undefined ? originalMaterial.opacity : 1.0 
              }
            },
            vertexShader: `
              varying vec3 vPosition;
              void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float fillPercent;
              uniform float minY;
              uniform float maxY;
              uniform vec3 originalColor;
              uniform vec3 fillColor;
              uniform float opacity;

              varying vec3 vPosition;

              void main() {
                float heightRatio = (vPosition.y - minY) / (maxY - minY);
                heightRatio = clamp(heightRatio, 0.0, 1.0);

                float blendFactor = smoothstep(fillPercent - 0.05, fillPercent + 0.05, heightRatio);
                
                vec3 finalColor = mix(fillColor, originalColor, blendFactor);
                float finalOpacity = mix(opacity, 0.5, blendFactor);

                gl_FragColor = vec4(finalColor, finalOpacity);
              }
            `,
            transparent: true,
            side: THREE.DoubleSide
          });
          // 3. 应用新材质
          wildMouthBottle001.material = chlorineShaderMaterial;
          
          // 4. 确保物体可见
          wildMouthBottle001.visible = true;
          
          console.log('已设置氯气填充着色器', {
            minY: bottleBounds.minY,
            maxY: bottleBounds.maxY,
            originalColor: originalMaterial.color ? originalMaterial.color.getHex() : 0xffffff,
            originalOpacity: originalMaterial.opacity
          });
        } else {
          console.warn('未找到WildMouthBottle002或不是网格对象');
        }
      }
      // --- 结束氯气填充着色器设置 ---


      // 管道流动效果初始化
      if (modelName === 'lab.glb' && showPipeFlow.value) {
        const catheter = sceneObjects.scene.getObjectByName('Catheter_long001');
        if (catheter && catheter.isMesh) {
          pipeFlowEffect = new PipeFlowEffect({
            mesh: catheter,
            textureUrl: '/textures/fluid.png',
            speed: 0.01,
            opacity: 0.7,
          });
          pipeFlowEffect.start();
        }
      }
      if (modelName === 'bob.glb') {
        result.model.scale.set(0.5, 0.5, 0.5);
        const box = new THREE.Box3().setFromObject(result.model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const bottomY = center.y - size.y / 2;
        result.model.position.y -= bottomY;
      }
    }

    isLoading.value = false;
    updateAllEffects();
  } catch (error) {
    console.error('模型加载失败:', error);
    loadingText.value = `模型加载失败: ${error.message}`;
  }
};

// 修改动画循环，添加角色动画更新
const animate = () => {
  requestAnimationFrame(animate);
  
  // 更新动画混合器
  if (characterMixer.value) {
    characterMixer.value.update(1/60);
  }
  
  // 更新角色移动
  updateCharacterMovement();
  
  // 更新场景
  sceneObjects.controls.update();
  sceneObjects.renderer.render(sceneObjects.scene, sceneObjects.camera);
  customAnimates.forEach(fn => fn && fn());
};

// 组件挂载时初始化
onMounted(() => {
  sceneObjects = createScene(sceneContainer.value);

  const world = getCannonWorld();

  window.addEventListener('resize', handleResize);
  sceneContainer.value.addEventListener('mousemove', handleMouseMove);
  sceneContainer.value.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  setTimeout(handleResize, 100);
  loadModels();
  
  // 初始化时隐藏所有液体
  Object.keys(experimentState.value.liquids).forEach(key => {
    experimentState.value.liquids[key] = false;
  });
  
  // 监听实验步骤事件
  if (window.eventBus) {
    window.eventBus.on('experiment-step', (stepId, callback) => {
      const result = handleExperimentStep(stepId);
      // 如果提供了回调函数，则调用它并传递结果
      if (typeof callback === 'function') {
        callback(result);
      }
    });
    
    // 监听实验重置事件
    window.eventBus.on('reset-experiment', () => {
      // 重置实验状态
      experimentState.value.completedSteps = [];
      experimentState.value.currentStep = null;
      
      // 重置其他相关状态
      showFunnelParticles.value = false;
      showFlameEffects.value = false;
      showBubbleEffects.value = false;
      showPipeFlow.value = false;
      
      // 重置氯气填充
      resetChlorineFill();
      
      // 更新所有效果
      updateAllEffects();
    });
  }
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // 监听鼠标锁定状态变化
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== document.body && isFirstPerson.value) {
      toggleFirstPerson();
    }
  });
});

// 组件卸载前清理
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (sceneContainer.value) {
    sceneContainer.value.removeEventListener('mousemove', handleMouseMove);
    sceneContainer.value.removeEventListener('mousedown', handleMouseDown);
  }
  window.removeEventListener('mouseup', handleMouseUp);
  if (sceneObjects) {
    sceneObjects.dispose();
  }
  if (pipeFlowEffect) {
    pipeFlowEffect.stop();
  }
  if (flaskBalls.value) {
    flaskBalls.value.dispose();
  }
  
  if (window.eventBus) {
    window.eventBus.off('experiment-step', handleExperimentStep);
  }
  
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  
  // 移除鼠标移动事件监听
  window.removeEventListener('mousemove', handleMouseMove);
  
  // 监听鼠标锁定状态变化
  document.removeEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== document.body && isFirstPerson.value) {
      toggleFirstPerson();
    }
  });
});


// 添加碰撞体可见性状态
const showColliders = ref(false);

// 切换碰撞体可见性
function toggleColliderVisibility() {
  showColliders.value = !showColliders.value;
  if (sceneObjects && sceneObjects.scene) {
    sceneObjects.scene.traverse((object) => {
      if (object.userData && object.userData.isCollider) {
        if (object.material) {
          object.material.visible = showColliders.value;
        }
      }
    });
  }
}


// 新增：启动氯气填充的方法
const startChlorineFill = () => {
  console.log('开始填充氯气...');
  isFillingChlorine.value = true;
  // 可以选择重置填充百分比
  // chlorineFillPercent.value = 0;
  // if (chlorineShaderMaterial) {
  //   chlorineShaderMaterial.uniforms.fillPercent.value = 0;
  // }
};

// 新增：停止氯气填充的方法
const stopChlorineFill = () => {
  isFillingChlorine.value = false;
};

// 新增：重置氯气填充的方法
const resetChlorineFill = () => {
  isFillingChlorine.value = false;
  chlorineFillPercent.value = 0;
  if (chlorineShaderMaterial) {
    chlorineShaderMaterial.uniforms.fillPercent.value = 0;
  }
};

// 暴露方法给父组件或通过 inject/provide 使用
defineExpose({
  modelReferences,
  startChlorineFill,
  stopChlorineFill, // 现在这个函数已定义
  resetChlorineFill, // 现在这个函数已定义
  // ... 其他需要暴露的方法 ...
});
</script>

<style scoped>
.lab-scene-container {
  width: 100%;
  height: 100vh;
  position: relative;
  background-color: #f0f0f0;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.scene-container {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

.model-info {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
}

.model-info ul {
  margin: 5px 0 0 0;
  padding-left: 20px;
}

.collision-info {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  transition: opacity 0.3s ease;
}

.debug-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
