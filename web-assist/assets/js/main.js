/**
 * main.js — 全ページ共通
 * GAS Web AppのURLは、デプロイ後に必ず書き換えること。
 */
window.WEB_ASSIST_CONFIG = {
  // 例: "https://script.google.com/macros/s/AKfycb.../exec"
  apiBaseUrl: "https://script.google.com/macros/s/AKfycbxP3mpzNIi9QdFVpn2IQQu2il50p7WGmEujV-K1pq6tUJGD8ruyYAG8dxlIg9m6lZM/exec"
};

function waIsApiConfigured() {
  var url = window.WEB_ASSIST_CONFIG && window.WEB_ASSIST_CONFIG.apiBaseUrl;
  return !!url && /^https?:\/\//.test(url);
}

function waApiNotConfiguredError() {
  return new Error("GAS Web App URLが未設定です。assets/js/main.js の apiBaseUrl をデプロイ済みURLに設定してください。");
}

function waPostJson(payload) {
  if (!waIsApiConfigured()) return Promise.reject(waApiNotConfiguredError());
  return fetch(window.WEB_ASSIST_CONFIG.apiBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // GAS doPostのContent-Type制約回避
    body: JSON.stringify(payload)
  }).then(function (res) { return res.json(); });
}

function waGetJson(params) {
  if (!waIsApiConfigured()) return Promise.reject(waApiNotConfiguredError());
  var url = new URL(window.WEB_ASSIST_CONFIG.apiBaseUrl);
  Object.keys(params).forEach(function (key) { url.searchParams.set(key, params[key]); });
  return fetch(url.toString()).then(function (res) { return res.json(); });
}

function waFormatYen(amount) {
  return "¥" + Number(amount || 0).toLocaleString("ja-JP");
}

// モバイルナビ（必要になった時点で拡張。現状はCTAのみのため未使用）
document.addEventListener("DOMContentLoaded", function () {
  var year = document.querySelectorAll("[data-current-year]");
  year.forEach(function (el) { el.textContent = new Date().getFullYear(); });

  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.querySelector("#site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      siteNav.classList.toggle("is-open", !expanded);
    });

    siteNav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        navToggle.setAttribute("aria-expanded", "false");
        siteNav.classList.remove("is-open");
      }
    });
  }

  document.querySelectorAll("[data-wa-event]").forEach(function (el) {
    el.addEventListener("click", function () {
      var eventName = el.getAttribute("data-wa-event");
      if (eventName && typeof window.gtag === "function") {
        window.gtag("event", eventName, {
          event_category: "web_assist_lp",
          event_label: el.textContent.trim() || el.getAttribute("href") || eventName
        });
      }
    });
  });
});
