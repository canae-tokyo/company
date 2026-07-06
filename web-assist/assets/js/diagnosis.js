/**
 * diagnosis.js
 * 同意3点チェック→doPostへ送信→diagnosis_statusをポーリング→結果表示（Chart.js）
 * 重要：この画面からは診断処理を直接実行しない（非同期・時間主導トリガー側で処理される）
 */
(function () {
  var POLL_INTERVAL_MS = 10000;
  var form = document.getElementById("diagnosis-form");
  var errorEl = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");
  var urlParams = new URLSearchParams(window.location.search);
  var initialDiagnosisId = urlParams.get("diagnosis_id");
  var initialDealId = urlParams.get("deal_id") || sessionStorage.getItem("wa_deal_id");

  if (initialDiagnosisId) {
    showPendingView_();
    waGetJson({ action: "getDiagnosisById", diagnosis_id: initialDiagnosisId }).then(function (res) {
      if (!res.found || !res.diagnosis) {
        document.getElementById("pending-status").textContent = "診断結果が見つかりません。URLをご確認ください。";
        return;
      }
      if (res.deal_id) sessionStorage.setItem("wa_deal_id", res.deal_id);
      showResultView_(res.diagnosis, res.deal_id || "");
    }).catch(function () {
      document.getElementById("pending-status").textContent = "診断結果の読み込みに失敗しました。時間をおいて再度お試しください。";
    });
  } else if (initialDealId) {
    showPendingView_();
    startPolling_(initialDealId);
  }

  submitBtn.addEventListener("click", function () {
    if (!submitBtn.disabled) {
      submitBtn.textContent = "送信中…";
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.classList.remove("visible");

    var payload = {
      target_url: document.getElementById("target_url").value.trim(),
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      consent_terms: document.getElementById("consent_terms").checked,
      consent_email: document.getElementById("consent_email").checked,
      consent_diagnosis_disclaimer: document.getElementById("consent_diagnosis_disclaimer").checked,
      source: "LP"
    };

    if (!payload.consent_terms || !payload.consent_email || !payload.consent_diagnosis_disclaimer) {
      submitBtn.textContent = "無料でAI診断する";
      showError_("利用規約・メール配信・AI簡易診断への同意は、すべて必須です。");
      return;
    }
    if (!payload.target_url || !payload.name || !payload.email) {
      submitBtn.textContent = "無料でAI診断する";
      showError_("URL・お名前・メールアドレスは必須です。");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "送信中…";

    waPostJson(payload).then(function (res) {
      if (!res.success) {
        showError_(res.message || "送信に失敗しました。時間をおいて再度お試しください。");
        submitBtn.disabled = false;
        submitBtn.textContent = "無料でAI診断する";
        return;
      }
      sessionStorage.setItem("wa_deal_id", res.deal_id);
      showPendingView_();
      startPolling_(res.deal_id);
    }).catch(function (err) {
      showError_(err.message || "通信エラーが発生しました。時間をおいて再度お試しください。");
      submitBtn.disabled = false;
      submitBtn.textContent = "無料でAI診断する";
    });
  });

  function showError_(message) {
    errorEl.textContent = message;
    errorEl.classList.add("visible");
  }

  function showPendingView_() {
    document.getElementById("form-view").style.display = "none";
    document.getElementById("pending-view").style.display = "block";
  }

  function startPolling_(dealId) {
    var statusEl = document.getElementById("pending-status");
    var poll = function () {
      waGetJson({ action: "getDiagnosisStatus", deal_id: dealId }).then(function (res) {
        if (!res.found) {
          statusEl.textContent = "診断情報が見つかりません。時間をおいて再度お試しください。";
          return;
        }
        if (res.diagnosis_status === "COMPLETED") {
          showResultView_(res.diagnosis, dealId);
        } else if (res.diagnosis_status === "FAILED") {
          document.getElementById("pending-view").style.display = "none";
          document.getElementById("failed-view").style.display = "block";
        } else {
          statusEl.textContent = "診断処理中です…（" + res.diagnosis_status + "）";
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      }).catch(function () {
        setTimeout(poll, POLL_INTERVAL_MS);
      });
    };
    poll();
  }

  function showResultView_(diagnosis, dealId) {
    document.getElementById("pending-view").style.display = "none";
    document.getElementById("form-view").style.display = "none";
    document.getElementById("result-view").style.display = "block";
    var estimateUrl = "../estimate/?diagnosis_id=" + encodeURIComponent(diagnosis.diagnosis_id);
    if (dealId) estimateUrl += "&deal_id=" + encodeURIComponent(dealId);
    document.getElementById("to-estimate-btn").href = estimateUrl;

    // 10項目診断（すべて実データに対応。旧「更新性」は未実装のため「アクセス解析」に置き換えて10軸を実データで統一）
    var labels = ["表示速度", "SEO", "スマホ対応", "SSL", "CTA", "UI/UX", "コンテンツ量", "LINE導線", "Google導線", "アクセス解析"];
    var values = [
      diagnosis.pagespeed_score,
      diagnosis.seo_score,
      diagnosis.mobile_friendly ? 100 : 0,
      diagnosis.ssl_valid ? 100 : 0,
      diagnosis.ai_cta_score,
      diagnosis.ai_ui_score,
      diagnosis.ai_content_score,
      diagnosis.line_found ? 100 : 0,
      diagnosis.gbp_found ? 100 : 0,
      diagnosis.ga_found ? 100 : 0
    ].map(function (v) { return v === null || v === undefined || v === "" ? 0 : Number(v); });

    // eslint-disable-next-line no-undef
    new Chart(document.getElementById("radar-chart"), {
      type: "radar",
      data: {
        labels: labels,
        datasets: [{
          label: "診断スコア",
          data: values,
          backgroundColor: "rgba(14,143,122,0.2)",
          borderColor: "#0E8F7A",
          pointBackgroundColor: "#0E8F7A"
        }]
      },
      options: {
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
        plugins: { legend: { display: false } }
      }
    });

    waGetJson({ action: "getRecommendedModules", diagnosis_id: diagnosis.diagnosis_id })
      .then(function (res) {
        sessionStorage.setItem("wa_recommended_modules", JSON.stringify(res.module_ids || []));
        sessionStorage.setItem("wa_diagnosis_id", diagnosis.diagnosis_id);
        if (dealId) sessionStorage.setItem("wa_deal_id", dealId);
        renderRecommendations_(res.module_ids || []);
      });
  }

  function renderRecommendations_(moduleIds) {
    var el = document.getElementById("recommend-list");
    if (moduleIds.length === 0) {
      el.innerHTML = "<p class=\"small\">現時点で特筆すべき改善提案はありません。</p>";
      return;
    }
    waGetJson({ action: "getModules" }).then(function (modules) {
      var byId = {};
      modules.forEach(function (m) { byId[m.module_id] = m; });
      var html = "<h3>おすすめの改善ポイント</h3><ul class=\"issue-list\">";
      moduleIds.forEach(function (id) {
        if (byId[id]) html += "<li>" + byId[id].name + "</li>";
      });
      html += "</ul>";
      el.innerHTML = html;
    });
  }
})();
