import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MessageBubble({ 
  message, 
  isSelected, 
  isMultiSelectMode,
  onLongPress, 
  onPress,
  onPlayAudio
}) {
  // 根据消息类型渲染不同内容
  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return <Text style={styles.messageText}>{message.text}</Text>;
      case 'image':
        return (
          <Image 
            source={{ uri: message.image }} 
            style={styles.messageImage}
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
          {isSelected && (
            <Ionicons name="checkmark-circle" size={20} color="#0A84FF" />
          )}
          {!isSelected && (
            <Ionicons name="ellipse-outline" size={20} color="#8E8E93" />
          )}
        </View>
      )}
      
      <View style={styles.bubble}>
        {renderContent()}
        
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

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
    padding: 12,
    maxWidth: '80%',
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
    color: '#8E8E93',
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
}); 