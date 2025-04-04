import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
  Animated,
  PanResponder,
  Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';

export default function ChatScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const soundRef = useRef(null);

  // 清理函数
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // 发送文本消息
  const sendTextMessage = () => {
    if (inputText.trim() === '') return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      type: 'text',
      timestamp: new Date()
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setInputText('');
    
    // 自动滚动到底部
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 开始录音
  const startRecording = async () => {
    try {
      // 请求录音权限
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('需要麦克风权限来录制语音');
        return;
      }

      // 设置录音配置
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 创建录音对象
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await recording.startAsync();
      setRecording(recording);
      setIsRecording(true);
      
      // 开始计时
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 添加视觉反馈
      Vibration.vibrate(50);
    } catch (error) {
      console.error('录音失败:', error);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      clearInterval(timerRef.current);
      
      const uri = recording.getURI();
      
      // 添加语音消息
      const newMessage = {
        id: Date.now().toString(),
        audio: uri,
        type: 'audio',
        timestamp: new Date(),
        duration: recordingTime
      };

      setMessages(prevMessages => [...prevMessages, newMessage]);
      setIsRecording(false);
      setRecording(null);
      
      // 自动滚动到底部
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // 添加视觉反馈
      Vibration.vibrate(50);
    } catch (error) {
      console.error('停止录音失败:', error);
    }
  };

  // 播放录音
  const playAudio = async (uri) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('播放失败:', error);
    }
  };

  // 拍照
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('需要相机权限来拍照');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newMessage = {
          id: Date.now().toString(),
          image: result.assets[0].uri,
          type: 'image',
          timestamp: new Date()
        };

        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // 自动滚动到底部
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('拍照失败:', error);
    }
  };

  // 从相册选择
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('需要相册权限来选择图片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newMessage = {
          id: Date.now().toString(),
          image: result.assets[0].uri,
          type: 'image',
          timestamp: new Date()
        };

        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // 自动滚动到底部
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
    }
  };

  // 长按消息进入选择模式
  const handleLongPress = (messageId) => {
    setIsSelectionMode(true);
    setSelectedMessages([messageId]);
    Vibration.vibrate(100);
  };

  // 点击消息切换选择状态
  const toggleMessageSelection = (messageId) => {
    if (isSelectionMode) {
      if (selectedMessages.includes(messageId)) {
        setSelectedMessages(selectedMessages.filter(id => id !== messageId));
        if (selectedMessages.length === 1) {
          setIsSelectionMode(false);
        }
      } else {
        setSelectedMessages([...selectedMessages, messageId]);
      }
    }
  };

  // 合并选中的消息
  const combineMessages = () => {
    if (selectedMessages.length < 2) return;
    
    const selectedItems = messages.filter(msg => selectedMessages.includes(msg.id));
    const combinedText = selectedItems
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(msg => {
        if (msg.type === 'text') return msg.text;
        if (msg.type === 'image') return '[Image]';
        if (msg.type === 'audio') return `[Audio: ${msg.duration}s]`;
        return '';
      })
      .join('\n\n');
    
    const newMessage = {
      id: Date.now().toString(),
      text: combinedText,
      type: 'text',
      timestamp: new Date(),
      isCombined: true
    };
    
    setMessages(prevMessages => [
      ...prevMessages.filter(msg => !selectedMessages.includes(msg.id)),
      newMessage
    ]);
    
    setIsSelectionMode(false);
    setSelectedMessages([]);
  };

  // 取消选择模式
  const cancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessages([]);
  };

  // 渲染消息项
  const renderMessageItem = ({ item }) => {
    const isSelected = selectedMessages.includes(item.id);
    
    return (
      <GestureHandlerRootView>
        <PanGestureHandler
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              // 处理拖动逻辑
            }
          }}
        >
          <Animated.View>
            <TouchableOpacity 
              style={[
                styles.messageContainer,
                isSelected && styles.selectedMessageContainer,
                item.isCombined && styles.combinedMessageContainer
              ]}
              onLongPress={() => handleLongPress(item.id)}
              onPress={() => toggleMessageSelection(item.id)}
              delayLongPress={300}
            >
              {item.type === 'text' && (
                <Text style={styles.messageText}>{item.text}</Text>
              )}
              
              {item.type === 'image' && (
                <Image 
                  source={{ uri: item.image }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}
              
              {item.type === 'audio' && (
                <TouchableOpacity 
                  style={styles.audioContainer}
                  onPress={() => playAudio(item.audio)}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={styles.audioDuration}>{item.duration}s</Text>
                </TouchableOpacity>
              )}
              
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </GestureHandlerRootView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部标题栏 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Note</Text>
        {isSelectionMode ? (
          <View style={styles.selectionControls}>
            <TouchableOpacity 
              style={styles.selectionButton}
              onPress={combineMessages}
            >
              <Ionicons name="git-merge-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.selectionButton}
              onPress={cancelSelection}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        style={styles.messageList}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.messageListContent}
      />
      
      {/* 底部输入区域 - 重新设计 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        {/* 工具栏 - 语音、照片、拍照按钮在一排 */}
        <View style={styles.toolbarRow}>
          <TouchableOpacity 
            style={[styles.toolbarButton, isRecording && styles.activeToolbarButton]}
            onPressIn={!isRecording ? startRecording : undefined}
            onPressOut={isRecording ? stopRecording : undefined}
          >
            <Ionicons name="mic" size={24} color={isRecording ? "#FF453A" : "#007AFF"} />
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingTimeSmall}>{recordingTime}s</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolbarButton}
            onPress={pickImage}
          >
            <Ionicons name="image" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolbarButton}
            onPress={takePhoto}
          >
            <Ionicons name="camera" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        {/* 文本输入和发送按钮在一排 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#8E8E93"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxHeight={100}
          />
          
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={sendTextMessage}
            disabled={inputText.trim() === ''}
          >
            <Ionicons 
              name="send" 
              size={24} 
              color={inputText.trim() === '' ? "#555" : "#007AFF"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButton: {
    padding: 4,
  },
  selectionControls: {
    flexDirection: 'row',
  },
  selectionButton: {
    padding: 8,
    marginLeft: 8,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    alignSelf: 'flex-start',
  },
  combinedMessageContainer: {
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  selectedMessageContainer: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 16,
    minWidth: 80,
  },
  audioDuration: {
    color: '#fff',
    marginLeft: 8,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    padding: 8,
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    paddingBottom: 12,
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeToolbarButton: {
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
  },
  recordingIndicator: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#FF453A',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  recordingTimeSmall: {
    color: '#fff',
    fontSize: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    padding: 8,
    marginBottom: 8,
  },
}); 