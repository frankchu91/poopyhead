import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, Clipboard, UIManager, findNodeHandle, TouchableWithoutFeedback, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 启用布局动画测量 (仅适用于Android)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DocumentBlock({ 
  block, 
  onUpdate, 
  onDelete, 
  active = false
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(block.content);
  
  // 文本选择相关状态
  const [selectedText, setSelectedText] = useState('');
  const [selectionVisible, setSelectionVisible] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // 文本输入引用
  const textInputRef = useRef(null);
  const textContainerRef = useRef(null);
  
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
  
  // 计算菜单位置
  const measureTextPosition = useCallback((selection) => {
    if (!textContainerRef.current) return;
    
    try {
      const nodeHandle = findNodeHandle(textContainerRef.current);
      
      UIManager.measure(nodeHandle, (x, y, width, height, pageX, pageY) => {
        // 计算选中文本的大致位置
        const fontSize = 15; // 与样式中的字体大小一致
        const lineHeight = 22; // 与样式中的行高一致
        
        // 假设选中文本在单行的情况, 计算相对位置
        const selectedTextWidth = (selection.end - selection.start) * (fontSize * 0.6);
        const selectionStartX = pageX + 16; // 加上padding
        
        // 设置菜单位置在文本上方
        setSelectionCoords({
          x: selectionStartX,
          y: pageY - 40, // 菜单高度 + 一些间距
          width: selectedTextWidth,
          height: lineHeight
        });
      });
    } catch (error) {
      console.error('Measure error:', error);
      // 使用备用位置
      setSelectionCoords({
        x: 50,
        y: -40,
        width: 100,
        height: 22
      });
    }
  }, []);
  
  // 处理文本选择变化
  const handleSelectionChange = (event) => {
    const { selection } = event.nativeEvent;
    if (selection.start !== selection.end) {
      // 有文本被选中
      const selectedContent = block.content.substring(selection.start, selection.end);
      setSelectedText(selectedContent);
      
      // 测量选中文本的位置
      measureTextPosition(selection);
      
      setSelectionVisible(true);
    } else {
      // 没有选中文本
      hideSelectionMenu();
    }
  };
  
  // 隐藏选择菜单
  const hideSelectionMenu = () => {
    setSelectionVisible(false);
    setSelectedText('');
  };
  
  // 复制选中的文本
  const copySelectedText = () => {
    if (selectedText) {
      Clipboard.setString(selectedText);
      hideSelectionMenu();
    }
  };
  
  // 对选中文本添加笔记 (占位功能)
  const addNoteToSelection = () => {
    // 这里是占位功能，暂不实现
    hideSelectionMenu();
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
        <View ref={textContainerRef}>
          {/* 可选择的转录内容 */}
          <TextInput
            ref={textInputRef}
            style={styles.transcriptionContent}
            value={block.content}
            multiline
            editable={false}
            contextMenuHidden={true}
            onSelectionChange={handleSelectionChange}
            selectionColor={'rgba(10, 132, 255, 0.3)'}
          />
          
          {/* 点击文本区域外部时隐藏菜单 */}
          {selectionVisible && (
            <Modal
              transparent
              visible={selectionVisible}
              animationType="fade"
              onRequestClose={hideSelectionMenu}
            >
              <TouchableWithoutFeedback onPress={hideSelectionMenu}>
                <View style={styles.modalOverlay}>
                  <View 
                    style={[
                      styles.selectionMenu,
                      {
                        left: selectionCoords.x,
                        top: selectionCoords.y,
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.selectionOption}
                      onPress={copySelectedText}
                    >
                      <Text style={styles.selectionOptionText}>复制</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.selectionDivider} />
                    
                    <TouchableOpacity 
                      style={styles.selectionOption}
                      onPress={addNoteToSelection}
                    >
                      <Text style={styles.selectionOptionText}>Add notes</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
        </View>
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
    position: 'relative',
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
    backgroundColor: 'transparent',
    padding: 0,
    textAlignVertical: 'top',
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
  
  // 选择文本后的菜单和Modal样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  selectionMenu: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
    zIndex: 1000,
  },
  selectionOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectionOptionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
  selectionDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
}); 