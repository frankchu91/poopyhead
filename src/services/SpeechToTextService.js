import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { OPENAI_API_KEY } from '../config/keys';

// API密钥
const API_KEY = OPENAI_API_KEY;

// 调试日志
function debugLog(step, data) {
  console.log(`[DEBUG:${step}]`, 
    typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : data);
}

export default class SpeechToTextService {
  constructor(onTranscriptionUpdate) {
    this.recording = null;
    this.isRecording = false;
    this.recordingInterval = null;
    this.onTranscriptionUpdate = onTranscriptionUpdate;
    this.transcription = "";
    this.recordingStartTime = null;
    
    // 添加文件收集器
    this.audioFiles = [];
    this.processingIndex = 0;
    this.isProcessing = false;
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
      
      // 创建新录音对象
      this.recording = new Audio.Recording();
      
      // 配置高质量音频
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
      
      // 开始录音
      await this.recording.startAsync();
      
      // 更新状态
      this.isRecording = true;
      this.transcription = "";
      this.recordingStartTime = new Date();
      this.audioFiles = [];
      this.processingIndex = 0;
      
      console.log("Recording started");
      
      // 设置每3秒保存一次录音
      this.recordingInterval = setInterval(async () => {
        if (this.isRecording) {
          await this.saveCurrentSegment();
        }
      }, 3000);
      
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
  
  // 保存当前录音段，并准备新段
  async saveCurrentSegment() {
    if (!this.isRecording || !this.recording) return;
    
    try {
      // 暂停当前录音
      await this.recording.pauseAsync();
      
      // 获取文件URI
      const uri = this.recording.getURI();
      
      if (uri) {
        // 添加到文件列表
        this.audioFiles.push(uri);
        
        // 处理队列中的文件
        if (!this.isProcessing) {
          this.processAudioFiles();
        }
      }
      
      // 停止并卸载当前录音，准备创建新录音
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
      
      // 创建新录音对象
      this.recording = new Audio.Recording();
      
      // 配置高质量音频
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
      
      // 继续新录音
      await this.recording.startAsync();
      
    } catch (error) {
      console.error('Error saving segment:', error);
      
      // 如果失败，尝试重新开始录音
      try {
        await this.ensureNoActiveRecording();
        
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
      } catch (restartError) {
        console.error('Could not restart recording:', restartError);
      }
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
        const fileUri = this.audioFiles[this.processingIndex];
        
        // 转录这个文件
        const transcription = await this.transcribeAudioChunk(fileUri);
        
        // 如果有转录结果，添加到数组
        if (transcription && transcription.trim() !== '') {
          newTranscriptions.push(transcription);
        }
        
        this.processingIndex++;
      }
      
      // 如果有新的转录结果，更新总转录文本
      if (newTranscriptions.length > 0) {
        // 直接使用新收集的所有转录，而不是累加到之前的文本
        this.transcription = newTranscriptions.join(' ');
        
        // 更新UI
        if (this.onTranscriptionUpdate) {
          const now = new Date();
          const totalDuration = (now - this.recordingStartTime) / 1000;
          const estimatedTranscribedDuration = this.processingIndex * 3; // 每段约3秒
          
          const progress = Math.min(1.0, estimatedTranscribedDuration / totalDuration);
          
          this.onTranscriptionUpdate(this.transcription, {
            totalDuration,
            transcribedDuration: estimatedTranscribedDuration,
            progress
          });
        }
      }
    } catch (error) {
      console.error('Error processing audio files:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  // 停止录音并返回最终转录
  async stopRecording() {
    if (!this.isRecording) {
      return this.transcription;
    }
    
    console.log("Stopping recording...");
    this.isRecording = false;
    
    // 清除定时器
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    try {
      // 保存最后一段录音
      if (this.recording) {
        const uri = this.recording.getURI();
        if (uri) {
          // 停止录音
          await this.recording.stopAndUnloadAsync();
          
          // 添加到文件列表
          this.audioFiles.push(uri);
        } else {
          await this.recording.stopAndUnloadAsync();
        }
      }
      
      // 处理所有剩余文件 - 但只更新一次UI
      await this.processRemainingFiles();
    } catch (error) {
      console.warn("Note: Recording may have already been stopped:", error.message);
    }
    
    // 清理资源
    await this.cleanupResources();
    
    console.log("Recording stopped");
    return this.transcription;
  }
  
  // 新增专门处理剩余文件的方法
  async processRemainingFiles() {
    if (this.processingIndex >= this.audioFiles.length) return;
    
    try {
      const pendingFiles = this.audioFiles.slice(this.processingIndex);
      const allTranscriptions = [];
      
      for (const fileUri of pendingFiles) {
        const transcription = await this.transcribeAudioChunk(fileUri);
        if (transcription && transcription.trim()) {
          allTranscriptions.push(transcription);
        }
        this.processingIndex++;
      }
      
      // 合并所有待处理文件的转录结果
      if (allTranscriptions.length > 0) {
        // 整合到当前转录
        if (this.transcription) {
          this.transcription += ' ' + allTranscriptions.join(' ');
        } else {
          this.transcription = allTranscriptions.join(' ');
        }
        
        // 最后一次更新UI
        if (this.onTranscriptionUpdate) {
          this.onTranscriptionUpdate(this.transcription, {
            totalDuration: (new Date() - this.recordingStartTime) / 1000,
            transcribedDuration: this.audioFiles.length * 3,
            progress: 1.0
          });
        }
      }
    } catch (error) {
      console.error('Error processing remaining files:', error);
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
      console.warn('Error resetting audio mode:', error);
    }
  }
  
  // 转录单个音频块
  async transcribeAudioChunk(fileUri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        return '';
      }
      
      // 创建FormData用于上传
      const formData = new FormData();
      
      // 添加文件
      formData.append('file', {
        uri: fileUri,
        type: 'audio/wav',
        name: 'audio_chunk.wav'
      });
      
      // 添加其他参数
      formData.append('model', 'gpt-4o-transcribe');
      formData.append('language', 'zh'); // 中文
      
      console.log(`Transcribing file: ${fileUri}`);
      
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
      console.log(`Transcription result: ${data.text || ''}`);
      return data.text || '';
      
    } catch (error) {
      console.error('Transcribe chunk error:', error);
      return '';
    }
  }
} 