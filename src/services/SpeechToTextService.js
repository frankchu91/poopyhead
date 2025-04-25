import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { OPENAI_API_KEY } from '../config/keys';
import { chatLogic } from '../core/useChatLogic';

// API密钥
const API_KEY = OPENAI_API_KEY;

// 调试日志
function debugLog(step, data) {
  console.log(`[DEBUG:${step}]`, 
    typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : data);
}

export default class SpeechToTextService {
  constructor(onTranscriptionUpdate) {
    this.recording = null;              // 用于录音的单一对象
    this.isRecording = false;
    this.recordingInterval = null;
    this.onTranscriptionUpdate = onTranscriptionUpdate;
    this.transcription = "";
    this.recordingStartTime = null;
    this.mainAudioUri = null;           // 存储完整录音的URI
    
    // 添加文件收集器
    this.audioFiles = [];
    this.processingIndex = 0;
    this.isProcessing = false;
    this.currentMessageId = null;       // 添加当前消息ID追踪
    this.recordingDuration = 0;         // 记录当前录音总时长(秒)
    this.segmentDuration = 3;           // 每个片段的时长(秒)
    this.lastSegmentTime = 0;           // 上次截取片段的时间
  }

  // 开始录音
  async startRecording() {
    try {
      // 请求录音权限
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (permissionResponse.status !== 'granted') {
        console.error('未授予录音权限');
        return false;
      }
      
      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // 使用数字常量值
        interruptionModeIOS: 1, // DO_NOT_MIX = 1
        interruptionModeAndroid: 1, // DO_NOT_MIX = 1
      });
      
      // 确保任何现有录音已停止
      await this.ensureNoActiveRecording();
      
