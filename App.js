import { useRef, useState } from 'react';
import { Dimensions, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // مكتبة الأيقونات المثبتة لديك
import { VLCPlayer } from 'react-native-vlc-media-player';
import { WebView } from 'react-native-webview';

// رابط موقعك الذي سيتم عرضه داخل التطبيق (عدله برابط موقعك الحقيقي)
const WEBSITE_URL = 'https://amjadalhajy2.github.io/tv/';

export default function App() {
  const webViewRef = useRef(null);
  
  // حالة التحكم بالتشغيل والمعلومات القادمة من الويب
  const [activeVideo, setActiveVideo] = useState({
    isPlaying: false,
    url: '',
    resumeTime: 0,
  });

  // 1. دالة لاستقبال الأوامر من صفحة الويب
  const handleMessageFromWeb = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'PLAY_MOVIE') {
        // تفعيل المشغل وتمرير الرابط ووقت البدء
        setActiveVideo({
          isPlaying: true,
          url: data.url,
          resumeTime: data.resumeTime || 0,
        });
      }
    } catch (error) {
      console.error("خطأ في قراءة الرسالة من الويب:", error);
    }
  };

  // 2. دالة لإرسال وقت المشاهدة الحالي إلى صفحة الويب للمزامنة
  const handleVideoProgress = (event) => {
    // جلب الوقت الحالي بالثواني (مكتبة VLC تعيد الوقت بالملي ثانية أحياناً، يجب التأكد من القسمة على 1000 إذا لزم الأمر)
    const currentTimeInSeconds = Math.floor(event.currentTime / 1000);
    
    // حقن كود جافاسكريبت داخل الويب لتشغيل دالة الحفظ
    const jsCode = `
      if (window.updateWatchProgress) {
        window.updateWatchProgress(${currentTimeInSeconds});
      }
      true;
    `;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  // 3. إغلاق الفيديو والعودة للموقع
  const closeVideo = () => {
    setActiveVideo({ isPlaying: false, url: '', resumeTime: 0 });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {activeVideo.isPlaying ? (
        // --- واجهة مشغل الفيديو (VLC) ---
        <View style={styles.playerContainer}>
          <VLCPlayer
            style={styles.video}
            videoAspectRatio="16:9"
            source={{ uri: activeVideo.url }}
            seek={activeVideo.resumeTime} // بدء التشغيل من نقطة التوقف
            onProgress={handleVideoProgress} // تحديث الوقت باستمرار
            progressUpdateInterval={5000} // تحديث كل 5 ثوانٍ لتقليل الضغط
          />
          
          {/* زر الإغلاق العائم فوق الفيديو */}
          <TouchableOpacity style={styles.closeButton} onPress={closeVideo}>
            <Icon name="close-circle" size={32} color="#FFF" />
            <Text style={styles.closeText}>عودة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // --- واجهة الموقع الإلكتروني (WebView) ---
        <WebView
          ref={webViewRef}
          source={{ uri: WEBSITE_URL }}
          onMessage={handleMessageFromWeb} // التنصت على رسائل الموقع
          style={styles.webview}
          allowsInlineMediaPlayback={true}
          bounces={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: height,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 20,
  },
  closeText: {
    color: '#FFF',
    marginLeft: 5,
    fontWeight: 'bold',
  },
});