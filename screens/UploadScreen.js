import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  FlatList,
  ActivityIndicator 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function UploadScreen({ navigation }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
      }
    })();
  }, []);

  const pickImage = async () => {
    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        navigation.navigate('NewNote', { 
          photo: result.assets[0],
          type: 'upload'
        });
      }
    } catch (error) {
      alert('Error picking image');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#f4511e" />
      ) : (
        <TouchableOpacity 
          style={styles.uploadButton} 
          onPress={pickImage}
        >
          <Ionicons name="cloud-upload" size={48} color="#f4511e" />
          <Text style={styles.uploadText}>Select from Gallery</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#f4511e',
    borderStyle: 'dashed',
    borderRadius: 10,
    width: '100%',
    aspectRatio: 1,
  },
  uploadText: {
    marginTop: 10,
    fontSize: 18,
    color: '#f4511e',
  },
}); 