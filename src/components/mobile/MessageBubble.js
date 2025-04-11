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
    switch (message.type) {
      case 'text':
        return <Text style={styles.messageText}>{message.text}</Text>;
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TouchableOpacity
        style={[
          styles.container,
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
            { width: size.width },
            isResizable && styles.resizableBubble,
            isScaling && styles.activePinching
          ]}>
            {renderContent()}
            
            <Text style={styles.timestamp}>
              {formatTimestamp(message.timestamp, true)}
            </Text>
            
            {/* 可视化的缩放提示 */}
            {isResizable && (
              <View style={styles.resizeIndicator}>
                <Ionicons name="resize-outline" size={18} color="#0A84FF" />
              </View>
            )}
          </View>
        </PinchGestureHandler>
      </TouchableOpacity>
    </GestureHandlerRootView>
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
    alignItems: 'center',
    marginVertical: 4,
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
    maxWidth: '80%',
    marginBottom: 2,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
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
    fontSize: 10,
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
}); 