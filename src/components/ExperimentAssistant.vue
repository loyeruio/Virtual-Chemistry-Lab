<template>
  <div class="experiment-assistant-container">
    <div class="top-decoration"></div>
    
    <div class="content-container">
      <!-- 左侧区域：实验数据和步骤 -->
      <div class="left-panel">
        <ExperimentData :experimentData="experimentData" :cl2Warning="cl2Warning" />
        <ExperimentSteps 
          :steps="experimentSteps" 
          @step-click="handleStepClick"
          :currentStepIndex="currentStepIndex"
          :isExperimentStarted="experimentState.isRunning"
        />
        
        <!-- 提示信息 -->
        <div class="tip-box">
          请按照正确的实验步骤顺序操作，AI 助手将指导您完成实验。
        </div>
        
        <!-- 操作按钮 -->
        <div class="action-buttons">
          <el-button 
            v-if="!experimentState.isRunning" 
            type="success" 
            size="large" 
            @click="startExperiment"
          >
            开始实验
          </el-button>
          <el-button 
            v-else 
            type="danger" 
            size="large" 
            @click="stopExperiment"
          >
            停止实验
          </el-button>
        </div>
      </div>
      
      <!-- 右侧区域：聊天窗口 -->
      <div class="right-panel" v-if="!isCollapsed">
        <ChatWindow 
          :messages="chatMessages" 
          :loading="loading"
          @send-message="handleSendMessage" 
          :currentModel="currentModel"
          @change-model="handleModelChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, inject } from 'vue';
import ExperimentData from './ExperimentData.vue';
import ExperimentSteps from './ExperimentSteps.vue';
import ChatWindow from './ChatWindow.vue';
import { ElMessage } from 'element-plus';
import AIService from '../services/AIService';

// 初始化 AI 服务
const aiService = new AIService();

// 实验数据
const experimentData = ref({
  temperature: '25°C',
  pressure: '1 atm',
  cl2Concentration: '0 ppm'
});

// 实验步骤
const experimentSteps = ref([
  { id: 'collect_cl2', description: '收集纯净的氯气', correctOrder: 8 },
  { id: 'add_hcl', description: '向分液漏斗中加入浓盐酸', correctOrder: 2 },
  { id: 'heat_flask', description: '用酒精灯加热圆底烧瓶', correctOrder: 3 },
  { id: 'dry_cl2', description: '通过浓硫酸洗气瓶干燥氯气', correctOrder: 7 },
  { id: 'add_mno2', description: '向圆底烧瓶中加入二氧化锰', correctOrder: 1 },
  { id: 'drip_hcl', description: '缓慢滴加浓盐酸', correctOrder: 4 },
  { id: 'check_setup', description: '检查装置气密性', correctOrder: 0 },
  { id: 'observe_reaction', description: '观察氯气生成', correctOrder: 5 },
  { id: 'purify_cl2', description: '通过饱和食盐水洗气瓶除去HCl', correctOrder: 6 },
  { id: 'absorb_excess_cl2', description: '用氢氧化钠溶液吸收多余氯气', correctOrder: 9 }
]);

// 聊天消息
const chatMessages = ref([
  { 
    id: 1, 
    sender: 'ai', 
    content: '欢迎进入氯气制取实验！请点击"开始实验"按钮，并按照步骤操作。',
    avatar: '/icon/deepseek.svg'
  },
  { 
    id: 2, 
    sender: 'ai', 
    content: '如有疑问，可随时提问，我会为您解答。',
    avatar: '/icon/deepseek.svg'
  }
]);

// 当前模型
const currentModel = ref('local');
const loading = ref(false);

// 添加氯气浓度警告状态
const cl2Warning = ref(false);
const cl2ConcentrationInterval = ref(null);

// 从App.vue中获取LabScene组件的引用
const labSceneRef = inject('labSceneRef', ref(null));

// 添加碰撞检测相关状态
const lastInteractedObject = ref(null);
const interactionCooldown = ref(false);
const interactionCooldownTime = 2000; // 2秒冷却时间

// 监听碰撞事件
const handleCollisionEvent = (collisionData) => {
  if (!experimentState.value.isRunning || interactionCooldown.value) return;
  
  const { objectName, point } = collisionData;
  
  // 防止重复触发同一物体的碰撞事件
  if (lastInteractedObject.value === objectName) return;
  
  // 设置冷却时间，防止频繁触发
  interactionCooldown.value = true;
  setTimeout(() => {
    interactionCooldown.value = false;
  }, interactionCooldownTime);
  
  // 记录最后交互的物体
  lastInteractedObject.value = objectName;
  
  // 根据碰撞的物体名称处理不同的实验步骤
  handleObjectInteraction(objectName);
};

