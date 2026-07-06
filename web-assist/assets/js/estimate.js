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
  var allPlanModules = [];
  var moduleById = {};
  var isReady = false;
  var latestEstimate = null;

  var PLAN_COPY = {
    "PLAN-STARTER": {
      target: "まず1ページで公開したい方向け",
      detail: "基本1ページ、問い合わせフォーム、SSL、SNS/Googleマップ導線"
    },
    "PLAN-BIZ-LIGHT": {
      target: "最低限の集客導線を整えたい方向け",
      detail: "Starter内容に加え、ロゴ、Googleビジネスプロフィール、LINE、SEO初期設定"
    },
    "PLAN-BIZ-STD": {
      target: "Web・Google・LINEをまとめて改善したい方向け",
      detail: "Light内容に加え、画像、会社/サービス文、SEO meta/構造化、GA4/GSC、口コミ導線、LINEメニュー"
    },
    "PLAN-BIZ-PREM": {
      target: "複数ページ・AI機能まで含めて強化したい方向け",
      detail: "Standard内容に加え、ページ追加、AIチャットボット、実績/事例/FAQ、SEO記事、LINE拡張、アニメーション"
    }
  };

  if (dealId) sessionStorage.setItem("wa_deal_id", dealId);
  if (diagnosisId) sessionStorage.setItem("wa_diagnosis_id", diagnosisId);

  var recommendedRequest = diagnosisId
    ? waGetJson({ action: "getRecommendedModules", diagnosis_id: diagnosisId }).catch(function () { return { module_ids: recommendedIds }; })
    : Promise.resolve({ module_ids: recommendedIds });

  Promise.all([
    waGetJson({ action: "getPlans" }),
    waGetJson({ action: "getModules" }),
    waGetJson({ action: "getPublicSettings" }),
    recommendedRequest,
    waGetJson({ action: "getPlanModules" })
  ]).then(function (results) {
    allPlans = results[0].filter(function (p) { return p.category === "ONE_TIME"; });
    allModules = results[1];
    allModules.forEach(function (m) { moduleById[m.module_id] = m; });
    recommendedIds = results[3].module_ids || [];
    allPlanModules = results[4] || [];
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
      var copy = PLAN_COPY[plan.plan_id] || { target: "個別要件に合わせた構成", detail: "詳細は無料相談で確認します" };
      var includedNames = getIncludedVisibleModuleNames_(plan.plan_id).slice(0, 4);
      var card = document.createElement("div");
      card.className = "card plan-card";
      card.innerHTML =
        "<h3>" + plan.name + "</h3>" +
        "<div class=\"plan-price\">" + waFormatYen(plan.price) + "</div>" +
        "<p class=\"plan-note\">" + copy.target + "</p>" +
        "<p class=\"plan-detail\">" + copy.detail + "</p>" +
        (includedNames.length ? "<ul class=\"plan-includes\">" + includedNames.map(function (name) { return "<li>" + name + "</li>"; }).join("") + "</ul>" : "") +
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
    saveEstimate_();
  });

  function recalculateEstimate_() {
    if (!isReady) return;
    var errorEl = document.getElementById("estimate-error");
    errorEl.textContent = "";
    latestEstimate = calculateLocalEstimate_();
    document.getElementById("total-price").textContent = waFormatYen(latestEstimate.total_price);
    document.getElementById("reserve-btn").style.display = "block";
    renderRecommendPlanNote_(latestEstimate.recommended_plan);
  }

  function calculateLocalEstimate_() {
    var plan = selectedPlanId ? allPlans.filter(function (p) { return p.plan_id === selectedPlanId; })[0] : null;
    var includedQty = {};
    if (plan) {
      allPlanModules.filter(function (pm) { return pm.plan_id === plan.plan_id; })
        .forEach(function (pm) { includedQty[pm.module_id] = Number(pm.quantity || 1); });
    }

    var lineItems = [];
    var moduleTotal = 0;
    Object.keys(moduleQuantities).forEach(function (moduleId) {
      var mod = moduleById[moduleId];
      if (!mod) return;
      var qty = Number(moduleQuantities[moduleId] || 1);
      var chargeableQty = Math.max(0, qty - Number(includedQty[moduleId] || 0));
      var lineTotal = chargeableQty * Number(mod.price || 0);
      moduleTotal += lineTotal;
      lineItems.push({ module_id: moduleId, name: mod.name, line_total: lineTotal });
    });

    var totalPrice = Number(plan ? plan.price : 0) + moduleTotal;
    return {
      plan: plan || null,
      line_items: lineItems,
      total_price: totalPrice,
      recommended_plan: plan ? null : findRecommendedPlan_(Object.keys(moduleQuantities), totalPrice)
    };
  }

  function findRecommendedPlan_(moduleIds, itemTotal) {
    if (!moduleIds.length || itemTotal <= 0) return null;
    var candidates = allPlans.filter(function (plan) {
      var includedIds = allPlanModules.filter(function (pm) { return pm.plan_id === plan.plan_id; })
        .map(function (pm) { return pm.module_id; });
      return Number(plan.price || 0) < itemTotal && moduleIds.every(function (id) { return includedIds.indexOf(id) !== -1; });
    });
    candidates.sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); });
    return candidates[0] || null;
  }

  function renderRecommendPlanNote_(plan) {
    var note = document.getElementById("recommend-plan-note");
    if (plan) {
      note.style.display = "block";
      note.textContent = plan.name + "（" + waFormatYen(plan.price) + "）に切り替えると、単品合計より費用を抑えられます。";
    } else {
      note.style.display = "none";
    }
  }

  function saveEstimate_() {
    if (!isReady) return;
    var errorEl = document.getElementById("estimate-error");
    var btn = document.getElementById("recalculate-btn");
    errorEl.textContent = "";
    if (!dealId) {
      errorEl.textContent = "診断情報が見つかりません。無料診断からやり直してください。";
      return;
    }
    btn.disabled = true;
    btn.textContent = "保存中…";
    var selectedModules = Object.keys(moduleQuantities).map(function (id) {
      return { module_id: id, quantity: moduleQuantities[id] };
    });

    waPostJson({ action: "calculateEstimate", deal_id: dealId, plan_id: selectedPlanId, selected_modules: selectedModules })
      .then(function (res) {
        if (!res.success) {
          errorEl.textContent = res.message || "見積の保存に失敗しました。";
          return;
        }
        document.getElementById("total-price").textContent = waFormatYen(res.estimate.total_price);
        renderRecommendPlanNote_(res.estimate.recommended_plan);
        document.getElementById("reserve-btn").style.display = "block";
      })
      .catch(function () { errorEl.textContent = "通信エラーが発生しました。"; })
      .then(function () {
        btn.disabled = false;
        btn.textContent = "この内容で見積る";
      });
  }

  function getIncludedVisibleModuleNames_(planId) {
    return allPlanModules.filter(function (pm) { return pm.plan_id === planId; })
      .map(function (pm) { return moduleById[pm.module_id]; })
      .filter(function (m) { return m && m.visible_on_estimator; })
      .map(function (m) { return m.name; });
  }

  function setupReserveLink_(timerexUrl) {
    var link = document.getElementById("reserve-btn");
    link.href = timerexUrl || "../thanks/"; // TimeRex URL未設定時はサンクスページへ暫定リンク
  }
})();
