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

export default function HomeScreen({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const modalAnimation = useRef(new Animated.Value(0)).current;

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
    <SafeAreaView style={styles.container}>
      {/* 顶部标题和用户图标 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Loose Note</Text>
        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* 笔记列表 */}
      <FlatList
        style={styles.notesList}
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.noteItem}
            onPress={() => navigation.navigate('NewNote', { note: item, isEditing: true })}
          >
            <View style={styles.noteContent}>
              <Text style={styles.noteTitle} numberOfLines={1}>
                {item.title || 'Untitled Note'}
              </Text>
              <Text style={styles.noteDate}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No notes yet</Text>
          </View>
        }
      />

      {/* 底部导航栏 */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('home')}
        >
          <Ionicons 
            name={activeTab === 'home' ? "home" : "home-outline"} 
            size={24} 
            color={activeTab === 'home' ? "#007AFF" : "#fff"} 
          />
          <Text style={[
            styles.navText, 
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
            color={activeTab === 'search' ? "#007AFF" : "#fff"} 
          />
          <Text style={[
            styles.navText, 
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
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('Upload');
              }}
            >
              <Ionicons name="image" size={24} color="#fff" />
              <Text style={styles.modalOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('NewNote');
              }}
            >
              <Ionicons name="create" size={24} color="#fff" />
              <Text style={styles.modalOptionText}>Text Note</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('VoiceNote');
              }}
            >
              <Ionicons name="mic" size={24} color="#fff" />
              <Text style={styles.modalOptionText}>Voice Note</Text>
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
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
    borderBottomColor: '#2C2C2E',
  },
  noteContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitle: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  noteDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
    paddingBottom: 8,
    paddingTop: 8,
    height: 60,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  navText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
  },
  navTextActive: {
    color: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2C2C2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 16,
  },
}); 