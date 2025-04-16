import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

const RecordingProgressBar = ({ 
  isRecording, 
  duration, 
  transcriptionProgress = 0,
  transcribedSeconds = 0,
  totalSeconds = 0 
}) => {
  const [time, setTime] = useState(0);
  const waveAnim = useRef(new Animated.Value(0)).current;
  
  // 波形动画
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: false,
          })
        ])
      ).start();
      
      // 计时器
      const timer = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
      
      return () => {
        clearInterval(timer);
        waveAnim.stopAnimation();
      };
    } else {
      setTime(0);
    }
  }, [isRecording]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // 计算转录进度宽度
  const transcriptionWidth = `${transcriptionProgress * 100}%`;
  
  // 生成波形效果
  const renderWaveform = () => {
    const waveElements = [];
    for (let i = 0; i < 15; i++) {
      const randomHeight = 10 + Math.random() * 10;
      waveElements.push(
        <Animated.View 
          key={i}
          style={[
            styles.waveBar,
            {
              height: waveAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [randomHeight / 2, randomHeight]
              })
            }
          ]}
        />
      );
    }
    return waveElements;
  };
  
  // 增加显示已转录/总时长
  const progressText = totalSeconds > 0 
    ? `${Math.round(transcribedSeconds)}s / ${Math.round(totalSeconds)}s` 
    : formatTime(time);
  
  return (
    <View style={styles.container}>
      <View style={[styles.progressBar, { backgroundColor: '#ff3333' }]}>
        {/* 波形区域 */}
        <View style={styles.waveContainer}>
          {renderWaveform()}
        </View>
        
        {/* 转录进度指示器 */}
        <View style={[styles.transcriptionIndicator, { width: transcriptionWidth }]} />
        
        {/* 时间显示 - 改为显示转录进度 */}
        <Text style={styles.timeText}>{progressText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  waveContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: '100%',
  },
  waveBar: {
    width: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  transcriptionIndicator: {
    position: 'absolute',
    height: '100%',
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  timeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  }
});

export default RecordingProgressBar; 