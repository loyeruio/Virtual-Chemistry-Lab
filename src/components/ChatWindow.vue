<template>
    <div class="chat-window">
      <div class="chat-header">
        <h2 class="chat-title">😀 AI 实验助手</h2>
        <div class="model-selector">
          <span class="model-label">选择模型：</span>
          <el-select v-model="selectedModel" @change="changeModel" size="small">
            <el-option label="本地模型" value="local" />
            <el-option label="DeepSeek-R1" value="online" />
            <el-option label="DeepSeek-V3" value="onlineV3" />
          </el-select>
        </div>
      </div>
      
      <div class="chat-messages" ref="messagesContainer">
        <div 
          v-for="message in messages" 
          :key="message.id" 
          :class="['message', message.sender === 'ai' ? 'ai-message' : 'user-message']"
        >
          <div class="message-avatar">
            <img :src="message.avatar" alt="Avatar" />
          </div>
          <div class="message-content" v-html="message.content"></div>
        </div>
        
        <div v-if="loading" class="message ai-message">
          <div class="message-avatar">
            <img src="/icon/deepseek.svg" alt="AI Avatar" />
          </div>
          <div class="message-content typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
      
      <div class="chat-input">
        <el-input
          v-model="inputMessage"
          placeholder="有问题？向AI助手提问..."
          :disabled="loading"
          @keyup.enter="sendMessage"
        >
          <template #prefix>
            <el-icon><ChatDotRound /></el-icon>
          </template>
        </el-input>
        <button class="send-button" @click="sendMessage" :class="{ disabled: loading || !inputMessage.trim() }">
          <el-icon><Position /></el-icon>
        </button>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, watch, nextTick } from 'vue';
  import { Position, ChatDotRound } from '@element-plus/icons-vue';
  
  const props = defineProps({
    messages: {
      type: Array,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    currentModel: {
      type: String,
      default: 'local'
    }
  });
  
  const emit = defineEmits(['send-message', 'change-model']);
  
  const inputMessage = ref('');
  const messagesContainer = ref(null);
  const selectedModel = ref(props.currentModel);
  
  // 发送消息
  const sendMessage = () => {
    if (inputMessage.value.trim() && !props.loading) {
      emit('send-message', inputMessage.value);
      inputMessage.value = '';
    }
  };
  
  // 切换模型
  const changeModel = (value) => {
    if (value !== props.currentModel) {
      emit('change-model', value);
    }
  };
  
  // 监听消息变化，自动滚动到底部
  watch(() => props.messages.length, async () => {
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
  
  // 监听加载状态变化，自动滚动到底部
  watch(() => props.loading, async (newVal) => {
    if (newVal) {
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    }
  });
  
  // 监听当前模型变化
  watch(() => props.currentModel, (newVal) => {
    selectedModel.value = newVal;
  });
  </script>
  
  <style scoped>
  .chat-window {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f0f5fa;
    border-radius: 12px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    font-size: 16px; /* 统一基础字体大小 */
  }
  
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between; /* 两端对齐 */
    padding: 14px 20px;
    background-color: white; /* 改为白色背景 */
    color: #333; /* 文字颜色改为深色 */
    border-bottom: 1px solid #eaeaea;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    position: relative;
    z-index: 2;
  }
  
  .model-selector {
    display: flex;
    align-items: center;
    background-color: #f5f7fa;
    padding: 4px 10px;
    border-radius: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  
  .model-label {
    margin-right: 8px;
    font-size: 14px;
    color: #666;
    white-space: nowrap;
  }
  
  .model-selector :deep(.el-input__wrapper) {
    background-color: transparent;
    box-shadow: none;
    padding: 0;
  }
  
  .model-selector :deep(.el-select) {
    width: 120px;
  }
  
  .chat-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #4A90E2;
  }
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNGNUY3RkEiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRjMCAxLjEtLjkgMi0yIDJzLTItLjktMi0yIC45LTIgMi0yIDIgLjkgMiAyem0tMTYgMGMwIDEuMS0uOSAyLTIgMnMtMi0uOS0yLTIgLjktMiAyLTIgMiAuOSAyIDJ6bTE2LTE2YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTE2IDBjMCAxLjEtLjkgMi0yIDJzLTItLjktMi0yIC45LTIgMi0yIDIgLjkgMiAyeiI+PC9wYXRoPjwvZz48L2c+PC9zdmc+');
    background-color: #f9f9f9;
  }
  
  .message {
    display: flex;
    max-width: 85%;
    animation: fadeIn 0.3s ease-out;
    font-size: 15px; /* 消息文字大小 */
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .ai-message {
    align-self: flex-start;
  }
  
  .user-message {
    align-self: flex-end;
    margin-left: auto;
    flex-direction: row-reverse;
  }
  
  .message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
    background-color: #f0f0f0; /* 添加背景色，防止图片加载失败时显示空白 */
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .message-avatar img {
    width: 80%;
    height: 80%;
    object-fit: cover;
  }
  
  .message-content {
    padding: 14px 18px;
    border-radius: 18px;
    margin: 0 12px;
    word-break: break-word;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    position: relative;
    transition: transform 0.2s ease;
  }
  
  .message-content :deep(h4.ai-response-title) {
    font-size: 16px;
    font-weight: 600;
    color: #1976d2;
    margin: 16px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(25, 118, 210, 0.2);
  }
  
  .message-content :deep(h4.ai-response-title:first-child) {
    margin-top: 0;
  }

  .message-content :deep(ul) {
    margin: 8px 0;
    padding-left: 20px;
    list-style-type: none;
  }

  .message-content :deep(ul.sub-list) {
    margin: 4px 0 4px 20px;
    padding-left: 16px;
    border-left: 2px solid rgba(25, 118, 210, 0.1);
  }

  .message-content :deep(li) {
    margin: 6px 0;
    line-height: 1.5;
    position: relative;
    padding-left: 16px;
  }
  .message-content :deep(li::before) {
    content: '•';
    position: absolute;
    left: 0;
    color: #1976d2;
  }
  
  .message-content :deep(li.sub-item) {
    color: #555;
    font-size: 0.95em;
    padding-left: 24px;
  }
  
  .message-content :deep(li.sub-item::before) {
    content: '';
  }
  
  .message-content :deep(strong) {
    color: #d32f2f;
    font-weight: 600;
  }
  
  .message-content :deep(p) {
    margin: 8px 0;
    line-height: 1.6;
  }

  .message-content :deep(p:first-of-type) {
    margin-top: 4px;
  }

  .message-content :deep(p:last-of-type) {
    margin-bottom: 4px;
  }
  
  .message-content :deep(p:first-child) {
    margin-top: 0;
  }
  
  .message-content :deep(p:last-child) {
    margin-bottom: 0;
  }
  .ai-message .message-content {
    background: linear-gradient(135deg, #E6F0FA 0%, #c5e1ff 100%);
    border-bottom-left-radius: 4px;
    color: #2c3e50;
    line-height: 1.6;
  }
  
  .user-message .message-content {
    background: linear-gradient(135deg, #4A90E2 0%, #3a7bc8 100%);
    color: white;
    border-bottom-right-radius: 4px;
  }
  
  .user-message .message-content::before {
    content: '';
    position: absolute;
    right: -8px;
    bottom: 8px;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #4A90E2 0%, #3a7bc8 100%);
    transform: rotate(45deg);
    z-index: -1;
    border-radius: 2px;
  }
  
  .typing {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
  }
  
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #4A90E2;
    margin: 0 3px;
    animation: typing 1.4s infinite ease-in-out both;
  }
  
  .dot:nth-child(1) {
    animation-delay: 0s;
  }
  
  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes typing {
    0%, 80%, 100% {
      transform: scale(0.6);
      opacity: 0.6;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  /* 修复聊天输入框和发送按钮 */
  .chat-input {
    display: flex;
    padding: 16px 20px;
    background-color: white;
    border-top: 1px solid #eee;
    position: relative;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    align-items: center;
  }
  
  .chat-input .el-input {
    flex: 1;
  }
  
  .chat-input :deep(.el-input__wrapper) {
    border-radius: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e0e0e0;
    transition: all 0.3s ease;
    padding-right: 50px; /* 为发送按钮留出空间 */
  }
  
  .chat-input :deep(.el-input__inner) {
    padding-left: 16px;
    font-size: 15px;
    color: #333;
    height: 44px; /* 确保输入框高度一致 */
  }
  
  .chat-input :deep(.el-input__inner::placeholder) {
    color: #555;
    font-weight: 500;
  }
  
  .send-button {
    position: absolute;
    right: 28px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #4A90E2 0%, #3a7bc8 100%);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
    z-index: 2;
    border: none; /* 移除按钮边框 */
  }
  
  .send-button .el-icon {
    font-size: 20px;
  }
  
  .send-button:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
  }
  
  .send-button:active {
    transform: scale(0.95);
  }
  
  .send-button.disabled {
    background: #ccc;
    cursor: not-allowed;
    box-shadow: none;
  }
  
  /* 滚动条样式 */
  .chat-messages::-webkit-scrollbar {
    width: 12px;
  }
  
  .chat-messages::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 8px;
    margin: 4px 0;
  }
  
  .chat-messages::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #4A90E2, #3a7bc8);
    border-radius: 8px;
    border: 3px solid #f1f1f1;
    min-height: 40px;
  }
  
  .chat-messages::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #3a7bc8, #2a6cb8);
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .message {
      max-width: 95%;
    }
    
    .chat-messages {
      padding: 12px;
    }
    
    .chat-input {
      padding: 12px;
    }
    
    .send-button {
      right: 20px;
    }
    
    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }
  }
  </style>