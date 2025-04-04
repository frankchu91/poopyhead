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
  Vibration,
  Alert,
  Modal,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

export default function ChatScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [showMergeOptions, setShowMergeOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [draggedMessage, setDraggedMessage] = useState(null);
  const [dragY, setDragY] = useState(new Animated.Value(0));
  const [isDragging, setIsDragging] = useState(false);
  
  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const messageRefs = useRef({});

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

  // 创建拖拽处理器
  const createPanResponder = (message) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // 只有垂直移动超过10才开始拖拽
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        // 开始拖拽
        setDraggedMessage(message);
        setIsDragging(true);
        dragY.setValue(0);
        Vibration.vibrate(50);
      },
      onPanResponderMove: (_, gestureState) => {
        // 更新拖拽位置
        dragY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        // 结束拖拽
        setIsDragging(false);
        
        // 如果移动距离足够大，重新排序消息
        if (Math.abs(gestureState.dy) > 50) {
          reorderMessages(message, gestureState.dy);
        }
        
        // 重置拖拽状态
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => {
          setDraggedMessage(null);
        });
      }
    });
  };

  // 重新排序消息
  const reorderMessages = (message, dy) => {
    const messageIndex = messages.findIndex(m => m.id === message.id);
    if (messageIndex === -1) return;
    
    // 计算新位置
    let newIndex = messageIndex;
    if (dy < 0) {
      // 向上移动
      newIndex = Math.max(0, messageIndex - 1);
    } else {
      // 向下移动
      newIndex = Math.min(messages.length - 1, messageIndex + 1);
    }
    
    // 如果位置没变，不做任何操作
    if (newIndex === messageIndex) return;
    
    // 创建新的消息数组
    const newMessages = [...messages];
    const [movedMessage] = newMessages.splice(messageIndex, 1);
    newMessages.splice(newIndex, 0, movedMessage);
    
    // 更新状态
    setMessages(newMessages);
    Vibration.vibrate(50);
  };

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

  // 开始编辑消息
  const startEditMessage = (message) => {
    if (message.type === 'text') {
      setEditingMessage(message);
      setEditText(message.text);
    }
  };

  // 保存编辑的消息
  const saveEditedMessage = () => {
    if (editText.trim() === '') return;

    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === editingMessage.id 
          ? { ...msg, text: editText, edited: true } 
          : msg
      )
    );
    
    setEditingMessage(null);
    setEditText('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  // 删除消息
  const deleteMessage = (messageId) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => {
            setMessages(prevMessages => 
              prevMessages.filter(msg => msg.id !== messageId)
            );
          },
          style: "destructive"
        }
      ]
    );
  };

  // 合并两条消息
  const mergeMessages = (message1, message2) => {
    if (message1.type === 'text' && message2.type === 'text') {
      const mergedMessage = {
        id: Date.now().toString(),
        text: `${message1.text}\n\n${message2.text}`,
        type: 'text',
        timestamp: new Date(),
        isCombined: true
      };
      
      setMessages(prevMessages => 
        prevMessages
          .filter(msg => msg.id !== message1.id && msg.id !== message2.id)
          .concat(mergedMessage)
      );
    } else {
      // 如果不是两个文本消息，则创建一个组合消息
      const combinedMessage = {
        id: Date.now().toString(),
        type: 'combined',
        messages: [message1, message2],
        timestamp: new Date(),
        isCombined: true
      };
      
      setMessages(prevMessages => 
        prevMessages
          .filter(msg => msg.id !== message1.id && msg.id !== message2.id)
          .concat(combinedMessage)
      );
    }
    
    setShowMergeOptions(false);
    setSelectedMessage(null);
  };

  // 显示合并选项
  const showMergeOptionsModal = (message) => {
    if (selectedMessage && selectedMessage.id !== message.id) {
      setShowMergeOptions(true);
    } else {
      setSelectedMessage(message);
    }
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
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      
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

  // 从相册选择图片
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

  // 渲染消息项
  const renderMessageItem = ({ item }) => {
    const isSelected = selectedMessage && selectedMessage.id === item.id;
    const isDragged = draggedMessage && draggedMessage.id === item.id;
    
    // 创建该消息的拖拽处理器
    const panResponder = createPanResponder(item);
    
    // 计算拖拽样式
    const dragStyle = isDragged ? {
      transform: [{ translateY: dragY }],
      zIndex: 100,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
    } : {};
    
    return (
      <Animated.View 
        style={[
          styles.messageWrapper,
          dragStyle
        ]}
        {...panResponder.panHandlers}
        ref={ref => messageRefs.current[item.id] = ref}
      >
        <TouchableOpacity 
          style={[
            styles.messageContainer,
            item.isCombined && styles.combinedMessageContainer,
            isSelected && styles.selectedMessageContainer,
            isDragged && styles.draggingMessageContainer
          ]}
          onLongPress={() => showMergeOptionsModal(item)}
          delayLongPress={300}
        >
          {/* 编辑状态 */}
          {editingMessage && editingMessage.id === item.id ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
              />
              <View style={styles.editButtons}>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={cancelEdit}
                >
                  <Text style={styles.editButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={saveEditedMessage}
                >
                  <Text style={[styles.editButtonText, styles.saveButtonText]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* 消息内容 */}
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
              
              {item.type === 'combined' && (
                <View style={styles.combinedContent}>
                  {item.messages.map((subMsg, index) => (
                    <View key={index} style={styles.combinedItem}>
                      {subMsg.type === 'text' && (
                        <Text style={styles.messageText}>{subMsg.text}</Text>
                      )}
                      
                      {subMsg.type === 'image' && (
                        <Image 
                          source={{ uri: subMsg.image }} 
                          style={styles.combinedImage}
                          resizeMode="cover"
                        />
                      )}
                      
                      {subMsg.type === 'audio' && (
                        <TouchableOpacity 
                          style={styles.audioContainer}
                          onPress={() => playAudio(subMsg.audio)}
                        >
                          <Ionicons name="play" size={20} color="#fff" />
                          <Text style={styles.audioDuration}>{subMsg.duration}s</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
              
              {item.edited && (
                <Text style={styles.editedTag}>(edited)</Text>
              )}
              
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              
              {/* 消息操作按钮 */}
              <View style={styles.messageActions}>
                {item.type === 'text' && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => startEditMessage(item)}
                  >
                    <Ionicons name="pencil" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => deleteMessage(item.id)}
                >
                  <Ionicons name="trash" size={16} color="#FF453A" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
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
        
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        scrollEnabled={!isDragging}
      />
      
      {/* 底部输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inputContainer}>
          {/* 工具栏 */}
          <View style={styles.toolbarRow}>
            <TouchableOpacity 
              style={[
                styles.toolbarButton,
                isRecording && styles.activeToolbarButton
              ]}
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
          
          {/* 文本输入和发送按钮 */}
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
        </View>
      </KeyboardAvoidingView>
      
      {/* 合并选项模态框 */}
      <Modal
        visible={showMergeOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMergeOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mergeOptionsContainer}>
            <Text style={styles.mergeTitle}>Merge Messages</Text>
            
            <TouchableOpacity 
              style={styles.mergeOption}
              onPress={() => {
                const otherMessage = messages.find(m => m.id !== selectedMessage.id);
                if (otherMessage) {
                  mergeMessages(selectedMessage, otherMessage);
                }
              }}
            >
              <Ionicons name="git-merge" size={24} color="#007AFF" />
              <Text style={styles.mergeOptionText}>Merge Messages</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.mergeOption, styles.cancelOption]}
              onPress={() => {
                setShowMergeOptions(false);
                setSelectedMessage(null);
              }}
            >
              <Ionicons name="close-circle" size={24} color="#FF453A" />
              <Text style={[styles.mergeOptionText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
  },
  messageWrapper: {
    width: '100%',
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    alignSelf: 'flex-start',
    position: 'relative',
  },
  combinedMessageContainer: {
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  selectedMessageContainer: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  draggingMessageContainer: {
    opacity: 0.8,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  editedTag: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  editContainer: {
    width: '100%',
  },
  editInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 8,
    color: '#fff',
    fontSize: 16,
    minHeight: 60,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    marginLeft: 16,
  },
  editButtonText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  saveButtonText: {
    color: '#007AFF',
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
  combinedContent: {
    width: '100%',
  },
  combinedItem: {
    marginVertical: 4,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  combinedImage: {
    width: 150,
    height: 100,
    borderRadius: 8,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageActions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    opacity: 0.7,
  },
  actionButton: {
    padding: 4,
    marginLeft: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mergeOptionsContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 16,
    width: '80%',
  },
  mergeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  mergeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#3A3A3C',
  },
  mergeOptionText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  cancelOption: {
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    marginTop: 12,
  },
  cancelText: {
    color: '#FF453A',
  },
}); 