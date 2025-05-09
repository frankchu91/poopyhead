import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View, Platform, TouchableOpacity, Text, Dimensions, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import NewNoteScreen from './screens/NewNoteScreen';
import VoiceNoteScreen from './screens/VoiceNoteScreen';
import UploadScreen from './screens/UploadScreen';
import MobileChatScreen from './src/screens/mobile/ChatScreen';
import WebChatScreen from './src/screens/web/ChatScreen';
import DocumentScreen from './src/screens/mobile/DocumentScreen';
import { ThemeProvider } from './src/context/ThemeContext';

const Stack = createStackNavigator();

function App() {
  // 设置状态栏为亮色内容(白色图标)
  StatusBar.setBarStyle('light-content', true);
  
  // 根据平台决定容器样式和聊天组件
  const containerStyle = Platform.OS === 'web' 
    ? styles.webContainer 
    : styles.mobileContainer;
  
  const ChatScreenComponent = Platform.OS === 'web'
    ? WebChatScreen
    : MobileChatScreen;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <View style={[styles.container, containerStyle]}>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
              <Stack.Screen 
                name="Home" 
                component={HomeScreen}
                options={{
                  headerShown: false
                }}
              />
              <Stack.Screen 
                name="Camera" 
                component={CameraScreen} 
                options={{
                  title: '拍照',
                  headerStyle: { backgroundColor: '#1C1C1E' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen 
                name="NewNote" 
                component={NewNoteScreen} 
                options={{
                  title: 'New Note',
                  headerStyle: { backgroundColor: '#1C1C1E' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen 
                name="VoiceNote" 
                component={VoiceNoteScreen} 
                options={{
                  title: 'Voice Note',
                  headerStyle: { backgroundColor: '#1C1C1E' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen 
                name="Upload" 
                component={UploadScreen} 
                options={{
                  title: 'Choose Photo',
                  headerStyle: { backgroundColor: '#1C1C1E' },
                  headerTintColor: '#fff',
                }}
              />
              <Stack.Screen 
                name="Chat" 
                component={ChatScreenComponent}
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen 
                name="Document" 
                component={DocumentScreen}
                options={{
                  headerShown: false,
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  mobileContainer: {
    // 移动端样式
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  webContainer: {
    // Web端样式 - 更宽的布局
    maxWidth: '100%',
    width: '100%',
    height: '100vh',
  },
});

export default App; 