# Poopy Head Note

A mobile application that helps users capture images and add notes (text or audio) to them.

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