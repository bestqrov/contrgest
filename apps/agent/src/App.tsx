import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { useAuthStore } from './store/auth.store';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { mdmService } from './services/mdm.service';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { isAuthenticated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
    mdmService.initialize().then(() => {
      if (isAuthenticated) mdmService.startCheckins();
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) mdmService.startCheckins();
    else mdmService.stopCheckins();
  }, [isAuthenticated]);

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'FieldOps Agent', headerLeft: () => null }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
