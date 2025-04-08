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
import * as Clipboard from 'expo-clipboard';

export default function ChatScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
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
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [messagePositions, setMessagePositions] = useState({});
  const [listHeight, setListHeight] = useState(0);
  const [freePositionMode, setFreePositionMode] = useState(false);
  const [listWidth, setListWidth] = useState(0);
  const [initialPositionsSet, setInitialPositionsSet] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedBubble, setSelectedBubble] = useState(null);
  const [bubbleRefs, setBubbleRefs] = useState({});
  
  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(null);
  const listRef = useRef(null);

  // 初始化气泡位置的更好方法
  useEffect(() => {
    if (freePositionMode && !initialPositionsSet && messages.length > 0) {
      // 首先使用当前布局中估计的位置
      const initialPositions = {};
      const scrollY = flatListRef.current?._listRef?._scrollMetrics?.offset || 0;
      
      messages.forEach((message, index) => {
        // 计算位置时考虑滚动偏移量
        initialPositions[message.id] = {
          x: 20,
          y: (index * 60) - scrollY
        };
      });
      
      setMessagePositions(initialPositions);
      setInitialPositionsSet(true);
    }
  }, [freePositionMode, messages, initialPositionsSet]);
  
  // 创建专门为 Web 版本优化的拖拽处理器
  useEffect(() => {
    if (freePositionMode) {
      panResponder.current = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
        },
        onPanResponderGrant: (evt, gesture) => {
          // 查找被点击的气泡
          const { pageX, pageY } = evt.nativeEvent;
          let foundIndex = -1;
          
          // 检查每个消息的位置
          for (let i = 0; i < messages.length; i++) {
            const msgId = messages[i].id;
            const pos = messagePositions[msgId];
            
            if (pos) {
              // 气泡的尺寸
              const width = 250;
              const height = 80;
              
              // 检查点击是否在这个气泡内
              if (pageX >= pos.x && pageX <= pos.x + width &&
                  pageY >= pos.y && pageY <= pos.y + height) {
                foundIndex = i;
                break;
              }
            }
          }
          
          if (foundIndex >= 0) {
            setDraggingIndex(foundIndex);
            setDraggingId(messages[foundIndex].id);
            
            // 记录初始点击位置相对于气泡左上角的偏移
            const pos = messagePositions[messages[foundIndex].id];
            setDragOffset({
              x: pageX - pos.x,
              y: pageY - pos.y
            });
            
            // 在Web上可能不支持振动
            if (Platform.OS !== 'web') {
              Vibration.vibrate(30);
            }
          }
        },
        onPanResponderMove: (evt, gesture) => {
          if (draggingId) {
            const { pageX, pageY } = evt.nativeEvent;
            
            // 更新位置（考虑拖拽偏移）
            setMessagePositions(prev => ({
              ...prev,
              [draggingId]: {
                x: pageX - dragOffset.x,
                y: pageY - dragOffset.y
              }
            }));
          }
        },
        onPanResponderRelease: () => {
          // 结束拖拽
          setDraggingIndex(null);
          setDraggingId(null);
        }
      });
    }
  }, [freePositionMode, messages, messagePositions, draggingId, dragOffset]);
  
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

  // 显示上下文菜单
  const showContextMenu = (message, event) => {
    // 获取触摸位置
    const { pageX, pageY } = event.nativeEvent;
    
    setContextMenuPosition({ x: pageX, y: pageY });
    setActiveMessage(message);
    setContextMenuVisible(true);
    
    // 提供触觉反馈
    Vibration.vibrate(50);
  };
  
  // 关闭上下文菜单
  const hideContextMenu = () => {
    setContextMenuVisible(false);
  };
  
  // 复制消息
  const copyMessage = (message) => {
    if (message.type === 'text') {
      Clipboard.setString(message.text);
      hideContextMenu();
      // 可以添加一个提示，表示已复制
    }
  };
  
  // 进入多选模式
  const enterMultiSelectMode = () => {
    setIsMultiSelectMode(true);
    if (activeMessage) {
      setSelectedMessages([activeMessage.id]);
    }
    hideContextMenu();
  };
  
  // 退出多选模式
  const exitMultiSelectMode = () => {
    setIsMultiSelectMode(false);
    setSelectedMessages([]);
  };
  
  // 切换消息选择状态
  const toggleMessageSelection = (messageId) => {
    if (isMultiSelectMode) {
      setSelectedMessages(prev => 
        prev.includes(messageId)
          ? prev.filter(id => id !== messageId)
          : [...prev, messageId]
      );
    }
  };
  
  // 合并选中的消息
  const mergeSelectedMessages = () => {
    if (selectedMessages.length < 2) return;
    
    // 获取选中的消息
    const messagesToMerge = messages.filter(msg => 
      selectedMessages.includes(msg.id)
    ).sort((a, b) => {
      // 按照在原数组中的顺序排序
      return messages.findIndex(m => m.id === a.id) - messages.findIndex(m => m.id === b.id);
    });
    
    // 检查是否都是文本消息
    const allTextMessages = messagesToMerge.every(msg => msg.type === 'text');
    
    if (allTextMessages) {
      // 合并文本消息
      const mergedText = messagesToMerge.map(msg => msg.text).join('\n\n');
      
      const mergedMessage = {
        id: Date.now().toString(),
        text: mergedText,
        type: 'text',
        timestamp: new Date(),
        isCombined: true
      };
      
      // 更新消息列表
      setMessages(prevMessages => 
        prevMessages
          .filter(msg => !selectedMessages.includes(msg.id))
          .concat(mergedMessage)
      );
    } else {
      // 创建组合消息
      const combinedMessage = {
        id: Date.now().toString(),
        type: 'combined',
        messages: messagesToMerge,
        timestamp: new Date(),
        isCombined: true
      };
      
      // 更新消息列表
      setMessages(prevMessages => 
        prevMessages
          .filter(msg => !selectedMessages.includes(msg.id))
          .concat(combinedMessage)
      );
    }
    
    // 退出多选模式
    exitMultiSelectMode();
  };
  
  // 删除选中的消息
  const deleteSelectedMessages = () => {
    if (selectedMessages.length === 0) return;
    
    Alert.alert(
      "Delete Messages",
      `Are you sure you want to delete ${selectedMessages.length} message(s)?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => {
            setMessages(prevMessages => 
              prevMessages.filter(msg => !selectedMessages.includes(msg.id))
            );
            exitMultiSelectMode();
          },
          style: "destructive"
        }
      ]
    );
  };
  
  // 引用消息
  const quoteMessage = (message) => {
    // 创建引用文本
    let quoteText = '';
    
    if (message.type === 'text') {
      quoteText = `> ${message.text}\n\n`;
    } else if (message.type === 'image') {
      quoteText = '> [Image]\n\n';
    } else if (message.type === 'audio') {
      quoteText = '> [Audio]\n\n';
    }
    
    // 设置到输入框
    setInputText(quoteText + inputText);
    hideContextMenu();
    
    // 聚焦输入框
    // 这里需要一个输入框的ref，暂时省略
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

    // 如果是自由定位模式，为新消息设置一个默认位置
    if (freePositionMode) {
      const lastIndex = messages.length;
      setMessagePositions(prev => ({
        ...prev,
        [newMessage.id]: {
          x: 20,
          y: lastIndex * 60 + 20
        }
      }));
    }

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setInputText('');
    
    // 自动滚动到底部
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 切换自由定位模式
  const toggleFreePositionMode = () => {
    // 如果进入自由模式
    if (!freePositionMode) {
      // 为每个消息设置初始位置
      const initialPositions = {};
      const flatListNode = flatListRef.current;
      let scrollOffset = 0;
      
      // 在Web上，我们可能不能直接获取滚动位置
      if (Platform.OS === 'web' && flatListNode) {
        // 尝试获取Web滚动元素
        scrollOffset = flatListNode.scrollTop || 0;
      }
      
      messages.forEach((message, index) => {
        initialPositions[message.id] = {
          x: 20,
          y: index * 60 - scrollOffset
        };
      });
      
      setMessagePositions(initialPositions);
      setInitialPositionsSet(true);
    }
    
    // 如果当前是自由定位模式，切换回普通模式时重置所有位置
    if (freePositionMode) {
      setMessagePositions({});
      setInitialPositionsSet(false);
      setDraggingId(null);
      setDraggingIndex(null);
    }
    
    setFreePositionMode(prev => !prev);
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
    
    setIsMultiSelectMode(false);
    setSelectedMessages([]);
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
  const renderMessageItem = ({ item, index }) => {
    const isSelected = selectedMessages.includes(item.id);
    const isBeingDragged = index === draggingIndex;
    
    // 如果是编辑状态，显示编辑界面
    if (editingMessage && editingMessage.id === item.id) {
      return (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
          <View style={styles.editButtons}>
            <TouchableOpacity style={styles.editButton} onPress={cancelEdit}>
              <Text style={styles.editButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editButton} onPress={saveEditedMessage}>
              <Text style={[styles.editButtonText, styles.saveButtonText]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 在自由定位模式下，使用绝对定位
    if (freePositionMode) {
      // 使用保存的位置或默认位置
      const position = messagePositions[item.id] || { x: 20, y: index * 60 };
      
      return (
        <View 
          style={[
            {
              position: 'absolute',
              left: position.x, 
              top: position.y,
              zIndex: isBeingDragged ? 100 : 10,
            },
            isBeingDragged && {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.5,
              shadowRadius: 10,
              transform: [{ scale: 1.05 }]
            }
          ]}
          {...(draggingId !== item.id ? panResponder.current?.panHandlers : {})}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={(event) => showContextMenu(item, event)}
            onPress={() => {
              if (isMultiSelectMode) {
                toggleMessageSelection(item.id);
              }
            }}
            delayLongPress={500}
          >
            <View style={[
              styles.bubbleContainer,
              isBeingDragged && styles.draggingBubble,
              isSelected && styles.selectedMessageContainer,
              item.isCombined && styles.combinedMessageContainer
            ]}>
              {/* 消息内容 */}
              {item.type === 'text' && (
                <Text style={styles.messageText}>{item.text}</Text>
              )}
              
              {item.type === 'image' && (
                <Image source={{ uri: item.image }} style={styles.messageImage} />
              )}
              
              {item.type === 'audio' && (
                <TouchableOpacity 
                  style={styles.audioContainer}
                  onPress={() => playAudio(item.audio)}
                >
                  <Ionicons name="play" size={24} color="#fff" />
                  <Text style={styles.audioDuration}>
                    {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* 时间戳 */}
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {item.edited && ' (edited)'}
              </Text>
              
              {/* 多选模式下显示选择指示器 */}
              {isMultiSelectMode && (
                <View style={styles.selectionIndicator}>
                  <Ionicons 
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                    size={24} 
                    color={isSelected ? "#007AFF" : "#8E8E93"} 
                  />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    }
    
    // 普通模式下的渲染
    return (
      <Animated.View style={[
        styles.messageWrapper,
        isBeingDragged && {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y }
          ],
          zIndex: 100,
          elevation: 5
        }
      ]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={(event) => showContextMenu(item, event)}
          onPress={() => {
            if (isMultiSelectMode) {
              toggleMessageSelection(item.id);
            }
          }}
          delayLongPress={500}
        >
          <View style={[
            styles.messageContainer,
            isBeingDragged && styles.draggingMessageContainer,
            isSelected && styles.selectedMessageContainer,
            item.isCombined && styles.combinedMessageContainer
          ]}>
            {/* 消息内容 */}
            {item.type === 'text' && (
              <Text style={styles.messageText}>{item.text}</Text>
            )}
            
            {item.type === 'image' && (
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            )}
            
            {item.type === 'audio' && (
              <TouchableOpacity 
                style={styles.audioContainer}
                onPress={() => playAudio(item.audio)}
              >
                <Ionicons name="play" size={24} color="#fff" />
                <Text style={styles.audioDuration}>
                  {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* 时间戳 */}
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {item.edited && ' (edited)'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Note</Text>
        {isMultiSelectMode ? (
          <View style={styles.multiSelectControls}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={exitMultiSelectMode}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            {selectedMessages.length > 0 && (
              <>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={mergeSelectedMessages}
                  disabled={selectedMessages.length < 2}
                >
                  <Ionicons 
                    name="git-merge" 
                    size={24} 
                    color={selectedMessages.length < 2 ? "#555" : "#fff"} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={deleteSelectedMessages}
                >
                  <Ionicons name="trash" size={24} color="#FF453A" />
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={toggleFreePositionMode}
          >
            <Ionicons 
              name={freePositionMode ? "grid" : "move"} 
              size={24} 
              color={freePositionMode ? "#007AFF" : "#fff"} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      <View 
        style={[
          styles.messageListContainer,
          freePositionMode && styles.freeModeBg
        ]} 
        ref={listRef}
        onLayout={(event) => {
          const { height, width } = event.nativeEvent.layout;
          setListHeight(height);
          setListWidth(width);
        }}
        {...(freePositionMode ? panResponder.current?.panHandlers : {})}
      >
        {freePositionMode && (
          <View style={styles.grid}>
            {/* 网格线或其他装饰 */}
          </View>
        )}
        <FlatList
          ref={flatListRef}
          style={styles.messageList}
          contentContainerStyle={[
            styles.messageListContent,
            freePositionMode && { 
              height: Math.max(listHeight, messages.length * 60 + 200),
              position: 'relative'
            }
          ]}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          scrollEnabled={!freePositionMode}
        />
      </View>
      
      {/* 底部输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 工具栏 */}
        <View style={styles.inputContainer}>
          {/* 工具按钮行 */}
          <View style={styles.toolbarRow}>
            <TouchableOpacity 
              style={[
                styles.toolbarButton,
                isRecording && styles.activeToolbarButton
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons name="mic" size={24} color="#fff" />
              {isRecording && (
                <View style={styles.recordingIndicator}>
                  <Text style={styles.recordingTimeSmall}>
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.toolbarButton}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.toolbarButton}
              onPress={pickImage}
            >
              <Ionicons name="image" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* 文本输入行 */}
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
      
      {/* 上下文菜单 */}
      <Modal
        visible={contextMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={hideContextMenu}
      >
        <TouchableOpacity 
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={hideContextMenu}
        >
          <View 
            style={[
              styles.contextMenu,
              {
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
                // 确保菜单不会超出屏幕边界
                transform: [
                  { translateX: -100 }, // 向左偏移，避免超出右边界
                  { translateY: 10 }    // 向下偏移，避免被手指遮挡
                ]
              }
            ]}
          >
            {activeMessage?.type === 'text' && (
              <TouchableOpacity 
                style={styles.contextMenuItem}
                onPress={() => copyMessage(activeMessage)}
              >
                <Ionicons name="copy-outline" size={20} color="#fff" />
                <Text style={styles.contextMenuText}>Copy</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={() => deleteMessage(activeMessage?.id)}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.contextMenuText}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={enterMultiSelectMode}
            >
              <Ionicons name="checkbox-outline" size={20} color="#fff" />
              <Text style={styles.contextMenuText}>Select</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={() => quoteMessage(activeMessage)}
            >
              <Ionicons name="return-down-back-outline" size={20} color="#fff" />
              <Text style={styles.contextMenuText}>Quote</Text>
            </TouchableOpacity>
            
            {activeMessage?.type === 'text' && (
              <TouchableOpacity 
                style={styles.contextMenuItem}
                onPress={() => startEditMessage(activeMessage)}
              >
                <Ionicons name="pencil-outline" size={20} color="#fff" />
                <Text style={styles.contextMenuText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
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
  messageListContainer: {
    flex: 1,
    position: 'relative',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    position: 'relative',
    minHeight: '100%',
  },
  messageWrapper: {
    marginVertical: 4,
    position: 'relative',
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    alignSelf: 'flex-start',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
    transform: [{ scale: 1.03 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
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
  selectionIndicator: {
    position: 'absolute',
    left: -8,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  multiSelectControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contextMenu: {
    position: 'absolute',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  contextMenuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  bubbleContainer: {
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 16,
    maxWidth: 250,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  draggingBubble: {
    opacity: 0.9,
    transform: [{ scale: 1.05 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  // 自由模式下的背景
  freeModeBg: {
    backgroundColor: '#121212',
  },
  // 网格背景
  grid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    // 在Web上创建网格背景
    backgroundImage: Platform.OS === 'web' ? 
      'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)' : 
      undefined,
    backgroundSize: Platform.OS === 'web' ? '20px 20px' : undefined,
  },
}); 