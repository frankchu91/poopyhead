import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NewNoteScreen({ route, navigation }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState(route.params?.photo?.uri || null);
  const [isRecording, setIsRecording] = useState(false);

  // 保存笔记
  const saveNote = async () => {
    if (note.trim() === '') return;
    
    try {
      const newNote = {
        id: Date.now().toString(),
        title,
        note,
        image,
        date: new Date().toISOString(),
      };

      // 获取现有笔记
      const existingNotes = await AsyncStorage.getItem('notes');
      const notes = existingNotes ? JSON.parse(existingNotes) : [];
      
      // 添加新笔记
      notes.unshift(newNote);
      
      // 保存到 AsyncStorage
      await AsyncStorage.setItem('notes', JSON.stringify(notes));
      
      // 返回主页
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  };

  // 选择图片
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>新笔记</Text>
          
          <TouchableOpacity onPress={saveNote}>
            <Text style={styles.saveButton}>保存</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          {/* 标题输入 */}
          <TextInput
            style={styles.titleInput}
            placeholder="Note Title"
            value={title}
            onChangeText={setTitle}
          />

          {/* 图片显示区域 */}
          {image && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.image} />
              <TouchableOpacity 
                style={styles.removeImage}
                onPress={() => setImage(null)}
              >
                <Ionicons name="close-circle" size={24} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {/* 笔记输入 */}
          <TextInput
            style={styles.noteInput}
            placeholder="Write your note here..."
            value={note}
            onChangeText={setNote}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        {/* 底部工具栏 */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
            <Ionicons name="image" size={24} color="#f4511e" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1C1C1E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    color: '#0A84FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  imageContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 10,
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
  },
  noteInput: {
    fontSize: 16,
    minHeight: 200,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  toolbar: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  toolButton: {
    padding: 10,
    marginRight: 10,
  },
}); 