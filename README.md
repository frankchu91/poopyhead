# 多平台聊天应用

这是一个使用 React Native 和 Expo 构建的多平台聊天应用，支持移动端和 Web 端，并为每个平台提供了优化的 UI 和交互体验。

## 项目架构

项目采用了清晰的分层架构，将业务逻辑与 UI 表现分离：

## Features

- Image Capture & Upload
  - Take photos using camera
  - Upload existing images from device
  - Auto-crop and enhance images

- Note Taking
  - Record audio notes for each image
  - Add text descriptions or notes
  - Edit notes anytime

- Storage & Organization
  - Save all data locally
  - Organize notes by date
  - Easy search and retrieval

## Technical Requirements

- iOS 13.0+ / Android 8.0+
- Required Permissions:
  - Camera access
  - Microphone access
  - Storage access

## Tech Stack

- Frontend:
  - React Native
  - Expo (makes development easier)
  - React Native Camera for image capture
  - React Native Audio Recorder for voice notes
  - AsyncStorage for local data storage

- Backend (optional, if you need cloud storage):
  - Node.js
  - Express
  - MongoDB/PostgreSQL

## Usage

1. Capture/Upload
   - Tap "+" to take a new photo or upload existing one
   - Auto-crop and adjust image quality

2. Add Notes
   - Record audio note by tapping microphone icon
   - Or type text notes using keyboard
   - Save notes with the image

3. View & Manage
   - Browse all notes in chronological order
   - Play audio notes or read text notes
   - Edit or delete entries as needed