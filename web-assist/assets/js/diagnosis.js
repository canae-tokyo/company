/**
 * diagnosis.js
 * v1.2：同意3点チェック→doPost送信→diagnosis_statusポーリング→5軸結果表示
 * 診断処理自体は時間主導トリガー側で実行する。
 */
(function () {
  var POLL_INTERVAL_MS = 10000;
  var MAX_POLL_ATTEMPTS = 36;
  var form = document.getElementById("diagnosis-form");
  var errorEl = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");
  var attribution = getAttributionFromUrl_();
  var currentDiagnosis = null;
  var currentDealId = null;

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.classList.remove("visible");

    var payload = {
      target_url: getValue_("target_url"),
      name: getValue_("name"),
      email: getValue_("email"),
      phone: getValue_("phone"),
      business_type: getValue_("business_type"),
      has_ecommerce: getValue_("has_ecommerce"),
      needs_update_content: getValue_("needs_update_content"),
      needs_google_map: getValue_("needs_google_map"),
      needs_contact_form: getValue_("needs_contact_form"),
      consent_terms: document.getElementById("consent_terms").checked,
      consent_email: document.getElementById("consent_email").checked,
      consent_diagnosis_disclaimer: document.getElementById("consent_diagnosis_disclaimer").checked,
      source: "LP",
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content
    };

    if (!payload.consent_terms || !payload.consent_email || !payload.consent_diagnosis_disclaimer) {
      showError_("利用規約・メール配信・AI簡易診断への同意は、すべて必須です。");
      return;
    }
    if (!payload.target_url || !payload.name || !payload.email) {
      showError_("URL・お名前・メールアドレスは必須です。");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "送信中...";

    waPostJson(payload).then(function (res) {
      if (!res.success) {
        showError_(res.message || "送信に失敗しました。時間をおいて再度お試しください。");
        resetSubmit_();
        return;
      }
      currentDealId = res.deal_id;
      sessionStorage.setItem("wa_deal_id", res.deal_id);
      showPendingView_();
      startPolling_(res.deal_id);
    }).catch(function (err) {
      showError_(err.message || "通信エラーが発生しました。時間をおいて再度お試しください。");
      resetSubmit_();
    });
  });

  var estimateBtn = document.getElementById("to-estimate-btn");
  if (estimateBtn) {
    estimateBtn.addEventListener("click", function () {
      if (!currentDiagnosis || !currentDealId) return;
      var route = currentDiagnosis.final_route || currentDiagnosis.auto_route || "";
      waPostJson({
        action: "recordDiagnosisCtaClick",
        deal_id: currentDealId,
        diagnosis_id: currentDiagnosis.diagnosis_id,
        route_at_click: route,
        cta_type: route
      }).catch(function () {});
    });
  }

  function getValue_(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function resetSubmit_() {
    submitBtn.disabled = false;
    submitBtn.textContent = "無料Web診断を申し込む";
  }

  function showError_(message) {
    errorEl.textContent = message;
    errorEl.classList.add("visible");
  }

  function getAttributionFromUrl_() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || ""
    };
  }

  function hideAllViews_() {
    ["form-view", "pending-view", "manual-review-view", "result-view", "failed-view"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  function showPendingView_() {
    hideAllViews_();
    document.getElementById("pending-view").style.display = "block";
    setPendingSpinnerVisible_(true);
  }

  function startPolling_(dealId) {
    var statusEl = document.getElementById("pending-status");
    var attempts = 0;
    var poll = function () {
      attempts += 1;
      waGetJson({ action: "getDiagnosisStatus", deal_id: dealId }).then(function (res) {
        if (!res.found) {
          statusEl.textContent = "診断情報が見つかりません。時間をおいて再度お試しください。";
          setPendingSpinnerVisible_(false);
          return;
        }
        if (res.diagnosis_status === "COMPLETED") {
          currentDiagnosis = res.diagnosis;
          showResultView_(res.diagnosis, res.item_results || []);
          return;
        }
        if (res.diagnosis_status === "MANUAL_REVIEW") {
          showManualReviewView_(res.diagnosis);
          return;
        }
        if (res.diagnosis_status === "FAILED") {
          hideAllViews_();
          document.getElementById("failed-view").style.display = "block";
          return;
        }
        var label = res.diagnosis_status === "RETRY_PENDING"
          ? "一時エラーのため再試行待ちです。"
          : "診断処理中です。";
        statusEl.textContent = label + "（" + res.diagnosis_status + "）";
        if (attempts >= MAX_POLL_ATTEMPTS) {
          statusEl.textContent = "診断処理に時間がかかっています。ページを再読み込みするか、後ほどメールをご確認ください。";
          setPendingSpinnerVisible_(false);
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      }).catch(function () {
        if (attempts >= MAX_POLL_ATTEMPTS) {
          statusEl.textContent = "診断状況を確認できませんでした。通信状況をご確認のうえ、ページを再読み込みしてください。";
          setPendingSpinnerVisible_(false);
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      });
    };
    poll();
  }

  function setPendingSpinnerVisible_(visible) {
    var spinner = document.querySelector("#pending-view .spinner");
    if (spinner) spinner.style.display = visible ? "" : "none";
  }

  function showManualReviewView_(diagnosis) {
    hideAllViews_();
    var summary = document.getElementById("manual-review-summary");
    if (summary && diagnosis && diagnosis.auto_route) {
      summary.textContent = "参考分類: " + routeLabel_(diagnosis.auto_route) + "。最終分類はスタッフ確認後に確定します。";
    }
    document.getElementById("manual-review-view").style.display = "block";
  }

  function showResultView_(diagnosis, itemResults) {
    hideAllViews_();
    document.getElementById("result-view").style.display = "block";
    currentDiagnosis = diagnosis || {};

    var route = currentDiagnosis.final_route || currentDiagnosis.auto_route || "";
    document.getElementById("route-label").textContent = route ? routeLabel_(route) : "判定未確定";
    document.getElementById("total-score").textContent = currentDiagnosis.total_score !== undefined && currentDiagnosis.total_score !== ""
      ? currentDiagnosis.total_score + "点"
      : "--";

    var labels = ["運用・安全性", "スマホ・表示品質", "集客・導線", "信頼性", "情報の鮮度"];
    var values = getAxisValues_(currentDiagnosis);
    // eslint-disable-next-line no-undef
    new Chart(document.getElementById("radar-chart"), {
      type: "radar",
      data: {
        labels: labels,
        datasets: [{
          label: "5軸スコア",
          data: values,
          backgroundColor: "rgba(180,166,150,0.22)",
          borderColor: "#7B6958",
          pointBackgroundColor: "#C9AA72"
        }]
      },
      options: {
        scales: { r: { min: 0, max: 20, ticks: { stepSize: 5 } } },
        plugins: { legend: { display: false } }
      }
    });

    renderNotices_(currentDiagnosis);
    renderItemResults_(currentDiagnosis, itemResults || []);
    sessionStorage.setItem("wa_diagnosis_id", currentDiagnosis.diagnosis_id || "");
    sessionStorage.setItem("wa_route", route);

    waGetJson({ action: "getRecommendedModules", diagnosis_id: currentDiagnosis.diagnosis_id })
      .then(function (res) {
        sessionStorage.setItem("wa_recommended_modules", JSON.stringify(res.module_ids || []));
        renderRecommendations_(res.module_ids || []);
      }).catch(function () {
        renderRecommendations_([]);
      });
  }

  function getAxisValues_(diagnosis) {
    if (diagnosis && diagnosis.operations_security_score !== undefined && diagnosis.operations_security_score !== "") {
      return [
        numberOrZero_(diagnosis.operations_security_score),
        numberOrZero_(diagnosis.mobile_display_score),
        numberOrZero_(diagnosis.acquisition_path_score),
        numberOrZero_(diagnosis.trust_score),
        numberOrZero_(diagnosis.freshness_score)
      ];
    }
    return [
      numberOrZero_(diagnosis.ssl_valid ? 100 : 0) / 5,
      (numberOrZero_(diagnosis.pagespeed_score) + (diagnosis.mobile_friendly ? 100 : 0)) / 10,
      (numberOrZero_(diagnosis.seo_score) + numberOrZero_(diagnosis.ai_cta_score)) / 10,
      numberOrZero_(diagnosis.ai_ui_score) / 5,
      numberOrZero_(diagnosis.ai_content_score) / 5
    ];
  }

  function renderNotices_(diagnosis) {
    var el = document.getElementById("diagnosis-notices");
    var notices = [];
    String(diagnosis.unmeasurable_axes || "").split(",").filter(Boolean).forEach(function (axis) {
      notices.push("測定できなかった軸: " + axisLabel_(axis));
    });
    String(diagnosis.diagnostic_notice_codes || "").split(",").filter(Boolean).forEach(function (code) {
      if (code === "FORM_RESULT_UNVERIFIED") notices.push("フォームは実送信を伴わず、設置・導線のみ確認しています。");
    });
    if (notices.length === 0) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = "<div class=\"notice-list\">" + notices.map(function (notice) {
      return "<div class=\"notice-chip\">" + escapeHtml_(notice) + "</div>";
    }).join("") + "</div>";
  }

  function renderItemResults_(diagnosis, itemResults) {
    var el = document.getElementById("item-result-list");
    if (!itemResults.length) {
      el.innerHTML = "<h3>5軸スコア</h3><div class=\"axis-list\">" + [
        ["運用・安全性", diagnosis.operations_security_score],
        ["スマホ・表示品質", diagnosis.mobile_display_score],
        ["集客・導線", diagnosis.acquisition_path_score],
        ["信頼性", diagnosis.trust_score],
        ["情報の鮮度", diagnosis.freshness_score]
      ].map(function (row) {
        return "<div class=\"axis-row\"><span>" + row[0] + "</span><span>" + valueOrDash_(row[1]) + "</span></div>";
      }).join("") + "</div>";
      return;
    }
    var statusCount = itemResults.reduce(function (acc, item) {
      acc[item.measurement_status] = (acc[item.measurement_status] || 0) + 1;
      return acc;
    }, {});
    el.innerHTML = [
      "<h3>項目別の測定状況</h3>",
      "<div class=\"axis-list\">",
      statusRow_("測定済み", statusCount.MEASURED),
      statusRow_("測定できませんでした", statusCount.UNMEASURABLE),
      statusRow_("対象外", statusCount.NOT_APPLICABLE),
      statusRow_("スタッフ確認", statusCount.REVIEW_REQUIRED),
      "</div>"
    ].join("");
  }

  function statusRow_(label, value) {
    return "<div class=\"axis-row\"><span>" + label + "</span><span>" + Number(value || 0) + "件</span></div>";
  }

  function renderRecommendations_(moduleIds) {
    var el = document.getElementById("recommend-list");
    if (moduleIds.length === 0) {
      el.innerHTML = "<h3>次のアクション</h3><p class=\"small\">診断分類に基づき、制作・改善・Monitor継続のいずれが適切かを確認します。</p>";
      return;
    }
    waGetJson({ action: "getModules" }).then(function (modules) {
      var byId = {};
      modules.forEach(function (m) { byId[m.module_id] = m; });
      var html = "<h3>おすすめの改善ポイント</h3><ul class=\"issue-list\">";
      moduleIds.forEach(function (id) {
        if (byId[id]) html += "<li>" + escapeHtml_(byId[id].name) + "</li>";
      });
      html += "</ul>";
      el.innerHTML = html;
    });
  }

  function routeLabel_(route) {
    return {
      BUILD: "要再構築",
      RENEWAL: "改善優先",
      IMPROVEMENT: "部分改善",
      MONITOR: "良好"
    }[route] || route;
  }

  function axisLabel_(axis) {
    return {
      OPERATIONS_SECURITY: "運用・安全性",
      MOBILE_DISPLAY: "スマホ・表示品質",
      ACQUISITION_PATH: "集客・導線",
      TRUST: "信頼性",
      FRESHNESS: "情報の鮮度"
    }[axis] || axis;
  }

  function numberOrZero_(value) {
    var num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  function valueOrDash_(value) {
    return value === undefined || value === null || value === "" ? "--" : value + "/20";
  }

  function escapeHtml_(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char];
    });
  }
})();
