import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Alert 
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export default function VoiceNoteScreen({ navigation }) {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    return () => {
      if (recording) {
        stopRecording();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);

      // Start duration counter
      const interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) {
          clearInterval(interval);
        }
      });
    } catch (err) {
      Alert.alert('Failed to start recording', err.message);
    }
  }

  async function stopRecording() {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      
      navigation.navigate('NewNote', {
        audioUri: uri,
        type: 'voice',
        duration: recordingDuration
      });
      
      setRecordingDuration(0);
    } catch (err) {
      Alert.alert('Failed to stop recording', err.message);
    }
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.timer}>
        {formatDuration(recordingDuration)}
      </Text>
      
      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recording]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Ionicons 
          name={isRecording ? "stop" : "mic"} 
          size={40} 
          color="white" 
        />
      </TouchableOpacity>

      <Text style={styles.helpText}>
        {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontSize: 48,
    marginBottom: 30,
    color: '#f4511e',
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f4511e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  recording: {
    backgroundColor: '#ff0000',
    transform: [{ scale: 1.1 }],
  },
  helpText: {
    fontSize: 16,
    color: '#666',
  },
}); 