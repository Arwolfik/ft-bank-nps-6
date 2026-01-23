(() => {
  const tg = window.Telegram?.WebApp;

  // TODO: подставишь invoke URL YC Function (БЕЗ /submit)
  const BACKEND_URL = "https://functions.yandexcloud.net/d4e1id3b0ckdmjkvt72j";

  const FORM_ID = "nps_2"; // поменяй при необходимости (например "nps_3")

  const form = document.getElementById("nps-form");
  const submitBtn = document.getElementById("submit-btn");
  const resultEl = document.getElementById("result");
  const globalErr = document.getElementById("error-global");

  function getTgUserId() {
    const id = tg?.initDataUnsafe?.user?.id;
    if (id) return String(id);
    // фолбэк для теста в браузере: ?tg_id=123
    const urlId = new URLSearchParams(location.search).get("tg_id");
    if (urlId) return String(urlId);
    return null;
  }

  function setGlobalError(msg) {
    globalErr.textContent = msg;
    globalErr.style.display = "block";
  }
  function clearGlobalError() {
    globalErr.textContent = "";
    globalErr.style.display = "none";
  }
  function showResult(msg) {
    resultEl.textContent = msg;
    resultEl.style.display = "block";
  }

  // Снимаем состояние "Не могу оценить" при выборе цифры
  function wireNAReset(scaleEl) {
    const name = scaleEl.dataset.name;
    const naBtn = scaleEl.querySelector(".scale-na");
    if (!naBtn) return;

    scaleEl.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach((inp) => {
      inp.addEventListener("change", () => {
        naBtn.classList.remove("active");
        naBtn.dataset.value = "";
      });
    });
  }

  function buildScale(scaleEl) {
    const name = scaleEl.dataset.name;
    const left = scaleEl.dataset.left || "1";
    const right = scaleEl.dataset.right || "10";
    const hasNA = scaleEl.dataset.na === "true";

    // 1..10
    for (let v = 1; v <= 10; v++) {
      const id = `${name}_${v}`;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = String(v);
      input.id = id;

      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = String(v);
      label.className = "scale-btn";

      scaleEl.appendChild(input);
      scaleEl.appendChild(label);
    }

    // подписи по краям (кастомные)
    const hint = document.createElement("div");
    hint.className = "scale-hint";
    hint.innerHTML = `<span>1 — ${left}</span><span>10 — ${right}</span>`;
    scaleEl.appendChild(hint);

    // "Не могу оценить"
    if (hasNA) {
      const naBtn = document.createElement("button");
      naBtn.type = "button";
      naBtn.className = "scale-na";
      naBtn.textContent = "Не могу оценить";
      naBtn.dataset.value = "";

      naBtn.addEventListener("click", () => {
        const isActive = naBtn.classList.toggle("active");
        naBtn.dataset.value = isActive ? "na" : "";

        // если активировали NA — снимаем выбранные цифры
        if (isActive) {
          scaleEl.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach((i) => {
            i.checked = false;
          });
        }
      });

      scaleEl.appendChild(naBtn);
    }

    wireNAReset(scaleEl);
  }

  // init UI
  try {
    tg?.ready();
    tg?.expand();
  } catch (_) {}

  // строим все шкалы, которые реально есть в HTML
  document.querySelectorAll(".scale").forEach(buildScale);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGlobalError();
    resultEl.style.display = "none";

    // сброс локальных ошибок
    document.querySelectorAll("[data-err]").forEach((p) => {
      p.textContent = "";
      p.style.display = "none";
    });

    const tgId = getTgUserId();
    if (!tgId) {
      setGlobalError("Не удалось определить tg-id. Откройте миниапп внутри Telegram.");
      return;
    }

    const answers = {};

    // required строим автоматически по HTML
    const required = Array.from(form.querySelectorAll(".scale[data-name]"))
      .map((el) => el.dataset.name);

    let ok = true;

    for (const q of required) {
      const picked = form.querySelector(`input[name="${q}"]:checked`);
      const scaleEl = form.querySelector(`.scale[data-name="${q}"]`);
      const naBtn = scaleEl?.querySelector(".scale-na");
      const naValue = naBtn?.dataset?.value || "";

      if (picked) {
        answers[q] = Number(picked.value);
      } else if (naValue === "na") {
        answers[q] = "na";
      } else {
        const p = form.querySelector(`[data-err="${q}"]`);
        if (p) {
          p.textContent = "Выберите оценку от 1 до 10";
          p.style.display = "block";
        }
        ok = false;
      }
    }

    if (!ok) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Отправляю…";

    try {
      const payload = {
        form_id: FORM_ID,
        tg_id: tgId,
        answers,
        tg_init_data: tg?.initData || ""
      };

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setGlobalError(data?.message || `Ошибка: ${res.status}`);
        return;
      }

      showResult(data?.message || "Спасибо! ✅");
      try {
        tg?.HapticFeedback?.notificationOccurred("success");
        setTimeout(() => tg?.close(), 900);
      } catch (_) {}
    } catch (err) {
      setGlobalError(err?.message || "Ошибка сети при отправке.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Отправить";
    }
  });
})();
