# Оставляем JS-интерфейсы WebView нетронутыми
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
