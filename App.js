import 'react-native-url-polyfill/auto';
import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Image, Alert, SafeAreaView } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player'; // مكتبة المشغل الجديدة
import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. إعدادات Supabase 
// ==========================================
const SUPABASE_URL = 'https://YOUR_PROJECT_URL.supabase.co'; // ضع رابطك هنا
const SUPABASE_KEY = 'YOUR_ANON_PUBLIC_KEY'; // ضع مفتاحك هنا

let supabase = null;

try {
  let cleanUrl = SUPABASE_URL.trim();
  let cleanKey = SUPABASE_KEY.trim();
  if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
  
  if (cleanUrl !== 'https://YOUR_PROJECT_URL.supabase.co' && cleanUrl !== 'https://') {
    supabase = createClient(cleanUrl, cleanKey);
  }
} catch (error) {
  console.log("تم تجاوز خطأ تهيئة Supabase:", error.message);
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login'); 
  const [credentials, setCredentials] = useState({ server: '', user: '', pass: '' });
  const [categories, setCategories] = useState([]);
  const [movies, setMovies] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  
  const [currentStreamId, setCurrentStreamId] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const lastSyncTime = useRef(0);

  // ==========================================
  // 2. تسجيل الدخول
  // ==========================================
  const handleLogin = async () => {
    let { server, user, pass } = credentials;
    server = server.trim().replace(/\/$/, "");

    if (!server || !user || !pass) {
      Alert.alert("تنبيه", "الرجاء تعبئة جميع الحقول");
      return;
    }

    try {
      const targetUrl = `${server}/player_api.php?username=${user}&password=${pass}`;
      const response = await fetch(targetUrl);
      const data = await response.json();

      if (data.user_info && data.user_info.auth === 1) {
        setCredentials({ server, user, pass });
        fetchCategories(server, user, pass);
      } else {
        Alert.alert("خطأ", "بيانات الدخول غير صحيحة");
      }
    } catch (error) {
      Alert.alert("خطأ اتصال", "تأكد من رابط السيرفر.");
    }
  };

  // ==========================================
  // 3. جلب الأقسام والأفلام
  // ==========================================
  const fetchCategories = async (server, user, pass) => {
    try {
      const targetUrl = `${server}/player_api.php?username=${user}&password=${pass}&action=get_vod_categories`;
      const response = await fetch(targetUrl);
      const data = await response.json();
      setCategories(data);
      setCurrentScreen('categories');
    } catch (error) {
      Alert.alert("خطأ", "فشل جلب الأقسام");
    }
  };

  const fetchMovies = async (categoryId, categoryName) => {
    try {
      const { server, user, pass } = credentials;
      const targetUrl = `${server}/player_api.php?username=${user}&password=${pass}&action=get_vod_streams&category_id=${categoryId}`;
      const response = await fetch(targetUrl);
      const data = await response.json();
      setMovies(data);
      setActiveCategory(categoryName);
      setCurrentScreen('movies');
    } catch (error) {
      Alert.alert("خطأ", "فشل جلب الأفلام");
    }
  };

  // ==========================================
  // 4. تشغيل الفيديو والمزامنة عبر محرك VLC
  // ==========================================
  const playMovie = async (streamId, containerExtension) => {
    const { server, user, pass } = credentials;
    const ext = containerExtension || 'mp4';
    const url = `${server}/movie/${user}/${pass}/${streamId}.${ext}`;
    
    setCurrentStreamId(streamId);
    setVideoUrl(url);
    setCurrentScreen('player');

    // ملاحظة: مع مكتبة VLC لا يمكننا تمرير نقطة التوقف قبل أن يبدأ الفيديو
    // في بيئة الإنتاج المتقدمة سنحتاج لبناء دالة SeekTo مخصصة، ولكن الآن سيبدأ من البداية وتعمل المزامنة للحفظ
  };

  const saveProgress = async (currentTimeMillis) => {
    if (!supabase || !currentTimeMillis) return; 
    
    const positionSeconds = Math.floor(currentTimeMillis / 1000);
    if (positionSeconds - lastSyncTime.current >= 10) {
      lastSyncTime.current = positionSeconds;
      try {
        await supabase.from('watch_progress').upsert({
          username: credentials.user,
          stream_id: currentStreamId,
          position_seconds: positionSeconds,
          updated_at: new Date().toISOString()
        }, { onConflict: 'username, stream_id' });
      } catch (e) {
        console.log("خطأ في حفظ التقدم");
      }
    }
  };

  // ==========================================
  // 5. واجهات المستخدم
  // ==========================================
  if (currentScreen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginBox}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <TextInput style={styles.input} placeholder="رابط السيرفر" placeholderTextColor="#888" autoCapitalize="none" value={credentials.server} onChangeText={(t) => setCredentials({...credentials, server: t})} />
          <TextInput style={styles.input} placeholder="اسم المستخدم" placeholderTextColor="#888" autoCapitalize="none" value={credentials.user} onChangeText={(t) => setCredentials({...credentials, user: t})} />
          <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor="#888" autoCapitalize="none" secureTextEntry value={credentials.pass} onChangeText={(t) => setCredentials({...credentials, pass: t})} />
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>دخول</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (currentScreen === 'categories') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>الأقسام</Text>
        <FlatList
          data={categories.slice(0, 50)}
          keyExtractor={(item) => item.category_id.toString()}
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => fetchMovies(item.category_id, item.category_name)}>
              <Text style={{ color: 'white', textAlign: 'center' }}>{item.category_name}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  if (currentScreen === 'movies') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.row}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentScreen('categories')}>
            <Text style={styles.buttonText}>رجوع</Text>
          </TouchableOpacity>
          <Text style={styles.header}>{activeCategory}</Text>
        </View>
        <FlatList
          data={movies.slice(0, 100)}
          keyExtractor={(item) => item.stream_id.toString()}
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => playMovie(item.stream_id, item.container_extension)}>
              <Image source={{ uri: item.stream_icon }} style={styles.image} resizeMode="cover" />
              <Text style={{ color: 'white', textAlign: 'center', marginTop: 5 }} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  if (currentScreen === 'player') {
    return (
      <View style={styles.playerContainer}>
        <TouchableOpacity style={styles.closePlayerBtn} onPress={() => {
            setCurrentScreen('movies');
        }}>
          <Text style={styles.buttonText}>إغلاق وإيقاف</Text>
        </TouchableOpacity>
        
        {/* مشغل VLC المدمج الذي يدعم كل الصيغ بما فيها MKV */}
        <VLCPlayer
          style={styles.video}
          source={{ uri: videoUrl }}
          autoplay={true}
          resizeMode="contain"
          onProgress={(event) => saveProgress(event.currentTime)}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 10 },
  loginBox: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { color: 'white', fontSize: 24, textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: '#2c2c2c', color: 'white', padding: 15, borderRadius: 8, marginBottom: 15, textAlign: 'right' },
  button: { backgroundColor: '#e50914', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold' },
  header: { color: 'white', fontSize: 20, marginVertical: 15, textAlign: 'center', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { backgroundColor: '#333', padding: 10, borderRadius: 5 },
  card: { flex: 1, backgroundColor: '#1e1e1e', margin: 5, padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  image: { width: 100, height: 150, borderRadius: 5 },
  playerContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  closePlayerBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,0,0,0.7)', padding: 10, borderRadius: 5 }
});