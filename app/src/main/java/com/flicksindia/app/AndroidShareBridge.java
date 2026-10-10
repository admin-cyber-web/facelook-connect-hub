package com.flicksindia.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native media sharing bridge for the hosted React app.
 *
 * The WebView cannot safely turn a remote URL into a content:// URI that
 * WhatsApp, Instagram, and other apps can read. This bridge downloads the
 * selected post media into the app cache, exposes it through FileProvider, and
 * sends the URI and caption in one ACTION_SEND intent.
 */
public final class AndroidShareBridge {
    private static final long MAX_MEDIA_BYTES = 100L * 1024L * 1024L;
    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public AndroidShareBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean shareMedia(final String caption, final String mediaUrl, final String mediaType) {
        if (TextUtils.isEmpty(mediaUrl)) {
            return false;
        }

        executor.execute(() -> downloadAndShare(
                caption == null ? "" : caption,
                mediaUrl,
                mediaType == null ? "" : mediaType,
                null
        ));
        return true;
    }

    @JavascriptInterface
    public boolean shareText(final String title, final String caption, final String url) {
        String body = caption == null ? "" : caption;
        if (!TextUtils.isEmpty(url) && !body.contains(url)) {
            body = body.isEmpty() ? url : body + "\n\n" + url;
        }
        final String finalBody = body;
        final String chooserTitle = TextUtils.isEmpty(title) ? "Share Flicks post" : title;
        activity.runOnUiThread(() -> {
            try {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("text/plain");
                sendIntent.putExtra(Intent.EXTRA_TEXT, finalBody);
                activity.startActivity(Intent.createChooser(sendIntent, chooserTitle));
            } catch (ActivityNotFoundException error) {
                showToast("No compatible sharing app is installed.");
            } catch (Exception error) {
                showToast("Couldn't open the share sheet. Please try again.");
            }
        });
        return true;
    }

    @JavascriptInterface
    public boolean shareToPlatform(
            final String platform,
            final String caption,
            final String mediaUrl,
            final String mediaType
    ) {
        final String targetPackage = packageForPlatform(platform);
        if (targetPackage == null) return false;

        if (TextUtils.isEmpty(mediaUrl)) {
            activity.runOnUiThread(() -> launchTextIntent(caption, targetPackage));
            return true;
        }

        executor.execute(() -> downloadAndShare(
                caption == null ? "" : caption,
                mediaUrl,
                mediaType == null ? "" : mediaType,
                targetPackage
        ));
        return true;
    }

    private String packageForPlatform(String platform) {
        if (platform == null) return null;
        switch (platform.toLowerCase()) {
            case "whatsapp": return "com.whatsapp";
            case "messenger": return "com.facebook.orca";
            case "facebook": return "com.facebook.katana";
            case "instagram": return "com.instagram.android";
            case "twitter": return "com.twitter.android";
            case "telegram": return "org.telegram.messenger";
            default: return null;
        }
    }

    private void launchTextIntent(String caption, String targetPackage) {
        try {
            if (activity.isFinishing() || activity.isDestroyed()) return;
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("text/plain");
            sendIntent.putExtra(Intent.EXTRA_TEXT, caption == null ? "" : caption);
            sendIntent.setPackage(targetPackage);
            activity.startActivity(sendIntent);
        } catch (ActivityNotFoundException error) {
            showToast("That app is not installed.");
        } catch (Exception error) {
            showToast("Couldn't open that app. Please try again.");
        }
    }

    private void downloadAndShare(String caption, String mediaUrl, String mediaType, String targetPackage) {
        HttpURLConnection connection = null;
        File mediaFile = null;
        try {
            URL url = new URL(mediaUrl);
            String scheme = url.getProtocol();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                throw new IOException("Unsupported media URL scheme");
            }

            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent", "FlicksIndia Android Share");

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                throw new IOException("Media download failed: HTTP " + responseCode);
            }
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_MEDIA_BYTES) {
                throw new IOException("Media file is too large to share");
            }

            String mimeType = resolveMimeType(connection.getContentType(), mediaUrl, mediaType);
            String extension = extensionFor(mimeType, mediaUrl);
            mediaFile = File.createTempFile("flicks-share-", extension, activity.getCacheDir());

            long bytesWritten = 0;
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(mediaFile)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    bytesWritten += count;
                    if (bytesWritten > MAX_MEDIA_BYTES) {
                        throw new IOException("Media file is too large to share");
                    }
                    output.write(buffer, 0, count);
                }
            }
            if (bytesWritten == 0) {
                throw new IOException("Media file was empty");
            }

            final File fileForShare = mediaFile;
            final String finalMimeType = mimeType;
            activity.runOnUiThread(() -> launchShareIntent(caption, fileForShare, finalMimeType, targetPackage));
            mediaFile = null;
        } catch (Exception error) {
            if (mediaFile != null) {
                //noinspection ResultOfMethodCallIgnored
                mediaFile.delete();
            }
            showToast("Couldn't share this media. Please try again.");
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void launchShareIntent(String caption, File mediaFile, String mimeType, String targetPackage) {
        try {
            if (activity.isFinishing() || activity.isDestroyed()) {
                return;
            }
            Uri contentUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    mediaFile
            );

            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType(mimeType);
            sendIntent.putExtra(Intent.EXTRA_TEXT, caption);
            sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            sendIntent.setClipData(ClipData.newRawUri("Flicks post media", contentUri));

            if (!TextUtils.isEmpty(targetPackage)) {
                sendIntent.setPackage(targetPackage);
                activity.startActivity(sendIntent);
                return;
            }

            activity.startActivity(Intent.createChooser(sendIntent, "Share Flicks post"));
        } catch (ActivityNotFoundException error) {
            showToast("No compatible sharing app is installed.");
        } catch (Exception error) {
            showToast("Couldn't open the share sheet. Please try again.");
        }
    }

    private String resolveMimeType(String contentType, String mediaUrl, String mediaType) {
        if (!TextUtils.isEmpty(contentType)) {
            String normalized = contentType.split(";")[0].trim().toLowerCase();
            if (normalized.startsWith("image/") || normalized.startsWith("video/")) {
                return normalized;
            }
        }

        if (mediaType.toLowerCase().startsWith("video")) {
            return "video/*";
        }

        String path = mediaUrl.toLowerCase().split("\\?")[0];
        if (path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".webm")
                || path.endsWith(".m4v") || path.endsWith(".avi")) {
            return "video/*";
        }
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".gif")) return "image/gif";
        return "image/jpeg";
    }

    private String extensionFor(String mimeType, String mediaUrl) {
        String path = mediaUrl.toLowerCase().split("\\?")[0];
        int dot = path.lastIndexOf('.');
        if (dot >= 0 && dot > path.lastIndexOf('/')) {
            String extension = path.substring(dot);
            if (extension.length() <= 8) return extension;
        }
        if (mimeType.startsWith("video/")) return ".mp4";
        if ("image/png".equals(mimeType)) return ".png";
        if ("image/webp".equals(mimeType)) return ".webp";
        if ("image/gif".equals(mimeType)) return ".gif";
        return ".jpg";
    }

    private void showToast(final String message) {
        activity.runOnUiThread(() ->
                Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
        );
    }

    public void shutdown() {
        executor.shutdownNow();
    }
}