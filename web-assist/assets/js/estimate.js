/**
 * estimate.js
 * Plan/Module選択 → calculateEstimate呼出 → 合計金額・おすすめプラン表示 → TimeRex予約導線
 */
(function () {
  var urlParams = new URLSearchParams(window.location.search);
  var dealId = urlParams.get("deal_id") || sessionStorage.getItem("wa_deal_id");
  var diagnosisId = urlParams.get("diagnosis_id") || sessionStorage.getItem("wa_diagnosis_id");
  var recommendedIds = JSON.parse(sessionStorage.getItem("wa_recommended_modules") || "[]");
  var selectedPlanId = null;
  var moduleQuantities = {}; // module_id -> quantity（チェックされているものだけ保持）
  var allModules = [];
  var allPlans = [];
  var isReady = false;

  if (dealId) sessionStorage.setItem("wa_deal_id", dealId);
  if (diagnosisId) sessionStorage.setItem("wa_diagnosis_id", diagnosisId);

  var recommendedRequest = diagnosisId
    ? waGetJson({ action: "getRecommendedModules", diagnosis_id: diagnosisId }).catch(function () { return { module_ids: recommendedIds }; })
    : Promise.resolve({ module_ids: recommendedIds });

  Promise.all([
    waGetJson({ action: "getPlans" }),
    waGetJson({ action: "getModules" }),
    waGetJson({ action: "getPublicSettings" }),
    recommendedRequest
  ]).then(function (results) {
    allPlans = results[0].filter(function (p) { return p.category === "ONE_TIME"; });
    allModules = results[1];
    recommendedIds = results[3].module_ids || [];
    sessionStorage.setItem("wa_recommended_modules", JSON.stringify(recommendedIds));
    renderPlans_();
    renderModules_();
    setupReserveLink_(results[2].timerex_url);
    isReady = true;
    recalculateEstimate_();
  }).catch(function (err) {
    var errorEl = document.getElementById("estimate-error");
    errorEl.textContent = err.message || "見積データを読み込めませんでした。";
    document.getElementById("plan-list").innerHTML = "<div class=\"notice-box\">見積データの読み込みにはGAS Web App URLの設定が必要です。</div>";
    document.getElementById("module-list").innerHTML = "";
  });

  function renderPlans_() {
    var el = document.getElementById("plan-list");
    el.innerHTML = "";
    allPlans.forEach(function (plan) {
      var card = document.createElement("div");
      card.className = "card plan-card";
      card.innerHTML =
        "<h3>" + plan.name + "</h3>" +
        "<div class=\"plan-price\">" + waFormatYen(plan.price) + "</div>" +
        "<button class=\"btn btn-secondary btn-block plan-select-btn\" data-plan-id=\"" + plan.plan_id + "\">このプランを選ぶ</button>";
      el.appendChild(card);
    });
    el.querySelectorAll(".plan-select-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedPlanId = (selectedPlanId === btn.dataset.planId) ? null : btn.dataset.planId;
        el.querySelectorAll(".plan-select-btn").forEach(function (b) {
          var active = b.dataset.planId === selectedPlanId;
          b.textContent = active ? "選択中" : "このプランを選ぶ";
          b.className = "btn btn-block plan-select-btn " + (active ? "btn-primary" : "btn-secondary");
        });
        recalculateEstimate_();
      });
    });
  }

  function renderModules_() {
    var el = document.getElementById("module-list");
    el.innerHTML = "";
    var byCategory = {};
    allModules.filter(function (m) { return m.visible_on_estimator; }).forEach(function (m) {
      byCategory[m.category_id] = byCategory[m.category_id] || [];
      byCategory[m.category_id].push(m);
    });
    Object.keys(byCategory).forEach(function (categoryId) {
      var group = document.createElement("div");
      group.className = "card";
      var rowsHtml = byCategory[categoryId].map(function (m) {
        var isRecommended = recommendedIds.indexOf(m.module_id) !== -1;
        return (
          "<div class=\"module-row\">" +
            "<div>" +
              "<label class=\"checkbox-field\" style=\"padding:0;\">" +
                "<input type=\"checkbox\" class=\"module-checkbox\" data-module-id=\"" + m.module_id + "\">" +
                "<span class=\"module-name\">" + m.name + (isRecommended ? "<span class=\"recommended-tag\">おすすめ</span>" : "") + "</span>" +
              "</label>" +
            "</div>" +
            "<div class=\"module-price\">" + waFormatYen(m.price) + "</div>" +
          "</div>"
        );
      }).join("");
      group.innerHTML = "<h3>" + categoryId + "</h3>" + rowsHtml;
      el.appendChild(group);
    });

    el.querySelectorAll(".module-checkbox").forEach(function (cb) {
      if (recommendedIds.indexOf(cb.dataset.moduleId) !== -1) cb.checked = true;
      cb.addEventListener("change", function () {
        if (cb.checked) moduleQuantities[cb.dataset.moduleId] = 1;
        else delete moduleQuantities[cb.dataset.moduleId];
        recalculateEstimate_();
      });
      if (cb.checked) moduleQuantities[cb.dataset.moduleId] = 1;
    });
  }

  document.getElementById("recalculate-btn").addEventListener("click", function () {
    recalculateEstimate_();
  });

  function recalculateEstimate_() {
    if (!isReady) return;
    var errorEl = document.getElementById("estimate-error");
    errorEl.textContent = "";
    if (!dealId) {
      errorEl.textContent = "診断情報が見つかりません。無料診断からやり直してください。";
      return;
    }
    var selectedModules = Object.keys(moduleQuantities).map(function (id) {
      return { module_id: id, quantity: moduleQuantities[id] };
    });

    waPostJson({ action: "calculateEstimate", deal_id: dealId, plan_id: selectedPlanId, selected_modules: selectedModules })
      .then(function (res) {
        if (!res.success) {
          errorEl.textContent = res.message || "見積の計算に失敗しました。";
          return;
        }
        document.getElementById("total-price").textContent = waFormatYen(res.estimate.total_price);
        document.getElementById("reserve-btn").style.display = "block";

        var note = document.getElementById("recommend-plan-note");
        if (res.estimate.recommended_plan) {
          note.style.display = "block";
          note.textContent = res.estimate.recommended_plan.name + "（" + waFormatYen(res.estimate.recommended_plan.price) + "）に切り替えると、単品合計より費用を抑えられます。";
        } else {
          note.style.display = "none";
        }
      })
      .catch(function () { errorEl.textContent = "通信エラーが発生しました。"; });
  }

  function setupReserveLink_(timerexUrl) {
    var link = document.getElementById("reserve-btn");
    link.href = timerexUrl || "../thanks/"; // TimeRex URL未設定時はサンクスページへ暫定リンク
  }
})();
