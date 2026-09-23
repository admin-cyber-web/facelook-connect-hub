# JavaScript calls this bridge by its public method name at runtime.
-keepclassmembers class com.flicksindia.app.AndroidShareBridge {
    public <methods>;
}