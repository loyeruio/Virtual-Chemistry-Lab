<template>
  <div class="experiment-steps">
    <h2 class="section-title">实验步骤</h2>
    <div class="steps-container">
      <ul class="steps-list">
        <li 
          v-for="step in sortedSteps" 
          :key="step.id" 
          :class="[
            'step-item', 
            {
              'active': currentStep === step.id,
              'completed': isStepCompleted(step)
            }
          ]"
          @click="handleStepClick(step)"
        >
          <span class="step-number">{{ step.correctOrder + 1 }}</span>
          <span class="step-description">{{ step.description }}</span>
          <span v-if="isStepCompleted(step)" class="step-status">✓</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  steps: {
    type: Array,
    required: true
  },
  currentStepIndex: {
    type: Number,
    required: true
  },
  isExperimentStarted: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['step-click']);

// 当前选中的步骤
const currentStep = ref('');

// 按照正确顺序排序步骤
const sortedSteps = computed(() => {
  return [...props.steps].sort((a, b) => a.correctOrder - b.correctOrder);
});

// 判断步骤是否已完成
const isStepCompleted = (step) => {
  return step.correctOrder < props.currentStepIndex;
};

// 判断步骤是否可以点击
const canClickStep = (step) => {
  // 允许点击任何步骤
  return true;
};

// 处理步骤点击
const handleStepClick = (step) => {
  if (!props.isExperimentStarted) {
    ElMessage.warning('请先点击"开始实验"按钮');
    return;
  }
  
  currentStep.value = step.id;
  if (!canClickStep(step)) {
    ElMessage.warning('请按照正确的顺序执行实验步骤');
    return;
  }
  
  // 触发步骤事件
  if (window.eventBus) {
    window.eventBus.emit('experiment-step', step.id);
  }
  
  currentStep.value = step.id;
  emit('step-click', step);
};
</script>

<style scoped>
.experiment-steps {
  margin-bottom: 20px;
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 1;
  padding-bottom: 8px;
  border-bottom: 2px solid #e0e0e0;
}

.steps-container {
  max-height: 250px;
  overflow-y: auto;
  position: relative;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

/* 滚动条样式优化 */
.steps-container::-webkit-scrollbar {
  width: 10px;
}

.steps-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 6px;
}

.steps-container::-webkit-scrollbar-thumb {
  background: #4A90E2;
  border-radius: 6px;
  border: 2px solid #f1f1f1;
}

.steps-container::-webkit-scrollbar-thumb:hover {
  background: #3a7bc8;
}

.steps-list {
  list-style: none;
  padding: 0;
  margin: 0;
  position: relative;
}

/* 添加左侧进度线 */
.steps-list::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 0;
  height: 100%;
  width: 2px;
  background-color: #e0e0e0;
  z-index: 0;
}

.step-item {
  font-size: 14px;
  padding: 12px 12px 12px 40px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-number {
  position: absolute;
  left: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #4A90E2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.step-description {
  flex: 1;
}

.step-status {
  color: #4CAF50;
  font-weight: bold;
}

.step-item.completed {
  background-color: #E8F5E9;
  color: #2E7D32;
}

.step-item.completed .step-number {
  background-color: #4CAF50;
}

.step-item.active {
  background-color: #E3F2FD;
  font-weight: bold;
}

.step-item:hover {
  background-color: #f5f5f5;
  transform: translateX(5px);
}
</style>