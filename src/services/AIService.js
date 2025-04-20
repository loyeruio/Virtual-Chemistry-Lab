/**
 * AI服务 - 处理与AI后端的通信
 */
export default class AIService {
  constructor() {
    // 从环境变量读取 API URL，提供一个本地默认值
    this.apiUrl = 'http://123.57.209.252:8080/api/ai';
    this.isConnected = false;
    this.pendingRequests = [];
    this.connectionCheckInterval = null;
    this.modelType = 'local'; // 默认使用本地模型
  }

  /**
   * 处理用户问题
   * @param {string} question 用户问题
   * @returns {Promise<object>} AI响应
   */
  async handleUserQuestion(question) {
    try {
      console.log('处理用户问题:', question, '使用模型:', this.modelType);
      
      // 获取当前实验状态
      const experimentState = {
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
      };
      
      // 获取当前步骤信息
      const currentStep = {
        id: "check_setup",
        description: "检查装置气密性",
        completed: false,
        correctOrder: 0
      };
      
      // 发送请求到AI后端
      const response = await this.sendRequest('question', {
        question,
        experimentState, // 确保这里传递了正确的 experimentState
        currentStep,     // 确保这里传递了正确的 currentStep
        modelType: this.modelType
      });

      return response;
    } catch (error) {
      console.error('处理用户问题时出错:', error);
      throw error;
    }
  }

  /**
   * 处理步骤请求
   * @param {string} stepId 步骤ID
   * @param {string} stepDescription 步骤描述
   * @param {boolean} isCorrectStep 是否是正确的步骤
   * @param {object} experimentState 实验状态
   * @param {number} currentStepIndex 当前步骤索引
   * @returns {Promise<object>} AI响应
   */
  async handleStepRequest(stepId, stepDescription, isCorrectStep, experimentState, currentStepIndex) {
    try {
      // 发送请求到AI后端
      const response = await this.sendRequest('step', {
        stepId,
        stepDescription,
        isCorrectStep,
        experimentState,
        currentStep: currentStepIndex,
        modelType: this.modelType
      });
      
      return response;
    } catch (error) {
      console.error('处理步骤请求失败:', error);
      throw error;
    }
  }

  /**
   * 发送请求到AI后端
   * @param {string} type 请求类型
   * @param {object} data 请求数据
   * @returns {Promise<object>} 响应数据
   */
  async sendRequest(type, data) {
    try {
      console.log(`发送${type}类型的AI请求:`, data);
      
      const requestBody = {
        type,
        ...data,
        modelType: this.modelType
      };
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`AI请求失败: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('AI请求错误:', error);
      throw error;
    }
  }

  formatAIResponse(response) {
    if (!response) return '';
    
    // 移除模型标识前的空格
    response = response.replace(/^\[([^\]]+)\]\s*/, '[$1]');
    
    // 处理标题格式
    response = response.replace(/(\d+)\.\s*([^：\n]+)(?:：|\n)/g, '<h4 class="ai-response-title">$1. $2</h4>');
    
    // 处理加粗文本（**text**）
    response = response.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 处理列表项
    // 1. 处理带数字编号的子列表项 (1) 2) 3))
    response = response.replace(/(\d+)\)\s+([^\n]+)/g, '<li class="sub-item">$1) $2</li>');
    
    // 2. 处理带破折号的列表项，确保它们在新行上
    response = response.replace(/(?<=^|\n)-\s+([^\n]+)/g, '<li>$1</li>');
    
    // 3. 处理没有前缀的列表项（通常是破折号后的新行内容）
    response = response.replace(/(?<=<\/li>\n)(?![-•\d]|\s*<)([^\n]+)/g, '<li>$1</li>');
    
    // 将连续的列表项包装在ul标签中
    response = response.replace(/(<li>(?!.*?class="sub-item".*?<\/li>).*?<\/li>\s*)+/g, '<ul>$&</ul>');
    
    // 将连续的子列表项包装在单独的ul标签中
    response = response.replace(/(<li class="sub-item">.*?<\/li>\s*)+/g, '<ul class="sub-list">$&</ul>');
    
    // 处理段落
    response = response.split('\n').map(line => {
      line = line.trim();
      if (line && !line.startsWith('<') && !line.match(/^\d+\)\s/) && !line.match(/^[-•]\s/)) {
        return `<p>${line}</p>`;
      }
      return line;
    }).join('\n');
    
    // 清理多余的空白和标签
    response = response
      .replace(/\s*<\/p>\s*<p>\s*/g, '</p><p>')
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return response;
  }
}
