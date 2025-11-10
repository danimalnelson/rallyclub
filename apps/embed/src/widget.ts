// Wine Club Widget - Embeddable Join Button
(function () {
  // Get script element and read data attributes
  const scripts = document.getElementsByTagName("script");
  const currentScript = scripts[scripts.length - 1];
  const businessSlug = currentScript.getAttribute("data-business");

  if (!businessSlug) {
    console.error("Wine Club Widget: data-business attribute is required");
    return;
  }

  // Get origin from script src or use default
  const scriptSrc = currentScript.src;
  const origin = scriptSrc
    ? new URL(scriptSrc).origin
    : window.location.origin;

  // Create widget container
  function createWidget() {
    const widgetId = "wine-club-widget";
    let container = document.getElementById(widgetId);

    if (!container) {
      // Find the script tag and insert widget after it
      container = document.createElement("div");
      container.id = widgetId;
      currentScript.parentNode?.insertBefore(container, currentScript.nextSibling);
    }

    // Create button
    const button = document.createElement("button");
    button.textContent = "Join Wine Club";
    button.style.cssText = `
      background-color: #8b5cf6;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    `;

    button.onmouseover = () => {
      button.style.backgroundColor = "#7c3aed";
    };
    button.onmouseout = () => {
      button.style.backgroundColor = "#8b5cf6";
    };

    button.onclick = () => {
      openModal();
    };

    container.appendChild(button);
  }

  // Create modal with iframe
  function openModal() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "wine-club-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal container
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: relative;
      width: 90%;
      max-width: 900px;
      height: 80vh;
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      display: flex;
      flex-direction: column;
    `;

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 32px;
      cursor: pointer;
      color: #666;
      z-index: 10000;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    `;

    closeButton.onmouseover = () => {
      closeButton.style.backgroundColor = "#f3f4f6";
    };
    closeButton.onmouseout = () => {
      closeButton.style.backgroundColor = "transparent";
    };

    closeButton.onclick = () => {
      closeModal();
    };

    // Create iframe
    const iframe = document.createElement("iframe");
    iframe.src = `${origin}/${businessSlug}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 12px;
    `;

    modal.appendChild(closeButton);
    modal.appendChild(iframe);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    };

    document.body.appendChild(overlay);

    // Prevent body scroll
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const overlay = document.getElementById("wine-club-overlay");
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = "";
    }
  }

  // Initialize widget when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();

