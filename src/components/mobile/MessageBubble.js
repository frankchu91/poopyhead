import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  PinchGestureHandler, 
  State,
  GestureHandlerRootView 
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.98;
const MIN_BUBBLE_WIDTH = 120;

export default function MessageBubble({ 
  message, 
  isSelected, 
  isMultiSelectMode,
  onLongPress, 
  onPress,
  onPlayAudio,
  onResize,
  isResizable = false
}) {
  // 消息尺寸状态
  const [size, setSize] = useState({ width: 250, height: 'auto' });
  const [scale, setScale] = useState(1);
  const [baseWidth, setBaseWidth] = useState(250);
  const [isScaling, setIsScaling] = useState(false);
  
  // 维护一个引用以追踪缩放状态
  const scaleRef = useRef(scale);
  const baseWidthRef = useRef(baseWidth);
  
  useEffect(() => {
    scaleRef.current = scale;
    baseWidthRef.current = baseWidth;
  }, [scale, baseWidth]);
  
  // 处理缩放手势
  const onPinchGestureEvent = event => {
    // 只在自由模式下响应缩放
    if (!isResizable) return;
    
    // 更新缩放比例，使用更平滑的值
    const newScale = event.nativeEvent.scale;
    setScale(newScale);
    
    // 实时更新宽度，提供即时反馈
    const calculatedWidth = Math.max(MIN_BUBBLE_WIDTH, Math.min(MAX_BUBBLE_WIDTH, baseWidth * newScale));
    setSize(prev => ({
      ...prev,
      width: calculatedWidth
    }));
    
    // 通知父组件进行实时更新
    if (onResize) {
      onResize(message.id, { width: calculatedWidth });
    }
  };
  
  // 处理缩放手势状态变化
  const onPinchHandlerStateChange = event => {
    // 只在自由模式下响应缩放
    if (!isResizable) return;
    
    if (event.nativeEvent.oldState === State.BEGAN) {
      setIsScaling(true);
      console.log('Pinch gesture began');
    }
    else if (event.nativeEvent.oldState === State.ACTIVE) {
      // 缩放结束，更新基础宽度
      const finalScale = event.nativeEvent.scale;
      const newWidth = Math.max(MIN_BUBBLE_WIDTH, Math.min(MAX_BUBBLE_WIDTH, baseWidth * finalScale));
      
      console.log(`Pinch ended. New width: ${newWidth}`);
      
      // 更新基础宽度和重置缩放比例
      setBaseWidth(newWidth);
      setScale(1);
      setIsScaling(false);
      
      // 更新尺寸并通知父组件
      setSize(prev => ({
        ...prev,
        width: newWidth
      }));
      
      if (onResize) {
        onResize(message.id, { width: newWidth });
      }
    }
  };

  // 根据消息类型渲染不同内容
  const renderContent = () => {
    if (message.type === 'text') {
      return (
        <View>
          <Text style={[
            styles.messageText,
            message.isUserTyped && styles.userTypedText
          ]}>
            {message.text}
          </Text>
          <Text style={styles.timestamp}>{formatTimestamp(message.timestamp, true)}</Text>
        </View>
      );
    }
    
    switch (message.type) {
      case 'image':
        return (
          <Image 
            source={{ uri: message.image }} 
            style={[
              styles.messageImage, 
              { width: (size.width - 24) * scale }
            ]}
            resizeMode="cover"
          />
        );
      case 'audio':
        return (
          <TouchableOpacity 
            style={styles.audioContainer}
            onPress={() => onPlayAudio && onPlayAudio(message.audio)}
          >
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={styles.audioDuration}>
              {Math.round(message.duration)}s
            </Text>
          </TouchableOpacity>
        );
      default:
        return <Text style={styles.messageText}>不支持的消息类型</Text>;
    }
  };

  // 如果是用户消息或非文本消息，使用现有的气泡样式
  if (message.isUserTyped || message.type !== 'text') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableOpacity
          style={[
            styles.container,
            message.isUserTyped ? null : styles.voiceTranscribedContainer,
            isSelected && styles.selectedContainer
          ]}
          onLongPress={onLongPress}
          onPress={onPress}
          activeOpacity={0.8}
          delayLongPress={200}
        >
          {isMultiSelectMode && (
            <View style={styles.checkbox}>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={20} color="#0A84FF" />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color="#8E8E93" />
              )}
            </View>
          )}
          
          <PinchGestureHandler
            onGestureEvent={onPinchGestureEvent}
            onHandlerStateChange={onPinchHandlerStateChange}
            enabled={isResizable}
          >
            <View style={[
              styles.bubble,
              message.isUserTyped ? styles.userTypedBubble : styles.voiceTranscribedBubble,
              isResizable ? { width: size.width } : null,
              isResizable && styles.resizableBubble,
              isScaling && styles.activePinching
            ]}>
              {renderContent()}
              
              {/* 可视化的缩放提示 */}
              {isResizable && (
                <View style={styles.resizeIndicator}>
                  <Ionicons name="resize-outline" size={18} color="#0A84FF" />
                </View>
              )}
              
              {message.isTranscribing && (
                <View style={styles.transcribingIndicator}>
                  <Text style={styles.transcribingText}>正在转录...</Text>
                </View>
              )}
            </View>
          </PinchGestureHandler>
        </TouchableOpacity>
      </GestureHandlerRootView>
    );
  }
  
  // 如果是转录消息，使用新的演讲者转录样式
  return (
    <TouchableOpacity
      style={[
        styles.transcriptContainer,
        isSelected && styles.selectedContainer
      ]}
      onLongPress={onLongPress}
      onPress={onPress}
      activeOpacity={0.8}
      delayLongPress={200}
    >
      {isMultiSelectMode && (
        <View style={styles.checkbox}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={20} color="#0A84FF" />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color="#8E8E93" />
          )}
        </View>
      )}
      
      <View style={styles.transcriptContent}>
        <View style={styles.speakerHeader}>
          <View style={styles.speakerAvatar}>
            <Text style={styles.speakerAvatarText}>A</Text>
          </View>
          
          <Text style={styles.speakerName}>Speaker A</Text>
          
          <Text style={styles.transcriptTimestamp}>
            {formatTimestamp(message.timestamp, true)}
          </Text>
        </View>
        
        <Text style={styles.transcriptText}>{message.text}</Text>
        
        {message.isTranscribing && (
          <View style={styles.transcribingIndicator}>
            <Text style={styles.transcribingText}>正在转录...</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const formatTimestamp = (timestamp, compact = false) => {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  if (compact) {
    // 紧凑格式: 只显示时:分
    return date.getHours().toString().padStart(2, '0') + ':' + 
           date.getMinutes().toString().padStart(2, '0');
  } else {
    // 完整格式
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 4,
    width: '100%',
  },
  selectedContainer: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bubble: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 8,
    minWidth: 80,
    maxWidth: '95%',
    marginBottom: 2,
    alignSelf: 'flex-start',
  },
  messageText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 18,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 8,
    width: 120,
  },
  audioDuration: {
    color: '#fff',
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  resizeHandleInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resizingBubble: {
    borderColor: 'rgba(10, 132, 255, 0.5)',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  activePinching: {
    borderColor: '#0A84FF',
    borderWidth: 2,
    borderStyle: 'solid',
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  resizeIndicator: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortMessage: {
    maxWidth: '60%',
  },
  mediumMessage: {
    maxWidth: '75%',
  },
  longMessage: {
    maxWidth: '85%',
  },
  transcribingIndicator: {
    position: 'absolute',
    bottom: -18,
    right: 10,
    backgroundColor: 'rgba(255, 51, 51, 0.8)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  transcribingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userTypedContainer: {
    justifyContent: 'flex-end',
  },
  voiceTranscribedContainer: {
    justifyContent: 'flex-start',
  },
  userTypedBubble: {
    backgroundColor: '#0A84FF',
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  voiceTranscribedBubble: {
    backgroundColor: '#1C1C1E',
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  userTypedText: {
    color: '#FFFFFF',
  },
  transcriptContainer: {
    marginVertical: 12,
    marginHorizontal: 4,
    width: '100%',
  },
  transcriptContent: {
    backgroundColor: 'transparent',
    padding: 12,
    width: '95%',
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  speakerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4a6c42',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  speakerAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  speakerName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  transcriptTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  transcriptText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 22,
  }
}); 