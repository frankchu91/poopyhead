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

  // 初始化 WebSocket 连接 - 使用子协议进行认证
  async initWebSocket() {
    try {
      // 直接连接到OpenAI API，使用子协议进行认证
      const url = "wss://api.openai.com/v1/realtime?intent=transcription";
      debugLog('WS_URL', url);
      
      // 定义子协议数组，包含认证信息
      const protocols = [
        "realtime",
        // 认证
        "openai-insecure-api-key." + API_KEY,
        // Beta协议，必需
        "openai-beta.realtime-v1"
      ];
      
      return new Promise((resolve, reject) => {
        // 创建WebSocket连接，使用子协议进行认证
        this.ws = new WebSocket(url, protocols);
        
        // 设置连接超时
        const connectionTimeout = setTimeout(() => {
          debugLog('CONNECTION_TIMEOUT', 'Connection timed out');
          reject(new Error('WebSocket connection timed out'));
          if (this.ws) this.ws.close();
        }, 10000);
        
        // WebSocket 打开时
        this.ws.onopen = () => {
          debugLog('WS_OPEN', 'WebSocket connection established');
          clearTimeout(connectionTimeout);
          
          // 创建一个新的会话ID (如果没有的话)
          if (!this.sessionId) {
            this.sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
          }
          
          // 发送配置 - 按照文档示例结构
          const config = {
            type: "transcription_session.update",
            session: {
              input_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1",  // 使用我们的模型
                prompt: "",
                language: "zh"  // 使用中文
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              },
              input_audio_noise_reduction: {
                type: "near_field"
              }
            }
          };
          
          debugLog('SENDING_CONFIG', JSON.stringify(config));
          this.ws.send(JSON.stringify(config));
          
          // 解决 Promise
          resolve();
        };
        
        // 接收消息 - 根据OpenAI文档处理所有服务器事件
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            debugLog('WS_MESSAGE', message.type || 'Unknown message type');
            
            // 处理不同类型的服务器事件
            switch (message.type) {
              case 'error':
                // 错误事件
                debugLog('WS_ERROR', JSON.stringify(message.error));
                break;
                
              case 'session.created':
                // 会话创建事件
                debugLog('SESSION_CREATED', `Session ID: ${message.session?.id}`);
                // 保存服务器分配的会话ID（如果有）
                if (message.session?.id) {
                  this.sessionId = message.session.id;
                }
                break;
                
              case 'session.updated':
                // 会话更新事件
                debugLog('SESSION_UPDATED', `Session ID: ${message.session?.id}`);
                break;
                
              case 'transcription':
                // 转录事件 - 包含转录文本
                const text = message.transcription?.text;
                if (text) {
                  debugLog('TRANSCRIPTION', text);
                  this.transcription = text;
                  if (this.onTranscriptionUpdate) {
                    this.onTranscriptionUpdate(text);
                  }
                }
                break;
                
              case 'audio_buffer.appended':
                // 音频缓冲区追加事件
                debugLog('AUDIO_APPENDED', `Bytes: ${message.bytes_appended}`);
                break;
                
              case 'audio_buffer.committed':
                // 音频缓冲区提交事件
                debugLog('AUDIO_COMMITTED', `Bytes: ${message.bytes_committed}`);
                break;
                
              case 'audio_buffer.cleared':
                // 音频缓冲区清除事件
                debugLog('AUDIO_CLEARED', 'Audio buffer cleared');
                break;
                
              case 'turn.started':
                // 语音轮次开始事件
                debugLog('TURN_STARTED', `Turn ID: ${message.turn?.id}`);
                break;
                
              case 'turn.ended':
                // 语音轮次结束事件
                debugLog('TURN_ENDED', `Turn ID: ${message.turn?.id}`);
                break;
                
              case 'ping':
                // 心跳检测事件 - 发送pong响应
                this.ws.send(JSON.stringify({ type: 'pong' }));
                break;
                
              default:
                // 未知事件类型
                debugLog('UNKNOWN_EVENT', JSON.stringify(message));
                break;
            }
          } catch (parseError) {
            debugLog('PARSE_ERROR', `Failed to parse message: ${parseError.message}`);
          }
        };
        
        // 错误处理
        this.ws.onerror = (error) => {
          debugLog('WS_ERROR', error.message || 'Unknown WebSocket error');
          clearTimeout(connectionTimeout);
          
          // Try to reconnect if appropriate
          if (this.isRecording) {
            debugLog('WS_RECONNECT', 'Attempting to reconnect...');
            setTimeout(() => this.initWebSocket(), 2000);
          }
          
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

  // 从录音中获取音频数据并发送到WebSocket
  async sendAudioData() {
    if (!this.recording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      // 获取临时文件 URI
      const uri = this.recording.getURI();
      if (!uri) return;
      
      // 获取录音状态
      const status = await this.recording.getStatusAsync();
      if (!status.isRecording && status.durationMillis <= 0) return;
      
      // 读取音频文件内容
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return;
      
      // 读取文件内容为 base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      if (base64Audio) {
        // 发送音频数据 - 完全按照文档示例
        const audioMessage = {
          type: "input_audio_buffer.append",
          audio: base64Audio
          // 不包含session或content_type参数
        };
        
        this.ws.send(JSON.stringify(audioMessage));
      }
    } catch (error) {
      console.error('Error sending audio data:', error);
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
      this.recordingInterval = setInterval(() => {
        if (this.isRecording) {
          this.sendAudioData();
        }
      }, 5000); // 每500毫秒发送一次
      
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
    
    // 停止录音 - 只有在stopRecording没有处理时才尝试停止
    if (this.recording && this.isRecording) {
      try {
        this.recording.stopAndUnloadAsync().catch(e => 
          console.warn("Error stopping recording:", e)
        );
      } catch (e) {
        console.warn("Error cleaning up recording:", e);
      }
    }
    
    // 无论如何都清除recording引用
    this.recording = null;
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
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (stopError) {
        // 如果已经停止，忽略错误
        console.warn("Note: Recording may have already been stopped:", stopError.message);
      }
      
      // 清理其他资源，但不再尝试停止录音
      const recordingRef = this.recording;
      this.recording = null;  // 先清除引用，防止cleanupResources再次尝试停止
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

  // 提交音频缓冲区 - 简化为只包含type
  commitAudioBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      const commitMessage = {
        type: "input_audio_buffer.commit"
        // 不包含session参数
      };
      
      debugLog('COMMIT_AUDIO', 'Committing audio buffer');
      this.ws.send(JSON.stringify(commitMessage));
    } catch (error) {
      console.error('Error committing audio buffer:', error);
    }
  }

  // 清除音频缓冲区 - 简化为只包含type
  clearAudioBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      const clearMessage = {
        type: "input_audio_buffer.clear"
        // 不包含session参数
      };
      
      debugLog('CLEAR_AUDIO', 'Clearing audio buffer');
      this.ws.send(JSON.stringify(clearMessage));
    } catch (error) {
      console.error('Error clearing audio buffer:', error);
    }
  }
} 