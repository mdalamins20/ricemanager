# React Native Implementation Guide

To implement the Android version of this app using React Native, follow these steps. You will reuse the exact same Firebase backend logic.

## 1. Setup

```bash
npx react-native init RiceManagerMobile
cd RiceManagerMobile
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-navigation/native @react-navigation/stack react-native-safe-area-context react-native-screens date-fns
```

## 2. Firebase Config

For React Native, do NOT use the web SDK (`firebase/app`). Instead, configure the native Android app in the Firebase Console:
1. Register app with package name (e.g., `com.ricemanager`).
2. Download `google-services.json`.
3. Place it in `android/app/`.
4. Import `@react-native-firebase/app` in your root `index.js`.

## 3. Code Adaptation

The logic is identical, but UI components change.

### Example: Auth Screen (React Native)

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  const handleLogin = async () => {
    try {
      await auth().signInWithEmailAndPassword(email, pass);
    } catch (e) {
      Alert.alert("Error", "Login Failed");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
      <TextInput placeholder="Password" value={pass} onChangeText={setPass} secureTextEntry style={styles.input} />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: { borderBottomWidth: 1, marginBottom: 20, padding: 10 }
});
```

### Example: Firestore List (React Native)

```tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import firestore from '@react-native-firebase/firestore';

export const MemberList = () => {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const subscriber = firestore()
      .collection('members')
      .onSnapshot(querySnapshot => {
        const users = [];
        querySnapshot.forEach(documentSnapshot => {
          users.push({
            ...documentSnapshot.data(),
            key: documentSnapshot.id,
          });
        });
        setMembers(users);
      });
    return () => subscriber();
  }, []);

  return (
    <FlatList
      data={members}
      renderItem={({ item }) => (
        <View style={{ padding: 10, borderBottomWidth: 1 }}>
          <Text>{item.fullName}</Text>
          <Text>{item.phone}</Text>
        </View>
      )}
    />
  );
}
```

## Summary
The Data Models (`types.ts`) and Business Logic (Daily calculation, Reports) remain exactly the same. Only the View layer changes from HTML/Tailwind to `View`/`Text`/`StyleSheet`.
