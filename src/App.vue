<template>
  <div class="app-container">
    <div class="scene-container">
      <LabScene />
    </div>
    <div class="assistant-wrapper" :class="{ 'collapsed': isCollapsed }">
      <div class="toggle-button" @click="toggleAssistant">
        <el-icon><Expand v-if="isCollapsed" /><Fold v-else /></el-icon>
      </div>
      <ExperimentAssistant 
        :is-collapsed="isCollapsed" 
        @show-response="showResponse" 
      />
    </div>
    
    <!-- 替换原来的el-dialog为自定义通知 -->
    <transition name="notification-fade">
      <div v-if="showResponseDialog" class="ai-notification">
        <div class="notification-header">
          <div class="notification-avatar">
            <img src="/icon/deepseek.svg" alt="AI Avatar" />
          </div>
          <div class="notification-title">AI助手</div>
          <div class="notification-close" @click="showResponseDialog = false">
            <el-icon><Close /></el-icon>
          </div>
        </div>
        <div class="notification-content" v-html="currentResponse"></div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import LabScene from './components/LabScene.vue';
import ExperimentAssistant from './components/ExperimentAssistant.vue';
import { ref, onMounted, provide } from 'vue';
import { Expand, Fold, Close } from '@element-plus/icons-vue';
import mitt from 'mitt';

// 创建事件总线
window.eventBus = mitt();

const isCollapsed = ref(true); // 设置初始值为 true，使界面默认收起
const showResponseDialog = ref(false);
const currentResponse = ref('');
const labSceneRef = ref(null);

// 提供LabScene组件引用给其他组件
provide('labSceneRef', labSceneRef);

const toggleAssistant = () => {
  isCollapsed.value = !isCollapsed.value;
  
  // 直接操作DOM样式
  setTimeout(() => {
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) {
      if (isCollapsed.value) {
        leftPanel.style.width = '100%';
      } else {
        leftPanel.style.width = '25%';
      }
    }
  }, 0);
};

const showResponse = (response) => {
  currentResponse.value = response;
  showResponseDialog.value = true;
  
  // 自动关闭通知
  setTimeout(() => {
    showResponseDialog.value = false;
  }, 8000); // 8秒后自动关闭
};

onMounted(() => {
  // 设置初始样式
  const leftPanel = document.querySelector('.left-panel');
  if (leftPanel) {
    if (isCollapsed.value) {
      leftPanel.style.width = '100%';
    } else {
      leftPanel.style.width = '25%';
    }
  }
});
</script>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden; /* 防止出现滚动条 */
  margin: 0;
  padding: 0;
  position: relative;
}

.scene-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.assistant-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 1200px;
  height: 80vh;
  z-index: 10;
  transition: all 0.3s ease;
  display: flex;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.assistant-wrapper.collapsed {
  left: 0;
  transform: translate(0, -50%);
  width: 30%;
  max-width: 400px;
  background-color: transparent;
  box-shadow: none;
}

.assistant-wrapper.collapsed :deep(.experiment-assistant-container) {
  width: 100%;
}

.assistant-wrapper.collapsed :deep(.content-container) {
  background-color: transparent;
  box-shadow: none;
  width: 100%;
}

.assistant-wrapper.collapsed :deep(.left-panel) {
  width: 100% !important; /* 添加 !important 确保优先级 */
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.assistant-wrapper.collapsed :deep(.right-panel) {
  display: none;
}

.toggle-button {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  background-color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 11;
  transition: all 0.3s ease;
}

.toggle-button:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.toggle-button .el-icon {
  font-size: 18px;
  color: #4A90E2;
}

/* 弹窗样式优化 */
:deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  margin: 0;
  padding: 16px 20px;
  background: linear-gradient(to right, #4A90E2, #3a7bc8);
  color: white;
}

:deep(.el-dialog__title) {
  color: white;
  font-size: 18px;
  font-weight: 500;
}

:deep(.el-dialog__body) {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: white;
}

/* 新增通知样式 */
.ai-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.notification-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(to right, #4A90E2, #3a7bc8);
  color: white;
}

.notification-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  border: 2px solid white;
  overflow: hidden;
}

.notification-avatar img {
  width: 70%;
  height: 70%;
  object-fit: contain;
}

.notification-title {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
}

.notification-close {
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.notification-close:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.notification-content {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
}

/* 通知动画 */
.notification-fade-enter-active,
.notification-fade-leave-active {
  transition: all 0.3s ease;
}

.notification-fade-enter-from,
.notification-fade-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>