// 处理物体交互
const handleObjectInteraction = (objectName) => {
  // 根据物体名称匹配实验步骤
  let matchedStep = null;
  
  // 分液漏斗相关
  if (objectName.includes('SeparateSeparatingFunnel')) {
    if (!experimentState.value.state.mnO2Added) {
      // 如果还没有加入二氧化锰，提示先加入二氧化锰
      addAIMessage('请先向圆底烧瓶中加入二氧化锰，再操作分液漏斗。');
      return;
    }
    
    if (!experimentState.value.state.hclAdded) {
      // 匹配加入浓盐酸的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'add_hcl');
    } else if (experimentState.value.state.hclAdded && !experimentState.value.state.hclDripping) {
      // 匹配滴加浓盐酸的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'drip_hcl');
    }
  }
  
  // 圆底烧瓶相关
  else if (objectName.includes('RoundBottomFlask')) {
    if (!experimentState.value.state.mnO2Added) {
      // 匹配加入二氧化锰的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'add_mno2');
    } else if (experimentState.value.state.mnO2Added && experimentState.value.state.hclAdded && !experimentState.value.state.isHeating) {
      // 匹配观察反应的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'observe_reaction');
    }
  }
  
  // 酒精灯相关
  else if (objectName.includes('Alcohol_lamp')) {
    if (experimentState.value.state.mnO2Added && experimentState.value.state.hclAdded && !experimentState.value.state.isHeating) {
      // 匹配加热圆底烧瓶的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'heat_flask');
    }
  }
  
  // 洗气瓶相关（假设用WildMouthBottle作为洗气瓶）
  else if (objectName.includes('WildMouthBottle')) {
    if (experimentState.value.state.cl2Generating && !experimentState.value.state.cl2Purifying) {
      // 匹配净化氯气的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'purify_cl2');
    } else if (experimentState.value.state.cl2Purifying && !experimentState.value.state.cl2Drying) {
      // 匹配干燥氯气的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'dry_cl2');
    } else if (experimentState.value.state.cl2Collecting && !experimentState.value.state.cl2Absorbing) {
      // 匹配吸收多余氯气的步骤
      matchedStep = experimentSteps.value.find(step => step.id === 'absorb_excess_cl2');
    }
  }
  
  // 如果匹配到步骤，自动执行该步骤
  if (matchedStep) {
    handleStepClick(matchedStep);
  } else {
    // 如果没有匹配到步骤，给出提示
    addAIMessage(`您点击了${getChineseNameForObject(objectName)}，但当前实验阶段不需要操作此物品。请按照实验步骤顺序操作。`);
  }
};

// 获取物体的中文名称
const getChineseNameForObject = (objectName) => {
  const nameMap = {
    'SeparateSeparatingFunnel': '分液漏斗',
    'RoundBottomFlask': '圆底烧瓶',
    'Alcohol_lamp': '酒精灯',
    'IronSupport': '铁架台',
    'Catheter': '玻璃管',
    'RubberSeal': '橡胶塞',
    'RubberValve': '橡胶阀',
    'Beaker': '烧杯',
    'WildMouthBottle': '广口瓶'
  };
  
  for (const [key, value] of Object.entries(nameMap)) {
    if (objectName.includes(key)) {
      return value;
    }
  }
  
  return objectName;
};

// 添加AI消息的辅助函数
const addAIMessage = (content) => {
  chatMessages.value.push({
    id: Date.now(),
    sender: 'ai',
    content: content,
    avatar: '/icon/deepseek.svg'
  });
  
  // 如果面板收起，显示弹窗
  if (props.isCollapsed) {
    emit('show-response', content);
  }
};

// 监控氯气浓度
const monitorCl2Concentration = () => {
  if (cl2ConcentrationInterval.value) {
    clearInterval(cl2ConcentrationInterval.value);
  }
  
  cl2ConcentrationInterval.value = setInterval(() => {
    if (experimentState.value.state.cl2Generating) {
      // 模拟氯气浓度增加
      const currentConcentration = parseInt(experimentData.value.cl2Concentration);
      if (currentConcentration < 1000) {
        const newConcentration = Math.min(currentConcentration + 10, 1000);
        experimentData.value.cl2Concentration = `${newConcentration} ppm`;
        
        // 当浓度达到阈值时发出警告
        if (newConcentration >= 800 && !cl2Warning.value) {
          cl2Warning.value = true;
          chatMessages.value.push({
            id: Date.now(),
            sender: 'ai',
            content: '警告：氯气浓度已达到危险水平！请立即停止实验并通风。',
            avatar: '/icon/deepseek.svg'
          });
        }
      }
    }
  }, 1000);
};

