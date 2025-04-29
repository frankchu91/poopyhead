import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  onAddNote,
  active = false,
  autoFocus = false,
  relatedNotes = [], // 添加关联笔记参数
  onAddEmptyNote // 新增：添加空白笔记的回调函数
}) {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [editText, setEditText] = useState(block.content);
  
  // 文本选择相关状态
  const [selectedText, setSelectedText] = useState('');
  const [selectionVisible, setSelectionVisible] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  // 触摸和拖动相关状态
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  
  // 添加新的状态变量，用于垂直三点菜单
  const [menuVisible, setMenuVisible] = useState(false);
  // 添加菜单位置状态
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  // 文本输入引用
  const textInputRef = useRef(null);
  const textContainerRef = useRef(null);
  // 添加菜单按钮引用
  const menuButtonRef = useRef(null);
  
  // 当autoFocus改变时，更新编辑状态
  useEffect(() => {
    if (autoFocus && !isEditing) {
      setIsEditing(true);
    }
  }, [autoFocus]);
  
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
  
  // 测量菜单按钮位置并显示菜单
  const showMenu = () => {
    if (!menuButtonRef.current) return;
    
    const nodeHandle = findNodeHandle(menuButtonRef.current);
    
    UIManager.measure(nodeHandle, (x, y, width, height, pageX, pageY) => {
      // 菜单位置设置在按钮右侧
      setMenuPosition({
        x: pageX,
        y: pageY + height
      });
      setMenuVisible(true);
    });
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
        const charWidth = fontSize * 0.6; // 估算的字符宽度
        
        // 获取文本内容和选区
        const content = block.content || '';
        const selStart = selection.start || 0;
        const selEnd = selection.end || 0;
        
        // 计算选中文本的大致长度
        const selectedTextWidth = (selEnd - selStart) * charWidth;
        
        // 找到选中文本的起始位置 (加上左边距)
        const selectionStartX = pageX + 16 + (selStart * charWidth);
        
        // 估计选中文本的垂直位置
        // 假设每行大约能容纳的字符数
        const charsPerLine = Math.floor((width - 32) / charWidth);
        
        // 如果charsPerLine为0，设置一个默认值避免除以零错误
        const actualCharsPerLine = charsPerLine > 0 ? charsPerLine : 50;
        
        // 估计选中文本开始位置所在的行数
        const startLineNumber = Math.floor(selStart / actualCharsPerLine);
        
        // 基于行数计算垂直位置
        const selectionY = pageY + (startLineNumber * lineHeight);
        
        // 设置选区坐标
        setSelectionCoords({
          x: selectionStartX,
          y: selectionY,
          width: selectedTextWidth,
          height: lineHeight,
          startOffset: selStart,
          endOffset: selEnd
        });
      });
    } catch (error) {
      console.error('Measure error:', error);
      // 使用备用位置
      setSelectionCoords({
        x: 50,
        y: 40,
        width: 100,
        height: 22,
        startOffset: selection.start,
        endOffset: selection.end
      });
    }
  }, [block.content]);
  
  // 处理文本选择变化
  const handleSelectionChange = (event) => {
    const { selection } = event.nativeEvent;
    if (selection.start !== selection.end) {
      // 有文本被选中
      const selectedContent = block.content.substring(selection.start, selection.end);
      setSelectedText(selectedContent);
      setSelectionRange(selection);
      
      // 测量选中文本的位置
      measureTextPosition(selection);
      
      setSelectionVisible(true);
    } else {
      // 没有选中文本
      hideSelectionMenu();
    }
  };
  
  // 计算选择手柄位置
  const getHandlePosition = (isStart = true) => {
    const baseX = selectionCoords.x || 0;
    const baseY = selectionCoords.y || 0;
    const width = selectionCoords.width || 0;
    const height = selectionCoords.height || 0;
    
    if (isStart) {
      return {
        x: baseX - 8, // 向左偏移，更适合触摸
        y: baseY + height // 底部
      };
    } else {
      // 结束位置在选区右侧
      return {
        x: baseX + width - 8, // 向左偏移一点以居中
        y: baseY + height // 底部
      };
    }
  };
  
  // 手柄拖动开始
  const handleHandleDragStart = (isStart, event) => {
    if (isStart) {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
    
    setIsDragging(true);
    
    // 保存触摸起始位置
    const touch = event.nativeEvent.touches[0] || event.nativeEvent;
    setTouchStartX(touch.pageX);
    setLastTouch({ x: touch.pageX, y: touch.pageY });
  };
  
  // 全局拖动处理
  const handleTouchMove = (event) => {
    if (!isDragging) return;
    
    const touch = event.nativeEvent.touches[0] || event.nativeEvent;
    const { pageX, pageY } = touch;
    
    // 计算移动距离
    const deltaX = pageX - lastTouch.x;
    setLastTouch({ x: pageX, y: pageY });
    
    // 基于当前字体大小估算字符宽度
    const fontSize = 15;
    const avgCharWidth = fontSize * 0.6;
    
    // 敏感度调整 - 平滑拖动体验
    const sensitivity = 1.2; // 增加灵敏度使拖动更流畅
    const charDelta = Math.round((deltaX * sensitivity) / avgCharWidth);
    
    if (charDelta === 0) return;
    
    // 更新选择范围
    try {
      if (isDraggingStart) {
        // 调整起始位置，但不能超过终点位置减1
        const newStart = Math.max(0, Math.min(selectionRange.start + charDelta, selectionRange.end - 1));
        
        if (newStart !== selectionRange.start) {
          updateSelectionRange({
            start: newStart,
            end: selectionRange.end
          });
        }
      } else if (isDraggingEnd) {
        // 调整终点位置，但不能小于起点位置加1
        const newEnd = Math.max(selectionRange.start + 1, Math.min(selectionRange.end + charDelta, block.content.length));
        
        if (newEnd !== selectionRange.end) {
          updateSelectionRange({
            start: selectionRange.start, 
            end: newEnd
          });
        }
      }
    } catch (error) {
      console.error('Selection update error:', error);
    }
  };
  
  // 更新选择范围
  const updateSelectionRange = (newRange) => {
    try {
      if (!block.content) return;
      
      // 确保范围有效
      const validRange = {
        start: Math.max(0, Math.min(newRange.start, block.content.length)),
        end: Math.max(0, Math.min(newRange.end, block.content.length))
      };
      
      // 确保开始位置小于结束位置
      if (validRange.start >= validRange.end) {
        if (isDraggingStart) {
          validRange.start = validRange.end - 1;
        } else {
          validRange.end = validRange.start + 1;
        }
      }
      
      // 更新选中文本和范围
      const newText = block.content.substring(validRange.start, validRange.end);
      setSelectedText(newText);
      setSelectionRange(validRange);
      
      // 重新测量位置
      measureTextPosition(validRange);
      
      // 尝试更新文本输入组件的选择范围 (原生选择)
      if (textInputRef.current) {
        textInputRef.current.setNativeProps({
          selection: validRange
        });
      }
    } catch (error) {
      console.error('Range update error:', error);
    }
  };
  
  // 手柄拖动结束
  const handleDragEnd = () => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setIsDragging(false);
  };
  
  // 隐藏选择菜单
  const hideSelectionMenu = () => {
    setSelectionVisible(false);
    setSelectedText('');
    setIsDragging(false);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  };
  
  // 复制选中的文本
  const copySelectedText = () => {
    if (selectedText) {
      Clipboard.setString(selectedText);
      hideSelectionMenu();
    }
  };
  
  // 对选中文本添加笔记
  const addNoteToSelection = () => {
    if (selectedText && typeof onAddNote === 'function') {
      // 调用父组件传入的添加笔记函数
      onAddNote(selectedText, block.id, selectionRange);
      hideSelectionMenu();
    }
  };
  
  // 高亮文本渲染器
  const renderHighlightedContent = () => {
    // 如果是笔记块自己，不需要高亮
    if (block.type !== 'transcription' || !block.content) {
      return <Text style={styles.transcriptionContent}>{block.content}</Text>;
    }
    
    // 处理高亮逻辑 - 查找被引用的文本并高亮显示
    // 先检查当前块是否有引用自身的笔记
    const notesReferencingThisBlock = relatedNotes.filter(note => 
      note.referencedBlockId === block.id && note.referencedText
    );
    
    // 如果没有引用，使用增强的文本选择组件
    if (notesReferencingThisBlock.length === 0) {
      return (
        <View style={styles.textContainer}>
          <TextInput
            ref={textInputRef}
            style={styles.transcriptionContent}
            value={block.content}
            multiline
            editable={false}
            contextMenuHidden={true}
            onSelectionChange={handleSelectionChange}
            selectionColor={'rgba(100, 200, 255, 0.5)'} // 调整选择高亮颜色，让它在黑底上更可见
          />
          
          {/* 添加全局触摸移动事件捕获层 */}
          {isDragging && (
            <TouchableWithoutFeedback
              onTouchMove={handleTouchMove}
              onTouchEnd={handleDragEnd}
            >
              <View style={styles.touchCaptureLayer} />
            </TouchableWithoutFeedback>
          )}
        </View>
      );
    }
    
    // 创建一个视图，使用Text组件渲染高亮部分和普通部分
    return (
      <View>
        <Text style={styles.transcriptionContent}>
          {block.content.split('').map((char, index) => {
            // 检查此字符是否属于任何引用文本
            const isHighlighted = notesReferencingThisBlock.some(note => {
              const referenceText = note.referencedText;
              if (!referenceText) return false;
              
              // 查找引用文本的所有出现位置，而不仅仅是第一次出现
              let position = -1;
              let tempIndex = -1;
              
              // 循环查找所有可能的位置
              do {
                tempIndex = block.content.indexOf(referenceText, tempIndex + 1);
                if (tempIndex !== -1 && index >= tempIndex && index < tempIndex + referenceText.length) {
                  position = tempIndex;
                  break;
                }
              } while (tempIndex !== -1);
              
              // 如果找到包含当前字符的引用文本位置，则高亮
              return position !== -1;
            });
            
            // 根据是否需要高亮返回不同样式
            return (
              <Text 
                key={index} 
                style={isHighlighted ? styles.highlightedText : null}
                onPress={() => {
                  if (isHighlighted) {
                    // 找到与高亮文本相关的笔记
                    const relatedNote = notesReferencingThisBlock.find(note => {
                      const referenceText = note.referencedText;
                      if (!referenceText) return false;
                      
                      // 同样需要查找所有出现位置
                      let position = -1;
                      let tempIndex = -1;
                      
                      do {
                        tempIndex = block.content.indexOf(referenceText, tempIndex + 1);
                        if (tempIndex !== -1 && index >= tempIndex && index < tempIndex + referenceText.length) {
                          position = tempIndex;
                          break;
                        }
                      } while (tempIndex !== -1);
                      
                      return position !== -1;
                    });
                    
                    // 如果找到相关笔记，可以在这里添加点击高亮文本时的操作
                    // 例如：滚动到相关笔记位置
                  }
                }}
              >
                {char}
              </Text>
            );
          })}
        </Text>
        
        {/* 在下方添加一个不可见但可选择的文本输入组件，用于处理文本选择 */}
        <TextInput
          ref={textInputRef}
          style={[styles.transcriptionContent, styles.hiddenInput]}
          value={block.content}
          multiline
          editable={false}
          contextMenuHidden={true}
          onSelectionChange={handleSelectionChange}
          selectionColor={'rgba(100, 200, 255, 0.5)'} // 调整选择高亮颜色，让它在黑底上更可见
        />
      </View>
    );
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
    // 为笔记块添加高亮的引用文本显示
    const hasReference = block.referencedText && block.referencedText.length > 0;
    
    return (
      <View style={[
        styles.noteContainer,
        active && styles.activeNoteBlock
      ]}>
        <View style={styles.noteContentWrapper}>
          {/* 垂直三点菜单按钮 - 移到最顶部定义 */}
          <TouchableOpacity 
            ref={menuButtonRef}
            style={styles.menuButton}
            onPress={showMenu}
          >
            <Ionicons name="ellipsis-vertical" size={16} color="#666" />
          </TouchableOpacity>
          
          {/* 显示引用的文本 */}
          {hasReference && (
            <View style={styles.referencedTextContainer}>
              <Text style={styles.referencedText}>"{block.referencedText}"</Text>
            </View>
          )}
          
          {/* 笔记内容 - 不显示"笔记"标签 */}
          <Text style={styles.noteContent}>{block.content}</Text>
          
          {/* 操作菜单 */}
          {menuVisible && (
            <Modal
              transparent
              visible={menuVisible}
              animationType="fade"
              onRequestClose={() => setMenuVisible(false)}
            >
              <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                <View style={styles.modalOverlay}>
                  <View 
                    style={[
                      styles.actionMenu,
                      {
                        left: menuPosition.x - 110, // 调整菜单位置，向左偏移确保在按钮附近
                        top: menuPosition.y + 10,  // 调整菜单位置，在按钮正下方
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.actionOption}
                      onPress={() => {
                        setMenuVisible(false);
                        setIsEditing(true);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#666" />
                      <Text style={styles.actionOptionText}>编辑</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.actionDivider} />
                    
                    <TouchableOpacity 
                      style={styles.actionOption}
                      onPress={() => {
                        setMenuVisible(false);
                        onDelete(block.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF453A" />
                      <Text style={[styles.actionOptionText, {color: '#FF453A'}]}>删除</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.actionDivider} />
                    
                    <TouchableOpacity 
                      style={styles.actionOption}
                      onPress={() => {
                        setMenuVisible(false);
                        onAddEmptyNote && onAddEmptyNote(block.id);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#4CAF50" />
                      <Text style={[styles.actionOptionText, {color: '#4CAF50'}]}>添加笔记</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
          
          {isEditing && (
            <View style={styles.editingContainer}>
              <TextInput
                multiline
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                placeholder="添加笔记..."
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
        {/* 垂直三点菜单按钮 - 移到最右侧 */}
        <TouchableOpacity 
          ref={menuButtonRef}
          style={[styles.menuButton, styles.transcriptionMenuButton]}
          onPress={showMenu}
        >
          <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
        </TouchableOpacity>
        
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
        
        {/* 操作菜单 - 转录块 */}
        {menuVisible && (
          <Modal
            transparent
            visible={menuVisible}
            animationType="fade"
            onRequestClose={() => setMenuVisible(false)}
          >
            <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
              <View style={styles.modalOverlay}>
                <View 
                  style={[
                    styles.actionMenu,
                    {
                      left: menuPosition.x - 110, // 调整菜单位置，向左偏移确保在按钮附近
                      top: menuPosition.y + 10,  // 调整菜单位置，在按钮正下方
                    }
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.actionOption}
                    onPress={() => {
                      setMenuVisible(false);
                      setIsEditing(true);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#666" />
                    <Text style={styles.actionOptionText}>编辑</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.actionDivider} />
                  
                  <TouchableOpacity 
                    style={styles.actionOption}
                    onPress={() => {
                      setMenuVisible(false);
                      onDelete(block.id);
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF453A" />
                    <Text style={[styles.actionOptionText, {color: '#FF453A'}]}>删除</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.actionDivider} />
                  
                  <TouchableOpacity 
                    style={styles.actionOption}
                    onPress={() => {
                      setMenuVisible(false);
                      onAddEmptyNote && onAddEmptyNote(block.id);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#4CAF50" />
                    <Text style={[styles.actionOptionText, {color: '#4CAF50'}]}>添加笔记</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}
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
        <View ref={textContainerRef} style={styles.contentContainer}>
          {/* 可选择的转录内容 - 使用高亮渲染器 */}
          {renderHighlightedContent()}
          
          {/* 选择工具栏和手柄 */}
          {selectionVisible && selectedText.length > 0 && (
            <View style={styles.selectionHandlesContainer}>
              {/* 选择工具栏 - 使用固定位置显示 */}
              <View 
                style={styles.selectionToolbar}
                pointerEvents="box-none"
              >
                <TouchableOpacity 
                  style={styles.toolbarButton}
                  onPress={copySelectedText}
                >
                  <Text style={styles.toolbarButtonText}>复制</Text>
                </TouchableOpacity>
                
                <View style={styles.toolbarDivider} />
                
                <TouchableOpacity 
                  style={styles.toolbarButton}
                  onPress={addNoteToSelection}
                >
                  <Text style={styles.toolbarButtonText}>添加笔记</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* 操作菜单 Modal - 保留原有的 */}
          {menuVisible && (
            <Modal
              transparent
              visible={menuVisible}
              animationType="fade"
              onRequestClose={() => setMenuVisible(false)}
            >
              <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                <View style={styles.modalOverlay}>
                  <View 
                    style={[
                      styles.actionMenu,
                      {
                        left: menuPosition.x - 110, // 调整菜单位置，向左偏移确保在按钮附近
                        top: menuPosition.y + 10,  // 调整菜单位置，在按钮正下方
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.actionOption}
                      onPress={() => {
                        setMenuVisible(false);
                        setIsEditing(true);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#666" />
                      <Text style={styles.actionOptionText}>编辑</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.actionDivider} />
                    
                    <TouchableOpacity 
                      style={styles.actionOption}
                      onPress={() => {
                        setMenuVisible(false);
                        onDelete(block.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF453A" />
                      <Text style={[styles.actionOptionText, {color: '#FF453A'}]}>删除</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.actionDivider} />
                    
                    <TouchableOpacity 
                      style={styles.actionOption}
                      onPress={() => {
                        setMenuVisible(false);
                        onAddEmptyNote && onAddEmptyNote(block.id);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#4CAF50" />
                      <Text style={[styles.actionOptionText, {color: '#4CAF50'}]}>添加笔记</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
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
    backgroundColor: 'transparent', // 改为透明背景，让整体屏幕背景透出
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#444', // 更深色的边框
    position: 'relative',
    paddingTop: 12,
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
    color: '#ffffff', // 保持白色文字
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#aaaaaa', // 更亮的灰色，在深色背景上更易读
  },
  transcriptionContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#ffffff', // 保持白色文字
    marginTop: 4,
    backgroundColor: 'transparent',
    padding: 0,
    textAlignVertical: 'top',
  },
  
  // 高亮文本样式 - 调整为在黑底上更易见的颜色
  highlightedText: {
    backgroundColor: 'rgba(255, 193, 7, 0.4)', // 更鲜亮的黄色，在黑底上更醒目
    borderRadius: 3,
    paddingHorizontal: 1,
    textDecorationLine: 'underline',
    textDecorationColor: '#FFC107', // 亮黄色下划线
    textDecorationStyle: 'solid',
    color: '#FFEB3B', // 明亮的黄色文本
    fontWeight: '500',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    height: '100%',
  },
  
  // 全新设计的笔记样式 - 更现代简洁的设计
  noteContainer: {
    marginVertical: 8,
    marginLeft: 24, // 保持缩进，区分于转录块
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderLeftWidth: 2, // 使用细边框
    borderLeftColor: '#90CAF9', // 使用绿色边框做区分
    backgroundColor: 'rgba(245, 245, 245, 0.1)', // 半透明背景
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1, // 轻微阴影
  },
  noteContentWrapper: {
    position: 'relative',
  },
  noteContent: {
    fontSize: 14.5,
    lineHeight: 20,
    fontStyle: 'normal',
    color: '#dddddd', // 浅色文字，在深色背景上更易读
    paddingRight: 30,
    marginBottom: 4,
  },
  referencedTextContainer: {
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // 半透明绿色背景
    borderLeftWidth: 2,
    borderLeftColor: '#4CAF50', // 绿色边框
    borderRadius: 4,
  },
  referencedText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#bbbbbb', // 浅色文字
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
  noteAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  addNoteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addNoteButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
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
  transcriptionAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    marginRight: 10,
  },
  menuButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 6,
    zIndex: 10,
    backgroundColor: 'rgba(70, 70, 70, 0.7)', // 深色半透明背景
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptionMenuButton: {
    top: 2,
    right: 0,
    backgroundColor: 'rgba(70, 70, 70, 0.7)', // 在黑底上使用更深的半透明背景
  },
  actionMenu: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 10,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 0,
  },
  
  // 添加自定义选择手柄样式
  selectionHandlesContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  selectionHandle: {
    position: 'absolute',
    width: 30,  // 增大触摸区域
    height: 30, // 增大触摸区域
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  handleKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0A84FF',
    borderWidth: 1,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  
  contentContainer: {
    position: 'relative',
    width: '100%',
  },
  
  textContainer: {
    position: 'relative',
  },
  
  touchCaptureLayer: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -100,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  
  // 改进的选择工具栏和手柄样式
  selectionToolbar: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // 半透明背景，减轻视觉压力
    borderRadius: 8, // 更小的圆角
    paddingVertical: 6, // 减小垂直内边距
    paddingHorizontal: 4, // 减小水平内边距
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, // 减小阴影偏移
    shadowOpacity: 0.3, // 降低阴影不透明度
    shadowRadius: 4, // 减小阴影半径
    elevation: 5, // 降低Android阴影高度
    zIndex: 1002,
    borderWidth: 0.5, // 更细的边框
    borderColor: 'rgba(255, 255, 255, 0.2)', // 更淡的边框
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 20, // 保持工具栏在底部的固定位置
    left: 50, // 增大左边距，使其更居中
    right: 50, // 增大右边距，使其更居中
  },
  
  toolbarButton: {
    paddingHorizontal: 12, // 减小按钮的水平内边距
    paddingVertical: 6, // 减小按钮的垂直内边距
    borderRadius: 4, // 更小的圆角
    minWidth: 60, // 减小最小宽度
    alignItems: 'center',
  },
  
  toolbarButtonText: {
    color: 'white',
    fontSize: 14, // 减小字体大小
    fontWeight: '500', // 减小字体粗细
    textAlign: 'center',
  },
  
  toolbarDivider: {
    width: 0.5, // 更细的分隔线
    height: '80%', // 不占满整个高度
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // 更淡的分隔线颜色
    marginVertical: 4, // 添加垂直边距
  },
  
  selectionHandleContainer: {
    position: 'absolute',
    width: 44,  // 大大增加触摸区域
    height: 44, // 大大增加触摸区域
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  
  selectionHandle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  handleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0A84FF',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
}); 