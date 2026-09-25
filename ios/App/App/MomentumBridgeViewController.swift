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
      window.addEventListener('message', function (event) {
        if (event.data !== 'momentum-enter-pip') return;
        var video = document.querySelector('video');
        if (!video) return;
        try {
          if (video.paused) video.play();
        } catch (e) {}
        if (typeof video.webkitSetPresentationMode === 'function' &&
            (!video.webkitSupportsPresentationMode || video.webkitSupportsPresentationMode('picture-in-picture'))) {
          video.webkitSetPresentationMode('picture-in-picture');
          return;
        }
        if (typeof video.requestPictureInPicture === 'function') {
          video.requestPictureInPicture();
        }
      });
    })();
    """
}
