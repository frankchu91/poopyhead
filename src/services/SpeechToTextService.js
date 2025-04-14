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
    this.ws = null;
    this.recording = null;
    this.isRecording = false;
    this.recordingInterval = null;
    this.onTranscriptionUpdate = onTranscriptionUpdate;
    this.transcription = "";
    this.sessionId = null;
  }

  // 初始化 WebSocket 连接
  async initWebSocket() {
    try {
      // 1. 先获取认证令牌
      debugLog('TOKEN_REQUEST', 'Requesting token...');
      const tokenResponse = await fetch('https://api.openai.com/v1/realtime/transcription_sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        debugLog('TOKEN_ERROR', errorText);
        throw new Error(`Token request failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      
      // 添加更详细的令牌日志
      debugLog('TOKEN_FULL_DATA', JSON.stringify(tokenData));
      debugLog('TOKEN_KEYS', Object.keys(tokenData));
      
      const token = tokenData.client_secret;
      debugLog('TOKEN_VALUE', `Type: ${typeof token}, Value: ${token ? token.substring(0, 10) + '...' : 'null or undefined'}`);
      
      this.sessionId = tokenData.id;
      
      if (!token) {
        throw new Error('No token received');
      }
      
      // 2. 尝试两种不同的 WebSocket URL 格式
      
      // 选项 1: 官方文档格式 - 通过 URL 参数传递令牌
      const wsUrl1 = `wss://api.openai.com/v1/realtime?intent=transcription&token=${encodeURIComponent(token)}`;
      debugLog('WS_URL_1', wsUrl1.substring(0, 60) + '...');
      
      // 选项 2: 另一种可能的格式
      const wsUrl2 = `wss://api.openai.com/v1/realtime/transcription?token=${encodeURIComponent(token)}`;
      debugLog('WS_URL_2', wsUrl2.substring(0, 60) + '...');
      
      // 使用选项 1
      const finalWsUrl = wsUrl1;
      debugLog('WS_URL_FINAL', `Using: ${finalWsUrl.substring(0, 60)}...`);
      
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(finalWsUrl);
        
        // 设置连接超时
        const connectionTimeout = setTimeout(() => {
          debugLog('CONNECTION_TIMEOUT', 'Connection timed out');
          reject(new Error('WebSocket connection timed out'));
          if (this.ws) this.ws.close();
        }, 10000);
        
        // WebSocket 打开时
        this.ws.onopen = () => {
          debugLog('WS_OPEN', 'WebSocket opened');
          clearTimeout(connectionTimeout);
          
          // 直接发送配置，不需要单独发送认证
          const config = {
            type: "transcription_session.update",
            input_audio_format: "pcm16",
            input_audio_transcription: {
              model: "gpt-4o-transcribe", 
              prompt: "",
              language: "zh"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            input_audio_noise_reduction: {
              type: "near_field"
            },
            include: [
              "item.input_audio_transcription.logprobs"
            ]
          };
          
          debugLog('SENDING_CONFIG', 'Sending configuration...');
          this.ws.send(JSON.stringify(config));
          
          // 解决 Promise
          resolve();
        };
        
        // 接收消息
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            debugLog('WS_MESSAGE', message.type || 'Unknown message type');
            
            // 处理不同类型的消息
            if (message.type === 'error') {
              debugLog('WS_ERROR', JSON.stringify(message));
              reject(new Error(`WebSocket error: ${JSON.stringify(message.error)}`));
            } 
            else if (message.type === 'transcription') {
              // 更新转录
              const text = message.transcription?.text;
              if (text) {
                this.transcription = text;
                if (this.onTranscriptionUpdate) {
                  this.onTranscriptionUpdate(text);
                }
              }
            }
          } catch (parseError) {
            debugLog('PARSE_ERROR', `Failed to parse message: ${parseError.message}`);
          }
        };
        
        // 错误处理
        this.ws.onerror = (error) => {
          debugLog('WS_ERROR', error.message || 'Unknown WebSocket error');
          clearTimeout(connectionTimeout);
          reject(error);
        };
        
        // 关闭处理
        this.ws.onclose = (event) => {
          debugLog('WS_CLOSE', `WebSocket closed (${event.code}): ${event.reason}`);
          clearTimeout(connectionTimeout);
        };
      });
    } catch (error) {
      debugLog('INIT_ERROR', error.message);
      throw error;
    }
  }

  // 从录音中获取音频数据
  async getAudioData() {
    if (!this.recording) return null;
    
    try {
      // 获取临时文件 URI
      const uri = this.recording.getURI();
      if (!uri) return null;
      
      // 读取音频文件内容
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return null;
      
      // 读取文件内容为 base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      return base64Audio;
    } catch (error) {
      console.error('Error getting audio data:', error);
      return null;
    }
  }

  // 开始录音
  async startRecording() {
    try {
      console.log("Starting recording...");
      
      // 清理现有录音
      if (this.recording) {
        await this.stopExistingRecording();
      }
      
      // 请求麦克风权限
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        console.error('Permission denied');
        return false;
      }
      
      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // 初始化 WebSocket
      await this.initWebSocket();
      
      // 创建录音对象
      this.recording = new Audio.Recording();
      
      // 配置 PCM 16kHz 单声道
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_PCM_16BIT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_PCM_16BIT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      
      // 开始录音
      this.isRecording = true;
      this.transcription = "";
      await this.recording.startAsync();
      
      console.log("Recording started");
      
      // 设置定时器，定期发送音频数据
      this.recordingInterval = setInterval(async () => {
        if (this.isRecording && this.recording && this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            // 获取录音状态
            const status = await this.recording.getStatusAsync();
            
            // 如果正在录音并且有数据
            if (status.isRecording && status.durationMillis > 0) {
              // 获取音频数据
              const audioBase64 = await this.getAudioData();
              
              if (audioBase64) {
                // 发送音频数据
                const audioMessage = {
                  type: "input_audio_buffer.append",
                  audio: audioBase64
                };
                
                this.ws.send(JSON.stringify(audioMessage));
              }
            }
          } catch (error) {
            console.error('Error sending audio data:', error);
          }
        }
      }, 500); // 每500毫秒发送一次
      
      return true;
    } catch (error) {
      console.error('Start recording error:', error);
      this.cleanupResources();
      return false;
    }
  }

  // 停止现有录音
  async stopExistingRecording() {
    if (!this.recording) return;
    
    try {
      const status = await this.recording.getStatusAsync();
      
      if (status.isRecording) {
        await this.recording.stopAndUnloadAsync();
      } 
      else if (status.isDoneRecording === false) {
        await this.recording.stopAndUnloadAsync();
      }
    } catch (error) {
      console.warn("Error stopping recording:", error);
    }
    
    this.recording = null;
  }

  // 清理资源
  cleanupResources() {
    // 清除发送间隔
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    // 关闭 WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      this.ws = null;
    }
    
    // 停止录音
    if (this.recording) {
      try {
        this.recording.stopAndUnloadAsync().catch(e => 
          console.warn("Error stopping recording:", e)
        );
      } catch (e) {
        console.warn("Error cleaning up recording:", e);
      }
      this.recording = null;
    }
    
    this.isRecording = false;
  }

  // 停止录音
  async stopRecording() {
    try {
      if (!this.isRecording || !this.recording) {
        return this.transcription;
      }
      
      console.log("Stopping recording...");
      this.isRecording = false;
      
      // 停止录音
      await this.recording.stopAndUnloadAsync();
      
      // 清理资源
      this.cleanupResources();
      
      // 重置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
      
      console.log("Recording stopped");
      return this.transcription;
    } catch (error) {
      console.error('Stop recording error:', error);
      this.cleanupResources();
      return this.transcription;
    }
  }
} 