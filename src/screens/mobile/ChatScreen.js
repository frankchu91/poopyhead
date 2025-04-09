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
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useChatLogic from '../../core/useChatLogic';
import MessageBubble from '../../components/mobile/MessageBubble';

export default function MobileChatScreen({ navigation, route }) {
  // 使用共享逻辑
  const {
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
  } = useChatLogic();

  // 移动端特有的状态
  const [draggingMessageId, setDraggingMessageId] = useState(null);
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAttachBar, setShowAttachBar] = useState(false);
  const [hasUsedFreeMode, setHasUsedFreeMode] = useState(false);
  
  const flatListRef = useRef(null);
  const listRef = useRef(null);

  // 滚动到底部
  useEffect(() => {
    if (flatListRef.current && messages.length > 0 && !freePositionMode) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, freePositionMode]);

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

  // 切换自由模式
  const toggleFreeMode = () => {
    console.log('Button pressed!');
    console.log('Current freePositionMode:', freePositionMode);
    
    // 如果要进入自由模式，标记为已使用
    if (!freePositionMode) {
      setHasUsedFreeMode(true);
      
      // 如果是第一次进入自由模式，为所有消息设置初始位置
      if (!hasUsedFreeMode) {
        const initialPositions = {};
        messages.forEach((msg, index) => {
          // 只设置还没有位置的消息
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
      }
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
    
    // 提供触觉反馈
    Vibration.vibrate(50);
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
      onMoveShouldSetPanResponder: () => freePositionMode,
      onPanResponderGrant: (evt, gestureState) => {
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
  const renderMessageItem = ({ item, index }) => {
    const isSelected = selectedMessages.includes(item.id);
    
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
            <TouchableOpacity onPress={cancelEdit} style={styles.editButton}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdit} style={styles.editButton}>
              <Text style={styles.saveText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.messageItem}>
        <MessageBubble
          message={item}
          isSelected={isSelected}
          isMultiSelectMode={isMultiSelectMode}
          onLongPress={(event) => showContextMenu(item, event.nativeEvent)}
          onPress={() => {
            if (isMultiSelectMode) {
              toggleMessageSelection(item.id);
            }
          }}
          onPlayAudio={playAudio}
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
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{route.params?.name || 'Chat'}</Text>
      <View style={styles.headerActions}>
        {isMultiSelectMode ? (
          <>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={deleteSelectedMessages}
            >
              <Ionicons name="trash" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={combineSelectedMessages}
            >
              <Ionicons name="git-merge" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {hasUsedFreeMode && (
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => {
                  // 重置布局
                  setHasUsedFreeMode(false);
                  setMessagePositions({});
                  setFreePositionMode(false);
                }}
              >
                <Ionicons name="refresh" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleMultiSelectMode}
            >
              <Ionicons name="checkbox-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.headerButton,
                freePositionMode && styles.activeHeaderButton
              ]}
              onPress={toggleFreeMode}
            >
              <Ionicons 
                name="move" 
                size={24} 
                color={freePositionMode ? "#4CAF50" : "#fff"} 
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {/* 调试信息 */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Free Mode: {freePositionMode ? 'ON' : 'OFF'}
        </Text>
        <Text style={styles.debugText}>
          Has Used Free Mode: {hasUsedFreeMode ? 'YES' : 'NO'}
        </Text>
        {draggingMessageId && (
          <Text style={styles.debugText}>
            Dragging: {draggingMessageId}
          </Text>
        )}
      </View>
      
      {/* 多选工具栏 */}
      {renderMultiSelectToolbar()}
      
      {/* 消息列表 */}
      <View 
        style={[
          styles.messagesContainer,
          showAttachBar && styles.messagesContainerWithAttachments
        ]} 
        ref={listRef}
      >
        {/* 如果正在自由模式或曾经使用过自由模式，使用自由定位布局 */}
        {(freePositionMode || hasUsedFreeMode) ? (
          <View style={styles.freePositionContainer}>
            {messages.map((item, index) => {
              // 使用保存的位置或默认位置
              const position = messagePositions[item.id] || { 
                x: 20, 
                y: 20 + index * 80 
              };
              
              // 只在自由模式下允许拖拽
              const panHandlers = freePositionMode ? 
                createPanResponder(item.id).panHandlers : {};
              
              const isDragging = draggingMessageId === item.id;
              
              return (
                <Animated.View 
                  key={item.id}
                  style={[
                    styles.freePositionMessage,
                    {
                      left: position.x, 
                      top: position.y,
                      zIndex: isDragging ? 100 : 10,
                    },
                    isDragging && styles.draggingMessage
                  ]}
                  {...panHandlers}
                >
                  <MessageBubble
                    message={item}
                    isSelected={selectedMessages.includes(item.id)}
                    isMultiSelectMode={isMultiSelectMode}
                    onLongPress={(event) => showContextMenu(item, event.nativeEvent)}
                    onPress={() => {
                      if (isMultiSelectMode) {
                        toggleMessageSelection(item.id);
                      }
                    }}
                    onPlayAudio={playAudio}
                  />
                </Animated.View>
              );
            })}
          </View>
        ) : (
          // 从未使用过自由模式，使用普通列表
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
          />
        )}
      </View>
      
      {/* 附件工具栏 */}
      {renderAttachmentBar()}
      
      {/* 输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[
          styles.inputContainer,
          showAttachBar ? { borderTopWidth: 0 } : { borderTopWidth: 1, borderTopColor: '#2C2C2E' }
        ]}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={() => setShowAttachBar(!showAttachBar)}
          >
            <Ionicons 
              name={showAttachBar ? "close-circle" : "add-circle"} 
              size={24} 
              color="#0A84FF" 
            />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入消息..."
            placeholderTextColor="#8E8E93"
            multiline
          />
          
          {inputText.trim() === '' ? (
            <TouchableOpacity 
              style={styles.recordButton}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons 
                name={isRecording ? "radio" : "mic"} 
                size={24} 
                color={isRecording ? "#FF453A" : "#0A84FF"} 
              />
              {isRecording && (
                <Text style={styles.recordingTime}>
                  {recordingTime}s
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={sendTextMessage}
            >
              <Ionicons name="send" size={24} color="#0A84FF" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
      
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
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1E1E1E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
    padding: 8,
  },
  activeHeaderButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  messagesList: {
    padding: 8,
  },
  freePositionContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#121212',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#1C1C1E',
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    maxHeight: 100,
  },
  recordButton: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingTime: {
    color: '#FF453A',
    marginLeft: 4,
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
  debugInfo: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
  },
  freePositionMessage: {
    position: 'absolute',
    maxWidth: 250,
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
    marginBottom: 8,
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
}); 