import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DocumentScreen from '../screens/mobile/DocumentScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Document" component={DocumentScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

export default AppNavigator; 