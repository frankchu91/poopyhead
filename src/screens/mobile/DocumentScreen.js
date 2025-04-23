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
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useDocumentLogic from '../../core/useDocumentLogic';
import DocumentBlock from '../../components/document/DocumentBlock';
import RecordingProgressBar from '../../components/RecordingProgressBar';
import SpeechToTextService from '../../services/SpeechToTextService';

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
    addNote,
    exportDocument,
    shareDocument,
    isLoading
  } = useDocumentLogic();
  
  // 本地状态
  const [noteText, setNoteText] = useState('');
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [newNoteId, setNewNoteId] = useState(null);
  const { documentId } = route.params || { documentId: 'test-doc-id' };
  
  // Refs
  const scrollViewRef = useRef(null);
  const speechToTextRef = useRef(null);
  
  // 添加键盘状态跟踪
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  // 监听键盘显示/隐藏事件
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
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
    
    setIsProcessingRecording(true);
    
    try {
      if (isRecording) {
        // 结束录音
        console.log("Stopping recording...");
        const text = await speechToTextRef.current.stopRecording();
        console.log("Got text:", text);
        
        stopRecording();
      } else {
        // 开始录音前先准备
        console.log("Starting recording...");
        
        // 获取是否需要创建新块的标志
        const shouldCreateNew = document.blocks.some(block => block.type === 'note');
        
        // 如果之前添加过笔记，确保SpeechToTextService的转录状态被重置
        if (shouldCreateNew && speechToTextRef.current) {
          speechToTextRef.current.resetTranscription();
          console.log("检测到之前有笔记，已重置转录状态");
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
    } finally {
      setIsProcessingRecording(false);
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
        { text: "导出文档", onPress: () => {} },
        { text: "分享", onPress: () => {} },
        { text: "取消", style: "cancel" }
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* 标题栏 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.titleInput}
          value={document.metadata.title}
          onChangeText={setDocumentTitle}
          placeholder="未命名转录"
        />
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={showMenu}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
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
        
        {/* 占位区域确保内容不被底部输入框遮挡 */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* 录音状态指示器 */}
      {isRecording && (
        <RecordingProgressBar 
          isRecording={isRecording}
          duration={recordingTime}
          transcriptionProgress={transcriptionProgress}
        />
      )}
      
      {/* 底部输入区域 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.inputContainer}
      >
        {/* 键盘收起图标 - 只在键盘可见时显示 */}
        {isKeyboardVisible && (
          <TouchableOpacity 
            style={styles.keyboardDismissButton}
            onPress={dismissKeyboard}
          >
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        )}
        
        <View style={styles.inputWrapper}>
          <TouchableOpacity 
            style={[
              styles.recordButton,
              isRecording && styles.recordingActive,
              isProcessingRecording && styles.recordingProcessing
            ]}
            onPress={toggleRecording}
            disabled={isProcessingRecording}
          >
            {isProcessingRecording ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons 
                name={isRecording ? "stop-circle" : "mic"} 
                size={24} 
                color={isRecording ? "#fff" : "#0A84FF"} 
              />
            )}
          </TouchableOpacity>
          
          <TextInput
            style={styles.noteInput}
            placeholder="添加笔记..."
            value={noteText}
            onChangeText={setNoteText}
            multiline
            maxHeight={100}
          />
          
          <TouchableOpacity 
            style={styles.addNoteButton}
            onPress={handleSendNote}
            disabled={!noteText.trim()}
          >
            <Ionicons 
              name="send" 
              size={24} 
              color={noteText.trim() ? "#0A84FF" : "#999"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  },
  menuButton: {
    padding: 4,
  },
  documentContent: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  documentContentContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyDocument: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyDocumentText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
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
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    marginLeft: 0,
  },
  addNoteButton: {
    marginHorizontal: 8,
    padding: 8,
  },
  recordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  recordingActive: {
    backgroundColor: '#FF453A',
  },
  recordingProcessing: {
    backgroundColor: '#0A84FF',
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
    zIndex: 100,
  },
}); 