      // 创建新录音对象 - 使用原始WAV格式设置
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_PCM_16BIT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_PCM_16BIT,
          sampleRate: 16000,
          numberOfChannels: 1,
        },
        ios: {
          extension: '.wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      await this.recording.startAsync();
      console.log("录音已开始，使用WAV格式（16kHz, 16位PCM）");
      
      // 完全重置所有状态
      this.isRecording = true;
      this.transcription = ""; // 确保转录内容被清空
      this.recordingStartTime = new Date();
      this.audioFiles = [];
      this.processingIndex = 0;
      this.isProcessing = false;
      this.recordingDuration = 0; // 重置录音时长
      this.lastSegmentTime = 0;   // 重置上次截取片段的时间
      this.mainAudioUri = null;   // 重置完整录音的URI
      
      console.log("录音已开始，所有转录状态已重置");
      
      // 设置每3秒处理一次录音片段
      this.recordingInterval = setInterval(async () => {
        if (this.isRecording) {
          await this.captureAudioSegment();
          // 更新录音时长
          this.recordingDuration += this.segmentDuration;
        }
      }, this.segmentDuration * 1000);
      
      return true;
    } catch (error) {
      console.error('Start recording error:', error);
      await this.cleanupResources();
      return false;
    }
  }
  
  // 确保没有活动的录音
  async ensureNoActiveRecording() {
    if (this.recording) {
      try {
        const status = await this.recording.getStatusAsync();
        if (status.isRecording) {
          await this.recording.stopAndUnloadAsync();
        } else if (status.isDoneRecording) {
          await this.recording.unloadAsync();
        }
      } catch (error) {
        // 如果录音对象无效，忽略错误
        console.warn("Warning while stopping recording:", error.message);
      }
      this.recording = null;
    }
  }
  
  // 捕获当前音频片段用于转录，但不中断主录音
  async captureAudioSegment() {
    if (!this.isRecording || !this.recording) return;
    
    try {
      // 获取当前录音状态
      const status = await this.recording.getStatusAsync();
      if (!status.isRecording) {
        console.log("录音未处于活动状态，无法捕获片段");
        return;
      }
      
      // 获取主录音的URI - 用于最终返回完整录音
      this.mainAudioUri = this.recording.getURI();
      if (!this.mainAudioUri) {
        console.log("无法获取录音URI");
        return;
      }
      
      // 检查并确认文件扩展名（应该是.wav）
      const fileExt = this.mainAudioUri.split('.').pop().toLowerCase();
      console.log(`当前录音文件格式: ${fileExt}`);
      
      // 计算这个片段的时间信息
      const startTime = this.lastSegmentTime;
      const endTime = this.recordingDuration + this.segmentDuration;
      this.lastSegmentTime = endTime;
      
      // 为转录创建音频片段的副本
      const segmentFileName = `segment_${Date.now()}.wav`;
      const segmentUri = FileSystem.cacheDirectory + segmentFileName;
      
      // 复制当前录音文件的副本用于转录
      await FileSystem.copyAsync({
        from: this.mainAudioUri,
        to: segmentUri
      });
      
      console.log(`已创建音频片段用于转录: ${segmentUri}`);
      
      // 检查文件是否存在
      const fileInfo = await FileSystem.getInfoAsync(segmentUri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        console.log("警告: 复制的文件不存在或为空");
        return;
      }
      
      console.log(`音频片段文件大小: ${fileInfo.size} 字节`);
      
      // 添加到文件列表，包含时间信息
      this.audioFiles.push({
        uri: segmentUri,
        startTime: startTime,
        endTime: endTime
      });
      
      // 处理队列中的文件
      if (!this.isProcessing) {
        await this.processAudioFiles();
      }
      
    } catch (error) {
      console.error('捕获音频片段出错:', error);
    }
  }
  
  // 处理音频文件队列
  async processAudioFiles() {
    if (this.isProcessing || this.processingIndex >= this.audioFiles.length) return;
    
    this.isProcessing = true;
    
    try {
      // 收集所有待处理文件的转录结果
      const newTranscriptions = [];
      
      while (this.processingIndex < this.audioFiles.length) {
        const fileData = this.audioFiles[this.processingIndex];
        const fileUri = fileData.uri;
        
        // 转录这个文件
        const transcription = await this.transcribeAudioChunk(fileUri);
        
        // 如果有转录结果，添加到数组
        if (transcription && transcription.trim() !== '') {
          // 保存这个新的转录结果
          newTranscriptions.push(transcription);
          
          // 添加到总转录文本
          if (this.transcription) {
            this.transcription += ' ' + transcription.trim();
          } else {
            this.transcription = transcription.trim();
          }
          
          // 每处理一个文件就更新一次UI，以显示增量更新
          if (typeof this.onTranscriptionUpdate === 'function') {
            console.log("发送累积转录更新:", this.transcription);
            
            const now = new Date();
            const totalDuration = (now - this.recordingStartTime) / 1000;
            const estimatedTranscribedDuration = this.processingIndex * this.segmentDuration;
            const progress = Math.min(1.0, estimatedTranscribedDuration / totalDuration);
            
            // 调用更新方法，传递累积的完整转录文本，而不只是当前段的转录
            this.onTranscriptionUpdate(this.transcription, {
              totalDuration,
              transcribedDuration: estimatedTranscribedDuration,
              progress,
              isIncremental: true,
              isFullTranscription: true, // 指示这是完整的转录文本，而不是增量
              timestamp: new Date() // 添加当前时间戳
            });
          }
        }
        
        this.processingIndex++;
      }
    } catch (error) {
      console.error('处理音频文件队列出错:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  // 停止录音并返回最终转录
  async stopRecording() {
    if (!this.isRecording) {
      return { text: this.transcription, audioUri: null };
    }
    
    console.log("停止录音...");
    this.isRecording = false;
    
    // 清除定时器
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    try {
      // 确保我们获取了最终的录音URI
      if (!this.mainAudioUri && this.recording) {
        this.mainAudioUri = this.recording.getURI();
      }
      
      // 停止录音
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        console.log(`录音已停止并保存: ${this.mainAudioUri}`);
      }
      
      // 处理所有剩余文件 - 但只更新一次UI
      await this.processRemainingFiles();
      
      console.log(`录音已停止。完整录音文件: ${this.mainAudioUri}`);
      
      // 返回转录文本和主录音URI
      // 注意：此处只返回主录音文件（完整录音）用于回放，不返回分段文件
      return { 
        text: this.transcription,
        audioUri: this.mainAudioUri
      };
    } catch (error) {
      console.warn("注意: 录音可能已经停止:", error.message);
      
      // 出错时也尝试返回主录音文件
      return { 
        text: this.transcription,
        audioUri: this.mainAudioUri
      };
    } finally {
      // 清理资源
      await this.cleanupResources();
      console.log("录音已停止，资源已清理");
    }
  }
  
  // 专门处理剩余文件的方法
  async processRemainingFiles() {
    if (this.processingIndex >= this.audioFiles.length) return;
    
    try {
      const pendingFiles = this.audioFiles.slice(this.processingIndex);
      
      for (const fileData of pendingFiles) {
        const transcription = await this.transcribeAudioChunk(fileData.uri);
        if (transcription && transcription.trim()) {
          // 将新转录添加到总转录中
          if (this.transcription) {
            this.transcription += ' ' + transcription.trim();
          } else {
            this.transcription = transcription.trim();
          }
        }
        this.processingIndex++;
      }
      
      // 最后一次更新UI，确保传递最终的累积转录结果
      if (this.transcription && this.onTranscriptionUpdate) {
        console.log("发送最终转录结果:", this.transcription);
        this.onTranscriptionUpdate(this.transcription, {
          totalDuration: (new Date() - this.recordingStartTime) / 1000,
          transcribedDuration: this.audioFiles.length * this.segmentDuration,
          progress: 1.0,
          isFullTranscription: true, // 指示这是完整的转录文本
          isFinalTranscription: true // 指示这是最终的转录结果
        });
      }
    } catch (error) {
      console.error('处理剩余文件出错:', error);
    }
  }
  
  // 清理所有资源
  async cleanupResources() {
    // 清除定时器
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    // 确保录音已停止
    await this.ensureNoActiveRecording();
    
    // 重置音频模式
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch (error) {
      console.warn('重置音频模式出错:', error);
    }
  }
  
  // 转录单个音频块
  async transcribeAudioChunk(fileUri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        console.log("文件不存在或为空:", fileUri);
        return '';
      }
      
      // 详细记录文件信息用于调试
      console.log(`准备转录文件: ${fileUri}, 大小: ${fileInfo.size} 字节`);
      
      // 创建FormData用于上传
      const formData = new FormData();
      
      // 添加文件 - 使用WAV格式正确的MIME类型
      formData.append('file', {
        uri: fileUri,
        type: 'audio/wav',
        name: 'audio_chunk.wav'
      });
      
      // 添加其他参数 - 使用OpenAI推荐的Whisper模型
      formData.append('model', 'whisper-1');
      formData.append('language', 'zh'); // 中文
      
      console.log(`发送转录请求，模型: whisper-1, 语言: zh`);
      
      // 发送请求到OpenAI API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: formData
      });
      
      // 检查响应
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API错误 (${response.status}): ${errorText}`);
      }
      
      // 解析JSON响应
      const data = await response.json();
      console.log(`转录结果: ${data.text || ''}`);
      return data.text || '';
      
    } catch (error) {
      console.error('转录音频块出错:', error);
      return '';
    }
  }

  // 取消录音
  async cancelRecording() {
    try {
      if (this.recording) {
        console.log("正在取消录音...");
        
        // 停止录音计时器
        if (this.recordingInterval) {
          clearInterval(this.recordingInterval);
          this.recordingInterval = null;
        }
        
        // 确保所有录音已停止
        await this.ensureNoActiveRecording();
        
        // 重置录音相关状态
        this.recording = null;
        this.isRecording = false;
        this.audioFiles = [];
        this.processingIndex = 0;
        this.isProcessing = false;
        this.transcription = "";
        this.recordingStartTime = null;
        this.recordingDuration = 0;
        this.mainAudioUri = null;
        
        console.log("录音已取消，资源已清理");
      }
    } catch (error) {
      console.error("取消录音时出错:", error);
    }
  }

  // 修改转录更新逻辑 - 将其作为类的方法
  updateTranscription(text, speakerName) {
    // 获取当前活跃的消息ID
    const activeSpeakerMessage = chatLogic.getActiveTranscriptionMessage();
    
    if (activeSpeakerMessage) {
      // 检查这个活跃消息后面是否有用户消息
      if (chatLogic.hasUserMessageAfter(activeSpeakerMessage.id)) {
        // 如果有用户消息，创建新的转录消息
        chatLogic.addMessage(text, false);
      } else {
        // 没有用户消息，更新现有转录
        chatLogic.updateMessage(activeSpeakerMessage.id, text);
      }
    } else {
      // 没有活跃消息，创建新的
      chatLogic.addMessage(text, false);
    }
  }

  // 重置转录内容而不停止录音
  resetTranscription() {
    console.log("重置转录内容");
    this.transcription = "";
    return true;
  }

  // 合并多个音频文件为一个文件
  async mergeAudioFiles(audioFiles) {
    if (!audioFiles || audioFiles.length === 0) return null;
    if (audioFiles.length === 1) return audioFiles[0];
    
    try {
      console.log(`开始合并 ${audioFiles.length} 个音频文件...`);
      
      // 创建一个临时目录用于合并操作
      const tempDir = FileSystem.cacheDirectory + 'audio_merge/';
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(e => {
        // 目录可能已存在，忽略错误
        console.log("创建临时目录失败，可能已存在:", e.message);
      });
      
      // 创建合并后的文件名
      const mergedFileName = `merged_${Date.now()}.wav`;
      const mergedFileUri = `${tempDir}${mergedFileName}`;
      
      // 在移动端无法直接合并音频文件，我们只能保存引用
      console.log("将使用第一个音频文件作为主要回放文件:", audioFiles[0]);
      
      // 保存所有音频文件URI到合并信息文件中，以便将来可能的串联播放
      const mergeInfoFile = `${tempDir}merge_info.json`;
      await FileSystem.writeAsStringAsync(
        mergeInfoFile,
        JSON.stringify({
          files: audioFiles,
          created: new Date().toISOString()
        })
      );
      
      console.log("已保存所有音频文件信息用于回放");
      
      // 创建一个复制的第一个文件，将其作为主要回放文件
      const mainAudioFile = `${tempDir}main_audio.wav`;
      await FileSystem.copyAsync({
        from: audioFiles[0],
        to: mainAudioFile
      });
      
      console.log("已将第一个音频文件复制为主要回放文件:", mainAudioFile);
      
      return mainAudioFile;
    } catch (error) {
      console.error("音频合并失败:", error);
      // 失败时返回第一个音频文件
      return audioFiles[0];
    }
  }
} 