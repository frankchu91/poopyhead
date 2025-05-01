import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import useDocumentLogic from '../../core/useDocumentLogic';
import DocumentBlock from '../../components/document/DocumentBlock';
import SpeechToTextService from '../../services/SpeechToTextService';
import SummaryModal from '../../components/document/SummaryModal';

export default function DocumentScreen({ navigation, route }) {
  const {
    document,
    isRecording,
    recordingTime,
    transcriptionProgress,
    currentTranscriptionSession,
    setDocumentTitle,
    updateBlock,
    deleteBlock,
    handleTranscriptionUpdate,
    setCurrentTranscriptionSession,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    addNote,
    exportAsText,
    summaryData,
    isSummaryLoading,
    generateSummary,
    resetSummary,
    isPaused
  } = useDocumentLogic();
  
  // 本地状态
  const [noteText, setNoteText] = useState('');
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [newNoteId, setNewNoteId] = useState(null);
  const { documentId } = route.params || { documentId: 'test-doc-id' };
  const [showSummary, setShowSummary] = useState(false);
  
  // Refs
  const scrollViewRef = useRef(null);
  const speechToTextRef = useRef(null);
  
  // 添加键盘状态跟踪
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  // 监听键盘显示/隐藏事件
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    // 清理订阅
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // 添加收起键盘的方法
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };
  
  // 当newNoteId变化时，清除它
  useEffect(() => {
    if (newNoteId) {
      // 滚动到新创建的笔记块位置
      scrollToBlock(newNoteId);
      
      // 1秒后清除新笔记ID，以便自动聚焦只在创建时生效
      const timer = setTimeout(() => {
        setNewNoteId(null);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [newNoteId]);
  
  // 初始化语音服务
  useEffect(() => {
    speechToTextRef.current = new SpeechToTextService((text, progressInfo) => {
      handleTranscriptionUpdate(text, progressInfo);
    });
    
    return () => {
      if (speechToTextRef.current && speechToTextRef.current.isRecording) {
        speechToTextRef.current.stopRecording();
      }
    };
  }, []);
  
  // 滚动到指定块的位置
  const scrollToBlock = (blockId) => {
    if (!scrollViewRef.current) return;
    
    // 在下一帧执行滚动，确保DOM已更新
    setTimeout(() => {
      // 找到新创建笔记块的索引
      const blockIndex = document.blocks.findIndex(block => block.id === blockId);
      if (blockIndex === -1) return;
      
      // 计算大致的滚动位置 (每个块估计高度为120)
      const estimatedBlockHeight = 120;
      const scrollPosition = blockIndex * estimatedBlockHeight;
      
      // 执行滚动
      scrollViewRef.current.scrollTo({ y: scrollPosition, animated: true });
    }, 100);
  };
  
  // 获取给定块ID的所有关联笔记
  const getRelatedNotes = useCallback((blockId) => {
    if (!document || !document.blocks) return [];
    
    // 找出所有引用了该块的笔记
    return document.blocks.filter(block => 
      block.type === 'note' && 
      block.referencedBlockId === blockId
    );
  }, [document]);
  
  // 添加笔记到选择的文本
  const handleAddNoteToSelection = useCallback((selectedText, blockId, selectionRange) => {
    // 查找参考块
    const referenceBlock = document.blocks.find(block => block.id === blockId);
    if (!referenceBlock || referenceBlock.type !== 'transcription') return;
    
    // 计算参考块在数组中的位置
    const refIndex = document.blocks.findIndex(block => block.id === blockId);
    if (refIndex === -1) return;
    
    const { start, end } = selectionRange;
    
    // 创建新块数组
    let updatedBlocks = [...document.blocks];
    
    // 创建笔记块 - 添加关联的文本内容和引用信息
    const noteBlock = {
      id: Date.now().toString() + '_note',
      content: '',
      type: 'note',
      createdAt: new Date(),
      updatedAt: new Date(),
      referencedText: selectedText,           // 添加关联的文本
      referencedBlockId: referenceBlock.id    // 添加关联的块ID
    };
    
    // 在转录块后插入笔记
    updatedBlocks.splice(refIndex + 1, 0, noteBlock);
    
    // 更新文档
    document.blocks = updatedBlocks;
    
    // 设置新笔记ID以自动聚焦
    setNewNoteId(noteBlock.id);
    
    return noteBlock.id;
  }, [document, setNewNoteId]);
  
  // 处理添加空白笔记
  const handleAddEmptyNote = useCallback((blockId) => {
    // 查找目标块在数组中的位置
    const blockIndex = document.blocks.findIndex(block => block.id === blockId);
    if (blockIndex === -1) return;
    
    // 创建新块数组
    let updatedBlocks = [...document.blocks];
    
    // 创建空白笔记块
    const emptyNoteBlock = {
      id: Date.now().toString() + '_note',
      content: '',
      type: 'note',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // 在目标块后插入笔记
    updatedBlocks.splice(blockIndex + 1, 0, emptyNoteBlock);
    
    // 更新文档
    document.blocks = updatedBlocks;
    
    // 设置新笔记ID以自动聚焦
    setNewNoteId(emptyNoteBlock.id);
    
    return emptyNoteBlock.id;
  }, [document, setNewNoteId]);
  
  // 滚动到底部函数
  const scrollToBottom = (animated = true) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated });
    }
  };
  
  // 处理录音
  const toggleRecording = async () => {
    if (isProcessingRecording) return;
    
    try {
      if (isRecording) {
        // 结束录音 - 保存当前转录会话状态
        const activeBlockId = currentTranscriptionSession.blockId;
        console.log("停止录音，当前块ID:", activeBlockId);
        
        // 停止UI显示的录音状态，保持按钮立即恢复到麦克风图标
        stopRecording();
        
        // 后台继续处理转录，并更新到当前块
        speechToTextRef.current.stopRecording().catch(error => {
          console.error("转录错误:", error);
        });
      } else {
        // 开始录音
        console.log("开始录音...");
        
        // 重置转录状态
        if (speechToTextRef.current) {
          speechToTextRef.current.resetTranscription();
        }
        
        const recordingStarted = await startRecording();
        
        if (recordingStarted) {
          const success = await speechToTextRef.current.startRecording();
          if (!success) {
            // 如果录音启动失败，清理状态
            stopRecording();
            Alert.alert("录音失败", "无法启动录音，请检查麦克风权限");
          }
        } else {
          Alert.alert("录音失败", "无法启动录音，请检查麦克风权限");
        }
      }
    } catch (error) {
      console.error("录音操作错误:", error);
      stopRecording();
      Alert.alert("录音错误", "录音过程中发生错误");
    }
  };
  
  // 处理暂停/继续录音
  const togglePause = async () => {
    if (!isRecording || isProcessingRecording) return;
    
    try {
      if (isPaused) {
        // 恢复录音
        // 1. 先恢复UI计时器
        const timerResumed = resumeRecording();
        if (timerResumed) {
          // 2. 再恢复录音服务
          const success = await speechToTextRef.current.resumeRecording();
          if (!success) {
            // 如果恢复录音失败，也要停止计时器
            pauseRecording();
            console.error("恢复录音失败");
          }
        } else {
          console.error("恢复计时器失败");
        }
      } else {
        // 暂停录音
        // 1. 先暂停UI计时器
        const timerPaused = pauseRecording();
        if (timerPaused) {
          // 2. 再暂停录音服务
          const success = await speechToTextRef.current.pauseRecording();
          if (!success) {
            // 如果暂停录音失败，也要恢复计时器
            resumeRecording();
            console.error("暂停录音失败");
          }
        } else {
          console.error("暂停计时器失败");
        }
      }
    } catch (error) {
      console.error("暂停/恢复录音时出错:", error);
    }
  };
  
  // 处理发送笔记
  const handleSendNote = () => {
    if (!noteText.trim()) return;
    
    addNote(noteText);
    setNoteText('');
    
    // 重置语音转文字服务的状态，确保下次录音从空白开始
    if (speechToTextRef.current) {
      speechToTextRef.current.resetTranscription();
    }
    
    // 滚动到底部
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };
  
  // 处理删除块
  const handleDeleteBlock = (blockId) => {
    Alert.alert(
      "确认删除",
      "确定要删除这个内容块吗？",
      [
        { text: "取消", style: "cancel" },
        { 
          text: "删除", 
          style: "destructive",
          onPress: () => deleteBlock(blockId)
        }
      ]
    );
  };
  
  // 显示菜单
  const showMenu = () => {
    Alert.alert(
      "选项",
      "选择操作",
      [
        { 
          text: "生成AI总结", 
          onPress: handleShowSummary 
        },
        { 
          text: "导出文档", 
          onPress: () => {
            const text = exportAsText();
            Alert.alert("文档内容", text, [
              { text: "复制到剪贴板", onPress: async () => {
                await Clipboard.setStringAsync(text);
                Alert.alert("成功", "文档内容已复制到剪贴板");
              }},
              { text: "关闭", style: "cancel" }
            ]);
          } 
        },
        { text: "取消", style: "cancel" }
      ]
    );
  };
  
  // 显示AI总结
  const handleShowSummary = async () => {
    if (document.blocks.length === 0) {
      Alert.alert("无法生成总结", "文档中没有内容可供总结");
      return;
    }
    
    setShowSummary(true);
    
    if (!summaryData && !isSummaryLoading) {
      // 没有现有总结数据且没有正在加载，生成新的总结
      generateSummary();
    }
  };
  
  // 关闭总结弹窗
  const handleCloseSummary = () => {
    setShowSummary(false);
  };
  
  // 添加格式化时间的函数
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* 标题栏 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.titleInput}
          value={document.metadata.title}
          onChangeText={setDocumentTitle}
          placeholder="未命名转录"
          placeholderTextColor="#8E8E93"
        />
        
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.summaryButtonContainer}
            onPress={handleShowSummary}
          >
            <LinearGradient
              colors={['#0A7AFF', '#0A84FF', '#3A9BFF']}
              style={styles.summaryButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="flash-outline" size={14} color="#fff" style={styles.summaryButtonIcon} />
              <Text style={styles.summaryButtonText}>AI 摘要</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButtonWithLabel}
            onPress={() => {
              const text = exportAsText();
              Clipboard.setStringAsync(text);
              Alert.alert("已复制", "文档内容已复制到剪贴板");
            }}
          >
            <Ionicons name="share-outline" size={22} color="#0A84FF" />
            <Text style={styles.headerButtonLabel}>导出</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 使用KeyboardAvoidingView包裹整个内容区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* 文档内容 */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.documentContent}
          contentContainerStyle={styles.documentContentContainer}
        >
          {document.blocks.length === 0 ? (
            <View style={styles.emptyDocument}>
              <Text style={styles.emptyDocumentText}>
                {isRecording 
                  ? "正在录音和转录..." 
                  : "点击下方麦克风按钮开始转录"
                }
              </Text>
            </View>
          ) : (
            <>
              {document.blocks.map(block => (
                <DocumentBlock
                  key={block.id}
                  block={block}
                  onUpdate={updateBlock}
                  onDelete={handleDeleteBlock}
                  onAddNote={handleAddNoteToSelection}
                  onAddEmptyNote={handleAddEmptyNote}
                  active={currentTranscriptionSession.blockId === block.id}
                  autoFocus={block.id === newNoteId}
                  relatedNotes={getRelatedNotes(block.id)}
                />
              ))}
            </>
          )}
          
          {/* 底部间距，确保可以滚动到底部内容 */}
          <View style={{ height: 20 }} />
        </ScrollView>
        
        {/* 底部输入区域 */}
        <View style={styles.inputContainer}>
          {/* 键盘收起图标 - 只在键盘可见时显示 */}
          {isKeyboardVisible && (
            <TouchableOpacity 
              style={styles.keyboardDismissButton}
              onPress={dismissKeyboard}
            >
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          )}
          
          {/* 悬浮录音控制面板 */}
          {(isRecording || isProcessingRecording) && (
            <View style={styles.floatingRecordPanel}>
              <View style={styles.recordingStatusContainer}>
                <View style={[styles.recordingDot, isPaused && styles.recordingDotPaused]} />
                <Text style={styles.recordingStatusText}>
                  {formatTime(recordingTime)} {isPaused ? '已暂停' : '录音中'}
                </Text>
              </View>
              
              <View style={styles.recordingControls}>
                <TouchableOpacity
                  style={styles.recordingControlButton}
                  onPress={togglePause}
                  disabled={isProcessingRecording}
                >
                  {isPaused ? (
                    <Ionicons name="play" size={22} color="#fff" />
                  ) : (
                    <Ionicons name="pause" size={22} color="#fff" />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.recordingControlButton, styles.stopButton]}
                  onPress={toggleRecording}
                  disabled={isProcessingRecording}
                >
                  <Ionicons name="power" size={22} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.noteInput}
              placeholder="添加笔记..."
              placeholderTextColor="#8E8E93"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxHeight={100}
              onFocus={() => {
                // 当获得焦点时，滚动到内容底部
                setTimeout(() => scrollToBottom(false), 100);
              }}
            />
            
            <TouchableOpacity 
              style={styles.addNoteButton}
              onPress={handleSendNote}
              disabled={!noteText.trim()}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={noteText.trim() ? "#0A84FF" : "#666"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      
      {/* 录音浮动按钮 - 只在未录音状态显示 */}
      {!isRecording && !isProcessingRecording && (
        <TouchableOpacity 
          style={styles.floatingRecordButton}
          onPress={toggleRecording}
          activeOpacity={0.8}
        >
          <View style={styles.floatingRecordingContainer}>
            <Ionicons name="mic" size={32} color="#fff" />
            <Text style={styles.floatingRecordingLabel}>录音</Text>
          </View>
        </TouchableOpacity>
      )}
      
      {/* AI总结弹窗 */}
      <SummaryModal
        visible={showSummary}
        onClose={handleCloseSummary}
        summary={summaryData}
        isLoading={isSummaryLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
  },
  backButton: {
    padding: 4,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
    padding: 0,
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButtonWithLabel: {
    alignItems: 'center',
    marginLeft: 12,
  },
  headerButtonLabel: {
    fontSize: 11,
    marginTop: 2,
    color: '#0A84FF',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  documentContent: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  documentContentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyDocument: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyDocumentText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    marginLeft: 0,
    color: '#fff',
  },
  addNoteButton: {
    marginHorizontal: 8,
    padding: 8,
  },
  recordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  recordingActive: {
    backgroundColor: '#0A84FF',
    width: 'auto',
    paddingHorizontal: 12,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingTime: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  recordingProcessing: {
    backgroundColor: '#0A84FF',
  },
  
  // 新增: 浮动录音控制面板
  floatingRecordPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  recordingStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginRight: 8,
  },
  recordingDotPaused: {
    backgroundColor: '#9CA3AF',
  },
  recordingStatusText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'transparent',
  },
  stopButton: {
    backgroundColor: 'transparent',
  },
  
  // 修改: 浮动录音按钮样式
  floatingRecordButton: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 100,
  },
  floatingRecordingContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRecordingLabel: {
    color: '#fff',
    marginTop: 2,
    fontWeight: '600',
    fontSize: 14,
  },
  
  keyboardDismissButton: {
    position: 'absolute',
    top: -28,
    right: 18,
    width: 40,
    height: 28,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#3C3C3E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
    zIndex: 100,
  },
  summaryButtonContainer: {
    marginRight: 8,
    borderRadius: 20,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  summaryButtonIcon: {
    marginRight: 4,
  },
  summaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
}); 