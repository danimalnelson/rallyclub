/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/widget.ts":
/*!***********************!*\
  !*** ./src/widget.ts ***!
  \***********************/
/***/ (() => {

eval("{\n// Wine Club Widget - Embeddable Join Button\n(function () {\n    // Get script element and read data attributes\n    const scripts = document.getElementsByTagName(\"script\");\n    const currentScript = scripts[scripts.length - 1];\n    const businessSlug = currentScript.getAttribute(\"data-business\");\n    if (!businessSlug) {\n        console.error(\"Wine Club Widget: data-business attribute is required\");\n        return;\n    }\n    // Get origin from script src or use default\n    const scriptSrc = currentScript.src;\n    const origin = scriptSrc\n        ? new URL(scriptSrc).origin\n        : window.location.origin;\n    // Create widget container\n    function createWidget() {\n        var _a;\n        const widgetId = \"wine-club-widget\";\n        let container = document.getElementById(widgetId);\n        if (!container) {\n            // Find the script tag and insert widget after it\n            container = document.createElement(\"div\");\n            container.id = widgetId;\n            (_a = currentScript.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(container, currentScript.nextSibling);\n        }\n        // Create button\n        const button = document.createElement(\"button\");\n        button.textContent = \"Join Wine Club\";\n        button.style.cssText = `\n      background-color: #8b5cf6;\n      color: white;\n      padding: 12px 24px;\n      border: none;\n      border-radius: 8px;\n      font-size: 16px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: background-color 0.2s;\n    `;\n        button.onmouseover = () => {\n            button.style.backgroundColor = \"#7c3aed\";\n        };\n        button.onmouseout = () => {\n            button.style.backgroundColor = \"#8b5cf6\";\n        };\n        button.onclick = () => {\n            openModal();\n        };\n        container.appendChild(button);\n    }\n    // Create modal with iframe\n    function openModal() {\n        // Create overlay\n        const overlay = document.createElement(\"div\");\n        overlay.id = \"wine-club-overlay\";\n        overlay.style.cssText = `\n      position: fixed;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      background-color: rgba(0, 0, 0, 0.5);\n      z-index: 9998;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    `;\n        // Create modal container\n        const modal = document.createElement(\"div\");\n        modal.style.cssText = `\n      position: relative;\n      width: 90%;\n      max-width: 900px;\n      height: 80vh;\n      background-color: white;\n      border-radius: 12px;\n      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);\n      z-index: 9999;\n      display: flex;\n      flex-direction: column;\n    `;\n        // Create close button\n        const closeButton = document.createElement(\"button\");\n        closeButton.textContent = \"×\";\n        closeButton.style.cssText = `\n      position: absolute;\n      top: 16px;\n      right: 16px;\n      background: none;\n      border: none;\n      font-size: 32px;\n      cursor: pointer;\n      color: #666;\n      z-index: 10000;\n      width: 40px;\n      height: 40px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      border-radius: 50%;\n      transition: background-color 0.2s;\n    `;\n        closeButton.onmouseover = () => {\n            closeButton.style.backgroundColor = \"#f3f4f6\";\n        };\n        closeButton.onmouseout = () => {\n            closeButton.style.backgroundColor = \"transparent\";\n        };\n        closeButton.onclick = () => {\n            closeModal();\n        };\n        // Create iframe\n        const iframe = document.createElement(\"iframe\");\n        iframe.src = `${origin}/${businessSlug}`;\n        iframe.style.cssText = `\n      width: 100%;\n      height: 100%;\n      border: none;\n      border-radius: 12px;\n    `;\n        modal.appendChild(closeButton);\n        modal.appendChild(iframe);\n        overlay.appendChild(modal);\n        // Close on overlay click\n        overlay.onclick = (e) => {\n            if (e.target === overlay) {\n                closeModal();\n            }\n        };\n        document.body.appendChild(overlay);\n        // Prevent body scroll\n        document.body.style.overflow = \"hidden\";\n    }\n    function closeModal() {\n        const overlay = document.getElementById(\"wine-club-overlay\");\n        if (overlay) {\n            overlay.remove();\n            document.body.style.overflow = \"\";\n        }\n    }\n    // Initialize widget when DOM is ready\n    if (document.readyState === \"loading\") {\n        document.addEventListener(\"DOMContentLoaded\", createWidget);\n    }\n    else {\n        createWidget();\n    }\n})();\n\n\n//# sourceURL=webpack://embed/./src/widget.ts?\n}");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/widget.ts"]();
/******/ 	
/******/ })()
;