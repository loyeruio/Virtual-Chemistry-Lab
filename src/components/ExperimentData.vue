<template>
  <div class="experiment-data">
    <h2 class="section-title">实验数据</h2>
    <ul class="data-list">
      <li class="data-item">
        温度: <span class="data-value">{{ experimentData.temperature }}</span>
      </li>
      <li class="data-item">
        压力: <span class="data-value">{{ experimentData.pressure }}</span>
      </li>
      <li class="data-item">
        氯气浓度: <span class="data-value">{{ experimentData.cl2Concentration }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  experimentData: {
    type: Object,
    required: true
  }
});
</script>

<style scoped>
.experiment-data {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #1976d2;
  border-bottom: 2px solid #bbdefb;
  padding-bottom: 8px;
}

.data-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.data-item {
  font-size: 16px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.data-value {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

/* 温度值样式 */
.data-item:nth-child(1) .data-value {
  background-color: #ffebee;
  color: #c62828;
}

/* 压力值样式 */
.data-item:nth-child(2) .data-value {
  background-color: #e8f5e9;
  color: #2e7d32;
}

/* 氯气浓度样式 */
.data-item:nth-child(3) .data-value {
  background-color: #e3f2fd;
  color: #1565c0;
  transition: all 1s ease;
}

/* 氯气浓度过高时的警告样式 */
.data-item:nth-child(3) .data-value.warning {
  background-color: #fff3e0;
  color: #ef6c00;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>