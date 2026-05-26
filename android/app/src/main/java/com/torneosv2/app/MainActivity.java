package com.torneosv2.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
            webView.addJavascriptInterface(new AndroidDownloader(), "AndroidDownloader");
            webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                iniciarDescarga(url, userAgent, contentDisposition, mimeType);
            });
        }
    }

    private void iniciarDescarga(String url, String userAgent, String contentDisposition, String mimeType) {
        try {
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String cookies = CookieManager.getInstance().getCookie(url);

            request.setMimeType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/pdf");
            if (cookies != null) {
                request.addRequestHeader("Cookie", cookies);
            }
            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent);
            }
            request.setTitle(fileName);
            request.setDescription("Descargando documento");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.allowScanningByMediaScanner();
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);

            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager != null) {
                manager.enqueue(request);
                Toast.makeText(this, "Descarga iniciada", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception error) {
            Toast.makeText(this, "No se pudo iniciar la descarga", Toast.LENGTH_LONG).show();
        }
    }

    public class AndroidDownloader {
        @JavascriptInterface
        public void download(String url) {
            runOnUiThread(() -> iniciarDescarga(url, null, "attachment; filename=\"detalle-deuda.pdf\"", "application/pdf"));
        }

        @JavascriptInterface
        public void open(String url) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "No se pudo abrir el PDF", Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
