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
  
  // 添加音频回放相关状态
  const [recordingUri, setRecordingUri] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]); // 存储所有录音文件的URI
  const [currentAudioIndex, setCurrentAudioIndex] = useState(-1); // 当前播放的音频索引
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [totalPlaybackTime, setTotalPlaybackTime] = useState(0); // 总播放时长
  const [currentHighlightedBlockId, setCurrentHighlightedBlockId] = useState(null);
  
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
  const isPlayingRef = useRef(false);
  const playingNextRef = useRef(false);
  const currentAudioIndexRef = useRef(-1); // 新增: 使用ref追踪当前音频索引
  
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
      updatedAt: new Date(),
      // 为转录块添加说话者信息
      ...(type === 'transcription' ? { 
        speaker: 'A',
        speakerName: 'Speaker A'
      } : {})
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
          ? { 
              ...block, 
              content, 
              updatedAt: new Date(),
              // 如果是转录块且没有说话者信息，添加默认值
              ...(block.type === 'transcription' && !block.speaker ? {
                speaker: 'A',
                speakerName: 'Speaker A'
              } : {})
            } 
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
      
      // 查找当前块ID
      let targetBlockId = prev.blockId;
      
      // 如果没有当前块ID，则使用最后一个转录块或创建新块
      if (!targetBlockId) {
        const transcriptionBlocks = document.blocks.filter(block => block.type === 'transcription');
        const lastBlock = transcriptionBlocks[transcriptionBlocks.length - 1];
        
        if (lastBlock) {
          targetBlockId = lastBlock.id;
        } else {
          // 创建新块
          targetBlockId = addBlock(text.trim(), 'transcription');
        }
      }
      
      // 更新块内容
      updateBlock(targetBlockId, text.trim());
      
      // 返回更新后的会话状态
      return {
        ...prev,
        blockId: targetBlockId,
        text: text.trim(),
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
      
      // 确定是否需要创建新块
      // 1. 首次录音时创建新块
      // 2. 添加笔记后创建新块
      // 3. 避免在已经有转录块且正在转录的情况下创建新块
      if (shouldCreateNewBlock || document.blocks.length === 0) {
        // 创建一个全新的空白转录块
        initialBlockId = addBlock("正在倾听...", 'transcription');
        setShouldCreateNewBlock(false); // 重置标志
        console.log("创建新的转录块:", initialBlockId);
      } else {
        // 查找最后一个转录块
        const transcriptionBlocks = document.blocks.filter(block => block.type === 'transcription');
        const lastTranscriptionBlock = transcriptionBlocks[transcriptionBlocks.length - 1];
        
        if (lastTranscriptionBlock) {
          // 使用最后一个转录块
          initialBlockId = lastTranscriptionBlock.id;
          console.log("使用现有转录块:", initialBlockId);
          
          // 如果内容为空或仅为"正在倾听..."，则重置内容
          if (!lastTranscriptionBlock.content || lastTranscriptionBlock.content === "正在倾听...") {
            updateBlock(initialBlockId, "正在倾听...");
          }
        } else {
          // 没有找到转录块，创建新的
          initialBlockId = addBlock("正在倾听...", 'transcription');
          console.log("没有找到转录块，创建新的:", initialBlockId);
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
  const stopRecording = (audioResult = null) => {
    if (!isRecording) return;
    
    try {
      clearInterval(timerRef.current);
      
      // 检查当前转录块
      if (currentTranscriptionSession.blockId) {
        const currentBlock = document.blocks.find(
          block => block.id === currentTranscriptionSession.blockId
        );
        
        if (currentBlock && currentBlock.content === "正在倾听...") {
          // 如果内容还是初始值，删除这个块
          deleteBlock(currentTranscriptionSession.blockId);
          
          // 完全重置会话状态
          setCurrentTranscriptionSession({
            active: false,
            blockId: null,
            text: "",
            lastTimestamp: null
          });
        } else {
          // 保留当前块ID引用，但标记为非活跃
          // 这允许后续的转录内容继续更新到同一个块
          setCurrentTranscriptionSession(prev => ({
            ...prev,
            active: false,
            lastTimestamp: new Date()
          }));
          
          // 如果有录音结果，保存到文档中
          if (audioResult) {
            // 保存主文件URI
            setRecordingUri(audioResult.audioUri);
            
            // 如果有多个音频文件，保存它们以便播放
            if (audioResult.allAudioFiles && audioResult.allAudioFiles.length > 0) {
              setAudioFiles(audioResult.allAudioFiles);
              
              // 计算估计的总时长 (每个文件约3秒)
              const estimatedDuration = audioResult.allAudioFiles.length * 3;
              setTotalPlaybackTime(estimatedDuration);
              
              // 更新文档元数据
              setDocument(prev => ({
                ...prev,
                metadata: {
                  ...prev.metadata,
                  recordingUri: audioResult.audioUri,
                  audioFiles: audioResult.allAudioFiles,
                  duration: estimatedDuration,
                  lastModified: new Date()
                }
              }));
            } else {
              // 只有一个文件
              setAudioFiles([audioResult.audioUri]);
              
              // 更新文档元数据
              setDocument(prev => ({
                ...prev,
                metadata: {
                  ...prev.metadata,
                  recordingUri: audioResult.audioUri,
                  duration: 3, // 估计时长
                  lastModified: new Date()
                }
              }));
            }
          }
        }
      }
      
      setIsRecording(false);
      setRecordingTime(0);
      
      // 设置标志，指示下次录音时应该创建新的转录块
      setShouldCreateNewBlock(true);
      
      return true;
    } catch (err) {
      console.error('Failed to stop recording', err);
      return false;
    }
  };
  
  // 添加笔记
  const addNote = (text) => {
    if (!text && text !== '') return null;
    
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
  
  // 播放文档中的所有录音
  const playRecording = async () => {
    try {
      // 如果正在录音，不允许播放
      if (isRecording) {
        console.log("正在录音中，不能播放");
        return;
      }
      
      // 如果已经在播放，先停止当前播放
      if (isPlayingRef.current) {
        console.log("已经在播放，先停止当前播放");
        await stopPlayback();
        // 短暂延迟确保资源释放完毕
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log("检查可播放的音频");
      
      // 首先检查是否有保存在状态中的音频文件
      if (audioFiles && audioFiles.length > 0) {
        console.log(`发现 ${audioFiles.length} 个音频文件在状态中`);
        
        // 提取所有音频URI
        const audioUris = [...audioFiles]; // 复制数组，避免引用问题
        console.log(`准备播放音频，共 ${audioUris.length} 个片段，第一个: ${audioUris[0]}`);

        // 重置播放状态
        setIsPlaying(true);
        isPlayingRef.current = true;
        playingNextRef.current = false;
        setCurrentAudioIndex(0);
        currentAudioIndexRef.current = 0; // 同时更新ref值
        setCurrentPlaybackTime(0);
        
        // 高亮显示第一个相关的转录块
        updateHighlightedBlock(0);

        // 创建并播放第一个音频
        try {
          const sound = new Audio.Sound();
          console.log(`加载音频: ${audioUris[0]}`);
          await sound.loadAsync({ uri: audioUris[0] });
          sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
          soundRef.current = sound;
          
          // 短暂延迟确保UI更新
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 播放前再次检查状态，以防在加载过程中播放被取消
          if (!isPlayingRef.current) {
            await sound.unloadAsync();
            soundRef.current = null;
            return;
          }
          
          // 播放第一个音频
          console.log(`播放第一段音频 (1/${audioUris.length}): ${audioUris[0]}`);
          await sound.playAsync();
          return; // 成功开始播放，提前返回
        } catch (error) {
          console.error(`初始化音频播放失败: ${error.message}`);
          // 继续尝试其他方法
        }
      }
      
      // 如果没有在状态中找到或加载失败，尝试从文档元数据中获取
      if (document?.metadata?.audioFiles && document.metadata.audioFiles.length > 0) {
        console.log(`从文档元数据中发现 ${document.metadata.audioFiles.length} 个音频文件`);
        
        // 提取所有音频URI
        const audioUris = [...document.metadata.audioFiles];
        
        // 更新状态以保持一致
        setAudioFiles(audioUris);
        
        console.log(`准备播放元数据中的音频，共 ${audioUris.length} 个片段`);

        // 重置播放状态
        setIsPlaying(true);
        isPlayingRef.current = true;
        playingNextRef.current = false;
        setCurrentAudioIndex(0);
        currentAudioIndexRef.current = 0; // 同时更新ref值
        setCurrentPlaybackTime(0);
        
        // 高亮显示第一个相关的转录块
        updateHighlightedBlock(0);

        // 创建并播放第一个音频
        try {
          const sound = new Audio.Sound();
          await sound.loadAsync({ uri: audioUris[0] });
          sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
          soundRef.current = sound;
          
          // 短暂延迟确保UI更新
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 播放前再次检查状态，以防在加载过程中播放被取消
          if (!isPlayingRef.current) {
            await sound.unloadAsync();
            soundRef.current = null;
            return;
          }
          
          // 播放第一个音频
          console.log(`播放第一段元数据音频 (1/${audioUris.length}): ${audioUris[0]}`);
          await sound.playAsync();
          return; // 成功开始播放，提前返回
        } catch (error) {
          console.error(`初始化元数据音频播放失败: ${error.message}`);
          // 继续尝试最后一种方法
        }
      }
      
      // 最后尝试，检查是否有单个recordingUri
      if (recordingUri) {
        console.log(`尝试使用单个录音URI播放: ${recordingUri}`);
        
        // 重置播放状态
        setIsPlaying(true);
        isPlayingRef.current = true;
        playingNextRef.current = false;
        setCurrentAudioIndex(0);
        currentAudioIndexRef.current = 0; // 同时更新ref值
        setCurrentPlaybackTime(0);
        
        // 高亮显示第一个相关的转录块
        updateHighlightedBlock(0);

        // 创建并播放音频
        try {
          const sound = new Audio.Sound();
          await sound.loadAsync({ uri: recordingUri });
          sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
          soundRef.current = sound;
          
          // 短暂延迟确保UI更新
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 播放前再次检查状态，以防在加载过程中播放被取消
          if (!isPlayingRef.current) {
            await sound.unloadAsync();
            soundRef.current = null;
            return;
          }
          
          // 播放音频
          console.log(`播放单个录音URI: ${recordingUri}`);
          await sound.playAsync();
          return; // 成功开始播放，提前返回
        } catch (error) {
          console.error(`初始化单个录音播放失败: ${error.message}`);
        }
      }

      // 如果以上所有方法都失败了，才考虑从文档的块中查找
      console.log("查找带有音频的区块");
      const audioBlocks = document.blocks.filter(
        block => block.type === 'transcription' && 
        block.audioUri && 
        block.content && 
        block.content !== '正在倾听...'
      );

      if (audioBlocks && audioBlocks.length > 0) {
        // 提取所有音频URI
        const audioUris = audioBlocks.map(block => block.audioUri);
        console.log(`从区块中发现 ${audioUris.length} 个音频`);

        // 重置播放状态
        setIsPlaying(true);
        isPlayingRef.current = true;
        playingNextRef.current = false;
        setCurrentAudioIndex(0);
        currentAudioIndexRef.current = 0; // 同时更新ref值
        setCurrentPlaybackTime(0);
        
        // 高亮显示第一个音频对应的区块
        updateHighlightedBlock(0);

        // 创建并播放第一个音频
        try {
          const sound = new Audio.Sound();
          await sound.loadAsync({ uri: audioUris[0] });
          sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
          soundRef.current = sound;
          
          // 短暂延迟确保UI更新
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 播放前再次检查状态，以防在加载过程中播放被取消
          if (!isPlayingRef.current) {
            await sound.unloadAsync();
            soundRef.current = null;
            return;
          }
          
          // 播放第一个音频
          console.log(`播放第一段区块音频 (1/${audioUris.length}): ${audioUris[0]}`);
          await sound.playAsync();
        } catch (error) {
          console.error(`初始化区块音频播放失败: ${error.message}`);
          await stopPlayback();
        }
      } else {
        console.log("没有可播放的录音");
        await stopPlayback();
      }
    } catch (error) {
      console.error(`播放录音时出错: ${error.message}`);
      // 确保状态一致性
      await stopPlayback();
    }
  };
  
  // 暂停播放
  const pausePlayback = async () => {
    if (!soundRef.current || !isPlaying) return false;
    
    try {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return true;
    } catch (err) {
      console.error('Failed to pause playback', err);
      return false;
    }
  };
  
  // 停止播放
  const stopPlayback = async () => {
    try {
      console.log("停止播放所有录音");
      
      // 先重置播放状态标志，防止在清理过程中触发新的播放
      setIsPlaying(false);
      isPlayingRef.current = false;
      playingNextRef.current = false;
      
      // 清理当前声音实例
      if (soundRef.current) {
        try {
          // 必须先确认声音实例是否已就绪
          const status = await soundRef.current.getStatusAsync();
          
          // 如果声音已加载，则需要先停止并卸载
          if (status.isLoaded) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          }
        } catch (error) {
          console.warn("清理声音资源时出错:", error.message);
        } finally {
          // 无论出错与否，都清除引用
          soundRef.current = null;
        }
      }
      
      // 清除高亮显示
      setCurrentHighlightedBlockId(null);
      
      // 重置状态
      setCurrentAudioIndex(-1);
      currentAudioIndexRef.current = -1; // 重置ref值
      setCurrentPlaybackTime(0);
    } catch (error) {
      console.error("停止播放时出错:", error.message);
      // 确保状态被重置
      setIsPlaying(false);
      isPlayingRef.current = false;
      playingNextRef.current = false;
      soundRef.current = null;
      currentAudioIndexRef.current = -1; // 确保ref值被重置
    }
  };
  
  // 处理音频播放状态更新
  const onPlaybackStatusUpdate = async (status) => {
    try {
      // 只有当前正在播放并且有声音实例时才处理状态更新
      if (!isPlayingRef.current || !soundRef.current) {
        return;
      }

      // 确保音频已加载且状态有效
      if (!status.isLoaded) {
        console.log("音频未加载，状态更新被忽略");
        return;
      }

      // 更新当前播放进度 (仅在播放时)
      if (status.isPlaying) {
        setCurrentPlaybackTime(status.positionMillis);
      }

      // 当前音频播放结束 - 处理下一个音频
      if (status.didJustFinish && !playingNextRef.current) {
        // 设置锁，防止重复执行
        playingNextRef.current = true; 
        console.log(`当前音频播放结束，索引: ${currentAudioIndexRef.current}`);

        try {
          // 尝试使用已知的音频文件列表
          const audioUris = audioFiles && audioFiles.length > 0 
            ? audioFiles 
            : (document?.metadata?.audioFiles && document.metadata.audioFiles.length > 0 
              ? document.metadata.audioFiles 
              : null);
          
          if (!audioUris) {
            // 从区块中获取音频URI
            const audioBlocks = document.blocks.filter(
              block => block.type === 'transcription' && 
              block.audioUri && 
              block.content && 
              block.content !== '正在倾听...'
            );
            
            if (audioBlocks && audioBlocks.length > 0) {
              const blockAudioUris = audioBlocks.map(block => block.audioUri);
              const nextIndex = currentAudioIndexRef.current + 1; // 使用ref的值
              
              // 检查是否还有下一个音频
              if (nextIndex < blockAudioUris.length) {
                await playNextAudio(blockAudioUris, nextIndex);
              } else {
                // 所有音频已播放完成
                console.log("所有区块音频播放完成");
                await stopPlayback();
              }
            } else {
              console.log("无法找到可播放的区块音频");
              await stopPlayback();
            }
          } else {
            // 使用已知的音频文件列表
            const nextIndex = currentAudioIndexRef.current + 1; // 使用ref的值
            console.log(`检查下一个音频: 当前索引=${currentAudioIndexRef.current}, 下一个=${nextIndex}, 总数=${audioUris.length}`);
            
            // 检查是否还有下一个音频
            if (nextIndex < audioUris.length) {
              await playNextAudio(audioUris, nextIndex);
            } else {
              // 所有音频已播放完成
              console.log("所有音频播放完成");
              await stopPlayback();
            }
          }
        } catch (error) {
          console.error(`播放下一段音频时出错: ${error.message}`);
          await stopPlayback(); // 出错时停止所有播放
        } finally {
          // 确保锁在所有情况下都被释放
          playingNextRef.current = false;
        }
      }
    } catch (error) {
      console.error(`音频状态更新处理出错: ${error.message}`);
      playingNextRef.current = false;
      await stopPlayback(); // 出错时停止所有播放
    }
  };
  
  // 辅助函数：播放下一个音频
  const playNextAudio = async (audioUris, nextIndex) => {
    console.log(`准备播放下一段音频 (${nextIndex + 1}/${audioUris.length}): ${audioUris[nextIndex]}`);
    
    // 释放当前音频资源
    const currentSound = soundRef.current;
    soundRef.current = null;
    
    try {
      if (currentSound) {
        await currentSound.unloadAsync();
      }
    } catch (unloadError) {
      console.warn(`卸载当前音频时出错: ${unloadError.message}`);
    }
    
    // 检查播放状态是否仍然有效
    if (!isPlayingRef.current) {
      console.log("播放已停止，取消加载下一段音频");
      return;
    }
    
    // 创建新的音频实例
    const newSound = new Audio.Sound();
    await newSound.loadAsync({ uri: audioUris[nextIndex] });
    newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    soundRef.current = newSound;
    
    // 更新状态和UI
    setCurrentAudioIndex(nextIndex);
    currentAudioIndexRef.current = nextIndex; // 同时更新ref值
    setCurrentPlaybackTime(0);
    updateHighlightedBlock(nextIndex);
    
    // 短暂延迟确保UI更新
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 再次检查播放状态
    if (!isPlayingRef.current) {
      console.log("播放已停止，取消播放下一段音频");
      await newSound.unloadAsync();
      soundRef.current = null;
      return;
    }
    
    // 播放下一段音频
    console.log(`播放下一段音频 (${nextIndex + 1}/${audioUris.length}): ${audioUris[nextIndex]}`);
    await newSound.playAsync();
  };
  
  // 高亮当前播放的块
  const updateHighlightedBlock = (index) => {
    if (index < 0) {
      // 清除所有高亮
      setDocument(prev => ({
        ...prev,
        blocks: prev.blocks.map(block => ({ ...block, isHighlighted: false }))
      }));
      return;
    }
    
    // 找到对应索引的转录块
    const transcriptionBlocks = document.blocks.filter(
      block => block.type === 'transcription' && block.audioUri
    );
    
    if (index < transcriptionBlocks.length) {
      const highlightedBlockId = transcriptionBlocks[index].id;
      
      // 更新块的高亮状态
      setDocument(prev => ({
        ...prev,
        blocks: prev.blocks.map(block => ({
          ...block,
          isHighlighted: block.id === highlightedBlockId
        }))
      }));
    }
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
    recordingUri,
    audioFiles,
    currentAudioIndex,
    isPlaying,
    currentPlaybackTime,
    totalPlaybackTime,
    currentHighlightedBlockId,
    
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
    exportAsText,
    playRecording,
    pausePlayback,
    stopPlayback,
    onPlaybackStatusUpdate,
    updateHighlightedBlock
  };
} 