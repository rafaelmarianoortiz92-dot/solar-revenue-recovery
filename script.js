/* =====================================================
   CONFIGURAÇÃO — edite só este bloco
   1) SUPABASE_URL: Supabase > Project Settings > API > Project URL
   2) SUPABASE_ANON_KEY: mesma tela, chave "anon public"
      (NUNCA use a service_role aqui)
   3) TALLY_URL: opcional. Cole o link do seu formulário do Tally
      (tally.so > Share). Usado quando o Supabase não está configurado.
   4) WHATSAPP_NUMBER: opcional, só dígitos com DDI, ex.: 5547999999999.
      Ativa o botão "FALAR COM UM ESPECIALISTA".
   ===================================================== */
const CONFIG = {
  SUPABASE_URL: "SUPABASE_URL",
  SUPABASE_ANON_KEY: "SUPABASE_ANON_KEY",
  TABLE: "form_submissions",
  TALLY_URL: "",
  WHATSAPP_NUMBER: ""
};

const supabaseOk = /^https:\/\/.+\.supabase\.co/.test(CONFIG.SUPABASE_URL) && CONFIG.SUPABASE_ANON_KEY.length > 40;

/* ---------- WhatsApp do botão secundário ---------- */
if (/^\d{12,13}$/.test(CONFIG.WHATSAPP_NUMBER)) {
  document.querySelectorAll("[data-whatsapp]").forEach((a) => {
    a.href = "https://wa.me/" + CONFIG.WHATSAPP_NUMBER + "?text=" +
      encodeURIComponent("Olá! Quero conversar sobre o Revenue Recovery Sprint.");
    a.target = "_blank";
    a.rel = "noopener";
  });
}

/* ---------- Calculadora ---------- */
(function () {
  const g = (id) => document.getElementById(id);
  const props = g("c-props"), ticket = g("c-ticket"), rate = g("c-rate"), out = g("c-result");
  function calc() {
    const p = Math.max(0, parseFloat(props.value) || 0);
    const t = Math.max(0, parseFloat(ticket.value) || 0);
    const r = Math.min(100, Math.max(0, parseFloat(rate.value) || 0));
    out.textContent = (p * t * (r / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }
  [props, ticket, rate].forEach((el) => el.addEventListener("input", calc));
  calc();
})();

/* ---------- Formulário ---------- */
(function () {
  const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  const sel = document.getElementById("estado");
  UFS.forEach((u) => sel.add(new Option(u, u)));

  const form = document.getElementById("lead-form");
  const msg = document.getElementById("form-msg");
  const btn = document.getElementById("submit-btn");
  const params = new URLSearchParams(location.search);
  const LABEL = "ENVIAR DIAGNÓSTICO";

  const say = (html, ok) => {
    msg.innerHTML = html;
    msg.className = "sm:col-span-2 text-sm min-h-[1.5rem] " + (ok ? "text-vol" : "text-red-400");
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const phoneOk = (v) => {
    const d = v.replace(/\D/g, "");
    return d.length === 10 || d.length === 11 || ((d.length === 12 || d.length === 13) && d.startsWith("55"));
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    if (f.get("website")) return; // honeypot

    for (const el of form.querySelectorAll("[required]")) {
      const empty = el.type === "checkbox" ? !el.checked : !String(el.value).trim();
      if (empty) {
        el.focus();
        return say(el.type === "checkbox" ? "Marque a caixa de consentimento para enviar." : "Preencha todos os campos obrigatórios.", false);
      }
    }
    if (!phoneOk(f.get("whatsapp"))) return say("WhatsApp inválido. Informe DDD e número.", false);
    if (!/^\S+@\S+\.\S+$/.test(f.get("email"))) return say("E-mail inválido.", false);

    const n = (k) => Math.max(0, parseInt(f.get(k), 10) || 0);
    const payload = {
      nome: f.get("nome").trim(),
      empresa: f.get("empresa").trim(),
      whatsapp: f.get("whatsapp").replace(/\D/g, ""),
      email: f.get("email").trim().toLowerCase(),
      cidade_uf: f.get("cidade").trim() + " / " + f.get("estado"),
      crm: f.get("crm"),
      leads_aprox: n("leads_aprox"),
      propostas_aprox: n("propostas_aprox"),
      ticket_medio: n("ticket_medio"),
      problema: f.get("problema"),
      consent: true,
      consent_text: "Concordo em ser contatado sobre o diagnóstico solicitado.",
      source: params.get("utm_source") || document.referrer || "direto",
      utm_campaign: params.get("utm_campaign"),
      utm_medium: params.get("utm_medium")
    };

    // Fallback: Supabase não configurado
    if (!supabaseOk) {
      if (CONFIG.TALLY_URL) {
        return say('Para concluir, preencha o diagnóstico <a class="underline" href="' + esc(CONFIG.TALLY_URL) + '" target="_blank" rel="noopener">neste formulário</a>.', true);
      }
      return say("O formulário ainda não está configurado. Fale conosco pelo botão “Falar com um especialista”.", false);
    }

    btn.disabled = true;
    btn.textContent = "ENVIANDO...";
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + "/rest/v1/" + CONFIG.TABLE, {
        method: "POST",
        headers: Object.assign({
          "Content-Type": "application/json",
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Prefer: "return=minimal"
        }, CONFIG.SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + CONFIG.SUPABASE_ANON_KEY } : {}),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      say("Recebemos suas informações. Entraremos em contato para entender sua operação comercial.", true);
    } catch (err) {
      console.error("Falha no envio:", err);
      say("Não foi possível enviar agora. Tente novamente em instantes" +
        (CONFIG.TALLY_URL ? ' ou use <a class="underline" href="' + esc(CONFIG.TALLY_URL) + '" target="_blank" rel="noopener">este formulário</a>.' : "."), false);
    } finally {
      btn.disabled = false;
      btn.textContent = LABEL;
    }
  });
})();
