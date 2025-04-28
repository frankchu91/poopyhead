import { OPENAI_API_KEY } from '../config/keys';

// API密钥
const API_KEY = OPENAI_API_KEY;

export default class AISummaryService {
  static async generateSummary(documentContent, documentTitle = '') {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的会议和笔记总结助手。分析以下内容并生成一个简洁的总结，
              提取关键要点，并列出可操作的待办事项。输出应为JSON格式，包含以下字段：
              summary（总结），key_points（要点列表），action_items（待办事项列表）。`
            },
            {
              role: 'user',
              content: `标题: ${documentTitle}\n\n内容:\n${documentContent}`
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        throw new Error(`API错误: ${errorData.error?.message || '未知错误'}`);
      }

      const data = await response.json();
      
      // 解析返回的JSON格式内容
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('API返回内容为空');
      }

      const parsedContent = JSON.parse(content);
      
      return {
        summary: parsedContent.summary || '无法生成总结',
        key_points: parsedContent.key_points || [],
        action_items: parsedContent.action_items || []
      };
    } catch (error) {
      console.error('生成AI总结时出错:', error);
      throw error;
    }
  }
} 