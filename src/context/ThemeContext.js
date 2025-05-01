import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 主题常量
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

// 创建上下文
const ThemeContext = createContext({
  theme: THEMES.LIGHT,
  toggleTheme: () => {},
  isDark: false,
  setTheme: () => {}
});

// 主题提供者组件
export const ThemeProvider = ({ children }) => {
  const deviceTheme = useDeviceColorScheme();
  const [theme, setTheme] = useState(THEMES.DARK); // 默认使用深色主题
  
  // 从存储加载主题偏好
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) {
          setTheme(savedTheme);
        } else if (deviceTheme) {
          // 如果没有保存的主题，使用设备主题
          setTheme(deviceTheme);
        }
      } catch (error) {
        console.log('Error loading theme preference', error);
      }
    };
    
    loadTheme();
  }, [deviceTheme]);
  
  // 保存主题偏好
  const saveTheme = async (newTheme) => {
    try {
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.log('Error saving theme preference', error);
    }
  };
  
  // 切换主题
  const toggleTheme = () => {
    const newTheme = theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    setTheme(newTheme);
    saveTheme(newTheme);
  };
  
  // 直接设置主题
  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    saveTheme(newTheme);
  };
  
  // 检查是否为深色主题
  const isDark = theme === THEMES.DARK;
  
  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme,
      isDark,
      setTheme: changeTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 使用主题的钩子
export const useTheme = () => useContext(ThemeContext); 