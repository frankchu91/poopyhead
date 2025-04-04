import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  Modal,
  Animated,
  SafeAreaView,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function HomeScreen({ navigation }) {
  const [isModalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const modalAnimation = useRef(new Animated.Value(0)).current;

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
      {/* 搜索栏 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="menu" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your notes"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity style={styles.avatarButton}>
          <Ionicons name="person-circle" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* 笔记列表 */}
      <FlatList
        style={styles.notesList}
        data={[]}
        renderItem={() => null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No notes yet</Text>
          </View>
        }
      />

      {/* 添加按钮 */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={showModal}
      >
        <Ionicons name="add" size={30} color={theme.colors.text} />
      </TouchableOpacity>

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
              <Ionicons name="camera" size={24} color={theme.colors.text} />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('Upload');
              }}
            >
              <Ionicons name="image" size={24} color={theme.colors.text} />
              <Text style={styles.modalOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('NewNote');
              }}
            >
              <Ionicons name="create" size={24} color={theme.colors.text} />
              <Text style={styles.modalOptionText}>Text Note</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                hideModal();
                navigation.navigate('VoiceNote');
              }}
            >
              <Ionicons name="mic" size={24} color={theme.colors.text} />
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
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuButton: {
    padding: theme.spacing.s,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    marginHorizontal: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: theme.spacing.m,
    marginLeft: theme.spacing.s,
  },
  avatarButton: {
    padding: theme.spacing.s,
  },
  notesList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.l,
    bottom: theme.spacing.l,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.l,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
  },
  modalOptionText: {
    color: theme.colors.text,
    fontSize: 16,
    marginLeft: theme.spacing.m,
  },
}); 