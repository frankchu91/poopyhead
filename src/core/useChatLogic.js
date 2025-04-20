import { useState, useRef, useEffect } from 'react';
import { Vibration, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio, RecordingOptionsPresets } from 'expo-av';
import * as Clipboard from 'expo-clipboard';

export default function useChatLogic() {
  // 所有共享状态
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: '这是测试消息 1',
      type: 'text',
      isUserTyped: true,
      timestamp: new Date()
    },
    {
      id: '2',
      text: '这是测试消息 2',
      type: 'text',
      isUserTyped: true,
      timestamp: new Date()
    },
    {
      id: '3',
      text: '这是测试消息 3',
      type: 'text',
      isUserTyped: true,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [activeMessage, setActiveMessage] = useState(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [freePositionMode, setFreePositionMode] = useState(false);
  const [messagePositions, setMessagePositions] = useState({});
  const [messageSizes, setMessageSizes] = useState({});
  
  // Refs
  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const transcribingMessageIdRef = useRef(null);
  
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

  // 负责创建并添加用户消息到聊天记录中
  const sendTextMessage = (text, isUserTyped = true) => {
    if (!text || text.trim() === '') return;
    
    const newMessage = {
      id: Date.now().toString(),
      text: text,
      type: 'text',
      timestamp: new Date(),
      isUserTyped: isUserTyped,
      // isUser: true  // 始终设置为 true 以确保一致性
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    if (isUserTyped) {
      setInputText('');
    }
    
    return newMessage.id;
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('需要麦克风权限来录制语音消息');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingTime(0);
      
      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 提供触觉反馈
      if (Platform.OS !== 'web') {
        Vibration.vibrate(50);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      await recording.stopAndUnloadAsync();
      clearInterval(timerRef.current);
      
      const uri = recording.getURI();
      const { sound, status } = await Audio.Sound.createAsync({ uri });
      
      const newMessage = {
        id: Date.now().toString(),
        type: 'audio',
        audio: uri,
        duration: status.durationMillis / 1000,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, newMessage]);
      setRecording(null);
      setIsRecording(false);
      setRecordingTime(0);
      
      // 如果是自由定位模式，为新消息设置一个默认位置
      if (freePositionMode) {
        const lastIndex = messages.length;
        setMessagePositions(prev => ({
          ...prev,
          [newMessage.id]: {
            x: 20,
            y: lastIndex * 60
          }
        }));
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  // 播放音频
  const playAudio = async (uri) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      
      await sound.playAsync();
    } catch (err) {
      console.error('Failed to play audio', err);
    }
  };

  // 选择图片
  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('需要相册权限来选择图片');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newMessage = {
          id: Date.now().toString(),
          type: 'image',
          image: result.assets[0].uri,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // 如果是自由定位模式，为新消息设置一个默认位置
        if (freePositionMode) {
          const lastIndex = messages.length;
          setMessagePositions(prev => ({
            ...prev,
            [newMessage.id]: {
              x: 20,
              y: lastIndex * 60
            }
          }));
        }
      }
    } catch (err) {
      console.error('Failed to pick image', err);
    }
  };

  // 编辑消息
  const editMessage = (message) => {
    setEditingMessage(message);
    setEditText(message.text || '');
  };

  // 保存编辑
  const saveEdit = () => {
    if (!editingMessage) return;
    
    setMessages(prev => prev.map(msg => 
      msg.id === editingMessage.id 
        ? { ...msg, text: editText, edited: true } 
        : msg
    ));
    
    setEditingMessage(null);
    setEditText('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  // 删除消息
  const deleteMessage = (id) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  // 复制消息
  const copyMessage = async (message) => {
    if (message.type !== 'text') {
      alert('只能复制文本消息');
      return;
    }
    
    await Clipboard.setStringAsync(message.text);
  };

  // 显示上下文菜单
  const showContextMenu = (message, event) => {
    setActiveMessage(message);
    setContextMenuPosition({
      x: event.pageX || event.x || 0,
      y: event.pageY || event.y || 0
    });
    setContextMenuVisible(true);
  };

  // 切换多选模式
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(prev => !prev);
    setSelectedMessages([]);
  };

  // 切换消息选择
  const toggleMessageSelection = (id) => {
    setSelectedMessages(prev => 
      prev.includes(id)
        ? prev.filter(msgId => msgId !== id)
        : [...prev, id]
    );
  };

  // 删除选中的消息
  const deleteSelectedMessages = () => {
    setMessages(prev => prev.filter(msg => !selectedMessages.includes(msg.id)));
    setSelectedMessages([]);
    setIsMultiSelectMode(false);
  };

  // 合并选中的消息
  const combineSelectedMessages = () => {
    if (selectedMessages.length < 2) return;
    
    // 获取选中的消息
    const selectedMsgs = messages.filter(msg => selectedMessages.includes(msg.id));
    
    // 只合并文本消息
    const textMsgs = selectedMsgs.filter(msg => msg.type === 'text');
    
    if (textMsgs.length < 2) {
      alert('只能合并文本消息');
      return;
    }
    
    // 按时间排序
    textMsgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // 合并文本
    const combinedText = textMsgs.map(msg => msg.text).join('\n\n');
    
    // 创建新消息
    const newMessage = {
      id: Date.now().toString(),
      text: combinedText,
      type: 'text',
      timestamp: new Date(),
      isCombined: true
    };
    
    // 删除原消息，添加新消息
    setMessages(prev => [
      ...prev.filter(msg => !selectedMessages.includes(msg.id)),
      newMessage
    ]);
    
    setSelectedMessages([]);
    setIsMultiSelectMode(false);
  };

  // 修改添加消息的逻辑
  const addMessage = (message, isUser = false) => {
    // 如果是用户消息，直接添加到消息列表
    if (isUser) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        text: message, 
        isUser: true,
        timestamp: new Date()
      }]);
      return;
    }
    
    // 如果是转录消息
    // 检查是否有正在进行的转录
    const activeSpeakerMessage = messages.find(msg => 
      msg.isSpeaker && msg.isActive && !msg.isComplete);
      
    if (activeSpeakerMessage && !hasUserMessageAfter(activeSpeakerMessage.id)) {
      // 如果有活跃的转录消息且用户没有在之后发送过消息，则更新该消息
      setMessages(prev => prev.map(msg => 
        msg.id === activeSpeakerMessage.id 
          ? { ...msg, text: message } 
          : msg
      ));
    } else {
      // 否则创建新的转录消息
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        text: message, 
        isSpeaker: true,
        speakerName: currentSpeaker,
        isActive: true,
        isComplete: false,
        timestamp: new Date()
      }]);
    }
  };

  // 判断特定消息后是否有用户消息
  const hasUserMessageAfter = (messageId) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return false;
    
    // 检查该消息后面是否有用户消息
    for (let i = messageIndex + 1; i < messages.length; i++) {
      if (messages[i].isUser) return true;
    }
    return false;
  };

  // 当转录结束时标记消息为完成
  const completeTranscription = (messageId) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isActive: false, isComplete: true } 
        : msg
    ));
  };

  // 返回所有共享逻辑和状态
  return {
    // 状态
    messages,
    inputText,
    isRecording,
    recordingTime,
    editingMessage,
    editText,
    contextMenuVisible,
    contextMenuPosition,
    activeMessage,
    isMultiSelectMode,
    selectedMessages,
    freePositionMode,
    messagePositions,
    messageSizes,
    
    // 方法
    setInputText,
    sendTextMessage,
    startRecording,
    stopRecording,
    playAudio,
    pickImage,
    editMessage,
    saveEdit,
    cancelEdit,
    deleteMessage,
    copyMessage,
    showContextMenu,
    setContextMenuVisible,
    toggleMultiSelectMode,
    toggleMessageSelection,
    deleteSelectedMessages,
    combineSelectedMessages,
    setFreePositionMode,
    setMessagePositions,
    setMessages,
    setMessageSizes,
    addMessage,
    hasUserMessageAfter,
    completeTranscription,
  };
} 