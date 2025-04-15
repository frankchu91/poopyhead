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
    console.log(`Rendering message: ${item.id}`, item);
    
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

  // 渲染顶部工具栏
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Chat</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity 
          style={[styles.headerButton, isRecording && styles.recordingActive]} 
          onPress={toggleRecording}
        >
          <Ionicons 
            name={isRecording ? "mic" : "mic-outline"} 
            size={22} 
            color={isRecording ? "#FF453A" : "#fff"} 
          />
        </TouchableOpacity>
        
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

  // 初始化语音服务
  useEffect(() => {
    // 初始化 SpeechToTextService
    speechToTextRef.current = new SpeechToTextService((text) => {
      setTranscription(text);
      setInputText(text); // 保持文本同步到输入框
    });
    
    return () => {
      // 清理
      if (speechToTextRef.current && speechToTextRef.current.isRecording) {
        speechToTextRef.current.stopRecording();
      }
    };
  }, []);

  // 修改开始录音函数
  const handleStartRecording = async () => {
    // 避免重复处理
    if (isProcessingVoice) return;
    
    try {
      setIsProcessingVoice(true);
      setIsTranscribing(true);
      setTranscription("");
      setInputText("");
      
      const success = await speechToTextRef.current.startRecording();
      if (!success) {
        console.error("Failed to start recording");
        setIsTranscribing(false);
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsTranscribing(false);
    } finally {
      // 延迟重置处理状态
      setTimeout(() => {
        setIsProcessingVoice(false);
      }, 1000); // 1秒防抖延迟
    }
  };

  // 修改停止录音函数
  const handleStopRecording = async () => {
    if (!isTranscribing) return;
    
    try {
      if (speechToTextRef.current && speechToTextRef.current.isRecording) {
        const finalText = await speechToTextRef.current.stopRecording();
        setInputText(finalText);
        setIsTranscribing(false);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        // 结束录音
        console.log("Stopping recording...");
        const text = await speechToTextRef.current.stopRecording();
        console.log("Got text:", text);
        
        if (text && text.trim()) {
          // 处理语音识别结果
          setInputText(text);
          sendTextMessage();
        }
        setIsRecording(false);
      } else {
        // 开始录音
        console.log("Starting recording...");
        const success = await speechToTextRef.current.startRecording();
        if (success) {
          setIsRecording(true);
          // 清除任何现有的输入文本
          setInputText("");
        } else {
          // 处理录音失败的情况
          Alert.alert("录音失败", "无法启动录音，请检查麦克风权限");
        }
      }
    } catch (error) {
      console.error("录音操作错误:", error);
      setIsRecording(false);
      Alert.alert("录音错误", "录音过程中发生错误");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {/* 消息区域 - 修复布局 */}
      <View style={styles.messageContainer}>
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
          </View>
        )}
      </View>
      
      {/* 附件工具栏 */}
      {renderAttachmentBar()}
      
      {/* 输入区域 */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.keyboardAvoidContainer}
      >
        {!editingMessage ? (
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachBar(!showAttachBar)}>
              <Ionicons name="add-circle" size={24} color="#0A84FF" />
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
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
              style={styles.sendButton}
              onPress={() => {
                if (inputText.trim()) {
                  handleSendMessage();
                }
              }}
            >
              <Ionicons name="send" size={24} color="#0A84FF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity onPress={cancelEdit} style={styles.editButton}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={styles.editButton}>
                <Text style={styles.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      
      {/* 上下文菜单 */}
      {renderContextMenu()}
      
      {showScalingTip && (
        <View style={styles.scalingTip}>
          <Ionicons name="finger-print" size={24} color="#fff" />
          <Text style={styles.scalingTipText}>
            使用双指捏合可调整消息大小
          </Text>
          <TouchableOpacity onPress={() => setShowScalingTip(false)}>
            <Ionicons name="close-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      
      {/* 渲染iOS键盘顶部栏 */}
      {renderInputAccessory()}

      {/* 添加一个浮动的转录状态指示器 */}
      {isTranscribing && (
        <View style={styles.transcriptionOverlay}>
          <Text style={styles.transcriptionText}>
            {transcription || "正在聆听..."}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flexContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  fullFlex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
    paddingVertical: 4,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    height: 42,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 12,
    padding: 6,
  },
  activeHeaderButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#000',
    minHeight: 100,
  },
  messagesList: {
    padding: 4,
    flexGrow: 1,
  },
  freePositionContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#121212',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    height: 48,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: '#fff',
    maxHeight: 100,
    marginRight: 8,
    fontSize: 14,
  },
  sendButton: {
    padding: 8,
  },
  editContainer: {
    backgroundColor: '#1C1C1E',
    padding: 12,
    borderRadius: 16,
    margin: 8,
  },
  editInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    minHeight: 80,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    marginLeft: 16,
    padding: 8,
  },
  cancelText: {
    color: '#FF453A',
  },
  saveText: {
    color: '#0A84FF',
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
  multiSelectToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1C1C1E',
  },
  selectedCount: {
    color: '#fff',
    flex: 1,
  },
  multiSelectAction: {
    marginLeft: 16,
  },
  closeMultiSelectButton: {
    marginLeft: 16,
  },
  freePositionMessage: {
    position: 'absolute',
    maxWidth: 350,
  },
  draggingMessage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    opacity: 0.9,
  },
  messageItem: {
    marginBottom: 2,
  },
  messagesContainerWithAttachments: {
    paddingTop: 8,
    marginBottom: 0,
  },
  attachmentBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1C1C1E',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  attachmentButton: {
    alignItems: 'center',
    width: 70,
  },
  attachmentIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentText: {
    color: '#fff',
    fontSize: 12,
  },
  scalingTip: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 132, 255, 0.8)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  },
  scalingTipText: {
    color: '#fff',
    flex: 1,
    marginHorizontal: 12,
  },
  keyboardAvoidContainer: {
    width: '100%',
    backgroundColor: '#1C1C1E',
  },
  inputAccessory: {
    backgroundColor: '#222222',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 36,
  },
  keyboardDismissButton: {
    padding: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
  },
  messageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  recordingActive: {
    backgroundColor: 'rgba(255, 69, 58, 0.3)',
    borderRadius: 16,
  },
  transcriptionOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  transcriptionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voiceButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: '#eee',
  },
  recordingButton: {
    backgroundColor: '#ffeeee',
  },
}); 