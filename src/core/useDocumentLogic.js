import { useState, useRef, useEffect } from 'react';
import { Audio, RecordingOptionsPresets } from 'expo-av';
import { Vibration, Platform } from 'react-native';

export default function useDocumentLogic() {
  // 文档数据模型
  const [document, setDocument] = useState({
    blocks: [],
    metadata: {
      title: '未命名转录',
      createdAt: new Date(),
      lastModified: new Date(),
      recordingUri: null,
      duration: 0
    }
  });
  
  // 录音和转录状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribedDuration, setTranscribedDuration] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  
  // 当前转录会话
  const [currentTranscriptionSession, setCurrentTranscriptionSession] = useState({
    active: false,
    blockId: null,
    text: "",
    lastTimestamp: null
  });
  
  // 添加一个标志，表示是否需要创建新的转录块
  const [shouldCreateNewBlock, setShouldCreateNewBlock] = useState(false);
  
  // Refs
  const timerRef = useRef(null);
  const soundRef = useRef(null);
  
  // 清理函数
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);
  
  // 块操作方法
  const addBlock = (content, type = 'transcription') => {
    const newBlock = {
      id: Date.now().toString(),
      content,
      type, // 'transcription' 或 'note'
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setDocument(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
      metadata: {
        ...prev.metadata,
        lastModified: new Date()
      }
    }));
    
    return newBlock.id;
  };
  
  const updateBlock = (blockId, content) => {
    setDocument(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId 
          ? { ...block, content, updatedAt: new Date() } 
          : block
      ),
      metadata: {
        ...prev.metadata,
        lastModified: new Date()
      }
    }));
  };
  
  const deleteBlock = (blockId) => {
    setDocument(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId),
      metadata: {
        ...prev.metadata,
        lastModified: new Date()
      }
    }));
  };
  
  // 设置文档标题
  const setDocumentTitle = (title) => {
    setDocument(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        title,
        lastModified: new Date()
      }
    }));
  };
  
  // 转录处理逻辑
  const handleTranscriptionUpdate = (text, progressInfo) => {
    // 更新进度状态
    if (progressInfo) {
      setTranscribedDuration(progressInfo.transcribedDuration);
      setTotalDuration(progressInfo.totalDuration);
      setTranscriptionProgress(progressInfo.progress);
    }
    
    if (!text || !text.trim()) return;
    
    console.log("收到转录更新:", text);
    
    // 使用函数式更新，确保基于最新状态
    setCurrentTranscriptionSession(prev => {
      const timestamp = progressInfo?.timestamp || new Date();
      
      // 查找当前活跃的转录块
      let activeBlockId = prev.blockId;
      let existingContent = "";
      
      // 如果没有活跃的转录块，尝试找到最后一个转录块
      if (!activeBlockId) {
        const transcriptionBlocks = document.blocks.filter(block => block.type === 'transcription');
        const lastTranscriptionBlock = transcriptionBlocks[transcriptionBlocks.length - 1];
        
        if (lastTranscriptionBlock) {
          // 使用现有的最后一个转录块
          activeBlockId = lastTranscriptionBlock.id;
          existingContent = lastTranscriptionBlock.content;
          if (existingContent === "正在倾听...") {
            existingContent = "";
          }
        } else {
          // 没有找到转录块，创建一个新的
          activeBlockId = addBlock(text.trim(), 'transcription');
        }
      } else {
        // 获取当前块的内容
        const currentBlock = document.blocks.find(block => block.id === activeBlockId);
        if (currentBlock) {
          existingContent = currentBlock.content;
          if (existingContent === "正在倾听...") {
            existingContent = "";
          }
        }
      }
      
      // 构建更新后的文本 - 如果有已存在的内容则追加，否则使用新内容
      const updatedText = existingContent 
        ? `${existingContent} ${text.trim()}`
        : text.trim();
      
      // 更新块内容
      updateBlock(activeBlockId, updatedText);
      
      // 返回更新后的会话状态
      return {
        active: true,
        blockId: activeBlockId,
        text: updatedText,
        lastTimestamp: timestamp
      };
    });
  };
  
  // 开始录音
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('需要麦克风权限来录制语音消息');
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      let initialBlockId;
      
      // 检查是否应该创建新的转录块 - 如果添加过笔记或明确设置了标志
      if (shouldCreateNewBlock) {
        // 创建一个全新的空白转录块
        initialBlockId = addBlock("正在倾听...", 'transcription');
        setShouldCreateNewBlock(false); // 重置标志
      } else {
        // 查找最后一个转录块
        const transcriptionBlocks = document.blocks.filter(block => block.type === 'transcription');
        const lastTranscriptionBlock = transcriptionBlocks[transcriptionBlocks.length - 1];
        
        if (lastTranscriptionBlock) {
          // 使用现有的最后一个转录块继续转录
          initialBlockId = lastTranscriptionBlock.id;
          // 只有当它是空白或者是"正在倾听..."时才重置内容
          if (!lastTranscriptionBlock.content || lastTranscriptionBlock.content === "正在倾听...") {
            updateBlock(initialBlockId, "正在倾听...");
          }
        } else {
          // 如果没有转录块，创建一个新的
          initialBlockId = addBlock("正在倾听...", 'transcription');
        }
      }
      
      // 设置转录会话
      setCurrentTranscriptionSession({
        active: true,
        blockId: initialBlockId,
        text: document.blocks.find(block => block.id === initialBlockId)?.content || "正在倾听...",
        lastTimestamp: new Date()
      });
      
      setIsRecording(true);
      setRecordingTime(0);
      
      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 提供触觉反馈
      if (Platform.OS !== 'web') {
        Vibration.vibrate(50);
      }
      
      return true;
    } catch (err) {
      console.error('Failed to start recording', err);
      return false;
    }
  };
  
  // 结束录音
  const stopRecording = () => {
    if (!isRecording) return;
    
    try {
      clearInterval(timerRef.current);
      
      // 标记当前转录块为已完成
      if (currentTranscriptionSession.blockId) {
        const currentBlock = document.blocks.find(
          block => block.id === currentTranscriptionSession.blockId
        );
        
        if (currentBlock && currentBlock.content === "正在倾听...") {
          // 如果内容还是初始值，删除这个块
          deleteBlock(currentTranscriptionSession.blockId);
        }
      }
      
      // 重置会话状态
      setCurrentTranscriptionSession({
        active: false,
        blockId: null,
        text: "",
        lastTimestamp: null
      });
      
      setIsRecording(false);
      setRecordingTime(0);
      
      return true;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return false;
    }
  };
  
  // 添加笔记
  const addNote = (text) => {
    if (!text || !text.trim()) return null;
    
    const noteId = addBlock(text.trim(), 'note');
    
    // 清除当前转录会话，确保下次录音开始新的转录块
    setCurrentTranscriptionSession({
      active: false,
      blockId: null,
      text: "",
      lastTimestamp: null
    });
    
    // 设置标志，指示下次录音时应该创建新的转录块
    setShouldCreateNewBlock(true);
    
    return noteId;
  };
  
  // 导出为纯文本
  const exportAsText = () => {
    let text = `${document.metadata.title}\n`;
    text += `创建时间: ${document.metadata.createdAt.toLocaleString()}\n\n`;
    
    document.blocks.forEach(block => {
      if (block.type === 'transcription') {
        text += `[转录] ${block.content}\n\n`;
      } else if (block.type === 'note') {
        text += `[笔记] ${block.content}\n\n`;
      }
    });
    
    return text;
  };
  
  return {
    // 状态
    document,
    isRecording,
    recordingTime,
    transcribedDuration,
    totalDuration,
    transcriptionProgress,
    currentTranscriptionSession,
    
    // 方法
    setDocument,
    setDocumentTitle,
    addBlock,
    updateBlock,
    deleteBlock,
    handleTranscriptionUpdate,
    setCurrentTranscriptionSession,
    startRecording,
    stopRecording,
    addNote,
    exportAsText
  };
} 