import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator
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
    addNote
  } = useDocumentLogic();
  
  // 本地状态
  const [noteText, setNoteText] = useState('');
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  
  // Refs
  const scrollViewRef = useRef(null);
  const speechToTextRef = useRef(null);
  
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
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
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
                active={currentTranscriptionSession.blockId === block.id}
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <View style={styles.inputWrapper}>
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
  },
  documentContentContainer: {
    padding: 16,
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
  },
  recordingActive: {
    backgroundColor: '#FF453A',
  },
  recordingProcessing: {
    backgroundColor: '#0A84FF',
  },
}); 