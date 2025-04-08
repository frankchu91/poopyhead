import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useChatLogic from '../../core/useChatLogic';
import MessageBubble from '../../components/web/MessageBubble';

console.log('WebChatScreen is being imported');

export default function WebChatScreen({ navigation, route }) {
  console.log('WebChatScreen is rendering');
  
  // 使用共享逻辑
  const {
    messages,
    inputText,
    setInputText,
    sendTextMessage,
    // 其他逻辑...
  } = useChatLogic();

  // Web 特有的状态
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  
  // 添加窗口尺寸监听
  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(Dimensions.get('window'));
    }

    Dimensions.addEventListener('change', handleResize);
    return () => {
      // 清理监听器
      // 注意：在较新版本的React Native中，这个API可能有所不同
    };
  }, []);

  // 根据窗口宽度调整布局
  const isWideScreen = windowDimensions.width > 768;
  
  // 渲染消息列表
  const renderMessages = () => {
    return (
      <ScrollView style={styles.messagesContainer}>
        {messages.map(message => (
          <View key={message.id} style={styles.messageWrapper}>
            <MessageBubble 
              message={message}
              // 其他属性...
            />
          </View>
        ))}
      </ScrollView>
    );
  };
  
  // 渲染输入区域
  const renderInputArea = () => {
    return (
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={() => setShowAttachmentOptions(!showAttachmentOptions)}
        >
          <Ionicons name="add-circle-outline" size={24} color="#9E9E9E" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#9E9E9E"
          multiline
        />
        
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={sendTextMessage}
        >
          <Ionicons name="send" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    );
  };
  
  // 为宽屏模式渲染不同的布局
  if (isWideScreen) {
    return (
      <View style={[styles.container, isDarkMode ? styles.darkContainer : styles.lightContainer]}>
        {/* 宽屏布局 */}
        <View style={styles.wideScreenLayout}>
          {/* 侧边栏 */}
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Conversations</Text>
              <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)}>
                <Ionicons 
                  name={isDarkMode ? "sunny" : "moon"} 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
            
            {/* 会话列表 */}
            <View style={styles.conversationList}>
              <TouchableOpacity style={styles.conversationItem}>
                <View style={styles.conversationAvatar}>
                  <Ionicons name="person-circle" size={40} color="#4CAF50" />
                </View>
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationName}>Current Chat</Text>
                  <Text style={styles.conversationPreview}>Active now</Text>
                </View>
              </TouchableOpacity>
              
              {/* 可以添加更多会话项 */}
            </View>
          </View>
          
          {/* 主聊天区域 */}
          <View style={styles.mainChat}>
            {/* 顶部栏 */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Web Chat</Text>
              <View style={{width: 24}} /> {/* 占位 */}
            </View>
            
            {/* 消息区域 */}
            {renderMessages()}
            
            {/* 附件选项 */}
            {showAttachmentOptions && (
              <View style={styles.attachmentOptions}>
                <TouchableOpacity style={styles.attachmentOption}>
                  <Ionicons name="image" size={24} color="#fff" />
                  <Text style={styles.attachmentText}>Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachmentOption}>
                  <Ionicons name="mic" size={24} color="#fff" />
                  <Text style={styles.attachmentText}>Audio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachmentOption}>
                  <Ionicons name="document" size={24} color="#fff" />
                  <Text style={styles.attachmentText}>File</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* 输入区域 */}
            {renderInputArea()}
          </View>
        </View>
      </View>
    );
  }
  
  // 窄屏布局（原有布局）
  return (
    <View style={[
      styles.container,
      isDarkMode ? styles.darkContainer : styles.lightContainer
    ]}>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Web Chat</Text>
        <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)}>
          <Ionicons 
            name={isDarkMode ? "sunny" : "moon"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>
      
      {/* 消息区域 */}
      {renderMessages()}
      
      {/* 附件选项 */}
      {showAttachmentOptions && (
        <View style={styles.attachmentOptions}>
          <TouchableOpacity style={styles.attachmentOption}>
            <Ionicons name="image" size={24} color="#fff" />
            <Text style={styles.attachmentText}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption}>
            <Ionicons name="mic" size={24} color="#fff" />
            <Text style={styles.attachmentText}>Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption}>
            <Ionicons name="document" size={24} color="#fff" />
            <Text style={styles.attachmentText}>File</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* 输入区域 */}
      {renderInputArea()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  lightContainer: {
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1E1E1E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
    overflow: 'auto',
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '70%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    padding: 10,
    color: '#fff',
    marginHorizontal: 8,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  attachmentOptions: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 16,
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
  },
  attachmentText: {
    color: '#fff',
    marginTop: 4,
  },
  wideScreenLayout: {
    flex: 1,
    flexDirection: 'row',
    height: '100vh',
  },
  sidebar: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: '#333',
    backgroundColor: '#1A1A1A',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  conversationList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  conversationAvatar: {
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  conversationPreview: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
  },
  mainChat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
}); 