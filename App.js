import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import NewNoteScreen from './screens/NewNoteScreen';
import VoiceNoteScreen from './screens/VoiceNoteScreen';
import UploadScreen from './screens/UploadScreen';
import ChatScreen from './screens/ChatScreen';

const Stack = createStackNavigator();

function App() {
  return (
    <View style={styles.container}>
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
              title: 'Take Photo',
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
            component={ChatScreen} 
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    height: '100vh',
    backgroundColor: '#1C1C1E',
    margin: '0 auto',
    position: 'relative',
    left: '50%',
    transform: 'translateX(-50%)',
  },
});

export default App; 