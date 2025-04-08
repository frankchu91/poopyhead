import { Platform, Dimensions } from 'react-native';

// 添加调试输出
console.log('Platform.OS in platform.js:', Platform.OS);

/**
 * 检查当前平台是否是Web
 */
export const isWeb = Platform.OS === 'web';
console.log('isWeb value:', isWeb);

/**
 * 检查当前平台是否是移动设备
 */
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * 检查当前设备是否是平板
 */
export const isTablet = () => {
  const { width, height } = Dimensions.get('window');
  const aspectRatio = height / width;
  return (
    // iPad 和大多数平板的宽高比在 1.3-1.6 之间
    (Platform.OS === 'ios' && aspectRatio < 1.6) ||
    // Android 平板通常宽度大于 600dp
    (Platform.OS === 'android' && Math.max(width, height) >= 600)
  );
};

/**
 * 获取当前设备类型
 */
export const getDeviceType = () => {
  if (isWeb) {
    // 在Web上，根据窗口宽度判断设备类型
    const width = window.innerWidth;
    if (width < 768) {
      return 'mobile';
    } else if (width < 1024) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  } else if (isTablet()) {
    return 'tablet';
  } else {
    return 'mobile';
  }
};

/**
 * 根据平台返回不同的值
 */
export const selectPlatformValue = ({ web, ios, android, default: defaultValue }) => {
  if (Platform.OS === 'web' && web !== undefined) {
    return web;
  } else if (Platform.OS === 'ios' && ios !== undefined) {
    return ios;
  } else if (Platform.OS === 'android' && android !== undefined) {
    return android;
  }
  return defaultValue;
};

/**
 * 获取平台特定的样式
 */
export const getPlatformStyles = (styles) => {
  const platformKey = `${Platform.OS}Style`;
  return {
    ...styles.baseStyle,
    ...(styles[platformKey] || {})
  };
}; 