// 处理发送消息
const handleSendMessage = async (message) => {
  if (!message.trim()) return;
  
  // 添加用户消息
  chatMessages.value.push({
    id: Date.now(),
    sender: 'user',
    content: message,
    avatar: '/icon/avatar.svg'
  });
  
  // 显示加载动画
  loading.value = true;
  
  try {
    // 调用 AI 服务处理用户问题
    const response = await aiService.handleUserQuestion(message);
    
    // 添加 AI 响应
    if (response && response.content) {
      chatMessages.value.push({
        id: Date.now() + 1,
        sender: 'ai',
        content: response.content,
        avatar: '/icon/deepseek.svg'
      });
    }
  } catch (error) {
    console.error('获取AI响应失败:', error);
    ElMessage.error('获取AI响应失败，请重试');
    
    // 添加错误提示消息
    chatMessages.value.push({
      id: Date.now() + 1,
      sender: 'ai',
      content: '抱歉，我暂时无法回答您的问题，请稍后再试。',
      avatar: '/icon/deepseek.svg'
    });
  } finally {
    loading.value = false;
  }
};

// 处理模型变更
const handleModelChange = (model) => {
  currentModel.value = model;
  
  // 更新 AI 服务的模型类型
  aiService.modelType = model;
  
  // 添加 AI 消息通知模型切换
  const modelNames = {
    'local': '本地模型',
    'online': 'DeepSeek-R1',
    'onlineV3': 'DeepSeek-V3'
  };
  
  chatMessages.value.push({
    id: Date.now(),
    sender: 'ai',
    content: `已切换到${modelNames[model]}`,
    avatar: '/icon/deepseek.svg'
  });
};

