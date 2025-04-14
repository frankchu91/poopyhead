import * as Speech from 'expo-speech';

export default class LocalSpeechService {
  constructor(onTranscriptionUpdate) {
    this.onTranscriptionUpdate = onTranscriptionUpdate;
    this.isListening = false;
  }

  async startRecording() {
    try {
      const { status } = await Speech.requestPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }

      this.isListening = true;
      
      // 使用本地语音识别
      Speech.start({
        locale: 'zh-CN', // 使用中文
        onSpeechResults: (e) => {
          if (e.value && e.value.length > 0) {
            const transcription = e.value[0];
            if (this.onTranscriptionUpdate) {
              this.onTranscriptionUpdate(transcription);
            }
          }
        },
        onSpeechError: (e) => {
          console.error('Speech recognition error:', e);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      return false;
    }
  }

  async stopRecording() {
    try {
      if (this.isListening) {
        this.isListening = false;
        await Speech.stop();
      }
      return '';
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      return '';
    }
  }
} 