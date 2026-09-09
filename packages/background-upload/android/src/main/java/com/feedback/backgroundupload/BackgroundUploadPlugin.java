package com.feedback.backgroundupload;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.webkit.CookieManager;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * OS reachability via ConnectivityManager.NetworkCallback (no polling),
 * durable outbox files, and HTTP PUT of file ranges. Work continues on a
 * background executor; Android will keep the process alive while the
 * WebView is backgrounded until the OS kills it — URLSession-equivalent
 * persistence is the on-disk queue + file, resumed on next launch.
 */
@CapacitorPlugin(name = "BackgroundUpload")
public class BackgroundUploadPlugin extends Plugin {
    private static final String QUEUE_FILE = "upload-outbox-queue.json";
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean lastConnected = false;

    @Override
    public void load() {
        super.load();
        ConnectivityManager cm = connectivityManager();
        if (cm == null) return;
        NetworkRequest request = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                emitReachability(true);
            }

            @Override
            public void onLost(@NonNull Network network) {
                emitReachability(currentConnected());
            }

            @Override
            public void onCapabilitiesChanged(
                @NonNull Network network,
                @NonNull NetworkCapabilities caps
            ) {
                emitReachability(hasUsableInternet(caps));
            }
        };
        cm.registerNetworkCallback(request, networkCallback);
        lastConnected = currentConnected();
    }

    @Override
    public void handleOnDestroy() {
        ConnectivityManager cm = connectivityManager();
        if (cm != null && networkCallback != null) {
            try {
                cm.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
                /* already unregistered */
            }
        }
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getReachability(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", currentConnected());
        ret.put("expensive", currentExpensive());
        call.resolve(ret);
    }

    @PluginMethod
    public void persistQueue(PluginCall call) {
        String json = call.getString("jobsJson", "[]");
        try {
            File file = new File(outboxDir(), QUEUE_FILE);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(json.getBytes(StandardCharsets.UTF_8));
            }
            call.resolve();
        } catch (IOException e) {
            call.reject("Failed to persist upload queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void loadQueue(PluginCall call) {
        JSObject ret = new JSObject();
        File file = new File(outboxDir(), QUEUE_FILE);
        if (!file.exists()) {
            ret.put("jobsJson", "[]");
            call.resolve(ret);
            return;
        }
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] bytes = new byte[(int) file.length()];
            int read = in.read(bytes);
            String json = read > 0 ? new String(bytes, 0, read, StandardCharsets.UTF_8) : "[]";
            ret.put("jobsJson", json);
            call.resolve(ret);
        } catch (IOException e) {
            ret.put("jobsJson", "[]");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void persistVideoFile(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || jobId.isEmpty()) {
            call.reject("Missing jobId");
            return;
        }
        String sourcePath = call.getString("sourcePath");
        String fileName = call.getString("fileName", "clip.mp4");
        String ext = "mp4";
        int dot = fileName.lastIndexOf('.');
        if (dot >= 0 && dot < fileName.length() - 1) {
            ext = fileName.substring(dot + 1);
        }
        File dest = new File(outboxDir(), jobId + "." + ext);
        try {
            if (sourcePath != null && !sourcePath.trim().isEmpty()) {
                File source = new File(stripFileScheme(sourcePath));
                copyFile(source, dest);
            } else if (!dest.exists()) {
                call.reject("Missing sourcePath and no existing outbox file");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("path", dest.getAbsolutePath());
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("Failed to persist video file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void fileExists(PluginCall call) {
        String path = call.getString("path", "");
        JSObject ret = new JSObject();
        if (path == null || path.trim().isEmpty()) {
            ret.put("exists", false);
            ret.put("size", 0);
            call.resolve(ret);
            return;
        }
        File file = new File(stripFileScheme(path));
        boolean exists = file.isFile();
        ret.put("exists", exists);
        ret.put("size", exists ? file.length() : 0);
        call.resolve(ret);
    }

    @PluginMethod
    public void uploadPart(PluginCall call) {
        String jobId = call.getString("jobId");
        Integer partNumber = call.getInt("partNumber");
        String url = call.getString("url");
        String filePath = call.getString("filePath");
        Integer offset = call.getInt("offset");
        Integer length = call.getInt("length");
        String method = call.getString("httpMethod", "PUT");
        JSObject headers = call.getObject("headers");
        if (jobId == null || partNumber == null || url == null || filePath == null
            || offset == null || length == null || partNumber <= 0 || length <= 0) {
            call.reject("Missing uploadPart fields");
            return;
        }
        call.resolve(new JSObject().put("accepted", true));
        executor.execute(() -> putRange(jobId, partNumber, url, filePath, offset, length, method, headers));
    }

    private void putRange(
        String jobId,
        int partNumber,
        String url,
        String filePath,
        int offset,
        int length,
        String method,
        @Nullable JSObject headers
    ) {
        HttpURLConnection conn = null;
        try {
            File source = new File(stripFileScheme(filePath));
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod(method == null ? "PUT" : method.toUpperCase());
            conn.setDoOutput(true);
            conn.setFixedLengthStreamingMode(length);
            conn.setRequestProperty("Content-Type", "application/octet-stream");
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }
            if (headers != null) {
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = headers.get(key);
                    if (value != null) {
                        conn.setRequestProperty(key, String.valueOf(value));
                    }
                }
            }
            try (FileInputStream in = new FileInputStream(source);
                 OutputStream out = conn.getOutputStream()) {
                skipFully(in, offset);
                byte[] buf = new byte[64 * 1024];
                int remaining = length;
                while (remaining > 0) {
                    int n = in.read(buf, 0, Math.min(buf.length, remaining));
                    if (n < 0) break;
                    out.write(buf, 0, n);
                    remaining -= n;
                    JSObject progress = new JSObject();
                    progress.put("jobId", jobId);
                    progress.put("partNumber", partNumber);
                    progress.put("sentBytes", length - remaining);
                    progress.put("totalBytes", length);
                    notifyListeners("uploadProgress", progress);
                }
            }
            int status = conn.getResponseCode();
            JSObject event = new JSObject();
            event.put("jobId", jobId);
            event.put("partNumber", partNumber);
            event.put("status", status);
            if (status >= 400) {
                event.put("error", "Part " + partNumber + " upload failed: " + status);
                notifyListeners("uploadPartFailed", event);
            } else {
                notifyListeners("uploadPartComplete", event);
            }
        } catch (Exception e) {
            JSObject event = new JSObject();
            event.put("jobId", jobId);
            event.put("partNumber", partNumber);
            event.put("status", 0);
            event.put("error", e.getMessage() == null ? "Upload failed" : e.getMessage());
            notifyListeners("uploadPartFailed", event);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private File outboxDir() {
        File dir = new File(getContext().getFilesDir(), "upload-outbox");
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return dir;
    }

    @Nullable
    private ConnectivityManager connectivityManager() {
        Context ctx = getContext();
        if (ctx == null) return null;
        return (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
    }

    private boolean currentConnected() {
        ConnectivityManager cm = connectivityManager();
        if (cm == null) return true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return hasUsableInternet(caps);
        }
        android.net.NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private boolean currentExpensive() {
        ConnectivityManager cm = connectivityManager();
        if (cm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            if (caps == null) return false;
            return !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                && !caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
        }
        return false;
    }

    private static boolean hasUsableInternet(@Nullable NetworkCapabilities caps) {
        if (caps == null) return false;
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && (Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
    }

    private void emitReachability(boolean connected) {
        if (connected == lastConnected) return;
        lastConnected = connected;
        JSObject event = new JSObject();
        event.put("connected", connected);
        event.put("expensive", currentExpensive());
        notifyListeners("reachabilityChange", event);
    }

    private static String stripFileScheme(String path) {
        if (path.startsWith("file://")) {
            return path.substring("file://".length());
        }
        return path;
    }

    private static void copyFile(File source, File dest) throws IOException {
        if (dest.exists() && !dest.delete()) {
            throw new IOException("Could not replace outbox file");
        }
        try (FileInputStream in = new FileInputStream(source);
             FileOutputStream out = new FileOutputStream(dest)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
        }
    }

    private static void skipFully(InputStream in, long offset) throws IOException {
        long skipped = 0;
        while (skipped < offset) {
            long n = in.skip(offset - skipped);
            if (n <= 0) {
                if (in.read() < 0) throw new IOException("Could not skip to file offset");
                n = 1;
            }
            skipped += n;
        }
    }
}