const props = defineProps({
  isCollapsed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['show-response']);

// 修改处理步骤点击的方法
const handleStepClick = async (step) => {
  if (!experimentState.value.isRunning) {
    ElMessage.warning('请先开始实验');
    return;
  }

  // 发送用户消息
  chatMessages.value.push({
    id: Date.now(),
    sender: 'user',
    content: `执行步骤：${step.description}`,
    avatar: '/icon/avatar.svg'
  });

  loading.value = true;

  try {
    // 检查是否是正确步骤
    const isCorrectStep = step.correctOrder === currentStepIndex.value;
    
    // 发送请求到AI服务
    const response = await aiService.handleStepRequest(
      step.id,
      step.description,
      isCorrectStep,
      experimentState.value,
      currentStepIndex.value
    );

    // 检查响应是否包含错误消息
    const hasError = response.content.includes('暂时无法') || 
                    response.content.includes('请稍后再试');

    // 只有在响应成功且没有错误时才更新步骤状态
    if (isCorrectStep && !hasError) {
      step.completed = true;
      currentStepIndex.value++;
      // 更新实验状态
      updateExperimentState(step);
    }

    // 添加AI响应到消息列表
    chatMessages.value.push({
      id: Date.now(),
      sender: 'ai',
      content: response.content,
      avatar: '/icon/deepseek.svg'
    });

    // 如果面板收起，显示弹窗
    if (props.isCollapsed) {
      emit('show-response', response.content);
    }
  } catch (error) {
    console.error('处理步骤请求失败:', error);
    ElMessage.error('处理步骤请求失败，请重试');
  } finally {
    loading.value = false;
  }
};

// 添加当前步骤索引
const currentStepIndex = ref(0);

// 添加实验状态
const experimentState = ref({
  isRunning: false,
  currentStep: 0,
  state: {
    mnO2Added: false,
    hclAdded: false,
    isHeating: false,
    hclDripping: false,
    cl2Generating: false,
    cl2Purifying: false,
    cl2Drying: false,
    cl2Collecting: false,
    cl2Absorbing: false
  },
  data: {
    temperature: 25,
    pressure: 101.3,
    cl2Concentration: 0,
    hclConcentration: 0,
    reactionProgress: 0
  }
});

// 修改开始实验方法
const startExperiment = () => {
  if (experimentState.value.isRunning) {
    ElMessage.warning('实验已经开始');
    return;
  }
  
  ElMessage.success('实验已开始，请按照步骤操作');
  experimentState.value.isRunning = true;
  currentStepIndex.value = 0;
  cl2Warning.value = false;
  
  // 重置所有步骤状态
  experimentSteps.value.forEach(step => {
    step.completed = false;
  });
  
  // 重置实验状态
  experimentState.value.state = {
    mnO2Added: false,
    hclAdded: false,
    isHeating: false,
    hclDripping: false,
    cl2Generating: false,
    cl2Purifying: false,
    cl2Drying: false,
    cl2Collecting: false,
    cl2Absorbing: false
  };
  
  // 通知 LabScene 重置实验状态
  if (window.eventBus) {
    window.eventBus.emit('reset-experiment');
  }
  
  // 开始监控氯气浓度
  monitorCl2Concentration();
  
  // 添加AI指导消息
  chatMessages.value.push({
    id: Date.now(),
    sender: 'ai',
    content: '实验已开始，第一步请检查装置气密性，确保所有连接处密封良好。',
    avatar: '/icon/deepseek.svg'
  });
};

// 添加停止实验方法
const stopExperiment = () => {
  if (!experimentState.value.isRunning) {
    return;
  }
  
  ElMessage.warning('实验已停止');
  experimentState.value.isRunning = false;
  
  // 停止监控氯气浓度
  if (cl2ConcentrationInterval.value) {
    clearInterval(cl2ConcentrationInterval.value);
    cl2ConcentrationInterval.value = null;
  }
  
  // 添加AI提示消息
  chatMessages.value.push({
    id: Date.now(),
    sender: 'ai',
    content: '实验已停止。请确保通风良好，等待氯气浓度降至安全水平。',
    avatar: '/icon/deepseek.svg'
  });
};

// 修改重置实验方法
const resetExperiment = () => {
  stopExperiment();
  currentStepIndex.value = 0;
  cl2Warning.value = false;
  
  // 重置所有步骤状态
  experimentSteps.value.forEach(step => {
    step.completed = false;
  });
  
  // 重置实验数据
  experimentData.value = {
    temperature: '25°C',
    pressure: '1 atm',
    cl2Concentration: '0 ppm'
  };
  
  // 重置实验状态
  experimentState.value.state = {
    mnO2Added: false,
    hclAdded: false,
    isHeating: false,
    hclDripping: false,
    cl2Generating: false,
    cl2Purifying: false,
    cl2Drying: false,
    cl2Collecting: false,
    cl2Absorbing: false
  };
  
  // 添加AI提示消息
  chatMessages.value.push({
    id: Date.now(),
    sender: 'ai',
    content: '实验已重置，您可以重新开始实验。',
    avatar: '/icon/deepseek.svg'
  });
};

// 添加更新实验状态的方法
const updateExperimentState = (step) => {
  switch (step.id) {
    case 'check_setup':
      // 不需要更新状态
      break;
    case 'add_mno2':
      experimentState.value.state.mnO2Added = true;
      break;
    case 'add_hcl':
      experimentState.value.state.hclAdded = true;
      break;
    case 'heat_flask':
      experimentState.value.state.isHeating = true;
      experimentData.value.temperature = '60°C';
      break;
    case 'drip_hcl':
      experimentState.value.state.hclDripping = true;
      experimentState.value.state.cl2Generating = true;
      experimentData.value.cl2Concentration = '100 ppm';
      break;
    case 'observe_reaction':
      experimentData.value.cl2Concentration = '500 ppm';
      // 确保在这一步只启动前两根管道的流动
      if (labSceneRef && labSceneRef.value) {
        // 调用 LabScene 中的方法，传递参数 2 表示只启动前两根管道
        if (labSceneRef.value.showPipeFlow) {
          labSceneRef.value.showPipeFlow.value = true;
        }
        if (typeof labSceneRef.value.updatePipeFlow === 'function') {
          labSceneRef.value.updatePipeFlow(2);
        } else {
          console.warn('updatePipeFlow 方法不可用');
        }
      }
      break;
    case 'purify_cl2':
      experimentState.value.state.cl2Purifying = true;
      // 确保前两根管道继续流动，并添加第三根管道流动
      if (labSceneRef && labSceneRef.value && typeof labSceneRef.value.updatePipeFlow === 'function') {
        labSceneRef.value.updatePipeFlow(4); // 更新为4根管道
      }
      break;
    case 'dry_cl2':
      experimentState.value.state.cl2Drying = true;
      // 确保前四根管道继续流动，并添加第五、六根管道流动
      if (labSceneRef && labSceneRef.value && typeof labSceneRef.value.updatePipeFlow === 'function') {
        labSceneRef.value.updatePipeFlow(6); // 更新为6根管道
      }
      break;
    case 'collect_cl2': 
      experimentState.value.state.cl2Collecting = true;
      // 确保前六根管道继续流动，并添加第七、八根管道流动
      if (labSceneRef && labSceneRef.value && typeof labSceneRef.value.updatePipeFlow === 'function') {
        labSceneRef.value.updatePipeFlow(8); // 更新为8根管道
      }
      // 调用 LabScene 中的方法开始填充
      if (labSceneRef && labSceneRef.value && labSceneRef.value.startChlorineFill) {
        labSceneRef.value.startChlorineFill();
      } else {
        console.warn('无法调用 startChlorineFill，labSceneRef 不可用');
      }
      break;
    case 'absorb_excess_cl2':
      experimentState.value.state.cl2Absorbing = true;
      experimentData.value.cl2Concentration = '0 ppm';
      // 确保所有管道继续流动
      if (labSceneRef && labSceneRef.value && typeof labSceneRef.value.updatePipeFlow === 'function') {
        labSceneRef.value.updatePipeFlow(10); // 更新为所有管道
      }
      break;
  }
};

onMounted(() => {
  console.log('实验助手组件已加载');
  
  // 订阅碰撞事件
  if (window.eventBus) {
    window.eventBus.on('collision-detected', handleCollisionEvent);
  }
});

// 组件卸载时清理定时器和事件监听
onBeforeUnmount(() => {
  if (cl2ConcentrationInterval.value) {
    clearInterval(cl2ConcentrationInterval.value);
  }
  
  // 取消订阅碰撞事件
  if (window.eventBus) {
    window.eventBus.off('collision-detected', handleCollisionEvent);
  }
});
</script>

<style scoped>
.experiment-assistant-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: transparent;
  overflow: hidden;
}

