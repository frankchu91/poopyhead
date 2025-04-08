import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MessageBubble({ 
  message, 
  isSelected, 
  isMultiSelectMode,
  onLongPress,
  onPress,
  onPlayAudio,
  style
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={onLongPress}
      onPress={onPress}
      delayLongPress={500}
      style={styles.container}
    >
      <View style={[
        styles.messageContainer,
        isSelected && styles.selectedMessageContainer,
        message.isCombined && styles.combinedMessageContainer,
        style
      ]}>
        {/* Web 版特有的消息头部 */}
        <View style={styles.messageHeader}>
          <Text style={styles.timestamp}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {message.edited && (
            <Text style={styles.editedTag}>(edited)</Text>
          )}
        </View>
        
        {/* 消息内容 */}
        <View style={styles.messageContent}>
          {message.type === 'text' && (
            <Text style={styles.messageText}>{message.text}</Text>
          )}
          
          {message.type === 'image' && (
            <Image source={{ uri: message.image }} style={styles.messageImage} />
          )}
          
          {message.type === 'audio' && (
            <TouchableOpacity 
              style={styles.audioContainer}
              onPress={() => onPlayAudio(message.audio)}
            >
              <Ionicons name="play" size={24} color="#fff" />
              <View style={styles.audioProgressBar}>
                <View style={styles.audioProgress} />
              </View>
              <Text style={styles.audioDuration}>
                {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    maxWidth: 350,
  },
  messageContainer: {
    backgroundColor: '#424242',
    padding: 12,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timestamp: {
    color: '#9E9E9E',
    fontSize: 12,
  },
  editedTag: {
    color: '#9E9E9E',
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageContent: {
    marginVertical: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 4,
    marginVertical: 4,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 4,
    marginVertical: 4,
  },
  audioProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#555',
    borderRadius: 2,
    marginHorizontal: 8,
  },
  audioProgress: {
    width: '30%',
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  audioDuration: {
    color: '#9E9E9E',
    fontSize: 12,
  },
  selectedMessageContainer: {
    backgroundColor: '#2E7D32',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  combinedMessageContainer: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
}); 