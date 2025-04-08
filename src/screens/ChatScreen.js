import React from 'react';
import { View, Text, Platform } from 'react-native';
import { isWeb } from '../utils/platform';
import MobileChatScreen from './mobile/ChatScreen';
import WebChatScreen from './web/ChatScreen';

export default function ChatScreen(props) {
  // 添加多种调试输出
  console.log('Platform.OS:', Platform.OS);
  console.log('isWeb from utils:', isWeb);
  
  // 直接返回调试信息，确认组件正在渲染
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 24 }}>
        Platform: {Platform.OS}, isWeb: {String(isWeb)}
      </Text>
      {Platform.OS === 'web' ? (
        <WebChatScreen {...props} />
      ) : (
        <MobileChatScreen {...props} />
      )}
    </View>
  );
} 