.top-decoration {
  height: 8px;
  width: 100%;
  background: linear-gradient(to right, #4A90E2, #3a7bc8);
  pointer-events: auto;
}

.content-container {
  display: flex;
  flex: 1;
  height: calc(100% - 8px);
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.left-panel {
  width: 25%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  background: linear-gradient(135deg, #f5f7fa 0%, #e6f0fa 100%);
  overflow-y: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
}

.tip-box {
  margin: 0;
  padding: 16px;
  background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);
  border-left: 4px solid #ffc107;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: #5d4037;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease;
}

.tip-box:hover {
  transform: translateX(4px);
}

.tip-box::before {
  content: "💡";
  margin-right: 12px;
  font-size: 18px;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: auto;
  padding: 16px 0;
}

.action-buttons .el-button {
  flex: 1;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-buttons .el-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-buttons .el-button:active {
  transform: translateY(0);
}

/* 滚动条样式 */
.left-panel::-webkit-scrollbar {
  width: 8px;
}

.left-panel::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.left-panel::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #4A90E2, #3a7bc8);
  border-radius: 4px;
}

.left-panel::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #3a7bc8, #2a6cb8);
}

/* 响应式布局调整 */
@media (max-width: 1200px) {
  .content-container {
    flex-direction: column;
  }
  
  .left-panel, .right-panel {
    width: 100%;
  }
  
  .left-panel {
    height: 40%;
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  
  .right-panel {
    height: 60%;
  }
}

/* 收起状态下的样式 */
:deep(.assistant-wrapper.collapsed) .experiment-assistant-container {
  background-color: transparent;
}

:deep(.assistant-wrapper.collapsed) .content-container {
  background-color: transparent;
  box-shadow: none;
}

:deep(.assistant-wrapper.collapsed) .left-panel {
  width: 100% !important; /* 确保收起状态下宽度为100% */
  flex: 1;
  padding: 12px;
  gap: 12px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border-right: none;
}

:deep(.assistant-wrapper.collapsed) .right-panel {
  display: none;
  width: 0;
  flex: 0;
}

:deep(.assistant-wrapper.collapsed) .tip-box {
  display: none;
}

:deep(.assistant-wrapper.collapsed) .action-buttons {
  margin-top: auto;
  padding: 12px 0;
}

:deep(.assistant-wrapper.collapsed) .experiment-data {
  margin-bottom: 12px;
}

:deep(.assistant-wrapper.collapsed) .experiment-steps {
  margin-bottom: 12px;
}
</style>