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
  Animated,
  PanResponder,
  Modal,
  Vibration,
  ScrollView,
  Dimensions,
  Keyboard,
  InputAccessoryView,
  TouchableWithoutFeedback,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useChatLogic from '../../core/useChatLogic';
import MessageBubble from '../../components/mobile/MessageBubble';
import SpeechToTextService from '../../services/SpeechToTextService';
import RecordingProgressBar from '../../components/RecordingProgressBar';

const INPUT_ACCESSORY_ID = 'uniqueInputAccessoryId';

export default function MobileChatScreen({ navigation, route }) {
  // 使用共享逻辑
  const {
    messages,
    inputText,
    // isRecording, // 注释掉，因为我们将使用自己的状态
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
  } = useChatLogic();

  // 添加本地的录音状态
  const [isRecording, setIsRecording] = useState(false);

  // 移动端特有的状态
  const [draggingMessageId, setDraggingMessageId] = useState(null);
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAttachBar, setShowAttachBar] = useState(false);
  const [hasUsedFreeMode, setHasUsedFreeMode] = useState(false);
  const [showScalingTip, setShowScalingTip] = useState(false);
  
  const flatListRef = useRef(null);
  const listRef = useRef(null);

  // 添加键盘状态跟踪
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // 在组件内添加状态和服务实例
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const speechToTextRef = useRef(null);

  // 在语音按钮处理中增加延迟保护
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // 在 ChatScreen 组件内添加状态
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  // 在组件内创建新状态
  const [transcribedDuration, setTranscribedDuration] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // 添加一个状态来跟踪当前正在转录的消息
  const [transcribingMessageId, setTranscribingMessageId] = useState(null);

  // 添加一个状态来存储上一次的转录文本
  const [lastTranscriptionText, setLastTranscriptionText] = useState("");

  // 在组件顶部添加
  const transcribingMessageIdRef = useRef(null);

  // 监听键盘事件
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // 滚动到底部
        if (flatListRef.current && messages.length > 0 && !freePositionMode) {
          setTimeout(() => {
            flatListRef.current.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [messages.length, freePositionMode]);

  // 处理相机返回的图片
  useEffect(() => {
    if (route.params?.image) {
      // 处理从相机返回的图片
      const newMessage = {
        id: Date.now().toString(),
        type: 'image',
        image: route.params.image,
        timestamp: new Date()
      };
      
      // 添加新消息
      setMessages(prev => [...prev, newMessage]);
      
      // 如果在自由模式下，设置位置
      if (hasUsedFreeMode) {
        // 找到现有消息中 y 坐标最大的
        let maxY = 0;
        Object.values(messagePositions).forEach(pos => {
          if (pos.y > maxY) maxY = pos.y;
        });
        
        setMessagePositions(prev => ({
          ...prev,
          [newMessage.id]: {
            x: 20,
            y: maxY + 100 // 图片消息高度更大，所以间距也更大
          }
        }));
      }
      
      // 清除路由参数
      navigation.setParams({ image: null });
    }
  }, [route.params?.image]);

  // 处理新笔记
  useEffect(() => {
    if (route.params?.newNote) {
      const newMessage = {
        id: Date.now().toString(),
        text: route.params.newNote,
        type: 'text',
        timestamp: new Date()
      };
      
      // 添加新消息
      setMessages(prev => [...prev, newMessage]);
      
      // 如果在自由模式下，设置位置
      if (hasUsedFreeMode) {
        // 找到现有消息中 y 坐标最大的
        let maxY = 0;
        Object.values(messagePositions).forEach(pos => {
          if (pos.y > maxY) maxY = pos.y;
        });
        
        setMessagePositions(prev => ({
          ...prev,
          [newMessage.id]: {
            x: 20,
            y: maxY + 80
          }
        }));
      }
      
      // 清除路由参数
      navigation.setParams({ newNote: null });
    }
  }, [route.params?.newNote]);

  // 切换自由模式
  const toggleFreeMode = () => {
    console.log('Button pressed!');
    console.log('Current freePositionMode:', freePositionMode);
    
    // 无论何时点击按钮，都确保为所有消息设置位置
    const initialPositions = {};
    messages.forEach((msg, index) => {
      // 为所有消息设置位置，除非已经有位置
      if (!messagePositions[msg.id]) {
        initialPositions[msg.id] = {
          x: 20,
          y: 20 + index * 80
        };
      }
    });
    
    // 更新位置
    if (Object.keys(initialPositions).length > 0) {
      setMessagePositions(prev => ({
        ...prev,
        ...initialPositions
      }));
    }
    
    // 如果要进入自由模式，标记为已使用
    if (!freePositionMode) {
      setHasUsedFreeMode(true);
    }
    
    // 切换自由模式
    setFreePositionMode(!freePositionMode);
  };

  // 开始拖拽
  const startDrag = (messageId, x, y) => {
    console.log('Starting drag for message:', messageId, 'at position:', x, y);
    setDraggingMessageId(messageId);
    
    // 保存当前位置作为起始位置
    const currentPosition = messagePositions[messageId] || { x: 20, y: 20 };
    setDragStartPosition(currentPosition);
    
    // 计算触摸点与消息左上角的偏移
    setDragOffset({
      x: x - currentPosition.x,
      y: y - currentPosition.y
    });
    
    // // 提供触觉反馈
    // Vibration.vibrate(50);
  };

  // 拖拽中
  const onDrag = (x, y) => {
    if (!draggingMessageId) return;
    
    // 计算新位置（考虑偏移）
    const newX = x - dragOffset.x;
    const newY = y - dragOffset.y;
    
    console.log('Dragging to:', newX, newY);
    
    // 更新消息位置
    setMessagePositions(prev => ({
      ...prev,
      [draggingMessageId]: { x: newX, y: newY }
    }));
  };

  // 结束拖拽
  const endDrag = () => {
    console.log('Ending drag');
    setDraggingMessageId(null);
  };

  // 创建拖拽处理器
  const createPanResponder = (messageId) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => freePositionMode,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // 只有当有明显的移动时才开始拖动，这样可以避免与缩放手势冲突
        return freePositionMode && 
          (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
      },
      // 设置低优先级，让缩放手势有机会优先处理
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (evt, gestureState) => {
        // 检测到多点触摸时不启动拖动
        if (evt.nativeEvent.touches.length > 1) return;
        
        const { pageX, pageY } = evt.nativeEvent;
        startDrag(messageId, pageX, pageY);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { pageX, pageY } = evt.nativeEvent;
        onDrag(pageX, pageY);
      },
      onPanResponderRelease: () => {
        endDrag();
      },
      onPanResponderTerminate: () => {
        endDrag();
      }
    });
  };

  // 处理消息大小调整
  const handleMessageResize = (messageId, newSize) => {
    console.log(`Resizing message ${messageId} to:`, newSize);
    
    // 检查 messageSizes 是否已定义
    if (!messageSizes) {
      console.warn('messageSizes is undefined!');
      return;
    }
    
    setMessageSizes(prev => {
      console.log('Previous messageSizes:', prev);
      const updated = {
        ...prev,
        [messageId]: newSize
      };
      console.log('Updated messageSizes:', updated);
      return updated;
    });
  };

  // 渲染附件工具栏
  const renderAttachmentBar = () => {
    if (!showAttachBar) return null;
    
    return (
      <View style={styles.attachmentBar}>
        <TouchableOpacity 
          style={styles.attachmentButton}
          onPress={() => {
            navigation.navigate('Camera');
            setShowAttachBar(false);
          }}
        >
          <View style={styles.attachmentIconContainer}>
            <Ionicons name="camera" size={24} color="#fff" />
          </View>
          <Text style={styles.attachmentText}>拍照</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.attachmentButton}
          onPress={() => {
            pickImage();
            setShowAttachBar(false);
          }}
        >
          <View style={styles.attachmentIconContainer}>
            <Ionicons name="image" size={24} color="#fff" />
          </View>
          <Text style={styles.attachmentText}>相册</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.attachmentButton}
          onPress={() => {
            // 长按录音功能保留在输入框旁边
            setShowAttachBar(false);
          }}
        >
          <View style={styles.attachmentIconContainer}>
            <Ionicons name="mic" size={24} color="#fff" />
          </View>
          <Text style={styles.attachmentText}>语音</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 渲染消息项
  const renderMessageItem = ({ item }) => {
    const isSelected = selectedMessages.includes(item.id);
    
    // 在这里添加调试日志
    // console.log(`Rendering message: ${item.id}`, item);
    
    // 返回简化的 MessageBubble 组件
    return (
      <View style={styles.messageItem}>
        <MessageBubble
          message={item}
          isSelected={isSelected}
          isMultiSelectMode={isMultiSelectMode}
          onLongPress={() => showContextMenu(item, {})}
          onPress={() => {
            if (isMultiSelectMode) {
              toggleMessageSelection(item.id);
            }
          }}
          onPlayAudio={playAudio}
          onResize={(messageId, size) => handleMessageResize(messageId, size)}
          isResizable={freePositionMode}
        />
      </View>
    );
  };

  // 渲染上下文菜单
  const renderContextMenu = () => {
    if (!contextMenuVisible) return null;
    
    return (
      <Modal
        transparent
        visible={contextMenuVisible}
        onRequestClose={() => setContextMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.contextMenuOverlay}
          onPress={() => setContextMenuVisible(false)}
          activeOpacity={1}
        >
          <View 
            style={[
              styles.contextMenu,
              {
                left: contextMenuPosition.x,
                top: contextMenuPosition.y
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={() => {
                if (activeMessage) {
                  editMessage(activeMessage);
                }
                setContextMenuVisible(false);
              }}
            >
              <Ionicons name="create" size={20} color="#fff" />
              <Text style={styles.contextMenuText}>编辑</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={() => {
                if (activeMessage) {
                  copyMessage(activeMessage);
                }
                setContextMenuVisible(false);
              }}
            >
              <Ionicons name="copy" size={20} color="#fff" />
              <Text style={styles.contextMenuText}>复制</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contextMenuItem}
              onPress={() => {
                if (activeMessage) {
                  deleteMessage(activeMessage.id);
                }
                setContextMenuVisible(false);
              }}
            >
              <Ionicons name="trash" size={20} color="#FF453A" />
              <Text style={[styles.contextMenuText, { color: '#FF453A' }]}>删除</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // 渲染多选工具栏
  const renderMultiSelectToolbar = () => {
    if (!isMultiSelectMode) return null;
    
    return (
      <View style={styles.multiSelectToolbar}>
        <Text style={styles.selectedCount}>
          已选择 {selectedMessages.length} 条消息
        </Text>
        
        <TouchableOpacity 
          style={styles.multiSelectAction}
          onPress={deleteSelectedMessages}
        >
          <Ionicons name="trash" size={24} color="#FF453A" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.multiSelectAction}
          onPress={combineSelectedMessages}
        >
          <Ionicons name="git-merge" size={24} color="#0A84FF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.closeMultiSelectButton}
          onPress={toggleMultiSelectMode}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // 修改renderHeader函数，移除录音按钮
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Chat</Text>
      
      <View style={styles.headerActions}>
        {/* 移除录音按钮，只保留其他功能按钮 */}
        <TouchableOpacity style={styles.headerButton} onPress={() => {}}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerButton} onPress={toggleMultiSelectMode}>
          <Ionicons name="checkbox-outline" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.headerButton, freePositionMode && styles.activeHeaderButton]} 
          onPress={toggleFreeMode}
        >
          <Ionicons name="move" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // 点击背景隐藏键盘
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // 创建键盘配件视图 (iOS)
  const renderInputAccessory = () => {
    if (Platform.OS !== 'ios') return null;
    
    return (
      <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
        <View style={styles.inputAccessory}>
          <TouchableOpacity onPress={dismissKeyboard} style={styles.keyboardDismissButton}>
            <Ionicons name="chevron-down" size={20} color="#0A84FF" />
          </TouchableOpacity>
        </View>
      </InputAccessoryView>
    );
  };
  
  // 修改handleSendMessage，简化逻辑
  const handleSendMessage = () => {
    sendTextMessage();
    setTimeout(() => scrollToBottom(false), 100);
  };

  const scrollToBottom = (animated = true) => {
    if (flatListRef.current && !freePositionMode && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated });
    }
  };

  // 在组件加载时为消息预设位置
  useEffect(() => {
    // 组件挂载时，确保所有消息都有位置
    if (messages.length > 0) {
      const initialPositions = {};
      messages.forEach((msg, index) => {
        if (!messagePositions[msg.id]) {
          initialPositions[msg.id] = {
            x: 20,
            y: 20 + index * 80
          };
        }
      });
      
      if (Object.keys(initialPositions).length > 0) {
        setMessagePositions(prev => ({
          ...prev,
          ...initialPositions
        }));
      }
    }
  }, []);  // 空依赖数组确保只在挂载时运行一次

  // 添加横屏检测和自适应布局
  const [orientation, setOrientation] = useState('portrait');
  const window = Dimensions.get('window');

  useEffect(() => {
    // 检测设备方向
    const updateOrientation = () => {
      const { width, height } = Dimensions.get('window');
      setOrientation(width > height ? 'landscape' : 'portrait');
    };
    
    // 初始化方向
    updateOrientation();
    
    // 监听方向变化
    Dimensions.addEventListener('change', updateOrientation);
    
    return () => {
      // 旧版本
      if (Dimensions.removeEventListener) {
        Dimensions.removeEventListener('change', updateOrientation);
      }
      // 新版本
      else if (Dimensions.removeEventListener) {
        // 新版方式
      }
    };
  }, []);

  // 修改toggleRecording函数
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        // 结束录音
        console.log("Stopping recording...");
        const text = await speechToTextRef.current.stopRecording();
        console.log("Got text:", text);
        
        // 标记当前转录消息为已完成
        setMessages(prev => prev.map(msg => 
          msg.id === transcribingMessageIdRef.current 
            ? { ...msg, isTranscribing: false } 
            : msg
        ));
        
        // 重置转录状态 (同时重置ref和state)
        transcribingMessageIdRef.current = null;
        setTranscribingMessageId(null);
        setIsRecording(false);
      } else {
        // 开始录音前先创建一个初始消息
        const newMessageId = Date.now().toString();
        const newMessage = {
          id: newMessageId,
          type: 'text',
          text: "正在倾听...",
          isTranscribing: true,
          timestamp: new Date()
        };
        
        // 添加新消息
        setMessages(prev => [...prev, newMessage]);
        
        // 同时更新ref和state (ref会立即更新，state是异步的)
        transcribingMessageIdRef.current = newMessageId;
        setTranscribingMessageId(newMessageId);
        
        console.log("设置转录消息ID (ref):", newMessageId);
        
        // 如果在自由模式下，设置位置
        if (hasUsedFreeMode) {
          let maxY = 0;
          Object.values(messagePositions).forEach(pos => {
            if (pos.y > maxY) maxY = pos.y;
          });
          
          setMessagePositions(prev => ({
            ...prev,
            [newMessageId]: { x: 20, y: maxY + 80 }
          }));
        }
        
        // 开始录音
        console.log("Starting recording...");
        const success = await speechToTextRef.current.startRecording();
        if (success) {
          setIsRecording(true);
        } else {
          // 如果录音启动失败，移除刚刚创建的消息
          setMessages(prev => prev.filter(msg => msg.id !== newMessageId));
          setTranscribingMessageId(null);
          transcribingMessageIdRef.current = null;
          Alert.alert("录音失败", "无法启动录音，请检查麦克风权限");
        }
      }
    } catch (error) {
      console.error("录音操作错误:", error);
      setIsRecording(false);
      Alert.alert("录音错误", "录音过程中发生错误");
    }
  };

  // 修改转录更新处理函数，改为追加文本
  const handleTranscriptionUpdate = (text, progressInfo) => {
    // 更新进度状态
    if (progressInfo) {
      setTranscribedDuration(progressInfo.transcribedDuration);
      setTotalDuration(progressInfo.totalDuration);
      setTranscriptionProgress(progressInfo.progress);
    }
    
    // 使用ref获取消息ID
    const currentId = transcribingMessageIdRef.current;
    console.log(`接收到转录更新: "${text}", REF ID: ${currentId}`);
    
    // 检查是否有有效文本和转录ID
    if (text && text.trim() && currentId) {
      // 追加新文本而不是覆盖
      setMessages(prev => {
        // 先检查消息是否存在
        const messageExists = prev.some(msg => msg.id === currentId);
        if (!messageExists) {
          console.warn("找不到要更新的消息:", currentId);
          return prev;
        }
        
        return prev.map(msg => {
          if (msg.id === currentId) {
            // 如果消息当前为"正在倾听..."，则替换它
            // 否则，追加新的转录文本
            const currentText = msg.text === "正在倾听..." ? "" : msg.text;
            const updatedText = currentText ? `${currentText} ${text.trim()}` : text.trim();
            
            console.log("更新消息文本:", updatedText);
            return { ...msg, text: updatedText };
          }
          return msg;
        });
      });
      
      // 自动滚动到底部
      setTimeout(() => scrollToBottom(false), 100);
    } else {
      console.log("未更新消息: 文本为空或ID不存在", 
        "文本:", text, 
        "REF ID:", currentId);
    }
  };

  // 初始化语音服务时传递更新的回调
  useEffect(() => {
    // 初始化 SpeechToTextService
    speechToTextRef.current = new SpeechToTextService((text, progressInfo) => {
      handleTranscriptionUpdate(text, progressInfo);
    });
    
    return () => {
      // 清理
      if (speechToTextRef.current && speechToTextRef.current.isRecording) {
        speechToTextRef.current.stopRecording();
      }
    };
  }, []);

  // 添加点击事件处理函数
  const hideKeyboardOnAreaTap = () => {
    Keyboard.dismiss();
  };

  // 添加取消录音的方法
  const cancelRecording = () => {
    // 如果正在录音，取消它
    if (isRecording && speechToTextRef.current) {
      // 停止录音但不处理结果
      speechToTextRef.current.cancelRecording();
      
      // 重置状态
      setIsRecording(false);
      setIsProcessingVoice(false);
      setRecordingDuration(0);
      setTranscriptionProgress(0);
      setTranscribedDuration(0);
      setTotalDuration(0);
      setTranscribingMessageId(null);
      transcribingMessageIdRef.current = null;
      
      // 可选：移除"正在倾听..."消息
      setMessages(prev => prev.filter(msg => msg.id !== transcribingMessageIdRef.current));
      
      console.log("录音已取消");
    }
  };

  // 修改录音按钮逻辑
  const handleRecordingAction = () => {
    if (isRecording) {
      // 已经在录音，显示确认对话框
      Alert.alert(
        "结束录音",
        "您确定要结束当前录音吗？",
        [
          {
            text: "取消",
            style: "cancel"
          },
          { 
            text: "确定", 
            onPress: toggleRecording 
          }
        ]
      );
    } else {
      // 开始新录音
      toggleRecording();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {/* 消息区域 - 修复布局 */}
      <View 
        style={styles.messageContainer}
        onTouchStart={hideKeyboardOnAreaTap}
      >
        {freePositionMode ? (
          // 自由模式布局
          <View style={styles.freePositionContainer}>
            {messages.map(message => (
              <Animated.View
                key={message.id}
                style={[
                  styles.freePositionMessage,
                  {
                    left: messagePositions[message.id]?.x || 20,
                    top: messagePositions[message.id]?.y || 20,
                  },
                  draggingMessageId === message.id && styles.draggingMessage
                ]}
                {...createPanResponder(message.id).panHandlers}
              >
                <MessageBubble
                  message={message}
                  isSelected={selectedMessages.includes(message.id)}
                  isMultiSelectMode={isMultiSelectMode}
                  onLongPress={() => showContextMenu(message, {})}
                  onPress={() => {
                    if (isMultiSelectMode) {
                      toggleMessageSelection(message.id);
                    }
                  }}
                  onPlayAudio={playAudio}
                  onResize={(messageId, size) => handleMessageResize(messageId, size)}
                  isResizable={true}  // 强制为可调整大小
                />
              </Animated.View>
            ))}
          </View>
        ) : (
          // 列表模式布局
          <View style={styles.messagesContainer}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessageItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesList}
                style={[styles.fullFlex, { backgroundColor: '#000' }]}
                removeClippedSubviews={false}
                windowSize={7}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                onContentSizeChange={() => {
                  if (flatListRef.current && messages.length > 0) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }}
              />
            </TouchableWithoutFeedback>
          </View>
        )}
      </View>
      
      {/* 附件工具栏 */}
      {renderAttachmentBar()}
      
      {/* 输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ backgroundColor: '#1A1A1A' }}
      >
        {isRecording && (
          <RecordingProgressBar 
            isRecording={isRecording}
            duration={recordingDuration}
            transcriptionProgress={transcriptionProgress}
            transcribedSeconds={transcribedDuration}
            totalSeconds={totalDuration}
          />
        )}
        
        {!editingMessage ? (
          <View style={[styles.inputContainer, { backgroundColor: '#1A1A1A', borderTopWidth: 0.5, borderTopColor: '#333' }]}>
            <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachBar(!showAttachBar)}>
              <Ionicons name="add-circle" size={24} color="#0A84FF" />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, { backgroundColor: '#2C2C2E', borderRadius: 18, color: '#FFFFFF' }]}
              placeholder="输入消息..."
              placeholderTextColor="#8E8E93"
              value={inputText}
              onChangeText={setInputText}
              multiline={false}
              returnKeyType="send"
              blurOnSubmit={false}
              enablesReturnKeyAutomatically={true}
              onSubmitEditing={() => {
                if (inputText.trim()) {
                  handleSendMessage();
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance="dark"
              inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined}
            />
            
            <TouchableOpacity 
              style={[styles.sendButton, isRecording && { backgroundColor: '#FF453A', borderRadius: 20 }]}
              onPress={handleRecordingAction}
              onLongPress={cancelRecording}
              delayLongPress={500}
              disabled={isProcessingVoice}
            >
              <Ionicons 
                name={isRecording ? "stop-circle" : "mic-outline"} 
                size={22} 
                color={isRecording ? "#fff" : "#0A84FF"} 
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      
      {/* 多选工具栏 */}
      {renderMultiSelectToolbar()}
      
      {/* 上下文菜单 */}
      {renderContextMenu()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 10,
  },
  recordingActive: {
    backgroundColor: '#FF453A',
  },
  activeHeaderButton: {
    backgroundColor: '#0A84FF',
  },
  messageContainer: {
    flex: 1,
  },
  freePositionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  freePositionMessage: {
    position: 'absolute',
  },
  draggingMessage: {
    borderWidth: 2,
    borderColor: '#FF453A',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 10,
  },
  attachmentBar: {
    flexDirection: 'row',
    padding: 10,
  },
  attachmentButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 5,
  },
  attachmentIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  keyboardAvoidContainer: {
    // 删除flex: 1
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  attachButton: {
    padding: 10,
  },
  input: {
    flex: 1,
    padding: 10,
    color: '#FFFFFF',
  },
  sendButton: {
    padding: 10,
  },
  multiSelectToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  multiSelectAction: {
    padding: 10,
  },
  closeMultiSelectButton: {
    padding: 10,
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contextMenu: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
  },
  contextMenuItem: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextMenuText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 10,
  },
});