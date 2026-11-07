# Project specific ProGuard rules

# Capacitor & Native Plugins Keep Rules
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class com.flicks.hub.** { *; }
-keepclassmembers class com.flicks.hub.MainActivity$** {
    public *;
}
-keepclassmembers class com.flicks.hub.AndroidShareBridge {
    public *;
}
-keep class ee.forgr.capacitor.social.login.** { *; }

# WebView & Javascript Interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers and attributes
-keepattributes SourceFile,LineNumberTable,Signature,*Annotation*,InnerClasses,EnclosingMethod
