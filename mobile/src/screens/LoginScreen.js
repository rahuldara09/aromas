import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../services/firebase';
import AnimatedLogo from '../components/AnimatedLogo';

export default function LoginScreen() {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Fallback to local machine if env is missing
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.3:3000';

  const sendOtp = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    
    // Safety timeout for network requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(`${API_BASE_URL}/api/vendor-auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid response from server. Make sure your server is running and accessible on this network.");
      }

      if (response.ok && data.success) {
        setStep('otp');
      } else {
        Alert.alert('Error', data.error || 'Failed to send OTP.');
      }
    } catch (error) {
      console.error(error);
      const msg = error.name === 'AbortError' 
        ? 'Connection timed out. Ensure your computer and phone are on the same Wi-Fi.'
        : `Could not connect to ${API_BASE_URL}. Check if your Next.js server is running ('npm run dev') and reachable.`;
      Alert.alert('Network Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vendor-auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        // Sign in to Firebase with the custom backend token
        await signInWithCustomToken(auth, data.token);
      } else {
        Alert.alert('Error', data.error || 'Invalid OTP.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <View style={styles.content}>
          <AnimatedLogo size={80} showText={true} />
          <View style={{ marginBottom: 40 }} />

          {step === 'email' ? (
            <View style={styles.form}>
              <Text style={styles.label}>Enter your email</Text>
              <TextInput
                style={styles.input}
                placeholder="vendor@aromadhaba.in"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
              <TouchableOpacity 
                style={[styles.button, (!email || loading) && styles.buttonDisabled]} 
                onPress={sendOtp}
                disabled={loading || !email}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Enter 6-digit OTP sent to</Text>
              <Text style={styles.highlightedEmail}>{email}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                editable={!loading}
                textAlign="center"
              />
              <TouchableOpacity 
                style={[styles.button, (!otp || loading) && styles.buttonDisabled]} 
                onPress={verifyOtp}
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify and Login</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => setStep('email')}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#fef2f2',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'center',
  },
  highlightedEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  buttonDisabled: {
    backgroundColor: '#fca5a5',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 16,
    padding: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});
