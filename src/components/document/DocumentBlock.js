import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DocumentBlock({ 
  block, 
  onUpdate, 
  onDelete, 
  active = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(block.content);
  
  const handleSave = () => {
    if (editText.trim() !== block.content) {
      onUpdate(block.id, editText.trim());
    }
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditText(block.content);
    setIsEditing(false);
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // 确定块类型样式
  const getBlockStyle = () => {
    switch(block.type) {
      case 'transcription':
        return styles.transcriptionBlock;
      case 'note':
        return styles.noteBlock;
      default:
        return styles.defaultBlock;
    }
  };
  
  // 如果是笔记，使用新的注释风格渲染
  if (block.type === 'note') {
    return (
      <View style={[
        styles.noteContainer,
        active && styles.activeNoteBlock
      ]}>
        <View style={styles.noteContentWrapper}>
          <Text style={styles.noteContent}>{block.content}</Text>
          
          {/* 编辑和删除按钮 - 放在右上角 */}
          <View style={styles.noteActions}>
            <TouchableOpacity 
              style={styles.noteAction}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="pencil-outline" size={16} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.noteAction}
              onPress={() => onDelete(block.id)}
            >
              <Ionicons name="trash-outline" size={16} color="#999" />
            </TouchableOpacity>
          </View>
          
          {isEditing && (
            <View style={styles.editingContainer}>
              <TextInput
                multiline
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.editButton} onPress={handleCancel}>
                  <Ionicons name="close-outline" size={22} color="#666" />
                  <Text style={styles.editButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editButton} onPress={handleSave}>
                  <Ionicons name="checkmark" size={22} color="#0A84FF" />
                  <Text style={[styles.editButtonText, { color: '#0A84FF' }]}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }
  
  // 如果是转录块，使用新的对话风格
  return (
    <View style={[
      styles.transcriptionContainer,
      active && styles.activeBlock
    ]}>
      <View style={styles.transcriptionHeader}>
        {/* 说话者信息和时间戳 */}
        <View style={styles.speakerHeader}>
          <View style={styles.speakerCircle}>
            <Text style={styles.speakerInitial}>A</Text>
          </View>
          <View style={styles.speakerInfo}>
            <Text style={styles.speakerName}>Speaker A</Text>
            <Text style={styles.timestamp}>{formatTime(block.createdAt)}</Text>
          </View>
        </View>
        
        {/* 编辑和删除按钮 */}
        <View style={styles.blockActions}>
          <TouchableOpacity 
            style={styles.blockAction}
            onPress={() => setIsEditing(true)}
          >
            <Ionicons name="pencil-outline" size={18} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.blockAction}
            onPress={() => onDelete(block.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
      
      {isEditing ? (
        <View style={styles.editingContainer}>
          <TextInput
            multiline
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            autoFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.editButton} onPress={handleCancel}>
              <Ionicons name="close-outline" size={22} color="#666" />
              <Text style={styles.editButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editButton} onPress={handleSave}>
              <Ionicons name="checkmark" size={22} color="#0A84FF" />
              <Text style={[styles.editButtonText, { color: '#0A84FF' }]}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.transcriptionContent}>{block.content}</Text>
      )}
      
      {active && (
        <View style={styles.activeIndicator}>
          <Text style={styles.activeText}>正在转录...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blockContainer: {
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  blockTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockTypeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginRight: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28a745',
  },
  transcriptionBlock: {
    backgroundColor: '#f8f9fa',
    borderLeftColor: '#6c757d',
  },
  noteBlock: {
    backgroundColor: '#e7f5ff',
    borderLeftColor: '#0A84FF',
  },
  defaultBlock: {
    backgroundColor: '#f8f9fa',
    borderLeftColor: '#6c757d',
  },
  activeBlock: {
    borderLeftColor: '#28a745',
  },
  activeNoteBlock: {
    borderLeftColor: '#28a745',
  },
  blockContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#212529',
  },
  blockActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  blockAction: {
    padding: 8,
    marginLeft: 4,
  },
  editingContainer: {
    width: '100%',
    marginTop: 8,
  },
  editInput: {
    fontSize: 16,
    lineHeight: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    minHeight: 100,
    color: '#212529',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  editButtonText: {
    fontSize: 14,
    marginLeft: 4,
    color: '#666',
  },
  
  transcriptionContainer: {
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6c757d',
  },
  transcriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  speakerInitial: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  speakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  transcriptionContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginTop: 4,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -10,
    right: 20,
    backgroundColor: 'rgba(40, 167, 69, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // 新的笔记样式 - 设计成注释风格
  noteContainer: {
    marginVertical: 4,
    marginLeft: 24, // 缩进，表示从属关系
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderLeftWidth: 2, // 更细的边框
    backgroundColor: 'rgba(246, 250, 255, 0.7)', // 更轻的背景色
    borderLeftColor: '#90CAF9', // 更淡的蓝色
    maxWidth: '92%', // 宽度更窄，增强从属感
  },
  noteContentWrapper: {
    position: 'relative',
  },
  noteContent: {
    fontSize: 13, // 字体更小
    lineHeight: 17,
    fontStyle: 'italic', // 斜体，区分于转录
    color: '#444', // 字体颜色更深，增强可读性
    paddingRight: 50, // 为右侧按钮预留空间
  },
  noteActions: {
    position: 'absolute', 
    top: -4,
    right: -4,
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 245, 245, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  noteAction: {
    padding: 6,
    marginLeft: 2,
  },
}); 