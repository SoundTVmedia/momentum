import Capacitor
import WebKit

/// Lets a playing YouTube embed enter picture-in-picture the same way a clip does:
/// `webkitSetPresentationMode('picture-in-picture')` on its video, during the tap.
class MomentumBridgeViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        return config
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.pictureInPictureScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            )
        )
        return super.webView(with: frame, configuration: configuration)
    }

    private static let pictureInPictureScript = """
    (function () {
      if (window.__momentumPipListener) return;
      window.__momentumPipListener = true;
      function findVideo(root) {
        if (!root || !root.querySelector) return null;
        var video = root.querySelector('video');
        if (video) return video;
        var nodes = root.querySelectorAll('*');
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].shadowRoot) {
            var nested = findVideo(nodes[i].shadowRoot);
            if (nested) return nested;
          }
        }
        return null;
      }
      window.addEventListener('message', function (event) {
        if (event.data !== 'momentum-enter-pip') return;
        var video = findVideo(document);
        var ok = false;
        if (video) {
          try { video.disablePictureInPicture = false; } catch (e) {}
          try { if (video.paused) video.play(); } catch (e) {}
          try {
            if (typeof video.webkitSetPresentationMode === 'function') {
              video.webkitSetPresentationMode('picture-in-picture');
              ok = video.webkitPresentationMode === 'picture-in-picture';
            }
          } catch (e) {}
          if (!ok && typeof video.requestPictureInPicture === 'function') {
            video.requestPictureInPicture().catch(function () {});
            ok = true;
          }
        }
        try {
          parent.postMessage({ type: 'momentum-pip-result', ok: ok }, '*');
        } catch (e) {}
      });
    })();
    """
}
