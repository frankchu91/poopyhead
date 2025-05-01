import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  Animated,
  SafeAreaView,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, THEMES } from '../src/context/ThemeContext';

export default function HomeScreen({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === THEMES.DARK;

  useEffect(() => {
    loadNotes();
    
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotes();
    });

    return unsubscribe;
  }, [navigation]);

  const loadNotes = async () => {
    try {
      const savedNotes = await AsyncStorage.getItem('notes');
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  // 动画显示模态框
  const showModal = () => {
    setModalVisible(true);
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // 动画隐藏模态框
  const hideModal = () => {
    Animated.spring(modalAnimation, {
      toValue: 0,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
      {/* 顶部标题和用户图标 */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>Loose Note</Text>
        <View style={styles.headerButtons}>
          {/* 添加主题切换按钮 */}
          <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
            <Ionicons 
              name={isDark ? "sunny" : "moon"} 
              size={24} 
              color={isDark ? "#FFF" : "#000"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons 
              name="person-circle" 
              size={28} 
              color={isDark ? "#fff" : "#000"} 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 笔记列表 */}
      <FlatList
        style={styles.notesList}
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.noteItem, { borderBottomColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
            onPress={() => navigation.navigate('NewNote', { note: item, isEditing: true })}
          >
            <View style={styles.noteContent}>
              <Text style={[styles.noteTitle, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
                {item.title || 'Untitled Note'}
              </Text>
              <Text style={[styles.noteDate, { color: isDark ? '#8E8E93' : '#8A8A8E' }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: isDark ? '#8E8E93' : '#8A8A8E' }]}>No notes yet</Text>
          </View>
        }
      />

      {/* 底部导航栏 */}
      <View style={[styles.bottomNav, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('home')}
        >
          <Ionicons 
            name={activeTab === 'home' ? "home" : "home-outline"} 
            size={24} 
            color={activeTab === 'home' ? "#007AFF" : (isDark ? "#fff" : "#000")} 
          />
          <Text style={[
            styles.navText, 
            { color: isDark ? '#fff' : '#000' },
            activeTab === 'home' && styles.navTextActive
          ]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('Document')}
        >
          <View style={styles.newButton}>
            <Ionicons name="document-text" size={24} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('search')}
        >
          <Ionicons 
            name={activeTab === 'search' ? "search" : "search-outline"} 
            size={24} 
            color={activeTab === 'search' ? "#007AFF" : (isDark ? "#fff" : "#000")} 
          />
          <Text style={[
            styles.navText, 
            { color: isDark ? '#fff' : '#000' },
            activeTab === 'search' && styles.navTextActive
          ]}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* 创建选项模态框 */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        onRequestClose={hideModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1} 
          onPress={hideModal}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                transform: [
                  {
                    translateY: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('Camera');
              }}
            >
              <Ionicons name="camera" size={24} color={isDark ? "#fff" : "#000"} />
              <Text style={[styles.modalOptionText, { color: isDark ? "#fff" : "#000" }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('Upload');
              }}
            >
              <Ionicons name="image" size={24} color={isDark ? "#fff" : "#000"} />
              <Text style={[styles.modalOptionText, { color: isDark ? "#fff" : "#000" }]}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('NewNote');
              }}
            >
              <Ionicons name="create" size={24} color={isDark ? "#fff" : "#000"} />
              <Text style={[styles.modalOptionText, { color: isDark ? "#fff" : "#000" }]}>Text Note</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('VoiceNote');
              }}
            >
              <Ionicons name="mic" size={24} color={isDark ? "#fff" : "#000"} />
              <Text style={[styles.modalOptionText, { color: isDark ? "#fff" : "#000" }]}>Voice Note</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeButton: {
    padding: 4,
    marginRight: 12,
  },
  profileButton: {
    padding: 4,
  },
  notesList: {
    flex: 1,
  },
  noteItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  noteContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  noteDate: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
  },
  navTextActive: {
    color: '#007AFF',
  },
  newButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    paddingTop: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 16,
  },
}); 